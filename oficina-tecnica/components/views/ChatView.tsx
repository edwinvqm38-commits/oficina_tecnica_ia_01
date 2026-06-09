"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Icons } from "../../lib/icons";
import { useStore } from "../../lib/store/StoreProvider";
import { agentById } from "../../lib/data";
import { agentAvatarClass } from "./shared";
import { routeRequest } from "@/lib/llm/modelRouter";
import { getStoredDeviceProfile } from "@/lib/llm/deviceDetection";
import { getOllamaModels, sendChat } from "@/lib/llm/providers";
import { ModelBadge } from "@/components/ai-office/ModelBadge";
import type { RoutingDecision } from "@/lib/llm/modelRouter";
import { saveConversation, loadConversationHistory } from "@/lib/memory/conversationMemory";
import { useSession } from "@/lib/auth/useSession";

const CHAT_AGENTS = ["ic", "pm", "gg", "ie"];

const STARTERS: Record<string, string[]> = {
  ic: ["Presupuesto de tendido de cable 138kV", "Analiza esta desviación de costo", "¿Qué contingencia recomiendas?"],
  pm: ["Riesgo de retraso en PRY-001", "¿Cómo recupero 12 días?", "Restricciones de la ruta crítica"],
  gg: ["Resume el estado del portafolio", "¿Apruebo el adicional de Tintaya?"],
  ie: ["¿Qué norma aplica a esta SET?"],
};

const INTRO: Record<string, string> = {
  ic: "Pídeme un presupuesto, análisis de desviación o valorización. Adjunta una memoria descriptiva o parámetros y lo proceso con mis skills.",
  pm: "Consúltame sobre cronograma, ruta crítica, riesgos o restricciones. Adjunta tu plan y modelo escenarios de recuperación.",
  gg: "Plantéame una decisión y te doy síntesis ejecutiva: diagnóstico, decisión y siguiente acción.",
  ie: "Soy un agente futuro. Cuando el GG apruebe mi alcance normativo, revisaré criterios de diseño eléctrico (CNE, IEC, IEEE).",
};

function mockReply(agentId: string, text: string): string {
  const agent = agentById(agentId);
  const name = agent?.name || agentId.toUpperCase();
  return `(${name} · respuesta simulada)\n\nHe registrado tu consulta: "${text.slice(0, 140)}". Cuando se configure un proveedor de modelos en Conexiones, responderé aquí con análisis real basado en mis skills activas y la base de conocimiento del proyecto.`;
}

function MessageBubble({ role, text, time, agentId, routing, isError }: { role: "gg" | "agent"; text: string; time: string; agentId: string; routing?: RoutingDecision; isError?: boolean }) {
  const isUser = role === "gg";
  return (
    <div style={{ display: "flex", gap: 9, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
      <div className={`agent-avatar ${isUser ? "agent-avatar--gg" : agentAvatarClass(agentId)}`} style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0 }}>
        {isUser ? "GG" : agentId.toUpperCase()}
      </div>
      <div style={{ maxWidth: "78%" }}>
        <div
          style={{
            padding: "8px 11px",
            borderRadius: 10,
            background: isUser ? "var(--blue)" : isError ? "var(--red-bg)" : "var(--bg-card)",
            color: isUser ? "#fff" : isError ? "var(--red-text)" : "var(--t1)",
            border: isUser ? "none" : isError ? "1px solid var(--red-border)" : "1px solid var(--border)",
            fontSize: 12.5,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            borderTopRightRadius: isUser ? 3 : 10,
            borderTopLeftRadius: isUser ? 10 : 3,
          }}
        >
          {text}
        </div>
        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 3, textAlign: isUser ? "right" : "left", display: "flex", alignItems: "center", gap: 6, flexDirection: isUser ? "row-reverse" : "row" }}>
          <span>{time}</span>
          {!isUser && routing && <ModelBadge decision={routing} />}
        </div>
      </div>
    </div>
  );
}

function TypingDots({ agentId }: { agentId: string }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
      <div className={`agent-avatar ${agentAvatarClass(agentId)}`} style={{ width: 28, height: 28, fontSize: 10 }}>
        {agentId.toUpperCase()}
      </div>
      <div style={{ padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--t3)", animation: `igblink 1.2s ${i * 0.2}s infinite ease-in-out` }} />
        ))}
      </div>
    </div>
  );
}

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  ic: "Eres el Ingeniero de Costos y Presupuestos de una Oficina Técnica de ingeniería. Analizas presupuestos, metrados, desviaciones de costo y haces recomendaciones técnicas. Responde en español de forma clara y profesional.",
  pm: "Eres el Project Manager de una Oficina Técnica de ingeniería. Gestionas cronogramas, riesgos, rutas críticas y bloqueos de proyectos. Responde en español de forma clara y profesional.",
  gg: "Eres el Gerente General de una Oficina Técnica de ingeniería. Tomas decisiones estratégicas, apruebas propuestas y supervisas el portafolio de proyectos. Responde en español de forma ejecutiva y directa.",
  ie: "Eres un Ingeniero Especialista en normas eléctricas (CNE, IEC, IEEE). Asesoras sobre diseño eléctrico y criterios normativos. Responde en español de forma técnica y precisa.",
};

export function ChatView() {
  const { state, appendChat, chatFor } = useStore();
  const { session } = useSession(false);
  const [agentId, setAgentId] = useState("ic");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const thread = chatFor(agentId);
  const agent = agentById(agentId);

  useEffect(() => {
    getOllamaModels().then(setOllamaModels);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.length, busy]);

  async function send(text?: string) {
    const value = (text ?? input).trim();
    if (!value || busy) return;
    appendChat(agentId, { role: "gg", text: value });
    setInput("");
    setBusy(true);

    const userId = session?.email ?? "anonymous";
    const deviceProfile = getStoredDeviceProfile();
    const agentModels = JSON.parse(localStorage.getItem("ot:agent:models") ?? "{}");
    const routing = routeRequest(value, ollamaModels, deviceProfile, agentModels[agentId] ?? null);

    // Load history from Supabase for context
    const history = await loadConversationHistory(userId, agentId, undefined, 10);
    const contextMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const messages = [
      { role: "system" as const, content: AGENT_SYSTEM_PROMPTS[agentId] ?? AGENT_SYSTEM_PROMPTS.gg },
      ...contextMessages,
      { role: "user" as const, content: value },
    ];

    let responseText = "";
    let isError = false;
    try {
      const response = await sendChat(messages, routing.config);
      responseText = response.content;
    } catch {
      responseText = `No se pudo conectar con ${routing.modelLabel}. Ve a Conexiones de modelos para configurar un proveedor.`;
      isError = true;
    }

    appendChat(agentId, { role: "agent", text: responseText, routing, isError });
    setBusy(false);

    if (!isError) {
      saveConversation(userId, agentId, value, responseText, routing.modelLabel, routing.complexity).catch(() => {});
    }
  }

  if (!agent) return null;

  return (
    <>
      <PageHeader
        eyebrow="Chat con agentes"
        title="Consulta directa a tu equipo IA"
        description="Conversa con cada agente. Las respuestas son simuladas hasta conectar un proveedor de modelos en Conexiones."
        actions={<span className="badge badge--blue badge--dot">IA real al publicar</span>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 10, alignItems: "start" }}>
        <div className="space-y-2">
          <div className="card" style={{ padding: 8 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, color: "var(--t3)", padding: "4px 6px 6px" }}>Tu equipo</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {CHAT_AGENTS.map((id) => {
                const a = agentById(id);
                if (!a) return null;
                const isActive = agentId === id;
                const future = a.type === "agent-future";
                return (
                  <button
                    key={id}
                    onClick={() => setAgentId(id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "8px 10px",
                      borderRadius: "var(--r)",
                      textAlign: "left",
                      width: "100%",
                      border: "1px solid " + (isActive ? "var(--blue-border)" : "transparent"),
                      background: isActive ? "var(--blue-bg)" : "transparent",
                      cursor: "pointer",
                      transition: "all .12s",
                      opacity: future ? 0.7 : 1,
                    }}
                  >
                    <div className={`agent-avatar ${agentAvatarClass(id)}`} style={{ width: 30, height: 30, fontSize: 11 }}>
                      {id.toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{a.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.role}</div>
                    </div>
                    {future && (
                      <span className="badge badge--slate" style={{ flexShrink: 0 }}>
                        Futuro
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>Contexto activo de {agent.name.split(" ").pop()}</div>
            <div className="info-row">
              <span className="info-row-label">Skills activas</span>
              <span className="info-row-value">{agent.skillCount}</span>
            </div>
            <div className="info-row">
              <span className="info-row-label">Mensajes</span>
              <span className="info-row-value">{thread.length}</span>
            </div>
            <div className="info-row">
              <span className="info-row-label">Tarea actual</span>
              <span className="info-row-value">{agent.currentTask}</span>
            </div>
            <p style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 8, lineHeight: 1.5 }}>{agent.focus}</p>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 190px)", minHeight: 420 }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div className={`agent-avatar ${agentAvatarClass(agentId)}`}>{agentId.toUpperCase()}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{agent.name}</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>{agent.role}</div>
              </div>
            </div>
            <span className="badge badge--mock">Simulado</span>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-muted)" }}>
            {thread.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: 340 }}>
                <div className={`agent-avatar ${agentAvatarClass(agentId)}`} style={{ width: 48, height: 48, fontSize: 16, margin: "0 auto 12px" }}>
                  {agentId.toUpperCase()}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>Hola, soy {agent.name}</div>
                <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>{INTRO[agentId]}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 14 }}>
                  {(STARTERS[agentId] || []).map((s) => (
                    <button key={s} className="btn btn--ghost btn--sm" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {thread.map((m) => (
              <MessageBubble key={m.id} role={m.role} text={m.text} time={m.time} agentId={agentId} routing={m.routing} isError={m.isError} />
            ))}
            {busy && <TypingDots agentId={agentId} />}
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
              placeholder={`Escribe a ${agent.name}… (Enter para enviar, Shift+Enter salto de línea)`}
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
      {state.notifications.length === 0 && null}
    </>
  );
}
