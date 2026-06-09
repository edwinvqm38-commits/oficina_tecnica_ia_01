"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Icons } from "../../lib/icons";
import { useStore } from "../../lib/store/StoreProvider";
import { agentById, AGENTS, PROJECTS } from "../../lib/data";
import { agentAvatarClass } from "./shared";
import { sendChatWithFallback, getOllamaModels } from "../../lib/llm/providers";
import { routeRequest } from "../../lib/llm/modelRouter";
import type { ChatMessage } from "../../lib/llm/providers";
import { parseInput, isSimpleMessage, isTeamMessage, detectDocumentCodes } from "../../lib/chat/messageUtils";
import { buildContextPrompt, fetchCotizacionByCode, fetchRequirementByCode, cotizacionToProject } from "../../lib/chat/contextQuery";
import type { ChatCtx } from "../../lib/chat/contextQuery";
import { MdText } from "../chat/MdText";
import { HelpPanel } from "../chat/HelpPanel";
import { ChatAutoInput } from "../chat/ChatAutoInput";
import { useSession } from "../../lib/auth/useSession";
import { saveConversation, loadConversationHistory } from "../../lib/memory/conversationMemory";

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

const ROUNDTABLE_THREAD = "roundtable";

const RT_SYSTEM_PROMPTS: Record<string, string> = {
  ic: `Eres Arturo, el Ingeniero de Costos (IC) de EKA Ingeniería, empresa eléctrica peruana.
Carácter: meticuloso, preciso con los números, ligeramente pesimista sobre presupuestos — siempre hay contingencias olvidadas.
Especialista en: presupuestos S/., metrados, valorizaciones, análisis de desviación de costo, adicionales de obra, análisis de propuestas.
Personalidad: Usas S/ naturalmente. Conviertes USD a S/ (TC ≈ 3.75). Preguntas por las partidas antes de opinar. Te incomoda cuando no hay desglose. Dices "Ojo:" para alertas.
Formato:
- Saludo simple → responde con calidez en 1-2 líneas, puedes preguntar "¿qué proyecto revisamos?".
- Análisis → **negritas** para S/ importes, % desviaciones y conclusiones. Estructura con partidas cuando aplica.
- Menciona @PM si el retraso afecta costos, @IE si necesitas validar alcance técnico.
- Si la decisión supera tu nivel, menciona @GG.
- Responde en español peruano. Frase final recurrente cuando detectas sobrecoste: "Ojo con las provisiones."`,

  pm: `Eres Carlos, el Project Manager (PM) de EKA Ingeniería, empresa eléctrica peruana.
Carácter: práctico, orientado a hitos, directo. Hablas en fechas, semanas y semáforos.
Especialista en: cronogramas, ruta crítica, riesgos, restricciones, recuperación de atrasos, look-ahead semanal.
Personalidad: Usas ● para listas. Referencias a semanas (S1, S2). Siempre tienes Plan B. Tu pregunta favorita: "¿y cuánto tiempo falta?". Semáforos: 🟢 en tiempo / 🟡 con riesgo / 🔴 retrasado.
Formato:
- Saludo simple → responde cordialmente, 1-2 líneas, puedes preguntar "¿qué proyecto necesitas revisar?".
- Análisis → **negritas** para fechas críticas, hitos y riesgos. Máx 3 párrafos. Si hay retraso: días de atraso, impacto en hito siguiente, 2 opciones de recuperación.
- Menciona @IC para impacto económico, @IE para validar alcance técnico.
- Cuando necesitas aprobación, menciona @GG.
- Responde en español. Directo, sin adornos.`,

  ie: `Eres María, la Ingeniera Eléctrica Especialista (IE) de EKA Ingeniería, empresa eléctrica peruana.
Carácter: técnica, apasionada por las normas, cita estándares naturalmente. Te entusiasmas con problemas de alta tensión.
Especialista en: CNE-U, IEC 60364, IEEE Std 141/242/519, diseño de SET, cálculo de cables, coordinación de protecciones, estudios de cortocircuito.
Personalidad: Citas normativas (CNE-U Art. 020, IEC 60364-4-41) cuando aplica. Usas kV, MVA, A, Ω con precisión. Distingues instalaciones (CNE) de concesionarias (DGE/MINEM).
Formato:
- Saludo simple → responde con calidez, 1-2 líneas, puedes preguntar "¿hay algo técnico que revisar?".
- Análisis → **negritas** para valores técnicos, normas y conclusiones de diseño. Usa tablas de comparación cuando hay opciones.
- Menciona @IC para presupuesto de materiales, @PM para integración en cronograma.
- Escala a @GG cuando requiere decisión de inversión mayor.
- Responde en español. Técnica pero comprensible.`,
};

const RT_KEYWORDS: Record<string, string[]> = {
  ic: ["costo", "costos", "presupuesto", "precio", "valoriz", "adicional", "desviaci", "metrado", "contingencia", "soles", "s/", "económic", "rentab", "partida", "gasto", "oferta", "cotiz"],
  pm: ["cronograma", "plazo", "retraso", "riesgo", "restricci", "ruta crítica", "hito", "avance", "recuper", "planific", "fecha", "entrega", "atraso", "gestión"],
  ie: ["diseño", "eléctric", "norma", "normativ", "cálculo", "cne", "iec", "ieee", "protección", "tensión", "kv", "subestación", "cable", "tendido", "set ", "potencia"],
};

function agentsForMessage(text: string, targetId: string | null): string[] {
  const allActive = AGENTS.filter((a) => a.type === "agent" && a.status === "active").map((a) => a.id);

  // If user directed to specific agent
  if (targetId && allActive.includes(targetId)) return [targetId];

  // "buenos días a todos" / team messages → all active agents respond
  if (isTeamMessage(text)) return allActive;

  const t = text.toLowerCase();
  const scored = allActive.map((id) => ({
    id, hits: (RT_KEYWORDS[id] || []).filter((k) => t.includes(k)).length,
  }));

  // Simple one-to-one greeting → only most relevant agent (or IC)
  if (isSimpleMessage(text)) {
    const best = scored.sort((a, b) => b.hits - a.hits)[0];
    return [best?.hits > 0 ? best.id : "ic"];
  }

  // Technical message → all agents with keyword hits; if none, IC+PM
  const relevant = scored.filter((s) => s.hits > 0).sort((a, b) => b.hits - a.hits);
  if (relevant.length > 0) return relevant.map((s) => s.id);
  return ["ic", "pm"];
}

function RTMessage({ role, text, time, agentId, modelLabel, isError }: {
  role: "gg" | "agent"; text: string; time: string; agentId?: string; modelLabel?: string; isError?: boolean;
}) {
  const isUser = role === "gg";
  const agent = agentId ? agentById(agentId) : null;
  return (
    <div style={{ display: "flex", gap: 9, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
      <div className={`agent-avatar ${isUser ? "agent-avatar--gg" : agentAvatarClass(agentId || "")}`} style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0 }}>
        {isUser ? "GG" : (agentId || "").toUpperCase()}
      </div>
      <div style={{ maxWidth: "80%" }}>
        {!isUser && agent && <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t1)", marginBottom: 3 }}>{agent.name}</div>}
        <div style={{
          padding: "8px 11px", borderRadius: 10,
          background: isError ? "var(--red-bg, #fff1f0)" : isUser ? "var(--blue)" : "var(--bg-card)",
          color: isError ? "var(--red-text, #c00)" : isUser ? "#fff" : "var(--t1)",
          border: isUser ? "none" : `1px solid ${isError ? "var(--red-border, #fca5a5)" : "var(--border)"}`,
          fontSize: 12.5, lineHeight: 1.6, borderTopRightRadius: isUser ? 3 : 10, borderTopLeftRadius: isUser ? 10 : 3,
        }}>
          {isUser ? text : <MdText text={text} />}
        </div>
        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 3, display: "flex", gap: 6, alignItems: "center", justifyContent: isUser ? "flex-end" : "flex-start" }}>
          <span>{time}</span>
          {modelLabel && !isUser && (
            <span style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "var(--mono)" }}>{modelLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function HandRaise({ agentId, modelLabel }: { agentId: string; modelLabel?: string }) {
  const agent = agentById(agentId);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: "var(--r)" }}>
      <div className={`agent-avatar ${agentAvatarClass(agentId)}`} style={{ width: 26, height: 26, fontSize: 9 }}>{agentId.toUpperCase()}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>✍️ {agent?.name || agentId} redactando…</div>
        {modelLabel && <div style={{ fontSize: 10, color: "var(--amber-text)", fontFamily: "var(--mono)" }}>{modelLabel}</div>}
      </div>
    </div>
  );
}

function ProjectChip({ projectId, onClick }: { projectId: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 4, padding: "2px 8px", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
      @{projectId}
    </button>
  );
}

export function RoundtableView() {
  const { state, appendChat, chatFor } = useStore();
  const { session } = useSession(false);
  const { online, toggle: toggleOnline } = useOnlineMode();
  const [input, setInput] = useState("");
  const [projectId, setProjectId] = useState("PRY-001");
  const [busy, setBusy] = useState(false);
  const [hands, setHands] = useState<{ agentId: string; modelLabel?: string }[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ollamaModelsRef = useRef<string[]>([]);

  const thread = chatFor(ROUNDTABLE_THREAD);
  const allProjects = [...PROJECTS, ...state.customProjects];
  const project = allProjects.find((p) => p.id === projectId);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.length, busy, hands.length, showHelp]);

  useEffect(() => {
    getOllamaModels().then((m) => { ollamaModelsRef.current = m; });
  }, []);

  async function send(rawText?: string, inputCtx?: ChatCtx) {
    const raw = (rawText ?? input).trim();
    if (!raw || busy) return;

    const parsed = parseInput(raw);

    if (parsed.isHelp) {
      setShowHelp(true);
      setInput("");
      return;
    }

    // Context from ChatAutoInput chip overrides sidebar selector
    const ctxProject = inputCtx?.project ?? null;
    const ctxRequirement = inputCtx?.requirement ?? null;

    // If @PRY-xxx detected in text OR chip context → switch project
    const effectiveProjectId = ctxProject?.id ?? parsed.targetProjectId ?? projectId;
    if (parsed.targetProjectId) {
      const found = allProjects.find((p) => p.id === parsed.targetProjectId);
      if (found) setProjectId(found.id);
    } else if (ctxProject) {
      setProjectId(ctxProject.id);
    }

    const activeProject = ctxProject ?? allProjects.find((p) => p.id === effectiveProjectId) ?? null;
    const userDisplay = raw;

    appendChat(ROUNDTABLE_THREAD, { role: "gg", text: userDisplay });
    setInput("");
    setBusy(true);

    const responders = agentsForMessage(parsed.cleanText, parsed.targetAgentId);
    const routing = routeRequest(parsed.cleanText, ollamaModelsRef.current);

    setHands(responders.map((id) => ({ agentId: id, modelLabel: routing.modelLabel })));

    const userId = session?.email ?? "anonymous";
    // A short message is only "simple" (greeting/no analysis) if the user
    // hasn't attached project/RQ context via chips — otherwise they want
    // that context used even if the question itself is short.
    const simple = isSimpleMessage(parsed.cleanText) && !ctxProject && !ctxRequirement;

    // Auto-detect COT-xxx / RQ-xxx / OC-xxx codes pasted in the message
    let autoCodeCtx = "";
    if (!simple) {
      const codes = detectDocumentCodes(parsed.cleanText);
      for (const dc of codes) {
        if (dc.type === "COT") {
          const cot = await fetchCotizacionByCode(dc.code).catch(() => null);
          if (cot) {
            const p = cotizacionToProject(cot);
            autoCodeCtx += `\n\nCotización detectada **${p.id}**: ${p.name} · Cliente: ${p.client} · Estado: ${p.status} · Avance: ${p.progress}%${p.summary ? ` · ${p.summary}` : ""}`;
          }
        } else if (dc.type === "RQ") {
          const rq = await fetchRequirementByCode(dc.code).catch(() => null);
          if (rq) {
            autoCodeCtx += buildContextPrompt({ project: null, requirement: rq });
          }
        }
      }
    }

    // File attachments from ChatAutoInput
    const fileCtx = (inputCtx?.attachments ?? []).map((f) =>
      `\n\n--- Archivo adjunto: ${f.name} (${Math.round(f.size / 1024)}KB) ---\n${f.content}\n---`
    ).join("");

    for (const agId of responders) {
      const sysPrompt = RT_SYSTEM_PROMPTS[agId] ?? RT_SYSTEM_PROMPTS.ic;
      const projectCtx = activeProject && !simple
        ? `\n\nProyecto activo: **${activeProject.name}** (${activeProject.id}). Cliente: ${activeProject.client}. Estado: ${activeProject.status}. Avance: ${activeProject.progress}%. ${activeProject.summary}`
        : "";
      const requirementCtx = ctxRequirement && !simple
        ? buildContextPrompt({ project: null, requirement: ctxRequirement })
        : "";

      // Load long-term memory from Supabase for this agent
      const supabaseHistory = simple ? [] : await loadConversationHistory(userId, agId, activeProject?.id, 6).catch(() => []);

      const messages: ChatMessage[] = [
        { role: "system", content: sysPrompt + projectCtx + requirementCtx + autoCodeCtx },
        ...supabaseHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: parsed.cleanText + fileCtx },
      ];

      try {
        const { response, actualConfig } = await sendChatWithFallback(messages, routing.config, ollamaModelsRef.current);
        const label = `${actualConfig.provider}/${response.model}`;
        appendChat(ROUNDTABLE_THREAD, { role: "agent", agentId: agId, text: response.content, modelLabel: label });
        saveConversation(userId, agId, parsed.cleanText, response.content, label, routing.complexity, activeProject?.id).catch(() => {});
      } catch (err) {
        appendChat(ROUNDTABLE_THREAD, {
          role: "agent", agentId: agId,
          text: `No pude conectar. ${err instanceof Error ? err.message : "Error"}`,
          isError: true,
        });
      }

      setHands((h) => h.filter((x) => x.agentId !== agId));
      await new Promise((r) => setTimeout(r, 200));
    }

    setBusy(false);
  }

  const projectOptions = allProjects.map((p) => p.id);

  return (
    <>
      <PageHeader
        eyebrow="Mesa de trabajo"
        title="Discusión coordinada con tu equipo IA"
        description="Plantea un tema — los agentes responden según su dominio. Usa @IC, @PM, @IE para dirigirte a uno, o /ayuda para ver comandos."
        actions={<span className="badge badge--green badge--dot">IA activa</span>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 10, alignItems: "start" }}>
        <div className="space-y-2">
          <div className="card" style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>Proyecto activo</div>
            <select className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ width: "100%" }}>
              {allProjects.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
            </select>
            {project && (
              <div style={{ marginTop: 10 }}>
                <div className="info-row"><span className="info-row-label">Cliente</span><span className="info-row-value">{project.client}</span></div>
                <div className="info-row"><span className="info-row-label">Estado</span><span className="info-row-value">{project.status}</span></div>
                <div className="info-row"><span className="info-row-label">Avance</span><span className="info-row-value">{project.progress}%</span></div>
                <p style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 8, lineHeight: 1.5 }}>{project.summary}</p>
              </div>
            )}
            <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
              <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 5 }}>Acceso rápido:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {projectOptions.slice(0, 4).map((pid) => (
                  <ProjectChip key={pid} projectId={pid} onClick={() => { setProjectId(pid); setInput((v) => v + `@${pid} `); }} />
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>Equipo en la mesa</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {AGENTS.filter((a) => a.id !== "gg").map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className={`agent-avatar ${agentAvatarClass(a.id)}`} style={{ width: 24, height: 24, fontSize: 9 }}>{a.id.toUpperCase()}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: a.status === "active" ? "var(--green-text)" : a.status === "needs-approval" ? "var(--amber-text)" : "var(--t3)" }}>
                      {a.status === "active" ? "● Activo" : a.status === "needs-approval" ? "⚠ Pendiente" : "○ Futuro"}
                    </div>
                  </div>
                  {a.status === "active" && (
                    <button className="btn btn--ghost btn--sm" style={{ fontSize: 9, padding: "2px 6px" }} onClick={() => setInput(`@${a.id.toUpperCase()} `)}>
                      @
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 190px)", minHeight: 420 }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div className="agent-avatar agent-avatar--gg">GG</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Mesa de trabajo</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>{project ? `${project.id} · ${project.name}` : "Sin proyecto"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="badge badge--green">IA activa</span>
              <button
                className="btn btn--ghost btn--sm"
                style={{ fontSize: 10, color: online ? "var(--blue)" : "var(--t3)" }}
                title={online ? "Modo Online — solo modelos cloud" : "Ollama activo — click para solo-cloud"}
                onClick={toggleOnline}
              >
                {online ? "☁ Online" : "🖥 Local+Cloud"}
              </button>
              <button className="btn btn--ghost btn--sm" style={{ fontSize: 11 }} onClick={() => setShowHelp((v) => !v)}>
                /ayuda
              </button>
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10, background: "var(--bg-muted)" }}>
            {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

            {thread.length === 0 && !showHelp && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: 380 }}>
                <div className="agent-avatar agent-avatar--gg" style={{ width: 48, height: 48, fontSize: 16, margin: "0 auto 12px" }}>GG</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>Convoca a tu equipo</div>
                <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>
                  Escribe cualquier pregunta. Los agentes activos responden según su especialidad. Usa <strong>/ayuda</strong> para ver todos los comandos.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 14 }}>
                  {[
                    "Buenos días equipo",
                    "@IC ¿cuál es la desviación en @PRY-001?",
                    "@PM ¿qué riesgos tiene el cronograma?",
                    "¿Qué norma aplica a la SET 138kV?",
                    "Estado del portafolio de proyectos",
                  ].map((s) => (
                    <button key={s} className="btn btn--ghost btn--sm" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {thread.map((m) => (
              <RTMessage key={m.id} role={m.role} text={m.text} time={m.time} agentId={m.agentId} modelLabel={m.modelLabel} isError={m.isError} />
            ))}
            {hands.map((h) => (
              <HandRaise key={h.agentId} agentId={h.agentId} modelLabel={h.modelLabel} />
            ))}
          </div>

          <div style={{ flexShrink: 0, padding: 10, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[
                { label: "@IC", title: "Ing. Costos", color: "#2563eb" },
                { label: "@PM", title: "Proj. Manager", color: "#7c3aed" },
                { label: "@IE", title: "Ing. Eléctrico", color: "#0891b2" },
              ].map((a) => (
                <button key={a.label} title={a.title} style={{ background: "#fff", border: `1px solid ${a.color}`, color: a.color, borderRadius: 4, padding: "2px 8px", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: "pointer" }} onClick={() => setInput((v) => (v.startsWith("@") ? v : a.label + " "))}>
                  {a.label}
                </button>
              ))}
              <button style={{ fontSize: 10, color: "var(--t3)", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }} onClick={() => setShowHelp(true)}>
                /ayuda
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <ChatAutoInput
                value={input}
                onChange={setInput}
                onSubmit={(text, ctx) => send(text, ctx)}
                placeholder="Escribe… @IC /proyecto /rq /ayuda"
                disabled={busy}
                defaultProjectId={projectId}
              />
              <button className="btn btn--primary" style={{ padding: "9px 14px" }} onClick={() => send()} disabled={busy}>
                <Icons.arrowRight width={15} height={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
