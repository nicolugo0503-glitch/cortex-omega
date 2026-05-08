export type Provider = "anthropic" | "openai";

export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  /** When this message was created (ms since epoch). */
  createdAt: number;
  /** Optional reasoning trace attached to an assistant message. */
  trace?: TraceStep[];
}

export interface TraceStep {
  /** Stage label, e.g. "PARSE", "PLAN", "EXECUTE". */
  stage: string;
  /** Plain-text body for the step. */
  body: string;
  /** ms since epoch when this step started. */
  at: number;
  /** ms duration of the step. */
  duration?: number;
  /** Status — affects coloring in the UI. */
  status?: "ok" | "warn" | "err" | "info";
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  domain: string;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  provider: Provider;
  anthropicKey: string;
  openaiKey: string;
  model: string;
  domain: string;
  criticEnabled: boolean;
  temperature: number;
}

export type StreamEvent =
  | { type: "trace"; step: TraceStep }
  | { type: "delta"; text: string }
  | { type: "done"; final?: string }
  | { type: "error"; message: string };

export const DEFAULT_SETTINGS: Settings = {
  provider: "anthropic",
  anthropicKey: "",
  openaiKey: "",
  model: "",
  domain: "general",
  criticEnabled: true,
  temperature: 0.7,
};
