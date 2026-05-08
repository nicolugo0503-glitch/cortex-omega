"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { ReasoningTrace } from "./ReasoningTrace";
import { DomainPicker } from "./DomainPicker";
import { getDomain } from "@/lib/domains";
import { cryptoId, deriveTitle } from "@/lib/store";
import type {
  ChatMessage,
  Conversation,
  Settings,
  StreamEvent,
  TraceStep,
} from "@/lib/types";

interface Props {
  conversation: Conversation;
  settings: Settings;
  onChange: (c: Conversation) => void;
  onChangeDomain: (id: string) => void;
}

const PRESETS = [
  {
    tag: "FINANCE",
    text: "Walk me through how to value a high-growth SaaS startup with $30M ARR growing 90% YoY. What are the right multiples and the common traps?",
  },
  {
    tag: "CLINICAL",
    text: "Differential diagnosis for a 47-year-old with intermittent vertigo, mild fatigue, and a slightly elevated TSH. What workup would you order?",
  },
  {
    tag: "SOFTWARE",
    text: "I'm seeing intermittent 504s under burst load on a Node.js service behind a Postgres-backed connection pool. Walk me through how to root-cause it.",
  },
  {
    tag: "STRATEGY",
    text: "We're a B2B SaaS company at $20M ARR deciding whether to expand into enterprise. What's the framework for this decision and the key trade-offs?",
  },
];

export function ChatInterface({
  conversation,
  settings,
  onChange,
  onChangeDomain,
}: Props) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages while streaming
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversation.messages.length, streaming]);

  // Auto-resize composer
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 240) + "px";
  }, [input]);

  function abort() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }

  async function send(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || streaming) return;
    setError(null);

    const userMsg: ChatMessage = {
      id: cryptoId(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    const assistantId = cryptoId();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      trace: [],
    };

    const newTitle =
      conversation.messages.length === 0
        ? deriveTitle(trimmed)
        : conversation.title;

    let working: Conversation = {
      ...conversation,
      title: newTitle,
      messages: [...conversation.messages, userMsg, assistantMsg],
      updatedAt: Date.now(),
    };
    onChange(working);
    setInput("");
    setStreaming(true);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const apiKey =
        settings.provider === "anthropic"
          ? settings.anthropicKey
          : settings.openaiKey;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          apiKey,
          model: settings.model,
          history: conversation.messages,
          prompt: trimmed,
          domain: conversation.domain,
          criticEnabled: settings.criticEnabled,
          temperature: settings.temperature,
        }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const txt = await res.text();
        let msg = txt;
        try {
          const j = JSON.parse(txt);
          msg = j.error ?? txt;
        } catch {}
        throw new Error(msg || `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error("no response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const ev of events) {
          for (const line of ev.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            let parsed: StreamEvent;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }
            working = applyStreamEvent(working, assistantId, parsed);
            onChange(working);
            if (parsed.type === "error") {
              setError(parsed.message);
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // User cancelled — silent
      } else {
        setError(err?.message ?? String(err));
        // Append an error indicator into the assistant message trace
        working = patchAssistant(working, assistantId, (m) => ({
          ...m,
          trace: [
            ...(m.trace ?? []),
            {
              stage: "ERROR",
              body: err?.message ?? String(err),
              status: "err",
              at: Date.now(),
            },
          ],
        }));
        onChange(working);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const empty = conversation.messages.length === 0;
  const currentDomain = getDomain(conversation.domain);

  return (
    <>
      <div className="topbar">
        <DomainPicker value={conversation.domain} onChange={onChangeDomain} />
        <div className="tb-spacer" />
        <div className="tb-meta">
          {settings.provider === "anthropic" ? "▸ Claude" : "▸ OpenAI"}{" "}
          · <span className="ok">{settings.model}</span>
          {" · "}critic{" "}
          <span className={settings.criticEnabled ? "ok" : ""}>
            {settings.criticEnabled ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      <div className="chat" ref={scrollRef}>
        <div className="chat-inner">
          {empty && (
            <div className="welcome">
              <div className="welcome-orb" />
              <h1>
                A cognitive engine,{" "}
                <span className="grad">awake.</span>
              </h1>
              <p>
                Ask anything. CORTEX-Ω will plan, reason, execute, and self-critique
                before answering. Currently routing to{" "}
                <span style={{ color: "var(--accent)" }}>{currentDomain.label}</span>.
              </p>
              <div className="welcome-presets">
                {PRESETS.map((p) => (
                  <button
                    key={p.tag}
                    className="welcome-preset"
                    onClick={() => send(p.text)}
                  >
                    <span className="ic">↗ {p.tag}</span>
                    {p.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {conversation.messages.map((m) => (
            <Message key={m.id} msg={m} streaming={streaming} domain={currentDomain.expert} />
          ))}

          {error && (
            <div className="error-box">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
      </div>

      <div className="composer-wrap">
        <div className="composer">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              streaming
                ? "CORTEX-Ω is reasoning..."
                : `Ask CORTEX-Ω · ${currentDomain.label} expert · Enter to send · Shift+Enter for newline`
            }
            disabled={streaming}
          />
          {streaming ? (
            <button className="send" onClick={abort} aria-label="Stop">
              ◼
            </button>
          ) : (
            <button
              className="send"
              onClick={() => send(input)}
              disabled={!input.trim()}
              aria-label="Send"
            >
              ↑
            </button>
          )}
        </div>
        <div className="composer-meta">
          <span>
            ▸ {currentDomain.expert} · {settings.provider}/{settings.model}
          </span>
          <span>
            {streaming ? "STREAMING ··" : "READY"}
          </span>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Message({
  msg,
  streaming,
  domain,
}: {
  msg: ChatMessage;
  streaming: boolean;
  domain: string;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={`msg ${msg.role}`}>
      <div className="av">{isUser ? "U" : "Ω"}</div>
      <div className="body">
        <div className="name">
          <strong>{isUser ? "You" : "CORTEX-Ω"}</strong>
          {!isUser && <> · {domain}</>}
        </div>
        {!isUser && msg.trace && msg.trace.length > 0 && (
          <ReasoningTrace steps={msg.trace} defaultOpen={!msg.content} />
        )}
        {msg.content ? (
          <div style={{ position: "relative" }}>
            <Markdown text={msg.content} />
          </div>
        ) : (
          !isUser && streaming && <div className="text cursor-blink" />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function patchAssistant(
  conv: Conversation,
  assistantId: string,
  fn: (m: ChatMessage) => ChatMessage
): Conversation {
  return {
    ...conv,
    messages: conv.messages.map((m) => (m.id === assistantId ? fn(m) : m)),
    updatedAt: Date.now(),
  };
}

function applyStreamEvent(
  conv: Conversation,
  assistantId: string,
  evt: StreamEvent
): Conversation {
  if (evt.type === "trace") {
    return patchAssistant(conv, assistantId, (m) => {
      const trace = [...(m.trace ?? [])];
      // If the new step's stage matches the previous step's stage AND
      // both are info, replace (lets us update "EXECUTE: streaming..." in place).
      const last = trace[trace.length - 1];
      if (last && last.stage === evt.step.stage && last.status === "info") {
        trace[trace.length - 1] = evt.step;
      } else {
        trace.push(evt.step);
      }
      return { ...m, trace };
    });
  }
  if (evt.type === "delta") {
    return patchAssistant(conv, assistantId, (m) => ({
      ...m,
      content: m.content + evt.text,
    }));
  }
  if (evt.type === "done" && evt.final) {
    // Final answer ensures content is exactly the final string (in case
    // the critic revised it via the special "Revised after self-critique" insert).
    // We don't overwrite — the revision is already streamed in.
    return conv;
  }
  if (evt.type === "error") {
    return patchAssistant(conv, assistantId, (m) => ({
      ...m,
      trace: [
        ...(m.trace ?? []),
        { stage: "ERROR", body: evt.message, status: "err", at: Date.now() },
      ],
    }));
  }
  return conv;
}
