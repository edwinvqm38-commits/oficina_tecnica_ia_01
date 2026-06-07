"use client";

import { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Icons } from "../../lib/icons";
import { useStore } from "../../lib/store/StoreProvider";
import { PROJECTS } from "../../lib/data";
import { ProgressFill, RiskBadge, StatusBadge } from "./shared";
import type { Project } from "../../lib/types";

const KANBAN_COLS = ["Planificacion", "Ejecucion", "Control", "Cierre"];

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="project-card">
      <div className="project-card-id">{project.id}</div>
      <div className="project-card-name">{project.name}</div>
      <div className="project-card-client">{project.client}</div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontSize: 10, color: "var(--t3)" }}>Avance</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)" }}>{project.progress}%</span>
        </div>
        <ProgressFill status={project.status} progress={project.progress} />
      </div>

      <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 8, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--t3)" }}>Disciplina</span>
          <span style={{ fontWeight: 500 }}>{project.discipline}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--t3)" }}>Costo</span>
          <span style={{ fontWeight: 500, fontFamily: "var(--mono)" }}>{project.cost}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--t3)" }}>Próx. hito</span>
          <span style={{ fontWeight: 500 }}>{project.nextMilestone}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--t3)" }}>Vencimiento</span>
          <span style={{ fontWeight: 500 }}>{project.due}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <StatusBadge status={project.status} />
        <RiskBadge risk={project.risk} />
        {project.agents.map((a) => (
          <span key={a} className="badge badge--blue">
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProjectsView() {
  const { state } = useStore();
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");
  const allProjects = [...PROJECTS, ...state.customProjects];
  const atRisk = allProjects.filter((p) => p.status === "at-risk" || p.status === "delayed").length;

  return (
    <>
      <PageHeader
        eyebrow="Proyectos"
        title="Portafolio de proyectos de ingeniería"
        description="Estado, avance, costos y riesgos de cada proyecto."
        actions={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div className="kpi" style={{ padding: "5px 10px" }}>
              <span style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".07em" }}>Total</span>
              <span style={{ fontSize: 15, fontWeight: 700, marginLeft: 6 }}>{allProjects.length}</span>
            </div>
            <div className="kpi" style={{ padding: "5px 10px" }}>
              <span style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".07em" }}>Riesgo</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--orange)", marginLeft: 6 }}>{atRisk}</span>
            </div>
            <div className="mode-tabs">
              <button className={`mode-tab ${viewMode === "kanban" ? "mode-tab--active" : ""}`} onClick={() => setViewMode("kanban")}>
                Kanban
              </button>
              <button className={`mode-tab ${viewMode === "list" ? "mode-tab--active" : ""}`} onClick={() => setViewMode("list")}>
                Lista
              </button>
            </div>
            <button className="btn btn--primary" disabled title="Disponible próximamente">
              <Icons.folder width={13} height={13} /> Nuevo proyecto
            </button>
          </div>
        }
      />

      {viewMode === "list" ? (
        <div className="card">
          <div className="card-header">
            <div style={{ fontSize: 13, fontWeight: 600 }}>Proyectos</div>
          </div>
          {allProjects.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderBottom: "1px solid var(--border)",
                borderLeft: `3px solid var(--${p.risk === "critical" ? "red" : p.risk === "high" ? "orange" : p.risk === "medium" ? "amber" : "green"})`,
              }}
            >
              <div style={{ width: 60, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--t3)" }}>{p.id}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 1 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>
                  {p.client} · {p.column}
                </div>
              </div>
              <div style={{ width: 120, flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: "var(--t3)" }}>Avance</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{p.progress}%</span>
                </div>
                <ProgressFill status={p.status} progress={p.progress} />
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <StatusBadge status={p.status} />
                <RiskBadge risk={p.risk} />
              </div>
              <div style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--t2)", flexShrink: 0 }}>{p.cost}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="kanban">
          {KANBAN_COLS.map((col) => {
            const colProjects = allProjects.filter((p) => p.column === col);
            return (
              <div key={col} className="kanban-col">
                <div className="kanban-col-header">
                  <span className="kanban-col-title">{col}</span>
                  <span className="kanban-col-count">{colProjects.length}</span>
                </div>
                {colProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
                {colProjects.length === 0 && (
                  <div style={{ padding: "16px 8px", textAlign: "center", color: "var(--t3)", fontSize: 11, borderRadius: "var(--r)", border: "1px dashed var(--border)" }}>Sin proyectos</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
