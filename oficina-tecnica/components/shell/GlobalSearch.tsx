"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "../../lib/icons";
import { useStore } from "../../lib/store/StoreProvider";
import { AGENTS, APPROVALS, SKILLS } from "../../lib/data";
import { ROUTES } from "../../lib/routes";

type SearchResult = { kind: string; route: string; title: string; sub: string; text: string };

export function GlobalSearch({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (route: string) => void;
}) {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const index = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [];
    [...SKILLS, ...state.customSkills].forEach((s) =>
      items.push({ kind: "Skill", route: "skills", title: s.name, sub: `${s.agent} · ${s.version}`, text: `${s.name} ${s.agent} ${s.trigger || ""}` })
    );
    APPROVALS.forEach((a) =>
      items.push({ kind: "Aprobación", route: "approvals", title: a.title, sub: a.agent, text: `${a.title} ${a.summary} ${a.agent}` })
    );
    state.knowledge.forEach((k) =>
      items.push({ kind: "Conocimiento", route: "memory", title: k.title, sub: k.body.slice(0, 40), text: `${k.title} ${k.body}` })
    );
    AGENTS.forEach((a) =>
      items.push({ kind: "Agente", route: "chat", title: a.name, sub: a.role, text: `${a.name} ${a.role} ${a.focus}` })
    );
    return items;
  }, [state.customSkills, state.knowledge]);

  const results = q.trim() ? index.filter((i) => i.text.toLowerCase().includes(q.toLowerCase())).slice(0, 12) : index.slice(0, 8);

  useEffect(() => setActive(0), [q]);

  function go(r: SearchResult) {
    onNavigate(r.route);
    onClose();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      go(results[active]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <div className="search-backdrop" onClick={onClose}>
      <div className="search-box" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrap">
          <Icons.eye width={18} height={18} />
          <input
            ref={inputRef}
            className="search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscar proyectos, skills, aprobaciones, conocimiento, agentes…"
          />
          <span className="badge badge--slate">Esc</span>
        </div>
        <div className="search-results">
          {results.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>Sin resultados para &ldquo;{q}&rdquo;</div>
          ) : (
            results.map((r, i) => (
              <div
                key={i}
                className={`search-result ${i === active ? "search-result--active" : ""}`}
                onClick={() => go(r)}
                onMouseEnter={() => setActive(i)}
              >
                <span className="search-result-kind">{r.kind}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</div>
                </div>
                <Icons.arrowRight width={14} height={14} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function routeIdToPath(id: string): string {
  return ROUTES.find((r) => r.id === id)?.path || "/";
}
