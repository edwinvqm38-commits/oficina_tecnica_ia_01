"use client";

import { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { AGENTS, APPROVALS, CONNECTIONS } from "../../lib/data";
import { RiskBadge, StatusBadge } from "./shared";
import { useStore } from "../../lib/store/StoreProvider";

function experienceLevel(msgs: number): { label: string; color: string; pct: number } {
  if (msgs >= 40) return { label: "Experto", color: "var(--blue)", pct: 100 };
  if (msgs >= 20) return { label: "Avanzado", color: "#7c3aed", pct: Math.round((msgs / 40) * 100) };
  if (msgs >= 8)  return { label: "Intermedio", color: "#0891b2", pct: Math.round((msgs / 20) * 100) };
  if (msgs >= 1)  return { label: "Aprendiendo", color: "#16a34a", pct: Math.round((msgs / 8) * 100) };
  return { label: "Sin datos", color: "var(--t3)", pct: 0 };
}

export function OrgChart() {
  const { chatFor } = useStore();
  const activeAgents = AGENTS.filter((a) => a.type === "agent");
  const futureAgents = AGENTS.filter((a) => a.type === "agent-future");
  return (
    <div style={{ padding: "24px 20px", background: "var(--bg-subtle)", borderRadius: "var(--r-lg)", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <div className="org-gg-node">
          <div className="agent-avatar agent-avatar--gg" style={{ width: 40, height: 40, fontSize: 13 }}>
            GG
          </div>
          <div className="org-gg-label">Gerente General</div>
          <div className="org-gg-sub">Supervisión · Aprobación · Decisión</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
        <div style={{ width: 1, height: 20, background: "var(--border-strong)" }}></div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
        <div style={{ width: "60%", height: 1, background: "var(--border-strong)" }}></div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 16 }}>
        {activeAgents.map((agent) => {
          const msgs = chatFor(agent.id).length + chatFor("roundtable").filter((m) => m.agentId === agent.id).length;
          const exp = experienceLevel(msgs);
          return (
            <div key={agent.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 1, height: 16, background: "var(--border-strong)" }}></div>
              <div className={`org-agent-node ${agent.status === "needs-approval" ? "org-agent-node--needs-approval" : ""}`}>
                <div className={`agent-avatar agent-avatar--${agent.id}`}>{agent.initials}</div>
                <div className="org-agent-name">{agent.name}</div>
                <div className="org-agent-role">{agent.role}</div>
                <StatusBadge status={agent.status} />
                <div style={{ width: "100%", marginTop: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 9.5, color: exp.color, fontWeight: 700 }}>{exp.label}</span>
                    <span style={{ fontSize: 9, color: "var(--t3)" }}>{msgs} consultas</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${exp.pct}%`, background: exp.color, borderRadius: 2, transition: "width .4s" }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }}></div>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--t3)" }}>Agentes futuros</span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }}></div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
        {futureAgents.map((agent) => (
          <div key={agent.id} className="org-agent-node org-agent-node--future" style={{ width: 140 }}>
            <div className="agent-avatar agent-avatar--future">{agent.initials}</div>
            <div className="org-agent-name">{agent.name}</div>
            <div className="org-agent-role">{agent.role}</div>
            <span className="badge badge--slate">Futuro</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OfficeView() {
  const [mode, setMode] = useState<"structure" | "collaboration" | "approvals">("structure");
  const modes: { id: typeof mode; label: string }[] = [
    { id: "structure", label: "Estructura" },
    { id: "collaboration", label: "Colaboración" },
    { id: "approvals", label: "Aprobaciones" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Oficina IA"
        title="Organigrama y red multiagente"
        description="Estructura jerárquica, colaboraciones activas y decisiones bloqueadas."
        actions={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div className="kpi" style={{ padding: "6px 12px" }}>
              <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--t3)" }}>Agentes</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginLeft: 6 }}>2</span>
            </div>
            <div className="kpi" style={{ padding: "6px 12px" }}>
              <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--t3)" }}>Red</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginLeft: 6 }}>{CONNECTIONS.length}</span>
            </div>
          </div>
        }
      />

      <div className="card" style={{ padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div className="mode-tabs">
          {modes.map((m) => (
            <button key={m.id} className={`mode-tab ${mode === m.id ? "mode-tab--active" : ""}`} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "var(--t3)" }}>Lógica completa: próxima fase</span>
      </div>

      {mode === "structure" && (
        <div className="space-y-3">
          <div className="card">
            <div className="card-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Organigrama operativo</div>
              <span className="badge badge--mock">Mock</span>
            </div>
            <div style={{ padding: 16 }}>
              <OrgChart />
            </div>
          </div>
        </div>
      )}

      {mode === "collaboration" && (
        <div className="card">
          <div className="card-header">
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Interacciones entre agentes</div>
            <span className="badge badge--mock">Mock</span>
          </div>
          {CONNECTIONS.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: c.kind === "supervision" ? "var(--blue)" : "var(--green)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginBottom: 2 }}>
                  {c.from} → {c.to}
                </div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>{c.label}</div>
              </div>
              <span className={`badge badge--${c.kind === "supervision" ? "blue" : "green"}`}>{c.kind === "supervision" ? "Supervisión" : "Colaboración"}</span>
            </div>
          ))}
        </div>
      )}

      {mode === "approvals" && (
        <div className="card">
          <div className="card-header">
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Bloqueos por aprobación pendiente</div>
            <span className="badge badge--orange">{APPROVALS.filter((a) => a.status === "pending").length} pendientes</span>
          </div>
          {APPROVALS.filter((a) => a.status === "pending").map((a) => (
            <div
              key={a.id}
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--border)",
                borderLeft: `3px solid var(--${a.risk === "critical" ? "red" : a.risk === "high" ? "orange" : "amber"})`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginBottom: 3 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: "var(--t2)" }}>{a.summary}</div>
                </div>
                <RiskBadge risk={a.risk} />
              </div>
              <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                <button className="btn btn--success btn--sm">Aprobar</button>
                <button className="btn btn--warning btn--sm">Observar</button>
                <button className="btn btn--danger btn--sm">Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
