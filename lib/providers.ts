/**
 * Streaming wrappers for Anthropic Claude + OpenAI Chat Completions.
 * No SDK dependency — direct fetch to keep the bundle small and the
 * surface area auditable.
 *
 * Both wrappers expose the same shape:
 *   stream(opts) → AsyncIterable<string> of token deltas
 *   complete(opts) → Promise<string> of the full response
 */

import type { Provider, Role } from "./types";

export interface ProviderMessage {
  role: Role;
  content: string;
}

export interface CallOpts {
  apiKey: string;
  model: string;
  system?: string;
  messages: ProviderMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
};

export const AVAILABLE_MODELS: Record<Provider, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o mini" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
  ],
};

/* ------------------------------------------------------------------ */
/* Anthropic                                                           */
/* ------------------------------------------------------------------ */

async function* anthropicStream(opts: CallOpts): AsyncIterable<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model || DEFAULT_MODELS.anthropic,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      messages: opts.messages.map((m) => ({
        role: m.role === "system" ? "user" : m.role,
        content: m.content,
      })),
      stream: true,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${text || res.statusText}`);
  }

  yield* parseSSE(res.body, (data) => {
    try {
      const evt = JSON.parse(data);
      if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
        return evt.delta.text as string;
      }
    } catch {}
    return null;
  });
}

/* ------------------------------------------------------------------ */
/* OpenAI                                                              */
/* ------------------------------------------------------------------ */

async function* openaiStream(opts: CallOpts): AsyncIterable<string> {
  const messages: ProviderMessage[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push(...opts.messages);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model || DEFAULT_MODELS.openai,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      messages,
      stream: true,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${text || res.statusText}`);
  }

  yield* parseSSE(res.body, (data) => {
    if (data === "[DONE]") return null;
    try {
      const evt = JSON.parse(data);
      const delta = evt.choices?.[0]?.delta?.content;
      if (typeof delta === "string") return delta;
    } catch {}
    return null;
  });
}

/* ------------------------------------------------------------------ */
/* SSE parser                                                          */
/* ------------------------------------------------------------------ */

async function* parseSSE(
  body: ReadableStream<Uint8Array>,
  extract: (data: string) => string | null
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const evt of events) {
      const lines = evt.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        const text = extract(data);
        if (text) yield text;
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function streamFor(provider: Provider, opts: CallOpts): AsyncIterable<string> {
  return provider === "anthropic" ? anthropicStream(opts) : openaiStream(opts);
}

export async function complete(provider: Provider, opts: CallOpts): Promise<string> {
  let out = "";
  for await (const delta of streamFor(provider, opts)) out += delta;
  return out;
}
