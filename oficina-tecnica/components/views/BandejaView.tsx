"use client";

import { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Icons } from "../../lib/icons";
import { APPROVALS, MVP_REQUEST, MVP_RESPONSES } from "../../lib/data";
import { agentAvatarClass, StatusBadge } from "./shared";
import type { AgentResponse, AgentResponseFinding } from "../../lib/types";

function FindingRow({ f }: { f: AgentResponseFinding }) {
  const valClass = f.type === "risk" ? "finding-value--risk" : f.type === "warning" ? "finding-value--warning" : f.type === "number" ? "finding-value--number" : "";
  return (
    <div className="finding-row">
      <span className="finding-label">{f.label}</span>
      <span className={`finding-value ${valClass}`}>{f.value}</span>
    </div>
  );
}

function AgentResponseCard({ response }: { response: AgentResponse }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card">
      <div className="card-header" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={`agent-avatar ${agentAvatarClass(response.agentId)}`}>{response.initials}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{response.agentName}</div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>
              Confianza: {response.confidence}% · {response.sources} fuente{response.sources > 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge--green">Respondido</span>
          {open ? <Icons.chevronUp /> : <Icons.chevronDown />}
        </div>
      </div>

      {open && (
        <>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}>
            <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>{response.summary}</p>
          </div>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600, color: "var(--t3)", marginBottom: 6 }}>Hallazgos</div>
            {response.findings.map((f, i) => (
              <FindingRow key={i} f={f} />
            ))}
          </div>
          <div style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600, color: "var(--t3)", marginBottom: 6 }}>Recomendaciones</div>
            {response.recommendations.map((r, i) => (
              <div key={i} className="rec-item">
                <div className="rec-num">{i + 1}</div>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function BandejaView() {
  const pendingApprovals = APPROVALS.filter((a) => a.status === "pending").length;

  return (
    <>
      <PageHeader
        eyebrow="Bandeja Gerencial"
        title="Solicitudes, respuestas y decisiones"
        description="Flujo del MVP: solicitud del GG → análisis multiagente → aprobaciones y memoria pendientes."
        actions={
          <div style={{ display: "flex", gap: 6 }}>
            {pendingApprovals > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  background: "var(--orange-bg)",
                  border: "1px solid var(--orange-border)",
                  borderRadius: "var(--r)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--orange-text)",
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--orange)" }} />
                {pendingApprovals} pendiente{pendingApprovals > 1 ? "s" : ""}
              </div>
            )}
            <span className="badge badge--blue badge--dot">{MVP_RESPONSES.length} respuestas</span>
          </div>
        }
      />

      <div className="space-y-3">
        <div className="card">
          <div className="card-header">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--t3)" }}>{MVP_REQUEST.id}</span>
                <StatusBadge status={MVP_REQUEST.status} />
                <span className="badge badge--red">Prioridad alta</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginTop: 4, lineHeight: 1.3 }}>{MVP_REQUEST.title}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: "var(--t3)" }}>Asignado a</div>
              <div style={{ display: "flex", gap: 5, marginTop: 3 }}>
                {MVP_REQUEST.agents.map((a) => (
                  <span key={a} className="badge badge--blue">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>{MVP_REQUEST.description}</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 600, color: "var(--t3)" }}>Respuestas de agentes</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 11, color: "var(--t3)" }}>
            {MVP_RESPONSES.length}/{MVP_REQUEST.agents.length}
          </span>
        </div>

        {MVP_RESPONSES.map((r) => (
          <AgentResponseCard key={r.id} response={r} />
        ))}

        <div className="card">
          <div className="card-header">
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)" }}>Estado del flujo</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0 }}>
            {[
              { color: "blue", label: "Solicitud", value: "En revisión", sub: MVP_REQUEST.id },
              { color: "green", label: "Agentes", value: `${MVP_RESPONSES.length}/${MVP_REQUEST.agents.length}`, sub: "Respuestas recibidas" },
              { color: "orange", label: "Aprobaciones", value: `${pendingApprovals} pend.`, sub: "Requieren GG" },
              { color: "blue", label: "Skills", value: "1 propuesta", sub: "Pendiente aprobación" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "10px 14px", borderRight: i < 3 ? "1px solid var(--border)" : "none" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, color: `var(--${s.color})`, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <span style={{ fontSize: 11, color: "var(--t3)" }}>
            Los agentes pueden analizar y recomendar, pero no ejecutan decisiones críticas sin aprobación del GG · Datos simulados · MVP mock
          </span>
        </div>
      </div>
    </>
  );
}
