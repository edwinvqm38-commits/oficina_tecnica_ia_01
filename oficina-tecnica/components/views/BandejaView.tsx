"use client";

import { useEffect, useState } from "react";
import {
  listPendingAgentKnowledgeApprovals,
  type AgentKnowledgeApproval,
} from "@/lib/ai-office/agentKnowledgeRepository";
import { PageHeader } from "../shell/PageHeader";
import { agentAvatarClass } from "./shared";

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function shortText(value: string, max = 240): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}...`;
}

function ApprovalRequestCard({ approval }: { approval: AgentKnowledgeApproval }) {
  return (
    <article className="card">
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div className={`agent-avatar ${agentAvatarClass(approval.agentId)}`}>{approval.agentId.slice(0, 2).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
              <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--t3)" }}>{approval.id}</span>
              <span className="badge badge--orange">Pendiente</span>
              <span className="badge badge--slate">{approval.knowledgeType}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", lineHeight: 1.3 }}>{approval.title}</div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: "var(--t3)" }}>Propuesto por</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>{approval.agentId.toUpperCase()}</div>
        </div>
      </div>
      <div className="card-body">
        <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6, marginBottom: 10 }}>{shortText(approval.content)}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--t3)" }}>
            Proyecto: <b style={{ color: "var(--t2)" }}>{approval.projectId ?? "Sin proyecto"}</b>
          </span>
          <span style={{ fontSize: 11, color: "var(--t3)" }}>
            Fuente: <b style={{ color: "var(--t2)" }}>{approval.source ?? "No registrada"}</b>
          </span>
          <span style={{ fontSize: 11, color: "var(--t3)" }}>
            Fecha: <b style={{ color: "var(--t2)", fontFamily: "var(--mono)" }}>{formatDate(approval.createdAt)}</b>
          </span>
        </div>
      </div>
    </article>
  );
}

export function BandejaView() {
  const [approvals, setApprovals] = useState<AgentKnowledgeApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

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
          setWarning("No se pudo cargar la bandeja gerencial real.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Bandeja Gerencial"
        title="Solicitudes y decisiones pendientes"
        description="Cola real de propuestas generadas por agentes que requieren revisión."
        actions={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="badge badge--orange">{loading ? "..." : approvals.length} pendientes</span>
          </div>
        }
      />

      {warning && (
        <div className="card" style={{ marginBottom: 12, padding: "10px 14px", borderColor: "var(--amber-border)", background: "var(--amber-bg)" }}>
          <div style={{ fontSize: 12, color: "var(--amber-text)", lineHeight: 1.5 }}>{warning} Se muestra la bandeja vacia.</div>
        </div>
      )}

      <div className="space-y-3">
        <div className="card">
          <div className="card-header">
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 600, color: "var(--t3)", marginBottom: 2 }}>
                Cola real
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Conocimientos propuestos</div>
            </div>
            <span className="badge badge--blue">agent_knowledge</span>
          </div>
          {loading ? (
            <div style={{ padding: "24px 14px", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>Cargando solicitudes...</div>
          ) : approvals.length === 0 ? (
            <div style={{ padding: "32px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 5 }}>Sin solicitudes gerenciales pendientes</div>
              <div style={{ fontSize: 12, color: "var(--t3)" }}>No existen decisiones generadas por agentes que requieran revisión.</div>
            </div>
          ) : (
            <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {approvals.map((approval) => (
                <ApprovalRequestCard key={approval.id} approval={approval} />
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)" }}>Regla de control</div>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>
              Los agentes pueden proponer conocimiento operativo, pero nada se incorpora como criterio aprobado sin decision explicita del usuario autorizado.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
