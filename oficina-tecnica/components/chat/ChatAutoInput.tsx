"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { PROJECTS } from "../../lib/data";
import { useStore } from "../../lib/store/StoreProvider";

type Option = {
  id: string;
  label: string;
  insert: string;
  desc?: string;
  color?: string;
  bg?: string;
  border?: string;
};

const AGENT_OPTIONS: Option[] = [
  { id: "ic", label: "@IC", insert: "@IC ", desc: "Ing. de Costos",   color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "pm", label: "@PM", insert: "@PM ", desc: "Project Manager",  color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: "ie", label: "@IE", insert: "@IE ", desc: "Ing. Eléctrico",   color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc" },
  { id: "gg", label: "@GG", insert: "@GG ", desc: "Gerente General",  color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
];

const SLASH_OPTIONS: Option[] = [
  { id: "ayuda",    label: "/ayuda",    insert: "/ayuda",    desc: "Ver comandos disponibles" },
  { id: "proyecto", label: "/proyecto", insert: "/proyecto ", desc: "Enfocar en un proyecto específico" },
];

function getAtMatch(value: string, cursor: number): { query: string; from: number } | null {
  const before = value.slice(0, cursor);
  const m = before.match(/@([A-Za-z0-9-]*)$/);
  if (!m) return null;
  return { query: m[1].toLowerCase(), from: before.length - m[0].length };
}

function getSlashMatch(value: string, cursor: number): { query: string; from: number } | null {
  const before = value.slice(0, cursor);
  const m = before.match(/(?:^|\s)(\/[a-z]*)$/);
  if (!m) return null;
  return { query: m[1].toLowerCase(), from: before.lastIndexOf("/") };
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function ChatAutoInput({ value, onChange, onSubmit, placeholder, disabled, style }: Props) {
  const { state } = useStore();
  const [cursor, setCursor] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const allProjects = [...PROJECTS, ...state.customProjects];

  const atMatch = getAtMatch(value, cursor);
  const slashMatch = !atMatch ? getSlashMatch(value, cursor) : null;

  let options: Option[] = [];
  let replaceFrom = -1;
  let replaceLen = 0;

  if (atMatch !== null) {
    replaceFrom = atMatch.from;
    replaceLen = cursor - atMatch.from;
    const q = atMatch.query;
    const agentOpts = q === "" || AGENT_OPTIONS.some((o) => o.id.startsWith(q))
      ? AGENT_OPTIONS.filter((o) => o.id.startsWith(q) || q === "")
      : [];
    const projectOpts = allProjects
      .filter((p) => p.id.toLowerCase().replace("pry-", "").startsWith(q.replace("pry-", "")) || q === "pry" || q === "")
      .slice(0, 5)
      .map((p): Option => ({
        id: p.id, label: `@${p.id}`, insert: `@${p.id} `,
        desc: `${p.name} · ${p.client}`, color: "#166534", bg: "#f0fdf4", border: "#bbf7d0",
      }));
    options = [...agentOpts, ...projectOpts];
  } else if (slashMatch !== null) {
    replaceFrom = slashMatch.from;
    replaceLen = cursor - slashMatch.from;
    const q = slashMatch.query.slice(1);
    options = SLASH_OPTIONS.filter((o) => o.id.startsWith(q) || q === "");
  }

  useEffect(() => { setSelectedIdx(0); }, [options.length]);

  function applyOption(opt: Option) {
    if (replaceFrom === -1) return;
    const newVal = value.slice(0, replaceFrom) + opt.insert + value.slice(replaceFrom + replaceLen);
    const newCursor = replaceFrom + opt.insert.length;
    onChange(newVal);
    setTimeout(() => {
      if (taRef.current) {
        taRef.current.setSelectionRange(newCursor, newCursor);
        taRef.current.focus();
      }
      setCursor(newCursor);
    }, 0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (options.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, options.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) { e.preventDefault(); applyOption(options[selectedIdx]); return; }
      if (e.key === "Escape") { setCursor(-1); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); }
  }

  function syncCursor(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    setCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0);
  }

  return (
    <div style={{ position: "relative", flex: 1 }}>
      {options.length > 0 && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0,
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r)",
          boxShadow: "0 6px 20px rgba(0,0,0,.12)", zIndex: 100, overflow: "hidden",
        }}>
          {options.map((opt, i) => (
            <div
              key={opt.id}
              onMouseDown={(e) => { e.preventDefault(); applyOption(opt); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", cursor: "pointer",
                background: i === selectedIdx ? "var(--blue-bg)" : "transparent",
                borderLeft: i === selectedIdx ? "2px solid var(--blue)" : "2px solid transparent",
              }}
            >
              <span style={{
                fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11,
                color: opt.color ?? "var(--t1)",
                background: opt.bg ?? "var(--bg-subtle)",
                border: `1px solid ${opt.border ?? opt.color ?? "var(--border)"}`,
                borderRadius: 4, padding: "1px 7px", flexShrink: 0,
              }}>
                {opt.label}
              </span>
              {opt.desc && <span style={{ fontSize: 11.5, color: "var(--t2)" }}>{opt.desc}</span>}
            </div>
          ))}
          <div style={{ padding: "4px 12px 5px", borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--t3)", display: "flex", gap: 10 }}>
            <span>↑↓ navegar</span><span>↵ Tab seleccionar</span><span>Esc cerrar</span>
          </div>
        </div>
      )}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); setCursor(e.target.selectionStart ?? 0); }}
        onKeyDown={handleKeyDown}
        onSelect={syncCursor}
        onClick={syncCursor}
        placeholder={placeholder}
        rows={1}
        disabled={disabled}
        style={{
          width: "100%", resize: "none",
          border: "1px solid var(--border)", borderRadius: "var(--r)",
          padding: "9px 11px", fontSize: 12.5, fontFamily: "var(--font)",
          color: "var(--t1)", maxHeight: 120, lineHeight: 1.5, outline: "none",
          background: "var(--bg-card)",
          ...style,
        }}
      />
    </div>
  );
}
