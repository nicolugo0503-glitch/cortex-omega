"use client";

import { useEffect, useRef, useState } from "react";
import { DOMAINS, getDomain } from "@/lib/domains";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export function DomainPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getDomain(value);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      <button className="tb-domain" onClick={() => setOpen((v) => !v)}>
        <span className="label">▸</span>
        <span>{current.label}</span>
        <span style={{ color: "var(--dim)", fontSize: 9 }}>▾</span>
      </button>
      {open && (
        <div className="dropdown-menu">
          {DOMAINS.map((d) => (
            <div
              key={d.id}
              className={`dropdown-item ${d.id === value ? "on" : ""}`}
              onClick={() => {
                onChange(d.id);
                setOpen(false);
              }}
            >
              <div className="label">{d.label}</div>
              <div className="desc">{d.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
