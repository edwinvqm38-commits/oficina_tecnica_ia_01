"use client";

import type { ReactNode } from "react";
import { ALERTS, APPROVALS, CONNECTIONS, MILESTONES, PROJECTS, SKILLS } from "../../lib/data";
import { useStore, useSkillsWithOverrides } from "../../lib/store/StoreProvider";
import type { RouteId } from "../../lib/routes";

function CtxCard({ title, badge, children }: { title: string; badge?: { label: string; color?: string }; children: ReactNode }) {
  return (
    <div className="ctx-card">
      <div className="ctx-title">
        <span>{title}</span>
        {badge && <span className={`badge badge--${badge.color || "slate"}`}>{badge.label}</span>}
      </div>
      <div className="ctx-body">{children}</div>
    </div>
  );
}

function CtxMetric2({ a, b }: { a: { label: string; value: string }; b: { label: string; value: string } }) {
  return (
    <div className="ctx-metric">
      <div className="ctx-metric-item">
        <div className="ctx-metric-label">{a.label}</div>
        <div className="ctx-metric-value">{a.value}</div>
      </div>
      <div className="ctx-metric-item">
        <div className="ctx-metric-label">{b.label}</div>
        <div className="ctx-metric-value">{b.value}</div>
      </div>
    </div>
  );
}

function DashboardContext() {
  const pendingCount = APPROVALS.filter((a) => a.status === "pending").length;
  const highRisk = PROJECTS.filter((p) => p.risk === "high" || p.risk === "critical").length;
  return (
    <>
      <CtxCard title="Pulso operativo" badge={{ label: "Mock", color: "mock" }}>
        <CtxMetric2 a={{ label: "Alertas", value: String(ALERTS.length) }} b={{ label: "Aprobaciones", value: String(pendingCount) }} />
        <CtxMetric2 a={{ label: "Agentes", value: "2 activos" }} b={{ label: "En riesgo", value: String(highRisk) }} />
      </CtxCard>

      <CtxCard title="Alertas activas">
        {ALERTS.map((a) => (
          <div key={a.id} className={`alert-item alert-item--${a.level}`}>
            <div className={`alert-dot alert-dot--${a.level}`}></div>
            <div>
              <div className="alert-title">{a.title}</div>
              <div className="alert-msg">{a.message}</div>
            </div>
          </div>
        ))}
      </CtxCard>

      <CtxCard title="Próximos hitos">
        {MILESTONES.map((m, i) => (
          <div key={i} style={{ padding: "5px 0", borderBottom: i < MILESTONES.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{m.label}</span>
              <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>{m.date}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
              {m.project} · {m.days}d
            </div>
          </div>
        ))}
      </CtxCard>
    </>
  );
}

function OfficeContext() {
  const pendingCount = APPROVALS.filter((a) => a.status === "pending").length;
  return (
    <>
      <CtxCard title="Agente seleccionado">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div className="agent-avatar agent-avatar--gg">GG</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Gerente General</div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>Supervisión y aprobación</div>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>
          Autoridad central de decisión. Los agentes analizan y recomiendan; el GG aprueba toda acción crítica.
        </p>
      </CtxCard>

      <CtxCard title="Red multiagente">
        <CtxMetric2
          a={{ label: "Conexiones", value: String(CONNECTIONS.length) }}
          b={{ label: "Colaboración", value: String(CONNECTIONS.filter((c) => c.kind === "collaboration").length) }}
        />
        {CONNECTIONS.map((c) => (
          <div key={c.id} style={{ padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--t3)", fontWeight: 600, marginBottom: 2 }}>
              {c.kind === "supervision" ? "Supervisión" : "Colaboración"}
            </div>
            <div style={{ fontSize: 12, color: "var(--t2)" }}>
              {c.from} → {c.to}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>{c.label}</div>
          </div>
        ))}
      </CtxCard>

      <CtxCard title="Aprobaciones bloqueadas" badge={{ label: `${pendingCount} pend.`, color: "orange" }}>
        <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>Ninguna acción crítica se ejecuta sin aprobación explícita del GG.</p>
      </CtxCard>
    </>
  );
}

function InboxContext() {
  const { decideApproval } = useStore();
  const pending = APPROVALS.filter((a) => a.status === "pending");
  const firstPending = pending[0];
  return (
    <>
      <CtxCard title="Decisión activa" badge={{ label: "Pendiente", color: "orange" }}>
        {firstPending && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginBottom: 4, lineHeight: 1.3 }}>{firstPending.title}</div>
            <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 10, lineHeight: 1.4 }}>{firstPending.summary}</div>
            <div style={{ display: "flex", gap: 5 }}>
              <button
                className="btn btn--success btn--sm"
                onClick={() => decideApproval(firstPending.id, "approved", { title: firstPending.title, summary: firstPending.summary })}
              >
                Aprobar
              </button>
              <button
                className="btn btn--warning btn--sm"
                onClick={() => decideApproval(firstPending.id, "observed", { title: firstPending.title, summary: firstPending.summary })}
              >
                Observar
              </button>
              <button
                className="btn btn--danger btn--sm"
                onClick={() => decideApproval(firstPending.id, "rejected", { title: firstPending.title, summary: firstPending.summary })}
              >
                Rechazar
              </button>
            </div>
          </div>
        )}
      </CtxCard>

      <CtxCard title="Memoria propuesta">
        <div style={{ padding: "6px 0" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginBottom: 2 }}>Criterio de cableado en terreno rocoso</div>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>Propuesta por IC · PRY-001</div>
          <span className="badge badge--amber" style={{ marginTop: 6 }}>
            Pendiente GG
          </span>
        </div>
      </CtxCard>

      <CtxCard title="Skill propuesta">
        <div style={{ padding: "6px 0" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginBottom: 2 }}>Gestión de Restricciones v1.1</div>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>Propuesta por PM · PRY-002</div>
          <span className="badge badge--blue" style={{ marginTop: 6 }}>
            Requiere aprobación GG
          </span>
        </div>
      </CtxCard>
    </>
  );
}

function ApprovalsContext() {
  const { state } = useStore();
  const status = (a: { id: string; status: string }) => state.approvalDecisions[a.id] ?? a.status;
  const pending = APPROVALS.filter((a) => status(a) === "pending").length;
  const highRisk = APPROVALS.filter((a) => a.risk === "high" || a.risk === "critical").length;
  const skills = APPROVALS.filter((a) => a.category === "skill").length;
  return (
    <>
      <CtxCard title="Carga de decisiones">
        <CtxMetric2 a={{ label: "Pendientes", value: String(pending) }} b={{ label: "Riesgo alto", value: String(highRisk) }} />
        <CtxMetric2 a={{ label: "Skills", value: String(skills) }} b={{ label: "Memoria", value: "1" }} />
      </CtxCard>

      <CtxCard title="Siguiente prioridad" badge={{ label: "Crítico", color: "red" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", lineHeight: 1.3, marginBottom: 6 }}>{APPROVALS[0].title}</div>
        <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.4 }}>{APPROVALS[0].summary}</div>
      </CtxCard>

      <CtxCard title="Regla de control">
        <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>
          Aprobar, observar y rechazar son acciones visuales en este prototipo. En producción, ninguna decisión crítica se ejecuta sin aprobación real del GG.
        </p>
      </CtxCard>
    </>
  );
}

function SkillsContext() {
  const skills = useSkillsWithOverrides();
  const active = skills.filter((s) => s.status === "active").length;
  const proposed = skills.filter((s) => s.status === "proposed").length;
  const observed = skills.filter((s) => s.status === "observed").length;
  const focused = SKILLS[1];
  return (
    <>
      <CtxCard title="Estado del registry">
        <CtxMetric2 a={{ label: "Activas", value: String(active) }} b={{ label: "Propuestas", value: String(proposed) }} />
        <CtxMetric2 a={{ label: "Observadas", value: String(observed) }} b={{ label: "Req. GG", value: String(skills.filter((s) => s.approvalRequired).length) }} />
      </CtxCard>

      {focused && (
        <CtxCard title="Skill en foco">
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginBottom: 4, lineHeight: 1.3 }}>{focused.name}</div>
          <div className="info-row">
            <span className="info-row-label">Versión</span>
            <span className="info-row-value">{focused.version}</span>
          </div>
          <div className="info-row">
            <span className="info-row-label">Riesgo</span>
            <span className="info-row-value">{focused.risk}</span>
          </div>
          <div className="info-row">
            <span className="info-row-label">Agente</span>
            <span className="info-row-value">{focused.agent}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <span className={`badge badge--${focused.status === "active" ? "green" : focused.status === "proposed" ? "blue" : "amber"}`}>
              {focused.status === "active" ? "Activa" : focused.status === "proposed" ? "Propuesta" : "Observada"}
            </span>
          </div>
        </CtxCard>
      )}

      <CtxCard title="Sin autoactivación">
        <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>
          Una skill propuesta no se activa hasta que el GG apruebe versión, alcance, riesgos, entradas y salida esperada.
        </p>
      </CtxCard>
    </>
  );
}

const CONTEXT_MAP: Partial<Record<RouteId, ReactNode>> = {
  dashboard: <DashboardContext />,
  office: <OfficeContext />,
  inbox: <InboxContext />,
  approvals: <ApprovalsContext />,
  skills: <SkillsContext />,
};

export const CONTEXT_ROUTES: RouteId[] = ["dashboard", "office", "inbox", "approvals", "skills"];

export function ContextPanel({ route }: { route: RouteId }) {
  const content = CONTEXT_MAP[route];
  if (!content) return null;
  return <aside className="ig-ctx">{content}</aside>;
}
