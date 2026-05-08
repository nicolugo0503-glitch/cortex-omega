import { NextRequest } from "next/server";
import { reason } from "@/lib/reasoning";
import type { ChatMessage, Provider, StreamEvent } from "@/lib/types";

export const runtime = "edge";

interface ChatRequestBody {
  provider: Provider;
  apiKey?: string;
  model: string;
  history: ChatMessage[];
  prompt: string;
  domain?: string;
  criticEnabled: boolean;
  temperature: number;
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const { provider, model, history, prompt, domain, criticEnabled, temperature } = body;

  // Resolve API key: user-provided takes precedence, else server env.
  const userKey = body.apiKey?.trim();
  const envKey =
    provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY;
  const apiKey = userKey || envKey;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: `No ${provider === "anthropic" ? "Anthropic" : "OpenAI"} API key configured. Add one in Settings.`,
      }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      };
      try {
        for await (const evt of reason({
          provider,
          apiKey,
          model,
          history,
          prompt,
          domainHint: domain,
          criticEnabled,
          temperature,
          signal: req.signal,
        })) {
          send(evt);
        }
      } catch (err: any) {
        send({
          type: "error",
          message: err?.message ?? String(err) ?? "unknown error",
        });
      } finally {
        controller.close();
      }
    },
    cancel() {
      // The async generator will see the abort signal via req.signal.
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
