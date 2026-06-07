"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Icons } from "../../lib/icons";
import { useStore } from "../../lib/store/StoreProvider";
import { agentById, AGENTS, PROJECTS } from "../../lib/data";
import { agentAvatarClass } from "./shared";

const ROUNDTABLE_THREAD = "roundtable";

const RT_KEYWORDS: Record<string, string[]> = {
  ic: ["costo", "costos", "presupuesto", "precio", "valoriz", "adicional", "desviaci", "metrado", "contingencia", "soles", "s/", "económic", "rentab", "partida", "gasto"],
  pm: ["cronograma", "plazo", "retraso", "riesgo", "restricci", "ruta crítica", "hito", "avance", "recuper", "planific", "fecha", "entrega"],
  ie: ["diseño", "eléctric", "norma", "normativ", "cálculo", "cne", "iec", "ieee", "protección", "tensión", "kv", "subestación", "cable", "tendido"],
};

function relevantAgents(text: string): string[] {
  const t = text.toLowerCase();
  const scored = AGENTS.filter((a) => a.type === "agent" && a.status === "active").map((a) => {
    const hits = (RT_KEYWORDS[a.id] || []).filter((k) => t.includes(k));
    return { id: a.id, score: hits.length };
  });
  const withScore = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  if (withScore.length) return withScore.map((s) => s.id);
  return scored.slice(0, 2).map((s) => s.id);
}

function mockRoundtableReply(agentId: string, text: string, projectName: string): string {
  const agent = agentById(agentId);
  const name = agent?.name || agentId.toUpperCase();
  return `(${name} · respuesta simulada)\n\nRevisando "${text.slice(0, 110)}" en el contexto de ${projectName}. Cuando se conecte un proveedor de modelos en Conexiones, aportaré aquí un análisis real coordinado con el resto del equipo.`;
}

function RTMessage({ role, text, time, agentId }: { role: "gg" | "agent"; text: string; time: string; agentId?: string }) {
  const isUser = role === "gg";
  const agent = agentId ? agentById(agentId) : null;
  return (
    <div style={{ display: "flex", gap: 9, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
      <div className={`agent-avatar ${isUser ? "agent-avatar--gg" : agentAvatarClass(agentId || "")}`} style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0 }}>
        {isUser ? "GG" : (agentId || "").toUpperCase()}
      </div>
      <div style={{ maxWidth: "78%" }}>
        {!isUser && agent && <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t1)", marginBottom: 3 }}>{agent.name}</div>}
        <div
          style={{
            padding: "8px 11px",
            borderRadius: 10,
            background: isUser ? "var(--blue)" : "var(--bg-card)",
            color: isUser ? "#fff" : "var(--t1)",
            border: isUser ? "none" : "1px solid var(--border)",
            fontSize: 12.5,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            borderTopRightRadius: isUser ? 3 : 10,
            borderTopLeftRadius: isUser ? 10 : 3,
          }}
        >
          {text}
        </div>
        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 3, textAlign: isUser ? "right" : "left" }}>{time}</div>
      </div>
    </div>
  );
}

function HandRaise({ agentId, reason }: { agentId: string; reason: string }) {
  const agent = agentById(agentId);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: "var(--r)" }}>
      <div className={`agent-avatar ${agentAvatarClass(agentId)}`} style={{ width: 26, height: 26, fontSize: 9 }}>
        {agentId.toUpperCase()}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>✋ {agent?.name || agentId} quiere aportar</div>
        <div style={{ fontSize: 11, color: "var(--amber-text)" }}>{reason}</div>
      </div>
    </div>
  );
}

export function RoundtableView() {
  const { state, appendChat, chatFor } = useStore();
  const [input, setInput] = useState("");
  const [projectId, setProjectId] = useState("PRY-001");
  const [busy, setBusy] = useState(false);
  const [hands, setHands] = useState<{ agentId: string; reason: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const thread = chatFor(ROUNDTABLE_THREAD);
  const allProjects = [...PROJECTS, ...state.customProjects];
  const project = allProjects.find((p) => p.id === projectId);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.length, busy, hands.length]);

  async function send(text?: string) {
    const value = (text ?? input).trim();
    if (!value || busy) return;

    appendChat(ROUNDTABLE_THREAD, { role: "gg", text: value });
    setInput("");
    setBusy(true);

    const responders = relevantAgents(value);
    const handCards = responders.map((id) => ({
      agentId: id,
      reason: RT_KEYWORDS[id]?.find((k) => value.toLowerCase().includes(k)) ? `Coincide con su dominio: "${RT_KEYWORDS[id].find((k) => value.toLowerCase().includes(k))}"` : "Puede aportar al tema",
    }));
    setHands(handCards);

    await new Promise((r) => setTimeout(r, 550));

    for (const id of responders) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
      appendChat(ROUNDTABLE_THREAD, { role: "agent", agentId: id, text: mockRoundtableReply(id, value, project?.name || "el proyecto") });
      setHands((h) => h.filter((x) => x.agentId !== id));
    }

    setBusy(false);
    setHands([]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Mesa de trabajo"
        title="Discusión coordinada con tu equipo IA"
        description="Plantea un tema y los agentes relevantes según su dominio se suman a la conversación. Las respuestas son simuladas hasta conectar un proveedor de modelos."
        actions={<span className="badge badge--blue badge--dot">IA real al publicar</span>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 10, alignItems: "start" }}>
        <div className="space-y-2">
          <div className="card" style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>Proyecto en discusión</div>
            <select className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ width: "100%" }}>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </select>
            {project && (
              <div style={{ marginTop: 10 }}>
                <div className="info-row">
                  <span className="info-row-label">Cliente</span>
                  <span className="info-row-value">{project.client}</span>
                </div>
                <div className="info-row">
                  <span className="info-row-label">Estado</span>
                  <span className="info-row-value">{project.status}</span>
                </div>
                <div className="info-row">
                  <span className="info-row-label">Avance</span>
                  <span className="info-row-value">{project.progress}%</span>
                </div>
                <p style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 8, lineHeight: 1.5 }}>{project.summary}</p>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>Equipo en la mesa</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {AGENTS.filter((a) => a.id !== "gg").map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className={`agent-avatar ${agentAvatarClass(a.id)}`} style={{ width: 24, height: 24, fontSize: 9 }}>
                    {a.id.toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: "var(--t3)" }}>{a.status === "active" ? "Activo" : a.status === "needs-approval" ? "Pendiente" : "Futuro"}</div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 8, lineHeight: 1.5 }}>
              Los agentes responden según la relevancia del tema con su dominio. El GG mantiene la decisión final sobre cualquier acción crítica.
            </p>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 190px)", minHeight: 420 }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div className="agent-avatar agent-avatar--gg">GG</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Mesa de trabajo</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>{project ? `Discutiendo: ${project.name}` : "Selecciona un proyecto"}</div>
              </div>
            </div>
            <span className="badge badge--mock">Simulado</span>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-muted)" }}>
            {thread.length === 0 && hands.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: 360 }}>
                <div className="agent-avatar agent-avatar--gg" style={{ width: 48, height: 48, fontSize: 16, margin: "0 auto 12px" }}>
                  GG
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>Convoca a tu equipo</div>
                <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>
                  Plantea una pregunta o un problema y los agentes cuyo dominio sea relevante se sumarán a la conversación de forma automática.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 14 }}>
                  {["¿Cómo recuperamos el atraso en PRY-001?", "Analicemos la desviación de costo de Tintaya", "¿Qué riesgos cruzados vemos en el portafolio?"].map((s) => (
                    <button key={s} className="btn btn--ghost btn--sm" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {thread.map((m) => (
              <RTMessage key={m.id} role={m.role} text={m.text} time={m.time} agentId={m.agentId} />
            ))}
            {hands.map((h) => (
              <HandRaise key={h.agentId} agentId={h.agentId} reason={h.reason} />
            ))}
          </div>

          <div style={{ flexShrink: 0, padding: 10, borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Plantea un tema a la mesa… (Enter para enviar, Shift+Enter salto de línea)"
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                padding: "9px 11px",
                fontSize: 12.5,
                fontFamily: "var(--font)",
                color: "var(--t1)",
                maxHeight: 120,
                lineHeight: 1.5,
                outline: "none",
              }}
            />
            <button className="btn btn--primary" style={{ padding: "9px 14px" }} onClick={() => send()} disabled={busy}>
              <Icons.arrowRight width={15} height={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
