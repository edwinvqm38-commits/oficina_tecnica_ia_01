"use client";

import { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Icons } from "../../lib/icons";
import { useStore } from "../../lib/store/StoreProvider";
import { APPROVALS } from "../../lib/data";
import { CATEGORY_LABEL, RiskBadge, StatusBadge } from "./shared";
import type { Approval } from "../../lib/types";

function ApprovalRow({ approval }: { approval: Approval }) {
  const { state, decideApproval } = useStore();
  const status = state.approvalDecisions[approval.id] || approval.status;
  const borderColor = approval.risk === "critical" ? "var(--red)" : approval.risk === "high" ? "var(--orange)" : approval.risk === "medium" ? "var(--amber)" : "var(--green)";

  function handleAction(action: "approved" | "observed" | "rejected") {
    decideApproval(approval.id, action, { title: approval.title, summary: approval.summary });
  }

  return (
    <div className="approval-item" style={{ borderLeft: `3px solid ${borderColor}` }}>
      <div className="approval-main">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--t3)" }}>{approval.id}</span>
            <span className="badge badge--slate">{CATEGORY_LABEL[approval.category]}</span>
            <RiskBadge risk={approval.risk} />
            <StatusBadge status={status} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 4, lineHeight: 1.3 }}>{approval.title}</div>
          <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: 6 }}>{approval.summary}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>
              Agente: <b style={{ color: "var(--t2)" }}>{approval.agent}</b>
            </span>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>
              Proyecto: <b style={{ color: "var(--t2)" }}>{approval.project}</b>
            </span>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>
              Tipo: <b style={{ color: "var(--t2)" }}>{approval.decisionType}</b>
            </span>
            <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>{approval.created}</span>
          </div>
        </div>

        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
          {status === "pending" ? (
            <>
              <button className="btn btn--success btn--sm" onClick={() => handleAction("approved")}>
                <Icons.check width={12} height={12} /> Aprobar
              </button>
              <button className="btn btn--warning btn--sm" onClick={() => handleAction("observed")}>
                <Icons.eye width={12} height={12} /> Observar
              </button>
              <button className="btn btn--danger btn--sm" onClick={() => handleAction("rejected")}>
                <Icons.x width={12} height={12} /> Rechazar
              </button>
              <span style={{ fontSize: 10, color: "var(--t3)", textAlign: "center", marginTop: 2 }}>Solo visual</span>
            </>
          ) : (
            <span className="btn btn--done btn--sm">{status === "approved" ? "✓ Aprobada" : status === "observed" ? "~ Observada" : "✗ Rechazada"}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ApprovalsView() {
  const { state } = useStore();
  const [filter, setFilter] = useState("all");
  const filterTabs = [
    { id: "all", label: "Todas" },
    { id: "pending", label: "Pendientes" },
    { id: "skill", label: "Skills" },
    { id: "memory", label: "Memoria" },
    { id: "critical-decision", label: "Decisiones críticas" },
  ];
  const decisionOf = (a: Approval) => state.approvalDecisions[a.id] || a.status;
  const filtered = filter === "all" ? APPROVALS : filter === "pending" ? APPROVALS.filter((a) => decisionOf(a) === "pending") : APPROVALS.filter((a) => a.category === filter);

  const pendingCount = APPROVALS.filter((a) => decisionOf(a) === "pending").length;

  return (
    <>
      <PageHeader
        eyebrow="Aprobaciones"
        title="Cola de decisiones del GG"
        description="Recomendaciones, skills y memorias que requieren decisión explícita antes de ejecutarse."
        actions={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="badge badge--orange">{pendingCount} pendientes</span>
            <span className="badge badge--mock">Acciones visuales</span>
          </div>
        }
      />

      <div style={{ display: "flex", gap: 2, marginBottom: 10, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 3, width: "fit-content" }}>
        {filterTabs.map((f) => (
          <button key={f.id} className={`mode-tab ${filter === f.id ? "mode-tab--active" : ""}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div style={{ padding: "24px 14px", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>Sin aprobaciones en esta categoría.</div>
        ) : (
          filtered.map((a) => <ApprovalRow key={a.id} approval={a} />)
        )}
      </div>
    </>
  );
}
