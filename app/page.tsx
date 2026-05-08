"use client";

import { useEffect, useState } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { Settings as SettingsModal } from "@/components/Settings";
import { Sidebar } from "@/components/Sidebar";
import { DEFAULT_MODELS } from "@/lib/providers";
import {
  loadConversations,
  loadSettings,
  newConversation,
  saveConversations,
  saveSettings,
} from "@/lib/store";
import type { Conversation, Settings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    const s = loadSettings();
    if (!s.model) s.model = DEFAULT_MODELS[s.provider];
    setSettings(s);

    let convs = loadConversations();
    if (convs.length === 0) {
      const fresh = newConversation(s.domain || "general");
      convs = [fresh];
      saveConversations(convs);
    }
    setConversations(convs);
    setActiveId(convs[0].id);
    setHydrated(true);

    // Open settings on first run if no API key configured
    const noKey = s.provider === "anthropic" ? !s.anthropicKey : !s.openaiKey;
    if (noKey) setSettingsOpen(true);
  }, []);

  // Persist on changes
  useEffect(() => {
    if (!hydrated) return;
    saveSettings(settings);
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveConversations(conversations);
  }, [conversations, hydrated]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  function updateConversation(c: Conversation) {
    setConversations((list) => list.map((x) => (x.id === c.id ? c : x)));
  }
  function selectConversation(id: string) {
    setActiveId(id);
  }
  function createConversation() {
    const c = newConversation(settings.domain || "general");
    setConversations((list) => [c, ...list]);
    setActiveId(c.id);
  }
  function deleteConversation(id: string) {
    setConversations((list) => {
      const next = list.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = newConversation(settings.domain || "general");
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }
  function changeDomain(domain: string) {
    if (!active) return;
    updateConversation({ ...active, domain, updatedAt: Date.now() });
    setSettings((s) => ({ ...s, domain }));
  }

  if (!hydrated || !active) {
    return (
      <main className="app">
        <div className="bg-grid" />
      </main>
    );
  }

  return (
    <main className="app">
      <div className="bg-grid" />
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onNew={createConversation}
        onDelete={deleteConversation}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="main">
        <ChatInterface
          conversation={active}
          settings={settings}
          onChange={updateConversation}
          onChangeDomain={changeDomain}
        />
      </div>
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
