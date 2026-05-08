"use client";

import { useState } from "react";
import type { TraceStep } from "@/lib/types";

interface Props {
  steps: TraceStep[];
  /** When true, the trace will be expanded by default. */
  defaultOpen?: boolean;
}

export function ReasoningTrace({ steps, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  if (!steps.length) return null;
  return (
    <div className={`trace ${open ? "open" : ""}`}>
      <div className="trace-head" onClick={() => setOpen((v) => !v)}>
        <span style={{ color: "var(--accent)" }}>▸</span>
        <span>Reasoning trace · {steps.length} step{steps.length === 1 ? "" : "s"}</span>
        <span className="toggle">▾</span>
      </div>
      <div className="trace-body">
        {steps.map((s, i) => (
          <div key={i} className={`trace-step ${s.status ?? ""}`}>
            <span className="stage">{s.stage}</span>
            <span className="body">{s.body}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
