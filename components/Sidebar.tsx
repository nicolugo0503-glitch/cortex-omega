"use client";

import type { Conversation } from "@/lib/types";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onOpenSettings,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="sb-head">
        <div className="sb-logo" />
        <div className="sb-title">CORTEX-Ω</div>
        <div className="sb-status">ONLINE</div>
      </div>

      <button className="sb-new" onClick={onNew}>
        <span>＋</span> New conversation
      </button>

      <div className="sb-list">
        {conversations.length === 0 ? (
          <div className="sb-empty">▸ No conversations yet</div>
        ) : (
          conversations
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((c) => (
              <div
                key={c.id}
                className={`sb-conv ${c.id === activeId ? "active" : ""}`}
                onClick={() => onSelect(c.id)}
              >
                <span style={{ color: "var(--accent)", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                  ▸
                </span>
                <span className="ti">{c.title}</span>
                <button
                  className="x"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this conversation?")) onDelete(c.id);
                  }}
                  aria-label="Delete"
                >
                  ×
                </button>
              </div>
            ))
        )}
      </div>

      <div className="sb-foot">
        <button onClick={onOpenSettings}>⚙ Settings</button>
      </div>
    </aside>
  );
}
