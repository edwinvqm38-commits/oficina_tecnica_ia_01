"use client";

import type { ReactNode } from "react";
import { CONNECTIONS } from "../../lib/data";
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
  return (
    <>
      <CtxCard title="Pulso operativo">
        <CtxMetric2 a={{ label: "Alertas", value: "0" }} b={{ label: "Hitos", value: "0" }} />
        <CtxMetric2 a={{ label: "Obs.", value: "0" }} b={{ label: "Riesgo", value: "0" }} />
      </CtxCard>

      <CtxCard title="Alertas activas">
        <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>Sin alertas registradas en una fuente persistente.</p>
      </CtxCard>

      <CtxCard title="Próximos hitos">
        <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>No hay hitos reales conectados a esta vista.</p>
      </CtxCard>
    </>
  );
}

function OfficeContext() {
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

      <CtxCard title="Aprobaciones bloqueadas">
        <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>Ninguna acción crítica se ejecuta sin aprobación explícita del GG.</p>
      </CtxCard>
    </>
  );
}

function InboxContext() {
  return (
    <>
      <CtxCard title="Decisión activa">
        <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>La cola real se muestra en la Bandeja principal cuando existen propuestas pendientes.</p>
      </CtxCard>

      <CtxCard title="Memoria propuesta">
        <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>Sin memoria propuesta registrada en el panel contextual.</p>
      </CtxCard>

      <CtxCard title="Skill propuesta">
        <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>Sin skill propuesta registrada en el panel contextual.</p>
      </CtxCard>
    </>
  );
}

function ApprovalsContext() {
  return (
    <>
      <CtxCard title="Carga de decisiones">
        <CtxMetric2 a={{ label: "Críticas", value: "0" }} b={{ label: "Obs.", value: "0" }} />
        <CtxMetric2 a={{ label: "Skills", value: "0" }} b={{ label: "Memoria", value: "0" }} />
      </CtxCard>

      <CtxCard title="Siguiente prioridad">
        <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.4 }}>Sin prioridad contextual registrada fuera de la cola real.</div>
      </CtxCard>

      <CtxCard title="Regla de control">
        <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>
          Ninguna decisión crítica se ejecuta sin aprobación real del GG.
        </p>
      </CtxCard>
    </>
  );
}

function SkillsContext() {
  return (
    <>
      <CtxCard title="Estado del registry">
        <CtxMetric2 a={{ label: "Activas", value: "0" }} b={{ label: "Propuestas", value: "0" }} />
        <CtxMetric2 a={{ label: "Observadas", value: "0" }} b={{ label: "Req. GG", value: "0" }} />
      </CtxCard>

      <CtxCard title="Skill en foco">
        <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>
          El detalle real se lee desde agent_skill_versions en la vista principal. Este panel no muestra una skill de ejemplo.
        </p>
      </CtxCard>

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
