"use client";

import { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Icons } from "../../lib/icons";
import { useStore, useSkillsWithOverrides } from "../../lib/store/StoreProvider";
import { RiskBadge, StatusBadge } from "./shared";
import type { Skill } from "../../lib/types";

const SKILL_TYPE_LABEL: Record<string, string> = {
  "analysis-workflow": "Workflow de análisis",
  "review-protocol": "Protocolo de revisión",
  "coordination-rule": "Regla de coordinación",
  "knowledge-method": "Método de conocimiento",
};

function SkillRow({ skill }: { skill: Skill }) {
  const [expanded, setExpanded] = useState(false);
  const { setSkillState } = useStore();
  const ggColor = skill.ggApproval.label.includes("Aprobada") ? "green" : skill.ggApproval.label.includes("Observada") ? "amber" : skill.ggApproval.label.includes("definición") ? "slate" : "blue";

  return (
    <div className="skill-row">
      <div className="skill-row-main" onClick={() => setExpanded((e) => !e)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 5, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--t3)" }}>{skill.id}</span>
            <StatusBadge status={skill.status} />
            <RiskBadge risk={skill.risk} />
            <span className="badge badge--slate">{SKILL_TYPE_LABEL[skill.type]}</span>
            {skill.approvalRequired && <span className="badge badge--orange">Req. GG</span>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 2 }}>{skill.name}</div>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>{skill.trigger}</div>
        </div>

        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>{skill.agent}</span>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--t1)" }}>{skill.version}</span>
          </div>
          <span className={`badge badge--${ggColor}`}>{skill.ggApproval.label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{expanded ? <Icons.chevronUp /> : <Icons.chevronDown />}</div>
        </div>
      </div>

      {expanded && (
        <div className="skill-row-expand">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div className="detail-block">
              <div className="detail-block-title">Entradas esperadas</div>
              {skill.inputs.map((i) => (
                <div key={i} className="list-item-bullet">
                  {i}
                </div>
              ))}
            </div>
            <div className="detail-block">
              <div className="detail-block-title">Flujo de trabajo</div>
              {skill.steps.map((s, i) => (
                <div key={i} className="list-item-bullet">
                  <span style={{ color: "var(--blue-text)", fontWeight: 600, marginRight: 2 }}>{i + 1}.</span>
                  {s}
                </div>
              ))}
            </div>
            <div className="detail-block">
              <div className="detail-block-title">Reglas de seguridad</div>
              {skill.safety.map((s) => (
                <div key={s} className="list-item-bullet" style={{ color: "var(--orange-text)" }}>
                  {s}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="detail-block" style={{ background: "var(--blue-bg)", borderColor: "var(--blue-border)" }}>
              <div className="detail-block-title" style={{ color: "var(--blue-text)" }}>
                Mejora sugerida
              </div>
              <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>{skill.improvement}</div>
            </div>
            <div className="detail-block">
              <div className="detail-block-title">Validación cruzada</div>
              <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600 }}>{skill.crossAgents.join(", ")}</span>: {skill.crossPurpose}
              </div>
              <div style={{ marginTop: 6 }}>
                <div className="detail-block-title" style={{ marginBottom: 3 }}>
                  Aprobación GG
                </div>
                <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>{skill.ggApproval.scope}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--t3)", marginRight: "auto" }}>Control del GG:</span>
            {skill.status !== "active" && (
              <button
                className="btn btn--success btn--sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSkillState(skill.id, "active");
                }}
              >
                <Icons.check width={12} height={12} /> Activar skill
              </button>
            )}
            {skill.status !== "observed" && (
              <button
                className="btn btn--warning btn--sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSkillState(skill.id, "observed");
                }}
              >
                <Icons.eye width={12} height={12} /> Observar
              </button>
            )}
            {skill.status === "active" && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSkillState(skill.id, "rejected");
                }}
              >
                Desactivar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SkillsView() {
  const skills = useSkillsWithOverrides();
  const [filter, setFilter] = useState("all");

  const activeCount = skills.filter((s) => s.status === "active").length;
  const proposedCount = skills.filter((s) => s.status === "proposed").length;

  const domainTiles = [
    { label: "Agente Costos", value: "1 activa", detail: "Análisis de desviación de presupuesto", color: "green" },
    { label: "Agente PM", value: "1 propuesta · 1 observada", detail: "Gestión de restricciones y riesgos", color: "amber" },
    { label: "Ing. Eléctrico (futuro)", value: "1 propuesta v0.1", detail: "Criterios de diseño eléctrico", color: "slate" },
  ];

  const filtered = filter === "all" ? skills : skills.filter((s) => s.status === filter);

  const filterTabs = [
    { id: "all", label: "Todas" },
    { id: "active", label: "Activas" },
    { id: "proposed", label: "Propuestas" },
    { id: "observed", label: "Observadas" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Skills de agentes IA"
        title="Capacidades operativas versionadas"
        description="Instrucciones, criterios y flujos que definen cómo opera cada agente. Versionadas y aprobadas por el GG antes de activarse."
        actions={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div className="kpi" style={{ padding: "5px 10px" }}>
              <span style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".07em" }}>Activas</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--green)", marginLeft: 6 }}>{activeCount}</span>
            </div>
            <div className="kpi" style={{ padding: "5px 10px" }}>
              <span style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".07em" }}>Propuestas</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--blue)", marginLeft: 6 }}>{proposedCount}</span>
            </div>
            <button className="btn btn--primary" disabled title="Disponible próximamente">
              <Icons.sparkle width={13} height={13} /> Proponer skill
            </button>
          </div>
        }
      />

      <div className="grid-3" style={{ marginBottom: 12 }}>
        {domainTiles.map((t) => (
          <div key={t.label} className="card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, color: "var(--t3)", marginBottom: 3 }}>{t.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: `var(--${t.color === "slate" ? "t3" : t.color})`, marginBottom: 2 }}>{t.value}</div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>{t.detail}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 2, marginBottom: 10, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 3, width: "fit-content" }}>
        {filterTabs.map((f) => (
          <button key={f.id} className={`mode-tab ${filter === f.id ? "mode-tab--active" : ""}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600, color: "var(--t3)", marginBottom: 1 }}>Capacidades versionadas</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Skills operativas de agentes IA</div>
          </div>
          <span className="badge badge--mock">Mock · {filtered.length} skills</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>Sin skills en esta categoría.</div>
        ) : (
          filtered.map((s) => <SkillRow key={s.id} skill={s} />)
        )}
      </div>
    </>
  );
}
