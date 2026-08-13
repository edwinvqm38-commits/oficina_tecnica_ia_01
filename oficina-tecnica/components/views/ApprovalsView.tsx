"use client";

import { useEffect, useMemo, useState } from "react";
import { Icons } from "../../lib/icons";
import {
  listPendingAgentKnowledgeApprovals,
  updateAgentKnowledgeApprovalStatus,
  type AgentKnowledgeApproval,
} from "@/lib/ai-office/agentKnowledgeRepository";
import { PageHeader } from "../shell/PageHeader";

type ApprovalFilter = "all" | "pending" | "skill" | "memory" | "critical-decision";

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function categoryFor(approval: AgentKnowledgeApproval): "skill" | "memory" {
  return approval.knowledgeType.toLowerCase().includes("skill") ? "skill" : "memory";
}

function priorityLabel(importance: number | null): { label: string; className: string } {
  if ((importance ?? 0) >= 5) return { label: "Alta", className: "badge--red" };
  if ((importance ?? 0) >= 3) return { label: "Media", className: "badge--amber" };
  return { label: "Baja", className: "badge--slate" };
}

function excerpt(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 220) return normalized;
  return `${normalized.slice(0, 220).trim()}...`;
}

function ApprovalRow({
  approval,
  processing,
  onDecision,
}: {
  approval: AgentKnowledgeApproval;
  processing: boolean;
  onDecision: (id: string, status: "approved" | "rejected") => void;
}) {
  const priority = priorityLabel(approval.importance);

  return (
    <div className="approval-item" style={{ borderLeft: `3px solid ${(approval.importance ?? 0) >= 5 ? "var(--red)" : "var(--blue)"}` }}>
      <div className="approval-main">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--t3)" }}>{approval.id}</span>
            <span className="badge badge--slate">{categoryFor(approval) === "skill" ? "Skill" : "Memoria"}</span>
            <span className={`badge ${priority.className}`}>Prioridad {priority.label}</span>
            <span className="badge badge--orange">Pendiente</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 4, lineHeight: 1.3 }}>{approval.title}</div>
          <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: 6 }}>{excerpt(approval.content)}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>
              Agente: <b style={{ color: "var(--t2)" }}>{approval.agentId.toUpperCase()}</b>
            </span>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>
              Proyecto: <b style={{ color: "var(--t2)" }}>{approval.projectId ?? "Sin proyecto"}</b>
            </span>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>
              Tipo: <b style={{ color: "var(--t2)" }}>{approval.knowledgeType}</b>
            </span>
            <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>{formatDate(approval.createdAt)}</span>
          </div>
        </div>

        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
          <button className="btn btn--success btn--sm" disabled={processing} onClick={() => onDecision(approval.id, "approved")}>
            <Icons.check width={12} height={12} /> Aprobar
          </button>
          <button className="btn btn--danger btn--sm" disabled={processing} onClick={() => onDecision(approval.id, "rejected")}>
            <Icons.x width={12} height={12} /> Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}

export function ApprovalsView() {
  const [filter, setFilter] = useState<ApprovalFilter>("all");
  const [approvals, setApprovals] = useState<AgentKnowledgeApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listPendingAgentKnowledgeApprovals()
      .then((result) => {
        if (cancelled) return;
        setApprovals(result.source === "supabase" ? result.rows : []);
        setWarning(result.warning);
      })
      .catch(() => {
        if (!cancelled) {
          setApprovals([]);
          setWarning("No se pudo cargar la cola real de aprobaciones.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all" || filter === "pending") return approvals;
    if (filter === "critical-decision") return [];
    return approvals.filter((approval) => categoryFor(approval) === filter);
  }, [approvals, filter]);

  const nextApproval = approvals[0] ?? null;
  const filterTabs: Array<{ id: ApprovalFilter; label: string }> = [
    { id: "all", label: "Todas" },
    { id: "pending", label: "Pendientes" },
    { id: "skill", label: "Skills" },
    { id: "memory", label: "Memoria" },
    { id: "critical-decision", label: "Decisiones críticas" },
  ];

  function handleDecision(id: string, status: "approved" | "rejected") {
    setProcessingId(id);
    updateAgentKnowledgeApprovalStatus(id, status)
      .then(() => {
        setApprovals((current) => current.filter((approval) => approval.id !== id));
      })
      .catch(() => {
        setWarning("No se pudo guardar la decision. Intenta nuevamente.");
      })
      .finally(() => {
        setProcessingId(null);
      });
  }

  return (
    <>
      <PageHeader
        eyebrow="Aprobaciones"
        title="Cola de decisiones del GG"
        description="Propuestas persistentes que requieren decisión explícita antes de quedar aprobadas."
        actions={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="badge badge--orange">{loading ? "..." : approvals.length} pendientes</span>
          </div>
        }
      />

      {warning && (
        <div className="card" style={{ marginBottom: 12, padding: "10px 14px", borderColor: "var(--amber-border)", background: "var(--amber-bg)" }}>
          <div style={{ fontSize: 12, color: "var(--amber-text)", lineHeight: 1.5 }}>{warning}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 2, marginBottom: 10, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 3, width: "fit-content" }}>
        {filterTabs.map((tab) => (
          <button key={tab.id} className={`mode-tab ${filter === tab.id ? "mode-tab--active" : ""}`} onClick={() => setFilter(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 10, alignItems: "start" }}>
        <div className="card">
          {loading ? (
            <div style={{ padding: "24px 14px", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>Cargando aprobaciones...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "28px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 5 }}>Sin decisiones pendientes</div>
              <div style={{ fontSize: 12, color: "var(--t3)" }}>No hay registros reales para esta categoria.</div>
            </div>
          ) : (
            filtered.map((approval) => (
              <ApprovalRow
                key={approval.id}
                approval={approval}
                processing={processingId === approval.id}
                onDecision={handleDecision}
              />
            ))
          )}
        </div>

        <div className="space-y-3">
          <div className="card">
            <div className="card-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Siguiente prioridad</div>
            </div>
            {nextApproval ? (
              <div className="card-body">
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)", lineHeight: 1.35, marginBottom: 6 }}>{nextApproval.title}</div>
                <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>{excerpt(nextApproval.content)}</div>
              </div>
            ) : (
              <div style={{ padding: "16px 14px", color: "var(--t3)", fontSize: 12 }}>Sin decisiones pendientes.</div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Regla de control</div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>
                Ninguna recomendacion de agente se considera aprobada hasta registrar una decision persistente del usuario autorizado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
