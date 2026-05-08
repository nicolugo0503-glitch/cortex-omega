/**
 * localStorage persistence for conversations + settings.
 * No backend database; everything stays in the user's browser.
 */

import { DEFAULT_SETTINGS, type Conversation, type Settings } from "./types";

const SETTINGS_KEY = "cortex.settings.v1";
const CONVOS_KEY = "cortex.conversations.v1";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CONVOS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveConversations(list: Conversation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONVOS_KEY, JSON.stringify(list));
}

export function newConversation(domain: string): Conversation {
  const now = Date.now();
  return {
    id: cryptoId(),
    title: "New conversation",
    messages: [],
    domain,
    createdAt: now,
    updatedAt: now,
  };
}

export function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Derive a short title from the first user message. */
export function deriveTitle(text: string, max = 40): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/[\s,;:]+$/, "") + "...";
}
