"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { useStore } from "../../lib/store/StoreProvider";
import { agentById } from "../../lib/data";
import { agentAvatarClass } from "./shared";
import { sendChatWithFallback } from "../../lib/llm/providers";
import { routeRequest } from "../../lib/llm/modelRouter";
import { getAgentModelOverride } from "../../lib/llm/agentModels";
import type { ChatMessage } from "../../lib/llm/providers";
import { parseInput, isSimpleMessage, HUMANIZE_CTX } from "../../lib/chat/messageUtils";
import { MdText } from "../chat/MdText";
import { HelpPanel } from "../chat/HelpPanel";
import { ChatAutoInput } from "../chat/ChatAutoInput";
import { buildContextPrompt, buildRequirementItemsPrompt, fetchRequirementItems } from "../../lib/chat/contextQuery";
import type { ChatCtx } from "../../lib/chat/contextQuery";
import { runContextPipeline } from "../../lib/chat/contextRouter";
import { useSession } from "../../lib/auth/useSession";
import { saveConversation, loadConversationHistory } from "../../lib/memory/conversationMemory";

const CHAT_AGENTS = ["ic", "pm", "ie", "gg"];

// Cap how many messages get mounted in the DOM at once — long threads (e.g.
// loaded from Supabase history) shouldn't render hundreds of MessageBubble
// (and MdText) instances on mount. Older messages are revealed on demand.
const VISIBLE_MESSAGES_STEP = 50;

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
  ic: `Eres Arturo, el Ingeniero de Costos (IC) de EKA Ingeniería, empresa eléctrica peruana.
Carácter: meticuloso, preciso con los números, ligeramente pesimista sobre presupuestos — siempre hay contingencias olvidadas.
Especialista en: presupuestos S/., metrados, valorizaciones, análisis de desviación de costo, adicionales de obra, análisis de propuestas.
Personalidad: Usas S/ naturalmente. Conviertes USD a S/ (TC ≈ 3.75). Preguntas por las partidas antes de opinar. Te incomoda cuando no hay desglose. Dices "Ojo:" para alertas.
Formato:
- Análisis → **negritas** para S/ importes, % desviaciones y conclusiones. Estructura con partidas cuando aplica.
- Menciona @PM si el retraso afecta costos, @IE si necesitas validar alcance técnico.
- Si la decisión supera tu nivel, menciona @GG.
- Responde en español peruano.`,
  pm: `Eres Carlos, el Project Manager (PM) de EKA Ingeniería, empresa eléctrica peruana.
Carácter: práctico, orientado a hitos, directo. Hablas en fechas, semanas y semáforos.
Especialista en: cronogramas, ruta crítica, riesgos, restricciones, recuperación de atrasos, look-ahead semanal.
Personalidad: Usas ● para listas. Referencias a semanas (S1, S2). Siempre tienes Plan B. Tu pregunta favorita: "¿y cuánto tiempo falta?". Semáforos: 🟢 en tiempo / 🟡 con riesgo / 🔴 retrasado.
Formato:
- Análisis → **negritas** para fechas críticas, hitos y riesgos. Máx 3 párrafos. Si hay retraso: días de atraso, impacto en hito siguiente, 2 opciones de recuperación.
- Menciona @IC para impacto económico, @IE para validar alcance técnico.
- Cuando necesitas aprobación, menciona @GG.
- Responde en español. Directo, sin adornos.`,
  gg: `Eres el Gerente General (GG) de EKA Ingeniería, empresa eléctrica peruana.
Carácter: ejecutivo, directo, visión de portafolio. No te pierdes en el detalle técnico — pides síntesis a tu equipo.
Tu rol: diagnóstico → decisión → siguiente acción (BLUF: la conclusión primero, el razonamiento después).
Personalidad: Si necesitas detalle de costos, dices "Que @IC revise...". Si necesitas cronograma, "@PM, ¿impacto en el timeline?". Si es técnico, "@IE, valida esto".
Formato:
- Análisis → máx 3 puntos clave con **negritas** en la decisión y cifras críticas. Marca: ✅ Aprobado / ⏸ En revisión / ❌ Rechazado cuando aplique.
- Responde en español ejecutivo, directo al grano.`,
  ie: `Eres María, la Ingeniera Eléctrica Especialista (IE) de EKA Ingeniería, empresa eléctrica peruana.
Carácter: técnica, apasionada por las normas, cita estándares naturalmente. Te entusiasmas con problemas de alta tensión.
Especialista en: CNE-U, IEC 60364, IEEE Std 141/242/519, diseño de SET, cálculo de cables, coordinación de protecciones, estudios de cortocircuito.
Personalidad: Citas normativas (CNE-U Art. 020, IEC 60364-4-41) cuando aplica. Usas kV, MVA, A, Ω con precisión. Distingues instalaciones (CNE) de concesionarias (DGE/MINEM).
Formato:
- Análisis → **negritas** para valores técnicos, normas y conclusiones de diseño. Usa tablas de comparación cuando hay opciones.
- Menciona @IC para presupuesto de materiales, @PM para integración en cronograma.
- Escala a @GG cuando requiere decisión de inversión mayor.
- Responde en español. Técnica pero comprensible.`,
};

function MessageBubble({
  role, text, time, agentId, modelLabel, modelSuggestion, isError,
}: {
  role: "gg" | "agent"; text: string; time: string; agentId: string; modelLabel?: string; modelSuggestion?: string; isError?: boolean;
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
          <MdText text={text} variant={isUser ? "inverted" : "default"} />
        </div>
        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 3, textAlign: isUser ? "right" : "left", display: "flex", gap: 6, alignItems: "center", justifyContent: isUser ? "flex-end" : "flex-start" }}>
          <span>{time}</span>
          {modelLabel && !isUser && (
            <span style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "var(--mono)" }}>{modelLabel}</span>
          )}
        </div>
        {modelSuggestion && !isUser && (
          <div style={{ fontSize: 10.5, color: "var(--amber-text)", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: 6, padding: "4px 8px", marginTop: 4, lineHeight: 1.5 }}>
            💡 {modelSuggestion}
          </div>
        )}
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

export function ChatView() {
  const { state, appendChat, chatFor, seedThreadFromLegacy, ready } = useStore();
  const { session } = useSession(false);
  const [agentId, setAgentId] = useState("ic");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typingModel, setTypingModel] = useState<string | undefined>();
  const [showHelp, setShowHelp] = useState(false);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_MESSAGES_STEP);
  const scrollRef = useRef<HTMLDivElement>(null);

  // "Chat privado" is 1:1 between this user and the agent — namespace the
  // thread key by user so it never gets mixed with other users' private
  // chats with the same agent (see lib/store/types.ts SHARED_CHAT_THREADS).
  const userKey = session?.email || "anonymous";
  const threadKey = `private:${userKey}:${agentId}`;
  const thread = chatFor(threadKey);
  const agent = agentById(agentId);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.length, busy]);

  // The help panel renders at the top of the scroll container — scroll up to
  // reveal it instead of staying scrolled to the bottom of the thread.
  useEffect(() => {
    if (showHelp && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [showHelp]);

  // Reset to "show last N" whenever the active thread changes (agent switch).
  // Adjusting state during render (React's documented pattern for resetting
  // state on prop change) instead of an effect, to avoid an extra render pass.
  const [prevThreadKey, setPrevThreadKey] = useState(threadKey);
  if (threadKey !== prevThreadKey) {
    setPrevThreadKey(threadKey);
    setVisibleCount(VISIBLE_MESSAGES_STEP);
  }

  // One-time migration: copy each agent's old unscoped thread (chats.ic etc,
  // shared by everyone before this fix) into this user's namespaced thread,
  // so existing history isn't lost. Runs once per user per agent.
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    for (const id of CHAT_AGENTS) {
      const flag = `ot:migrated-private:${userKey}:${id}`;
      if (window.localStorage.getItem(flag)) continue;
      seedThreadFromLegacy(id, `private:${userKey}:${id}`);
      window.localStorage.setItem(flag, "1");
    }
  }, [ready, userKey, seedThreadFromLegacy]);

  async function send(text?: string, inputCtx?: ChatCtx) {
    const raw = (text ?? input).trim();
    if (!raw || busy) return;

    const parsed = parseInput(raw);

    if (parsed.isHelp) {
      setShowHelp(true);
      setInput("");
      return;
    }

    appendChat(threadKey, { role: "gg", text: raw });
    setInput("");
    setBusy(true);

    const routing = routeRequest(parsed.cleanText, getAgentModelOverride(agentId));
    setTypingModel(routing.modelLabel);

    let ctxPrompt = inputCtx ? buildContextPrompt(inputCtx) : "";
    if (inputCtx?.requirement) {
      const items = await fetchRequirementItems(inputCtx.requirement.id).catch(() => []);
      ctxPrompt += buildRequirementItemsPrompt(items);
    }
    // A short message is only "simple" if there's no project/RQ context chip attached —
    // otherwise the user wants that context used even for a brief question.
    const hasAttachments = (inputCtx?.attachments?.length ?? 0) > 0;
    const simple = isSimpleMessage(parsed.cleanText) && !inputCtx?.project && !inputCtx?.requirement && !hasAttachments;
    const userId = session?.email ?? "anonymous";

    // Real-data context: detect intent → query Supabase → build the
    // "--- CONTEXTO REAL CONSULTADO ---" block. Centralized in
    // lib/chat/contextRouter (codes COT/RQ, historical codes, requerimiento/
    // cotización searches, recursos, propuestas técnicas). The pipeline never
    // throws — on a temporary error it returns a soft note instead of data.
    let autoCodeCtx = "";
    if (!simple) {
      autoCodeCtx = (await runContextPipeline(parsed.cleanText)).block;
    }

    const fileCtx = (inputCtx?.attachments ?? []).map((f) =>
      `\n\n--- Archivo adjunto: ${f.name} (${Math.round(f.size / 1024)}KB) ---\n${f.content}\n---`
    ).join("");

    // Tell the agent how to read the "Archivo adjunto" block(s) appended to
    // the user's message, mirroring RoundtableView's attachmentCtx.
    const attachmentCtx = hasAttachments
      ? `\n\nEl usuario adjuntó ${(inputCtx?.attachments?.length ?? 0) === 1 ? "un archivo" : `${inputCtx?.attachments?.length} archivos`} a este mensaje. Su contenido (texto extraído) viene al final, en bloques "--- Archivo adjunto: <nombre> ---". Básate en ese contenido para responder a lo que pregunta el usuario sobre el/los archivo(s) — NO respondas con un saludo genérico ni ignores el adjunto. Si el contenido extraído está vacío, es muy corto o dice "sin texto extraíble" (típico de planos/imágenes escaneadas), dilo explícitamente, indica qué archivo es (nombre) y pide al usuario un resumen, las páginas/secciones clave o una versión más legible para poder ayudar. El archivo adjunto de este mensaje es la fuente principal: ignora archivos o documentos mencionados en historial previo salvo que el usuario los nombre explícitamente.`
      : "";

    const systemPrompt = (AGENT_SYSTEM_PROMPTS[agentId] ?? AGENT_SYSTEM_PROMPTS.ic) + HUMANIZE_CTX + ctxPrompt + autoCodeCtx + attachmentCtx;

    // Load Supabase memory (older conversations) only for non-trivial
    // messages, but always read this thread's local history — it's already
    // in memory and is what lets the agent follow up on "ok"/short replies
    // instead of repeating its opening question. Skipped when this message
    // has a new attachment so old projects/files don't leak into context.
    // Long-term memory from Supabase: only loaded when there's an active
    // project (chip), and scoped to it — otherwise it tends to surface old,
    // unrelated conversations right before the current message, confusing
    // the model into anchoring on stale context instead of the live thread.
    const ctxProjectId = inputCtx?.project?.id;
    const [supabaseHistory, localHistory] = await Promise.all([
      simple || hasAttachments || !ctxProjectId ? Promise.resolve([]) : loadConversationHistory(userId, agentId, ctxProjectId, 8),
      Promise.resolve(chatFor(threadKey)),
    ]);

    const contextMessages: ChatMessage[] = [
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
      { role: "user", content: parsed.cleanText + fileCtx },
    ];

    try {
      const { response, actualConfig } = await sendChatWithFallback(messages, routing.config);
      const label = `${actualConfig.provider}/${response.model}`;
      appendChat(threadKey, { role: "agent", text: response.content, agentId, modelLabel: label, modelSuggestion: routing.suggestion });
      saveConversation(session?.email ?? "anonymous", agentId, parsed.cleanText, response.content, label, routing.complexity).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      appendChat(threadKey, { role: "agent", text: `No pude conectar con ningún proveedor de IA. ${msg}\n\nVe a Conexiones para configurar una API key gratuita.`, agentId, isError: true });
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
            {thread.length > visibleCount && (
              <button
                className="btn btn--ghost btn--sm"
                style={{ alignSelf: "center" }}
                onClick={() => setVisibleCount((v) => v + VISIBLE_MESSAGES_STEP)}
              >
                Cargar mensajes anteriores ({thread.length - visibleCount} más)
              </button>
            )}
            {thread.slice(-visibleCount).map((m) => (
              <MessageBubble key={m.id} role={m.role} text={m.text} time={m.time} agentId={agentId} modelLabel={(m as { modelLabel?: string }).modelLabel} modelSuggestion={(m as { modelSuggestion?: string }).modelSuggestion} isError={(m as { isError?: boolean }).isError} />
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
          </div>
        </div>
      </div>
      {state.notifications.length === 0 && null}
    </>
  );
}
