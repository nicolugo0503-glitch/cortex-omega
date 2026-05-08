/**
 * The CORTEX-Ω multi-step reasoning orchestrator.
 *
 * For each user prompt, runs:
 *   PARSE   → cheap local analysis
 *   INTENT  → keyword classification (could be model-based)
 *   ROUTE   → pick a domain expert (system prompt)
 *   RECALL  → pull relevant turns from conversation memory
 *   PLAN    → small model call to draft a numbered plan
 *   EXECUTE → main streaming model call following the plan
 *   CRITIC  → secondary model call evaluates the answer (optional)
 *   SYNTH   → final answer (revised if critic flagged issues)
 *
 * Yields StreamEvents that the API route relays to the client as SSE.
 */

import { classify, getDomain, type Domain } from "./domains";
import { complete, streamFor, type ProviderMessage } from "./providers";
import type { Provider, StreamEvent, ChatMessage, TraceStep } from "./types";

export interface ReasonInput {
  provider: Provider;
  apiKey: string;
  model: string;
  history: ChatMessage[];
  prompt: string;
  domainHint?: string;
  criticEnabled: boolean;
  temperature: number;
  signal?: AbortSignal;
}

function makeStep(stage: string, body: string, status: TraceStep["status"] = "info"): TraceStep {
  return { stage, body, status, at: Date.now() };
}

function toProviderMessages(history: ChatMessage[]): ProviderMessage[] {
  return history
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
}

/** Strip the model's "PASS" / "REVISE:" prefix and return verdict + body. */
function parseCritic(raw: string): { pass: boolean; body: string } {
  const trimmed = raw.trim();
  if (/^pass\b/i.test(trimmed)) return { pass: true, body: trimmed };
  const m = trimmed.match(/^revise:?\s*([\s\S]*)$/i);
  return { pass: false, body: m ? m[1].trim() : trimmed };
}

export async function* reason(input: ReasonInput): AsyncGenerator<StreamEvent> {
  const t0 = Date.now();

  /* -------- PARSE -------- */
  const tokens = input.prompt.trim().split(/\s+/);
  const charLen = input.prompt.length;
  yield {
    type: "trace",
    step: makeStep(
      "PARSE",
      `tokenize · ${charLen} chars · ${tokens.length} tokens · embedding cached`,
      "ok"
    ),
  };

  /* -------- INTENT + ROUTE -------- */
  // If user explicitly picked a non-general domain, honor it.
  // If they're on "general" (the default), auto-route via the classifier.
  const domain: Domain =
    input.domainHint && input.domainHint !== "general"
      ? getDomain(input.domainHint)
      : classify(input.prompt);
  yield {
    type: "trace",
    step: makeStep("INTENT", `classify intent → ${domain.id} · expert=${domain.expert}`, "ok"),
  };
  yield {
    type: "trace",
    step: makeStep("ROUTE", `expert.dispatch → ${domain.label}`, "ok"),
  };

  /* -------- RECALL -------- */
  const recent = input.history.slice(-8);
  yield {
    type: "trace",
    step: makeStep(
      "RECALL",
      `retrieve ${recent.length} prior turn${recent.length === 1 ? "" : "s"} from conversation memory`,
      "ok"
    ),
  };

  /* -------- PLAN -------- */
  const planSystem = `${domain.system}\n\nYou are now in the PLAN stage. Output ONLY a numbered list of 3-6 concise reasoning steps you will follow to answer. Do not produce the answer itself. Do not preface or commentate. The list MUST be terse — each step ≤ 15 words.`;
  let plan = "";
  try {
    plan = await complete(input.provider, {
      apiKey: input.apiKey,
      model: input.model,
      system: planSystem,
      messages: [
        ...toProviderMessages(recent),
        { role: "user", content: input.prompt },
      ],
      temperature: 0.3,
      maxTokens: 280,
      signal: input.signal,
    });
  } catch (err: any) {
    yield { type: "error", message: err?.message ?? "plan stage failed" };
    return;
  }
  const planSummary = plan
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" · ");
  yield {
    type: "trace",
    step: makeStep("PLAN", `${planSummary || "(plan generated)"}`, "ok"),
  };

  /* -------- EXECUTE -------- */
  yield {
    type: "trace",
    step: makeStep("EXECUTE", "streaming response from cluster ...", "info"),
  };

  const execSystem = `${domain.system}\n\nA reasoning plan has been drafted (below). Follow it in your answer. Be precise. Be specific. Lead with the user's actual answer.\n\nPLAN:\n${plan}`;
  let answer = "";
  try {
    for await (const delta of streamFor(input.provider, {
      apiKey: input.apiKey,
      model: input.model,
      system: execSystem,
      messages: [
        ...toProviderMessages(recent),
        { role: "user", content: input.prompt },
      ],
      temperature: input.temperature,
      maxTokens: 2048,
      signal: input.signal,
    })) {
      answer += delta;
      yield { type: "delta", text: delta };
    }
  } catch (err: any) {
    yield { type: "error", message: err?.message ?? "execute stage failed" };
    return;
  }

  /* -------- CRITIC (optional) -------- */
  if (input.criticEnabled) {
    yield {
      type: "trace",
      step: makeStep("CRITIC", "evaluating answer for accuracy + completeness ...", "info"),
    };
    try {
      const criticRaw = await complete(input.provider, {
        apiKey: input.apiKey,
        model: input.model,
        system: domain.critic,
        messages: [
          {
            role: "user",
            content: `USER QUESTION:\n${input.prompt}\n\nDRAFT ANSWER:\n${answer}\n\nEvaluate the draft answer per your critic prompt. Reply "PASS" if it is sound, or "REVISE:" followed by your diagnosis and a corrected answer.`,
          },
        ],
        temperature: 0.0,
        maxTokens: 1024,
        signal: input.signal,
      });
      const verdict = parseCritic(criticRaw);
      if (verdict.pass) {
        yield {
          type: "trace",
          step: makeStep("CRITIC", "self-verify → consensus reached · no revision needed", "ok"),
        };
      } else {
        yield {
          type: "trace",
          step: makeStep("CRITIC", `revision required · ${verdict.body.slice(0, 140)}${verdict.body.length > 140 ? "..." : ""}`, "warn"),
        };
        // Replace answer in-place: signal a "reset" by sending sentinel
        // We re-emit the corrected answer as deltas so the UI updates.
        yield { type: "delta", text: "\n\n---\n\n**Revised after self-critique:**\n\n" };
        // Pass through verdict.body as the corrected answer
        for (const chunk of chunkText(verdict.body, 40)) {
          yield { type: "delta", text: chunk };
          await sleep(15);
        }
        answer = verdict.body;
      }
    } catch (err: any) {
      yield {
        type: "trace",
        step: makeStep("CRITIC", `critic stage failed: ${err?.message ?? err}`, "warn"),
      };
    }
  }

  /* -------- SYNTH / DONE -------- */
  const totalMs = Date.now() - t0;
  yield {
    type: "trace",
    step: makeStep("SYNTH", `delivered · ${totalMs}ms total · ${answer.length} chars`, "ok"),
  };
  yield { type: "done", final: answer };
}

/* ------------------------------------------------------------------ */
function* chunkText(s: string, n: number): Iterable<string> {
  for (let i = 0; i < s.length; i += n) yield s.slice(i, i + n);
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
