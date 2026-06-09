"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Icons } from "../../lib/icons";
import { useStore } from "../../lib/store/StoreProvider";
import { agentById } from "../../lib/data";
import { agentAvatarClass } from "./shared";
import { sendChatWithFallback, getOllamaModels } from "../../lib/llm/providers";
import { routeRequest } from "../../lib/llm/modelRouter";
import type { ChatMessage } from "../../lib/llm/providers";
import { parseInput, isSimpleMessage } from "../../lib/chat/messageUtils";
import { MdText } from "../chat/MdText";
import { HelpPanel } from "../chat/HelpPanel";
import { ChatAutoInput } from "../chat/ChatAutoInput";
import { buildContextPrompt, EMPTY_CTX } from "../../lib/chat/contextQuery";
import type { ChatCtx } from "../../lib/chat/contextQuery";
import { useSession } from "../../lib/auth/useSession";
import { saveConversation, loadConversationHistory } from "../../lib/memory/conversationMemory";

const CHAT_AGENTS = ["ic", "pm", "ie", "gg"];

const STARTERS: Record<string, string[]> = {
  ic: ["Presupuesto de tendido de cable 138kV", "Analiza esta desviación de costo", "¿Qué contingencia recomiendas?"],
  pm: ["Riesgo de retraso en PRY-001", "¿Cómo recupero 12 días?", "Restricciones de la ruta crítica"],
  gg: ["Resume el estado del portafolio", "¿Apruebo el adicional de Tintaya?"],
  ie: ["¿Qué norma aplica a la SET 138kV?", "Criterios de diseño para tendido de cable", "¿Qué protecciones aplican en 22kV?"],
};

const INTRO: Record<string, string> = {
  ic: "Pídeme un presupuesto, análisis de desviación o valorización. Adjunta una memoria descriptiva o parámetros y lo proceso con mis skills.",
  pm: "Consúltame sobre cronograma, ruta crítica, riesgos o restricciones. Adjunta tu plan y modelo escenarios de recuperación.",
  gg: "Plantéame una decisión y te doy síntesis ejecutiva: diagnóstico, decisión y siguiente acción.",
  ie: "Consúltame sobre normas eléctricas (CNE, IEC, IEEE), diseño de subestaciones, cálculo de cables o criterios de protección.",
};

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  ic: `Eres el Ingeniero de Costos (IC) de una empresa peruana de ingeniería eléctrica.
Especialista en: presupuestos, metrados, valorizaciones, análisis de desviación de costo, contingencias.
Reglas:
- Si el mensaje es un saludo o pregunta simple (< 25 palabras), responde brevemente y con calidez, sin análisis de proyecto.
- En respuestas técnicas, usa **negritas** para cifras clave, porcentajes y conclusiones importantes.
- Puedes mencionar @PM o @IE cuando el tema requiere su input.
- Cuando necesites aprobación del Gerente, menciona @GG.
- Responde en español. Sé conciso pero completo.`,
  pm: `Eres el Project Manager (PM) de una empresa peruana de ingeniería eléctrica.
Especialista en: cronogramas, ruta crítica, riesgos, restricciones, recuperación de atrasos, planificación.
Reglas:
- Si el mensaje es un saludo o pregunta simple (< 25 palabras), responde brevemente y con calidez, sin análisis de proyecto.
- En respuestas técnicas, usa **negritas** para fechas críticas, hitos y riesgos principales.
- Puedes mencionar @IC o @IE cuando el tema requiere su input.
- Cuando necesites aprobación del Gerente, menciona @GG.
- Responde en español. Sé conciso pero completo.`,
  gg: `Eres el Gerente General (GG) de una empresa peruana de ingeniería eléctrica.
Tu rol es dar síntesis ejecutivas, diagnósticos de situación y recomendaciones de alto nivel.
Reglas:
- Si el mensaje es un saludo o pregunta simple (< 25 palabras), responde brevemente y con calidez.
- En respuestas técnicas, usa **negritas** para decisiones clave y métricas críticas.
- Puedes escalar a @IC o @PM para análisis detallado.
- Responde en español, de forma directa y ejecutiva.`,
  ie: `Eres el Ingeniero Eléctrico Especialista (IE) de una empresa peruana de ingeniería eléctrica.
Especialista en: normas eléctricas (CNE, IEC, IEEE), diseño de subestaciones, cálculo eléctrico, tendido de cables.
Reglas:
- Si el mensaje es un saludo o pregunta simple (< 25 palabras), responde brevemente y con calidez.
- En respuestas técnicas, usa **negritas** para normas, valores técnicos y conclusiones.
- Puedes mencionar @IC o @PM cuando el tema requiere su coordinación.
- Cuando necesites aprobación del Gerente, menciona @GG.
- Responde en español con referencias normativas cuando corresponda.`,
};

function MessageBubble({
  role, text, time, agentId, modelLabel, isError,
}: {
  role: "gg" | "agent"; text: string; time: string; agentId: string; modelLabel?: string; isError?: boolean;
}) {
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
            background: isError ? "var(--red-bg, #fff1f0)" : isUser ? "var(--blue)" : "var(--bg-card)",
            color: isError ? "var(--red-text, #c00)" : isUser ? "#fff" : "var(--t1)",
            border: isUser ? "none" : `1px solid ${isError ? "var(--red-border, #fca5a5)" : "var(--border)"}`,
            fontSize: 12.5,
            lineHeight: 1.55,
            borderTopRightRadius: isUser ? 3 : 10,
            borderTopLeftRadius: isUser ? 10 : 3,
          }}
        >
          {isUser ? text : <MdText text={text} />}
        </div>
        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 3, textAlign: isUser ? "right" : "left", display: "flex", gap: 6, alignItems: "center", justifyContent: isUser ? "flex-end" : "flex-start" }}>
          <span>{time}</span>
          {modelLabel && !isUser && (
            <span style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "var(--mono)" }}>{modelLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingDots({ agentId, modelLabel }: { agentId: string; modelLabel?: string }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
      <div className={`agent-avatar ${agentAvatarClass(agentId)}`} style={{ width: 28, height: 28, fontSize: 10 }}>
        {agentId.toUpperCase()}
      </div>
      <div style={{ padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--t3)", animation: `igblink 1.2s ${i * 0.2}s infinite ease-in-out` }} />
          ))}
        </div>
        {modelLabel && <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)" }}>{modelLabel}</span>}
      </div>
    </div>
  );
}

function useOnlineMode() {
  const [online, setOnline] = useState(true);
  useEffect(() => { setOnline(localStorage.getItem("ot:ollama:disabled") !== "false"); }, []);
  function toggle() {
    const next = !online;
    setOnline(next);
    localStorage.setItem("ot:ollama:disabled", next ? "true" : "false");
  }
  return { online, toggle };
}

export function ChatView() {
  const { state, appendChat, chatFor } = useStore();
  const { session } = useSession(false);
  const { online, toggle: toggleOnline } = useOnlineMode();
  const [agentId, setAgentId] = useState("ic");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typingModel, setTypingModel] = useState<string | undefined>();
  const [showHelp, setShowHelp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ollamaModelsRef = useRef<string[]>([]);

  const thread = chatFor(agentId);
  const agent = agentById(agentId);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.length, busy, showHelp]);

  useEffect(() => {
    getOllamaModels().then((models) => { ollamaModelsRef.current = models; });
  }, []);

  async function send(text?: string, inputCtx?: ChatCtx) {
    const raw = (text ?? input).trim();
    if (!raw || busy) return;

    const parsed = parseInput(raw);

    if (parsed.isHelp) {
      setShowHelp(true);
      setInput("");
      return;
    }

    appendChat(agentId, { role: "gg", text: raw });
    setInput("");
    setBusy(true);

    const routing = routeRequest(parsed.cleanText, ollamaModelsRef.current);
    setTypingModel(routing.modelLabel);

    const ctxPrompt = inputCtx ? buildContextPrompt(inputCtx) : "";
    const systemPrompt = (AGENT_SYSTEM_PROMPTS[agentId] ?? AGENT_SYSTEM_PROMPTS.ic) + ctxPrompt;
    const simple = isSimpleMessage(parsed.cleanText);
    const userId = session?.email ?? "anonymous";

    // Load Supabase memory + local thread for context
    const [supabaseHistory, localHistory] = await Promise.all([
      simple ? Promise.resolve([]) : loadConversationHistory(userId, agentId, undefined, 8),
      Promise.resolve(chatFor(agentId)),
    ]);

    const contextMessages: ChatMessage[] = simple ? [] : [
      // Supabase long-term memory (older conversations)
      ...supabaseHistory.slice(0, 6).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      // Recent local thread (current session)
      ...localHistory.slice(-6).map((m) => ({
        role: (m.role === "gg" ? "user" : "assistant") as "user" | "assistant",
        content: m.text,
      })),
    ];

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...contextMessages,
      { role: "user", content: parsed.cleanText },
    ];

    try {
      const { response, actualConfig } = await sendChatWithFallback(messages, routing.config, ollamaModelsRef.current);
      const label = `${actualConfig.provider}/${response.model}`;
      appendChat(agentId, { role: "agent", text: response.content, agentId, modelLabel: label });
      saveConversation(session?.email ?? "anonymous", agentId, parsed.cleanText, response.content, label, routing.complexity).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      appendChat(agentId, { role: "agent", text: `No pude conectar con ningún proveedor de IA. ${msg}\n\nVe a Conexiones para configurar una API key gratuita.`, agentId, isError: true });
    }

    setBusy(false);
    setTypingModel(undefined);
  }

  if (!agent) return null;

  return (
    <>
      <PageHeader
        eyebrow="Chat con agentes"
        title="Consulta directa a tu equipo IA"
        description="Conversa con cada agente. Respuestas reales vía Gemini, Groq, Sambanova u otros proveedores configurados."
        actions={<span className="badge badge--green badge--dot">IA activa</span>}
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
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: "var(--r)", textAlign: "left", width: "100%", border: "1px solid " + (isActive ? "var(--blue-border)" : "transparent"), background: isActive ? "var(--blue-bg)" : "transparent", cursor: "pointer", transition: "all .12s", opacity: future ? 0.7 : 1 }}
                  >
                    <div className={`agent-avatar ${agentAvatarClass(id)}`} style={{ width: 30, height: 30, fontSize: 11 }}>{id.toUpperCase()}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{a.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.role}</div>
                    </div>
                    {future && <span className="badge badge--slate" style={{ flexShrink: 0 }}>Futuro</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>Contexto activo de {agent.name.split(" ").pop()}</div>
            <div className="info-row"><span className="info-row-label">Skills activas</span><span className="info-row-value">{agent.skillCount}</span></div>
            <div className="info-row"><span className="info-row-label">Mensajes</span><span className="info-row-value">{thread.length}</span></div>
            <div className="info-row"><span className="info-row-label">Tarea actual</span><span className="info-row-value">{agent.currentTask}</span></div>
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
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="badge badge--green">IA activa</span>
              <button
                className="btn btn--ghost btn--sm"
                style={{ fontSize: 10, color: online ? "var(--blue)" : "var(--t3)" }}
                title={online ? "Modo Online — click para activar Ollama local" : "Ollama activo — click para modo solo-cloud"}
                onClick={toggleOnline}
              >
                {online ? "☁ Online" : "🖥 Local+Cloud"}
              </button>
              <button className="btn btn--ghost btn--sm" style={{ fontSize: 11 }} onClick={() => setShowHelp((v) => !v)}>/ayuda</button>
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-muted)" }}>
            {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
            {thread.length === 0 && !showHelp && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: 340 }}>
                <div className={`agent-avatar ${agentAvatarClass(agentId)}`} style={{ width: 48, height: 48, fontSize: 16, margin: "0 auto 12px" }}>{agentId.toUpperCase()}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>Hola, soy {agent.name}</div>
                <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>{INTRO[agentId]}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 14 }}>
                  {(STARTERS[agentId] || []).map((s) => (
                    <button key={s} className="btn btn--ghost btn--sm" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {thread.map((m) => (
              <MessageBubble key={m.id} role={m.role} text={m.text} time={m.time} agentId={agentId} modelLabel={(m as { modelLabel?: string }).modelLabel} isError={(m as { isError?: boolean }).isError} />
            ))}
            {busy && <TypingDots agentId={agentId} modelLabel={typingModel} />}
          </div>

          <div style={{ flexShrink: 0, padding: 10, borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <ChatAutoInput
              value={input}
              onChange={setInput}
              onSubmit={(text, ctx) => send(text, ctx)}
              placeholder={`Escribe a ${agent.name}… /proyecto /rq /ayuda`}
              disabled={busy}
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
