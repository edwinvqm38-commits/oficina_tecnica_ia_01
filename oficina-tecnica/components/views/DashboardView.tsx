"use client";

import { PageHeader } from "../shell/PageHeader";
import { useStore } from "../../lib/store/StoreProvider";
import { ACTIVITY, AGENTS, ALERTS, APPROVALS, MILESTONES, PROJECTS } from "../../lib/data";
import { StatusBadge } from "./shared";
import { agentAvatarClass } from "./shared";
import type { Agent } from "../../lib/types";

function AgentCompactRow({ agent }: { agent: Agent }) {
  const isFuture = agent.type === "agent-future";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", borderBottom: "1px solid var(--border)", opacity: isFuture ? 0.55 : 1 }}>
      <div className={`agent-avatar ${agentAvatarClass(agent.id)}`}>{agent.initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{agent.name}</span>
          <StatusBadge status={agent.status} />
          {isFuture && (
            <span className="badge badge--slate badge--mock">Futuro</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--t3)" }}>{agent.role}</div>
      </div>
      {!isFuture && agent.confidence !== null && (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>{agent.confidence}%</div>
          <div style={{ fontSize: 10, color: "var(--t3)" }}>confianza</div>
        </div>
      )}
      {!isFuture && (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>{agent.tasks}</div>
          <div style={{ fontSize: 10, color: "var(--t3)" }}>tareas</div>
        </div>
      )}
    </div>
  );
}

export function DashboardView() {
  const { state } = useStore();
  const pendingApprovals = APPROVALS.filter((a) => (state.approvalDecisions[a.id] || a.status) === "pending").length;
  const activeAgents = AGENTS.filter((a) => a.status === "active" && a.type !== "human").length;
  const allProjects = [...PROJECTS, ...state.customProjects];
  const atRiskProjects = allProjects.filter((p) => p.status === "at-risk" || p.status === "delayed").length;

  const approvalGroups = [
    { label: "Pendientes", key: "pending", color: "var(--orange)" },
    { label: "Aprobadas", key: "approved", color: "var(--green)" },
    { label: "Observadas", key: "observed", color: "var(--amber)" },
    { label: "Rechazadas", key: "rejected", color: "var(--red)" },
  ].map((g) => ({ ...g, value: APPROVALS.filter((a) => (state.approvalDecisions[a.id] || a.status) === g.key).length })).filter((g) => g.value > 0);
  const totalApprovals = approvalGroups.reduce((s, d) => s + d.value, 0);

  return (
    <>
      <PageHeader eyebrow="Dashboard" title="Centro ejecutivo de control" description="Vista general del estado del sistema, agentes, proyectos y aprobaciones pendientes." />

      <div className="grid-4" style={{ marginBottom: 14 }}>
        <div className="kpi">
          <div className="kpi-label">Proyectos</div>
          <div className="kpi-value">{allProjects.length}</div>
          <div className="kpi-sub">{atRiskProjects} en riesgo</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Aprobaciones</div>
          <div className="kpi-value" style={{ color: "var(--orange)" }}>{pendingApprovals}</div>
          <div className="kpi-sub">pendientes del GG</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Agentes activos</div>
          <div className="kpi-value">{activeAgents}</div>
          <div className="kpi-sub">de {AGENTS.filter((a) => a.type !== "human").length} total</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Alertas</div>
          <div className="kpi-value" style={{ color: "var(--red)" }}>{ALERTS.length}</div>
          <div className="kpi-sub">{ALERTS.filter((a) => a.level === "high").length} alta prioridad</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)" }}>Avance de proyectos</span>
          <span className="badge badge--mock">Mock</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {allProjects.map((p) => {
            const color = p.status === "on-track" ? "var(--green)" : p.status === "at-risk" ? "var(--orange)" : p.status === "delayed" ? "var(--red)" : "var(--blue)";
            const w = 80;
            const h = 28;
            const pct = p.progress / 100;
            const bars = 12;
            return (
              <div key={p.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{p.id}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color }}>{p.progress}%</span>
                </div>
                <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: h }}>
                  {Array.from({ length: bars }).map((_, i) => {
                    const filled = i < Math.round(bars * pct);
                    const bw = 4;
                    const gap = 2;
                    const x = i * (bw + gap);
                    return <rect key={i} x={x} y={0} width={bw} height={h} rx={1} fill={filled ? color : "var(--bg-subtle)"} opacity={filled ? 1 : 0.7} />;
                  })}
                </svg>
                <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nextMilestone}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 10, alignItems: "start" }}>
        <div className="space-y-3">
          <div className="card">
            <div className="card-header">
              <div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600, color: "var(--t3)", marginBottom: 1 }}>Organización IA</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Agentes y subagentes</div>
              </div>
              <span className="badge badge--mock">Mock</span>
            </div>
            {AGENTS.map((a) => (
              <AgentCompactRow key={a.id} agent={a} />
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Actividad reciente</div>
            </div>
            <div style={{ padding: "6px 0" }}>
              {ACTIVITY.map((act, i) => (
                <div key={act.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 14px", borderBottom: i < ACTIVITY.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div className={`agent-avatar ${agentAvatarClass(act.agent.toLowerCase())}`} style={{ width: 24, height: 24, fontSize: 9 }}>
                    {act.agent}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--t1)" }}>{act.action}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--t3)", flexShrink: 0, fontFamily: "var(--mono)" }}>{act.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="card">
            <div className="card-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Aprobaciones por estado</div>
              <span className="badge badge--orange">{pendingApprovals} pend.</span>
            </div>
            <div style={{ padding: "10px 14px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {approvalGroups.map((g) => (
                  <div key={g.key} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--t2)", flex: 1 }}>{g.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>{g.value}</span>
                    <span style={{ fontSize: 10, color: "var(--t3)" }}>({Math.round((g.value / totalApprovals) * 100)}%)</span>
                  </div>
                ))}
                {approvalGroups.length === 0 && <span style={{ fontSize: 11, color: "var(--t3)" }}>Sin aprobaciones</span>}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Próximos hitos</div>
            </div>
            <div style={{ padding: "8px 0" }}>
              {MILESTONES.map((m, i) => {
                const color = m.status === "on-track" ? "var(--green)" : m.status === "at-risk" ? "var(--orange)" : "var(--red)";
                return (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "7px 14px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, marginTop: 2 }} />
                      {i < MILESTONES.length - 1 && <div style={{ width: 1, flex: 1, background: "var(--border)", marginTop: 3, minHeight: 12 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: "var(--t3)" }}>{m.project}</div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--t2)" }}>{m.date}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color }}>{m.days}d</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Estado del sistema</div>
            </div>
            <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Ollama", status: "unknown", enabled: false },
                { label: "Memoria local", status: "online", enabled: true },
                { label: "Supabase", status: "unknown" as const, enabled: false },
                { label: "IA (proveedores)", status: "fallback", enabled: true },
              ].map((s) => {
                const color = s.status === "online" ? "var(--green)" : s.status === "offline" ? "var(--red)" : s.status === "fallback" ? "var(--amber)" : "var(--t3)";
                const label = s.status === "online" ? "Online" : s.status === "offline" ? "Offline" : s.status === "fallback" ? "Fallback" : "Sin verificar";
                return (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: s.status === "online" ? `0 0 4px ${color}` : "none" }} />
                    <span style={{ fontSize: 12, color: "var(--t2)", flex: 1 }}>{s.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color, opacity: s.enabled ? 1 : 0.5 }}>{label}</span>
                    {!s.enabled && <span style={{ fontSize: 9, color: "var(--t3)" }}>inactivo</span>}
                  </div>
                );
              })}
              <div style={{ marginTop: 4, fontSize: 10, color: "var(--t3)", display: "flex", justifyContent: "space-between" }}>
                <span>Última actividad</span>
                <span style={{ fontFamily: "var(--mono)" }}>{new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Alertas activas</div>
            </div>
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
              {ALERTS.map((a) => (
                <div key={a.id} className={`alert-item alert-item--${a.level}`}>
                  <div className={`alert-dot alert-dot--${a.level}`}></div>
                  <div>
                    <div className="alert-title">{a.title}</div>
                    <div className="alert-msg">{a.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
