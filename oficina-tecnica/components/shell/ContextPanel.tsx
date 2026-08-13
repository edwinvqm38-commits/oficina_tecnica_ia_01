"use client";

import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "../ui";
import { CONNECTIONS } from "../../lib/data";
import type { RouteId } from "../../lib/routes";

const ctxBadgeTone: Record<string, BadgeTone> = {
  blue: "info",
  green: "success",
  amber: "warning",
  orange: "warning",
  red: "danger",
  slate: "neutral",
};

function CtxCard({ title, badge, children }: { title: string; badge?: { label: string; color?: string }; children: ReactNode }) {
  return (
    <div className="ctx-card">
      <div className="ctx-title">
        <span>{title}</span>
        {badge && <Badge tone={ctxBadgeTone[badge.color || "slate"] ?? "neutral"}>{badge.label}</Badge>}
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
        <p className="ctx-note">Sin alertas registradas en una fuente persistente.</p>
      </CtxCard>

      <CtxCard title="Próximos hitos">
        <p className="ctx-note">No hay hitos reales conectados a esta vista.</p>
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
        <p className="ctx-note">
          Autoridad central de decisión. Los agentes analizan y recomiendan; el GG aprueba toda acción crítica.
        </p>
      </CtxCard>

      <CtxCard title="Red multiagente">
        <CtxMetric2
          a={{ label: "Conexiones", value: String(CONNECTIONS.length) }}
          b={{ label: "Colaboración", value: String(CONNECTIONS.filter((c) => c.kind === "collaboration").length) }}
        />
        {CONNECTIONS.map((c) => (
          <div key={c.id} className="ctx-list-row">
            <div className="ctx-list-kicker">
              {c.kind === "supervision" ? "Supervisión" : "Colaboración"}
            </div>
            <div className="ctx-list-title">
              {c.from} → {c.to}
            </div>
            <div className="ctx-list-sub">{c.label}</div>
          </div>
        ))}
      </CtxCard>

      <CtxCard title="Aprobaciones bloqueadas">
        <p className="ctx-note">Ninguna acción crítica se ejecuta sin aprobación explícita del GG.</p>
      </CtxCard>
    </>
  );
}

function InboxContext() {
  return (
    <>
      <CtxCard title="Decisión activa">
        <p className="ctx-note">La cola real se muestra en la Bandeja principal cuando existen propuestas pendientes.</p>
      </CtxCard>

      <CtxCard title="Memoria propuesta">
        <p className="ctx-note">Sin memoria propuesta registrada en el panel contextual.</p>
      </CtxCard>

      <CtxCard title="Skill propuesta">
        <p className="ctx-note">Sin skill propuesta registrada en el panel contextual.</p>
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
        <div className="ctx-note">Sin prioridad contextual registrada fuera de la cola real.</div>
      </CtxCard>

      <CtxCard title="Regla de control">
        <p className="ctx-note">
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
        <p className="ctx-note">
          El detalle real se lee desde agent_skill_versions en la vista principal. Este panel no muestra una skill de ejemplo.
        </p>
      </CtxCard>

      <CtxCard title="Sin autoactivación">
        <p className="ctx-note">
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
