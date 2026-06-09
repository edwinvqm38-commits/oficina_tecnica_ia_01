"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { PROJECTS } from "../../lib/data";
import { useStore } from "../../lib/store/StoreProvider";
import type { ChatCtx, RequirementSummary } from "../../lib/chat/contextQuery";
import { fetchRequirementsByProject } from "../../lib/chat/contextQuery";

export type { ChatCtx };

type DropdownOption = {
  id: string;
  label: string;
  desc?: string;
  color?: string;
  bg?: string;
  border?: string;
  insert?: string;       // for @mentions: text to insert in textarea
  setCtxProject?: boolean;
  setCtxRequirement?: RequirementSummary;
};

const AGENT_OPTIONS: DropdownOption[] = [
  { id: "ic", label: "@IC", desc: "Ing. de Costos",   color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", insert: "@IC " },
  { id: "pm", label: "@PM", desc: "Project Manager",  color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", insert: "@PM " },
  { id: "ie", label: "@IE", desc: "Ing. Eléctrico",   color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc", insert: "@IE " },
  { id: "gg", label: "@GG", desc: "Gerente General",  color: "#92400e", bg: "#fffbeb", border: "#fde68a", insert: "@GG " },
];

const SLASH_COMMANDS: DropdownOption[] = [
  { id: "proyecto", label: "/proyecto",  desc: "Seleccionar proyecto activo",          color: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
  { id: "rq",       label: "/rq",        desc: "Buscar requerimiento del proyecto",     color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc" },
  { id: "ayuda",    label: "/ayuda",     desc: "Ver comandos disponibles",              insert: "/ayuda" },
];

function getAtMatch(val: string, cur: number): { query: string; from: number } | null {
  const before = val.slice(0, cur);
  const m = before.match(/@([A-Za-z0-9-]*)$/);
  if (!m) return null;
  return { query: m[1].toLowerCase(), from: before.length - m[0].length };
}

function getSlashMatch(val: string, cur: number): { cmd: string; query: string; from: number } | null {
  const before = val.slice(0, cur);
  // match slash at start or after space
  const m = before.match(/(?:^|\s)(\/([a-z]*)\s?([^@/]*)?)$/);
  if (!m) return null;
  const slashIdx = before.lastIndexOf("/");
  const full = m[1].slice(1); // everything after /
  const parts = full.split(/\s+/);
  const cmd = parts[0] ?? "";
  const query = parts.slice(1).join(" ");
  return { cmd, query, from: slashIdx };
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string, ctx: ChatCtx) => void;
  placeholder?: string;
  disabled?: boolean;
  defaultProjectId?: string;
}

export function ChatAutoInput({ value, onChange, onSubmit, placeholder, disabled, defaultProjectId }: Props) {
  const { state } = useStore();
  const allProjects = [...PROJECTS, ...state.customProjects];

  const [cursor, setCursor] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [ctx, setCtx] = useState<ChatCtx>({ project: null, requirement: null });
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Initialize default project from prop
  useEffect(() => {
    if (defaultProjectId && !ctx.project) {
      const p = allProjects.find((x) => x.id === defaultProjectId);
      if (p) setCtx((c) => ({ ...c, project: { id: p.id, name: p.name, client: p.client, status: p.status, progress: p.progress, summary: p.summary ?? "" } }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultProjectId]);

  const atMatch = getAtMatch(value, cursor);
  const slashMatch = !atMatch ? getSlashMatch(value, cursor) : null;

  // Compute dropdown options
  let options: DropdownOption[] = [];
  let replaceFrom = -1;
  let replaceLen = 0;

  if (atMatch) {
    replaceFrom = atMatch.from;
    replaceLen = cursor - atMatch.from;
    const q = atMatch.query;
    const agentOpts = AGENT_OPTIONS.filter((o) => o.id.startsWith(q) || q === "");
    const projOpts = allProjects
      .filter((p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || q === "")
      .slice(0, 5)
      .map((p): DropdownOption => ({
        id: p.id, label: `@${p.id}`, desc: `${p.name} · ${p.client}`,
        color: "#166534", bg: "#f0fdf4", border: "#bbf7d0", insert: `@${p.id} `,
      }));
    options = [...agentOpts, ...projOpts];
  } else if (slashMatch) {
    replaceFrom = slashMatch.from;
    replaceLen = cursor - slashMatch.from;
    const { cmd, query } = slashMatch;

    if (cmd === "proyecto" || cmd === "p") {
      // Show project list filtered by query
      options = allProjects
        .filter((p) => !query || p.id.toLowerCase().includes(query.toLowerCase()) || p.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8)
        .map((p): DropdownOption => ({
          id: p.id, label: p.id, desc: `${p.name} · ${p.client} · ${p.status}`,
          color: "#166534", bg: "#f0fdf4", border: "#bbf7d0",
          setCtxProject: true,
        }));
    } else if (cmd === "rq" || cmd === "req") {
      // Show requirements for active project
      if (requirements.length === 0 && !loadingReqs && ctx.project) {
        setLoadingReqs(true);
        fetchRequirementsByProject(ctx.project.id).then((reqs) => {
          setRequirements(reqs);
          setLoadingReqs(false);
        });
      }
      const filtered = requirements.filter((r) =>
        !query || r.codigo.toLowerCase().includes(query.toLowerCase()) || (r.estado ?? "").toLowerCase().includes(query.toLowerCase())
      );
      options = filtered.map((r): DropdownOption => ({
        id: r.id,
        label: r.codigo,
        desc: `${r.estado}${r.responsable ? ` · ${r.responsable}` : ""}${r.avance != null ? ` · ${r.avance}%` : ""}`,
        color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc",
        setCtxRequirement: r,
      }));
      if (loadingReqs) {
        options = [{ id: "__loading", label: "Cargando…", desc: "Buscando requerimientos en Supabase" }];
      } else if (options.length === 0 && !loadingReqs) {
        if (!ctx.project) {
          options = [{ id: "__noproj", label: "Sin proyecto", desc: "Selecciona un proyecto con /proyecto primero" }];
        } else {
          options = [{ id: "__empty", label: "Sin resultados", desc: `No se encontraron RQs para ${ctx.project.id}` }];
        }
      }
    } else {
      // Show slash command list
      options = SLASH_COMMANDS.filter((c) => c.id.startsWith(cmd) || cmd === "");
    }
  }

  useEffect(() => { setSelectedIdx(0); }, [options.length]);

  function applyOption(opt: DropdownOption) {
    if (opt.id.startsWith("__")) return; // informational items

    if (opt.setCtxProject) {
      const p = allProjects.find((x) => x.id === opt.id)!;
      setCtx((c) => ({
        ...c,
        project: { id: p.id, name: p.name, client: p.client, status: p.status, progress: p.progress, summary: p.summary ?? "" },
        requirement: null,
      }));
      setRequirements([]);
      // Remove the /proyecto... text from textarea
      const newVal = value.slice(0, replaceFrom).trimEnd() + value.slice(replaceFrom + replaceLen);
      onChange(newVal.trimStart());
      const newCur = replaceFrom;
      setTimeout(() => { taRef.current?.setSelectionRange(newCur, newCur); taRef.current?.focus(); setCursor(newCur); }, 0);
      return;
    }

    if (opt.setCtxRequirement) {
      setCtx((c) => ({ ...c, requirement: opt.setCtxRequirement! }));
      const newVal = value.slice(0, replaceFrom).trimEnd() + value.slice(replaceFrom + replaceLen);
      onChange(newVal.trimStart());
      const newCur = replaceFrom;
      setTimeout(() => { taRef.current?.setSelectionRange(newCur, newCur); taRef.current?.focus(); setCursor(newCur); }, 0);
      return;
    }

    if (opt.insert !== undefined) {
      const newVal = value.slice(0, replaceFrom) + opt.insert + value.slice(replaceFrom + replaceLen);
      const newCur = replaceFrom + opt.insert.length;
      onChange(newVal);
      setTimeout(() => { taRef.current?.setSelectionRange(newCur, newCur); taRef.current?.focus(); setCursor(newCur); }, 0);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (options.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, options.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        const opt = options[selectedIdx];
        if (opt && !opt.id.startsWith("__")) applyOption(opt);
        return;
      }
      if (e.key === "Escape") { setCursor(-1); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(value.trim(), ctx);
    }
  }

  function syncCursor(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    setCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0);
  }

  function removeProject() { setCtx((c) => ({ ...c, project: null, requirement: null })); setRequirements([]); }
  function removeRequirement() { setCtx((c) => ({ ...c, requirement: null })); }

  const hasCtx = ctx.project || ctx.requirement;

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Context chips strip */}
      {hasCtx && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "4px 2px" }}>
          {ctx.project && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 6, padding: "2px 8px 2px 10px", fontSize: 11.5, fontWeight: 700 }}>
              <span style={{ fontFamily: "var(--mono)" }}>{ctx.project.id}</span>
              <span style={{ fontWeight: 400, color: "#4ade80", margin: "0 2px" }}>·</span>
              <span style={{ fontWeight: 500, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ctx.project.name}</span>
              <button onClick={removeProject} style={{ background: "none", border: "none", cursor: "pointer", color: "#4ade80", fontSize: 12, lineHeight: 1, padding: "0 0 0 2px" }}>×</button>
            </span>
          )}
          {ctx.requirement && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#ecfeff", color: "#0e7490", border: "1px solid #a5f3fc", borderRadius: 6, padding: "2px 8px 2px 10px", fontSize: 11.5, fontWeight: 700 }}>
              <span style={{ fontFamily: "var(--mono)" }}>{ctx.requirement.codigo}</span>
              <span style={{ fontWeight: 400 }}>·</span>
              <span style={{ fontWeight: 500 }}>{ctx.requirement.estado}</span>
              {ctx.requirement.avance != null && <span style={{ fontWeight: 400, fontSize: 10.5 }}>{ctx.requirement.avance}%</span>}
              <button onClick={removeRequirement} style={{ background: "none", border: "none", cursor: "pointer", color: "#22d3ee", fontSize: 12, lineHeight: 1, padding: "0 0 0 2px" }}>×</button>
            </span>
          )}
        </div>
      )}

      {/* Dropdown */}
      {options.length > 0 && (
        <div style={{
          position: "absolute", bottom: hasCtx ? "calc(100% - 8px)" : "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r)",
          boxShadow: "0 6px 20px rgba(0,0,0,.12)", zIndex: 100, overflow: "hidden", maxHeight: 240, overflowY: "auto",
        }}>
          {options.map((opt, i) => (
            <div
              key={opt.id}
              onMouseDown={(e) => { e.preventDefault(); if (!opt.id.startsWith("__")) applyOption(opt); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", cursor: opt.id.startsWith("__") ? "default" : "pointer",
                background: i === selectedIdx && !opt.id.startsWith("__") ? "var(--blue-bg)" : "transparent",
                borderLeft: i === selectedIdx && !opt.id.startsWith("__") ? "2px solid var(--blue)" : "2px solid transparent",
                opacity: opt.id.startsWith("__") ? 0.6 : 1,
              }}
            >
              <span style={{
                fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11, flexShrink: 0,
                color: opt.color ?? "var(--t1)", background: opt.bg ?? "var(--bg-subtle)",
                border: `1px solid ${opt.border ?? "var(--border)"}`, borderRadius: 4, padding: "1px 7px",
              }}>
                {opt.label}
              </span>
              {opt.desc && <span style={{ fontSize: 11.5, color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.desc}</span>}
            </div>
          ))}
          <div style={{ padding: "4px 12px 5px", borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--t3)", display: "flex", gap: 10 }}>
            <span>↑↓ navegar</span><span>↵ Tab seleccionar</span><span>Esc cerrar</span>
          </div>
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); setCursor(e.target.selectionStart ?? 0); }}
        onKeyDown={handleKeyDown}
        onSelect={syncCursor}
        onClick={syncCursor}
        placeholder={placeholder ?? "Escribe… @IC /proyecto /rq /ayuda"}
        rows={1}
        disabled={disabled}
        style={{
          width: "100%", resize: "none",
          border: "1px solid var(--border)", borderRadius: "var(--r)",
          padding: "9px 11px", fontSize: 12.5, fontFamily: "var(--font)",
          color: "var(--t1)", maxHeight: 120, lineHeight: 1.5, outline: "none",
          background: "var(--bg-card)", boxSizing: "border-box",
        }}
      />
    </div>
  );
}
