"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Icons } from "../../lib/icons";
import { useStore } from "../../lib/store/StoreProvider";
import { agentById, AGENTS, PROJECTS } from "../../lib/data";
import { agentAvatarClass } from "./shared";
import { routeRequest } from "@/lib/llm/modelRouter";
import { getStoredDeviceProfile } from "@/lib/llm/deviceDetection";
import { getOllamaModels, sendChat } from "@/lib/llm/providers";
import { ModelBadge } from "@/components/ai-office/ModelBadge";
import type { RoutingDecision } from "@/lib/llm/modelRouter";
import { saveConversation, loadConversationHistory } from "@/lib/memory/conversationMemory";
import { useSession } from "@/lib/auth/useSession";

const ROUNDTABLE_THREAD = "roundtable";
const LONG_TEXT_THRESHOLD = 700;

const RT_KEYWORDS: Record<string, string[]> = {
  ic: ["costo", "costos", "presupuesto", "precio", "valoriz", "adicional", "desviaci", "metrado", "contingencia", "soles", "s/", "económic", "rentab", "partida", "gasto"],
  pm: ["cronograma", "plazo", "retraso", "riesgo", "restricci", "ruta crítica", "hito", "avance", "recuper", "planific", "fecha", "entrega"],
  ie: ["diseño", "eléctric", "norma", "normativ", "cálculo", "cne", "iec", "ieee", "protección", "tensión", "kv", "subestación", "cable", "tendido"],
};

const RT_SYSTEM_PROMPTS: Record<string, string> = {
  ic: "Eres el Ingeniero de Costos y Presupuestos en una mesa de trabajo multidisciplinaria de una Oficina Técnica de ingeniería. Analizas presupuestos, metrados, desviaciones y costos. Sé directo y técnico. Responde en español. Si ya hay aportes de otros agentes en el contexto, complementa sin repetir lo que ya dijeron.",
  pm: "Eres el Project Manager en una mesa de trabajo multidisciplinaria de una Oficina Técnica de ingeniería. Aportas perspectiva de cronograma, riesgos, rutas críticas y planificación. Sé conciso. Responde en español. Complementa las perspectivas de otros agentes.",
  ie: "Eres el Ingeniero Especialista en normas eléctricas en una mesa de trabajo multidisciplinaria. Aportas perspectiva normativa (CNE, IEC, IEEE) y criterios de diseño eléctrico. Responde en español. Complementa a otros agentes.",
};

type FileAttachment = {
  name: string;
  mimeType: string;
  textContent?: string;
  isImage?: boolean;
  imageDataUrl?: string;
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

function FileChip({
  name,
  isImage,
  imageDataUrl,
  onRemove,
}: {
  name: string;
  mimeType: string;
  isImage?: boolean;
  imageDataUrl?: string;
  onRemove?: () => void;
}) {
  if (isImage && imageDataUrl) {
    return (
      <div style={{ position: "relative", display: "inline-block", marginTop: 6 }}>
        <img
          src={imageDataUrl}
          alt={name}
          style={{ maxWidth: 180, maxHeight: 120, borderRadius: 6, border: "1px solid var(--border)", display: "block" }}
        />
        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{name}</div>
        {onRemove && (
          <button
            onClick={onRemove}
            style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,.5)", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", color: "#fff", fontSize: 10, lineHeight: "18px", textAlign: "center" }}
          >
            ×
          </button>
        )}
      </div>
    );
  }
  const ext = name.split(".").pop()?.toUpperCase() || "FILE";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "var(--bg-muted)", border: "1px solid var(--border)", borderRadius: 6, marginTop: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--blue)", background: "var(--blue-bg)", padding: "1px 5px", borderRadius: 3 }}>{ext}</span>
      <span style={{ fontSize: 11, color: "var(--t2)" }}>{name}</span>
      {onRemove && (
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", fontSize: 12, padding: 0, marginLeft: 2 }}>×</button>
      )}
    </div>
  );
}

function RTMessage({
  role,
  text,
  time,
  agentId,
  routing,
  isError,
  attachment,
}: {
  role: "gg" | "agent";
  text: string;
  time: string;
  agentId?: string;
  routing?: RoutingDecision;
  isError?: boolean;
  attachment?: { name: string; mimeType: string; isImage?: boolean; imageDataUrl?: string };
}) {
  const isUser = role === "gg";
  const agent = agentId ? agentById(agentId) : null;
  return (
    <div style={{ display: "flex", gap: 9, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
      <div
        className={`agent-avatar ${isUser ? "agent-avatar--gg" : agentAvatarClass(agentId || "")}`}
        style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0 }}
      >
        {isUser ? "GG" : (agentId || "").toUpperCase()}
      </div>
      <div style={{ maxWidth: "78%" }}>
        {!isUser && agent && (
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t1)", marginBottom: 3 }}>{agent.name}</div>
        )}
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
          {attachment && (
            <FileChip
              name={attachment.name}
              mimeType={attachment.mimeType}
              isImage={attachment.isImage}
              imageDataUrl={attachment.imageDataUrl}
            />
          )}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--t3)",
            marginTop: 3,
            textAlign: isUser ? "right" : "left",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexDirection: isUser ? "row-reverse" : "row",
          }}
        >
          <span>{time}</span>
          {!isUser && routing && <ModelBadge decision={routing} />}
        </div>
      </div>
    </div>
  );
}

function TypingDots({ agentId, modelLabel }: { agentId: string; modelLabel?: string }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
      <div className={`agent-avatar ${agentAvatarClass(agentId)}`} style={{ width: 28, height: 28, fontSize: 10 }}>
        {agentId.toUpperCase()}
      </div>
      <div style={{ padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--t3)", animation: `igblink 1.2s ${i * 0.2}s infinite ease-in-out` }}
            />
          ))}
        </div>
        {modelLabel && (
          <div style={{ fontSize: 9.5, color: "var(--t3)", marginTop: 4 }}>{modelLabel}</div>
        )}
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
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>✋ {agent?.name || agentId} va a responder</div>
        <div style={{ fontSize: 11, color: "var(--amber-text)" }}>{reason}</div>
      </div>
    </div>
  );
}

export function RoundtableView() {
  const { state, appendChat, chatFor } = useStore();
  const { session } = useSession(false);
  const [input, setInput] = useState("");
  const [projectId, setProjectId] = useState("PRY-001");
  const [busy, setBusy] = useState(false);
  const [hands, setHands] = useState<{ agentId: string; reason: string }[]>([]);
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [hasModels, setHasModels] = useState(false);
  const [typingAgentId, setTypingAgentId] = useState<string | null>(null);
  const [typingModelLabel, setTypingModelLabel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const thread = chatFor(ROUNDTABLE_THREAD);
  const allProjects = [...PROJECTS, ...state.customProjects];
  const project = allProjects.find((p) => p.id === projectId);

  useEffect(() => {
    getOllamaModels().then((models) => {
      setOllamaModels(models);
      const apiKeys = [
        localStorage.getItem("ot:apikey:openai"),
        localStorage.getItem("ot:apikey:anthropic"),
        localStorage.getItem("ot:apikey:gemini"),
      ].filter(Boolean);
      setHasModels(models.length > 0 || apiKeys.length > 0);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.length, busy, hands.length, typingAgentId]);

  function readAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file, "utf-8");
    });
  }

  function readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.type.startsWith("image/")) {
      const dataUrl = await readAsDataURL(file);
      setAttachment({ name: file.name, mimeType: file.type, isImage: true, imageDataUrl: dataUrl });
    } else if (
      file.type.startsWith("text/") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".json")
    ) {
      const text = await readAsText(file);
      setAttachment({ name: file.name, mimeType: file.type || "text/plain", textContent: text });
    } else {
      // PDF, Word, Excel — attach as metadata; content not extractable without extra libraries
      setAttachment({ name: file.name, mimeType: file.type || "application/octet-stream" });
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = e.clipboardData.getData("text");
    if (pasted.length > LONG_TEXT_THRESHOLD && !attachment) {
      e.preventDefault();
      setAttachment({ name: "Contexto_pegado.txt", mimeType: "text/plain", textContent: pasted });
      if (!input.trim()) setInput("Analiza el siguiente documento:");
    }
  }

  async function send(text?: string) {
    const value = (text ?? input).trim();
    if (!value || busy) return;

    const userId = session?.email ?? "anonymous";
    const deviceProfile = getStoredDeviceProfile();
    const agentModels = JSON.parse(localStorage.getItem("ot:agent:models") ?? "{}");

    let contextText = value;
    if (attachment?.textContent) {
      contextText = `${value}\n\n[Documento adjunto: ${attachment.name}]\n---\n${attachment.textContent.slice(0, 8000)}\n---`;
    } else if (attachment) {
      contextText = `${value}\n\n[Archivo adjunto: ${attachment.name} (${attachment.mimeType})]`;
    }

    appendChat(ROUNDTABLE_THREAD, {
      role: "gg",
      text: value,
      ...(attachment
        ? {
            attachment: {
              name: attachment.name,
              mimeType: attachment.mimeType,
              isImage: attachment.isImage,
              imageDataUrl: attachment.imageDataUrl,
            },
          }
        : {}),
    });
    setInput("");
    setAttachment(null);
    setBusy(true);

    const responders = relevantAgents(value);

    const handCards = responders.map((id) => {
      const keyword = RT_KEYWORDS[id]?.find((k) => value.toLowerCase().includes(k));
      return {
        agentId: id,
        reason: keyword ? `Dominio: "${keyword}"` : "Puede aportar al tema",
      };
    });
    setHands(handCards);
    await new Promise((r) => setTimeout(r, 350));

    for (const agentId of responders) {
      const routing = routeRequest(contextText, ollamaModels, deviceProfile, agentModels[agentId] ?? null);
      setTypingAgentId(agentId);
      setTypingModelLabel(routing.modelLabel);

      const isPaidProvider = routing.config.provider === "openai" || routing.config.provider === "anthropic";
      if (isPaidProvider) {
        // Update hand card to inform user about paid model escalation
        setHands((h) =>
          h.map((hc) =>
            hc.agentId === agentId
              ? { ...hc, reason: `Usando ${routing.modelLabel} (${routing.config.provider}) para análisis profundo` }
              : hc
          )
        );
        await new Promise((r) => setTimeout(r, 200));
      }

      const history = await loadConversationHistory(userId, agentId, projectId, 6);
      const contextMessages = history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const projectContext = project
        ? `Proyecto actual: ${project.name} (${project.id}). Cliente: ${project.client}. Estado: ${project.status}. Avance: ${project.progress}%. Resumen: ${project.summary}`
        : "Proyecto no especificado.";

      const messages = [
        {
          role: "system" as const,
          content: `${RT_SYSTEM_PROMPTS[agentId] ?? "Eres un agente experto en ingeniería."}\n\n${projectContext}`,
        },
        ...contextMessages,
        { role: "user" as const, content: contextText },
      ];

      let responseText = "";
      let isError = false;
      try {
        const response = await sendChat(messages, routing.config);
        responseText = response.content;
      } catch {
        const providerLabel =
          routing.config.provider === "openai"
            ? "OpenAI"
            : routing.config.provider === "anthropic"
              ? "Anthropic"
              : "Ollama";
        responseText = `No pude conectarme con ${routing.modelLabel} (${providerLabel}). Verifica la conexión en Configuración de modelos → Conexiones.`;
        isError = true;
      }

      appendChat(ROUNDTABLE_THREAD, { role: "agent", agentId, text: responseText, routing, isError });
      setHands((h) => h.filter((x) => x.agentId !== agentId));

      if (!isError) {
        saveConversation(userId, agentId, contextText, responseText, routing.modelLabel, routing.complexity, projectId).catch(() => {});
      }

      await new Promise((r) => setTimeout(r, 150));
    }

    setTypingAgentId(null);
    setTypingModelLabel(null);
    setBusy(false);
    setHands([]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Mesa de trabajo"
        title="Discusión coordinada con tu equipo IA"
        description="Plantea un tema y los agentes con dominio relevante responden con IA real. Adjunta archivos o pega texto largo para mayor contexto."
        actions={
          hasModels ? (
            <span className="badge badge--blue badge--dot">En vivo</span>
          ) : (
            <span className="badge badge--slate">Sin modelo · ve a Conexiones</span>
          )
        }
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
                    <div style={{ fontSize: 10, color: "var(--t3)" }}>
                      {a.status === "active" ? "Activo" : a.status === "needs-approval" ? "Pendiente" : "Futuro"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 8, lineHeight: 1.5 }}>
              Los agentes responden según su dominio y el modelo más adecuado para la complejidad de la consulta.
            </p>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 190px)", minHeight: 420 }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div className="agent-avatar agent-avatar--gg">GG</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Mesa de trabajo</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>
                  {project ? `Discutiendo: ${project.name}` : "Selecciona un proyecto"}
                </div>
              </div>
            </div>
            {hasModels ? (
              <span className="badge badge--blue">En vivo</span>
            ) : (
              <span className="badge badge--mock">Sin modelo</span>
            )}
          </div>

          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-muted)" }}
          >
            {thread.length === 0 && hands.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: 360 }}>
                <div className="agent-avatar agent-avatar--gg" style={{ width: 48, height: 48, fontSize: 16, margin: "0 auto 12px" }}>
                  GG
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>Convoca a tu equipo</div>
                <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>
                  Plantea una pregunta o un problema y los agentes con dominio relevante responderán. Puedes adjuntar archivos o pegar texto largo para dar contexto.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 14 }}>
                  {[
                    "¿Cómo recuperamos el atraso en PRY-001?",
                    "Analicemos la desviación de costo de Tintaya",
                    "¿Qué riesgos cruzados vemos en el portafolio?",
                  ].map((s) => (
                    <button key={s} className="btn btn--ghost btn--sm" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {thread.map((m) => (
              <RTMessage
                key={m.id}
                role={m.role}
                text={m.text}
                time={m.time}
                agentId={m.agentId}
                routing={m.routing}
                isError={m.isError}
                attachment={m.attachment}
              />
            ))}
            {hands.map((h) => (
              <HandRaise key={h.agentId} agentId={h.agentId} reason={h.reason} />
            ))}
            {typingAgentId && (
              <TypingDots agentId={typingAgentId} modelLabel={typingModelLabel ?? undefined} />
            )}
          </div>

          {attachment && (
            <div
              style={{
                flexShrink: 0,
                padding: "6px 12px",
                borderTop: "1px solid var(--border)",
                background: "var(--blue-bg)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, color: "var(--t2)", flexShrink: 0 }}>Adjunto:</span>
              <FileChip
                name={attachment.name}
                mimeType={attachment.mimeType}
                isImage={attachment.isImage}
                imageDataUrl={attachment.imageDataUrl}
                onRemove={() => setAttachment(null)}
              />
              {attachment.textContent && (
                <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: 4 }}>
                  {(attachment.textContent.length / 1000).toFixed(1)}k chars
                </span>
              )}
            </div>
          )}

          <div
            style={{
              flexShrink: 0,
              padding: 10,
              borderTop: "1px solid var(--border)",
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".txt,.md,.csv,.json,.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <button
              className="btn btn--ghost"
              style={{ padding: "8px 10px", flexShrink: 0, fontSize: 14 }}
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar archivo (texto, imagen, PDF, Word, Excel)"
              disabled={busy}
            >
              <Icons.paperclip width={15} height={15} />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              onPaste={handlePaste}
              placeholder="Plantea un tema… (Enter envía · Shift+Enter nueva línea · texto largo → se adjunta automáticamente)"
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
                background: "var(--bg-card)",
              }}
            />
            <button
              className="btn btn--primary"
              style={{ padding: "9px 14px" }}
              onClick={() => send()}
              disabled={busy}
            >
              <Icons.arrowRight width={15} height={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
