"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { aiAgentsMock } from "@/lib/ai-office/aiAgentsMock";
import {
  checkOllamaConnectivity,
  getOllamaModels,
} from "@/lib/llm/providers";
import {
  DEFAULT_AGENT_MODELS,
  OLLAMA_SETUP_STEPS,
  RECOMMENDED_MODELS,
} from "@/lib/llm/agentModels";
import {
  detectDeviceProfile,
  getStoredDeviceProfile,
  type DeviceProfile,
} from "@/lib/llm/deviceDetection";

type OllamaStatus = "checking" | "connected" | "disconnected";

type AgentModelAssignment = {
  provider: "ollama" | "gemini" | "groq" | "sambanova" | "openrouter" | "cerebras" | "mistral" | "together" | "openai" | "anthropic";
  model: string;
};

type CompatBadge = {
  label: string;
  color: "green" | "amber" | "red";
};

const LS_OLLAMA_URL = "ot:ollama:baseUrl";
const LS_AGENT_MODELS = "ot:agent:models";
const LS_APIKEY_GEMINI      = "ot:apikey:gemini";
const LS_APIKEY_GROQ        = "ot:apikey:groq";
const LS_APIKEY_SAMBANOVA   = "ot:apikey:sambanova";
const LS_APIKEY_OPENROUTER  = "ot:apikey:openrouter";
const LS_APIKEY_CEREBRAS    = "ot:apikey:cerebras";
const LS_APIKEY_MISTRAL     = "ot:apikey:mistral";
const LS_APIKEY_TOGETHER    = "ot:apikey:together";
const LS_APIKEY_OPENAI      = "ot:apikey:openai";
const LS_APIKEY_ANTHROPIC   = "ot:apikey:anthropic";
const LS_NEW_DEVICE_DISMISSED = "ot:newdevice:dismissed";

function getLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

// ── Compatibility logic ─────────────────────────────────────────────────────

function getModelCompatibility(modelName: string, deviceProfile: DeviceProfile | null): CompatBadge {
  const lower = modelName.toLowerCase();
  const tier = deviceProfile?.tier ?? "mid";

  if (lower.includes("70b") || lower.includes("65b")) {
    return { label: "No recomendado", color: "red" };
  }
  if (lower.includes("30b") || lower.includes("32b")) {
    return { label: "Muy lento", color: "amber" };
  }
  if (lower.includes("14b") || lower.includes("13b")) {
    if (tier === "high") return { label: "Compatible", color: "green" };
    if (tier === "mid") return { label: "Lento en esta PC", color: "amber" };
    return { label: "No recomendado", color: "red" };
  }
  // 7b, 8b, 3b, 1b or no size suffix
  return { label: "Compatible", color: "green" };
}

function compatEmoji(color: "green" | "amber" | "red"): string {
  if (color === "green") return "✅";
  if (color === "amber") return "⚠️";
  return "❌";
}

function tierLabel(tier: DeviceProfile["tier"]): string {
  if (tier === "high") return "alto";
  if (tier === "mid") return "medio";
  return "bajo";
}

// ── New Device Notice ───────────────────────────────────────────────────────

function NewDeviceNotice({
  ollamaStatus,
}: {
  ollamaStatus: OllamaStatus;
}) {
  const [dismissed, setDismissed] = useState(true); // start hidden, check on mount

  useEffect(() => {
    const wasDismissed = localStorage.getItem(LS_NEW_DEVICE_DISMISSED) === "1";
    setDismissed(wasDismissed);
  }, []);

  function dismiss() {
    localStorage.setItem(LS_NEW_DEVICE_DISMISSED, "1");
    setDismissed(true);
  }

  if (dismissed || ollamaStatus !== "disconnected") return null;

  return (
    <div
      style={{
        background: "var(--blue-bg)",
        border: "1px solid var(--blue-border)",
        borderRadius: "var(--r)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>💻</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--blue-text)", marginBottom: 2 }}>
          ¿Estás en una PC nueva?
        </p>
        <p style={{ fontSize: 12, color: "var(--blue-text)", lineHeight: 1.6, opacity: 0.85 }}>
          Ollama no está corriendo en este dispositivo. Sigue los pasos de instalación abajo, o usa OpenAI/Anthropic mientras tanto.
        </p>
      </div>
      <button
        className="btn btn--ghost btn--sm"
        onClick={dismiss}
        style={{ flexShrink: 0, fontSize: 11 }}
        aria-label="Cerrar aviso"
      >
        Cerrar
      </button>
    </div>
  );
}

// ── No Compatible Models Warning ────────────────────────────────────────────

function NoCompatibleModelsWarning({
  ollamaStatus,
  ollamaModels,
  deviceProfile,
  apiKeysSectionRef,
}: {
  ollamaStatus: OllamaStatus;
  ollamaModels: string[];
  deviceProfile: DeviceProfile | null;
  apiKeysSectionRef: React.RefObject<HTMLDivElement | null>;
}) {
  const allBad =
    ollamaStatus === "connected" &&
    ollamaModels.length > 0 &&
    ollamaModels.every((m) => {
      const c = getModelCompatibility(m, deviceProfile);
      return c.color !== "green";
    });

  const showWarning = ollamaStatus === "disconnected" || allBad;

  if (!showWarning) return null;

  function scrollToApiKeys() {
    apiKeysSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      style={{
        background: "var(--amber-bg)",
        border: "1px solid var(--amber-border)",
        borderRadius: "var(--r)",
        padding: "14px 16px",
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--amber-text)", marginBottom: 6 }}>
        ⚠️ Sin modelos locales compatibles. Configura Gemini o Groq (gratuitos y rápidos) para obtener respuestas en 1-2 segundos.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button className="btn btn--ghost btn--sm" onClick={scrollToApiKeys} style={{ fontSize: 12, color: "var(--amber-text)", borderColor: "var(--amber-border)" }}>
          Configurar Gemini (gratis) ↓
        </button>
        <button className="btn btn--ghost btn--sm" onClick={scrollToApiKeys} style={{ fontSize: 12, color: "var(--amber-text)", borderColor: "var(--amber-border)" }}>
          Configurar Groq (gratis) ↓
        </button>
      </div>
    </div>
  );
}

// ── Model Compatibility Section ─────────────────────────────────────────────

function ModelCompatibilitySection({
  ollamaModels,
  deviceProfile,
}: {
  ollamaModels: string[];
  deviceProfile: DeviceProfile | null;
}) {
  if (ollamaModels.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 14,
        borderTop: "1px solid var(--border)",
        paddingTop: 14,
      }}
    >
      {/* Device summary */}
      <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10 }}>
        {deviceProfile
          ? `Este dispositivo: ${deviceProfile.threads} núcleos · ${deviceProfile.memoryGB} GB RAM · perfil ${tierLabel(deviceProfile.tier)}`
          : "Este dispositivo: perfil desconocido (abre la app para detectar)"}
      </p>

      {/* Model list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ollamaModels.map((m) => {
          const badge = getModelCompatibility(m, deviceProfile);
          const badgeColorMap: Record<"green" | "amber" | "red", string> = {
            green: "var(--green-text)",
            amber: "var(--amber-text)",
            red: "var(--red-text, #dc2626)",
          };
          return (
            <div
              key={m}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "5px 8px",
                borderRadius: "var(--r)",
                background: "var(--bg-subtle)",
              }}
            >
              <span style={{ color: "var(--t3)", fontSize: 10, flexShrink: 0 }}>●</span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  color: "var(--t1)",
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: badgeColorMap[badge.color],
                  fontWeight: 500,
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {compatEmoji(badge.color)} {badge.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Ollama Status Banner ────────────────────────────────────────────────────

function OllamaStatusBanner({
  status,
  ollamaUrl,
  ollamaModels,
  setupOpen,
  onToggleSetup,
  deviceProfile,
}: {
  status: OllamaStatus;
  ollamaUrl: string;
  ollamaModels: string[];
  setupOpen: boolean;
  onToggleSetup: () => void;
  deviceProfile: DeviceProfile | null;
}) {
  if (status === "checking") {
    return (
      <div
        className="card"
        style={{ borderLeft: "3px solid var(--blue)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}
      >
        <span className="spinner" />
        <p style={{ fontSize: 13, color: "var(--t2)" }}>Verificando conexión con Ollama…</p>
      </div>
    );
  }

  if (status === "connected") {
    return (
      <div
        className="card"
        style={{ borderLeft: "3px solid var(--green)", padding: "12px 16px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--green-text)" }}>
            Ollama conectado en{" "}
            <span style={{ fontFamily: "var(--mono)", fontWeight: 500 }}>{ollamaUrl}</span>
            {" — "}
            {ollamaModels.length > 0
              ? `${ollamaModels.length} modelo${ollamaModels.length !== 1 ? "s" : ""} disponible${ollamaModels.length !== 1 ? "s" : ""}`
              : "sin modelos descargados"}
          </p>
        </div>

        {/* Modelos disponibles with compatibility */}
        {ollamaModels.length > 0 && (
          <>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--t3)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginTop: 14,
                marginBottom: 0,
              }}
            >
              Modelos disponibles
            </p>
            <ModelCompatibilitySection ollamaModels={ollamaModels} deviceProfile={deviceProfile} />
          </>
        )}
      </div>
    );
  }

  // disconnected
  return (
    <div
      className="card"
      style={{ borderLeft: "3px solid var(--amber)" }}
    >
      <div
        style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--amber)", flexShrink: 0 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--amber-text)" }}>
            Ollama no detectado en{" "}
            <span style={{ fontFamily: "var(--mono)", fontWeight: 500 }}>{ollamaUrl}</span>
          </p>
        </div>
        <button
          className="btn btn--ghost btn--sm"
          onClick={onToggleSetup}
        >
          {setupOpen ? "Ocultar guía" : "Guía de instalación"}
        </button>
      </div>

      {setupOpen && (
        <div style={{ borderTop: "1px solid var(--amber-border)", padding: "16px", background: "var(--amber-bg)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--amber-text)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Cómo instalar Ollama
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {OLLAMA_SETUP_STEPS.map((s) => (
              <div key={s.step} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: "var(--amber)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {s.step}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 3 }}>{s.title}</p>
                  <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: s.command ? 6 : 0 }}>{s.description}</p>
                  {s.command && (
                    <pre
                      style={{
                        fontFamily: "var(--mono)", fontSize: 12,
                        background: "var(--bg-subtle)", border: "1px solid var(--border)",
                        borderRadius: "var(--r)", padding: "6px 10px",
                        color: "var(--t1)", overflowX: "auto",
                      }}
                    >
                      {s.command}
                    </pre>
                  )}
                  {s.link && (
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: "var(--blue)", marginTop: 4, display: "inline-block" }}
                    >
                      {s.link}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ollama URL Config ───────────────────────────────────────────────────────

function OllamaUrlConfig({
  ollamaUrl,
  onUrlChange,
  onTest,
  status,
}: {
  ollamaUrl: string;
  onUrlChange: (url: string) => void;
  onTest: () => void;
  status: OllamaStatus;
}) {
  const [draft, setDraft] = useState(ollamaUrl);

  function handleSave() {
    const url = draft.trim() || "http://localhost:11434";
    localStorage.setItem(LS_OLLAMA_URL, url);
    onUrlChange(url);
    onTest();
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="page-eyebrow" style={{ marginBottom: 2 }}>Configuración</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>URL de Ollama</p>
        </div>
      </div>
      <div className="card-body" style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
          <label className="field-label">Base URL</label>
          <input
            className="input"
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="http://localhost:11434"
          />
          <span className="field-hint">
            Por defecto: http://localhost:11434. Cambia si usas Cloudflare Tunnel u otro proxy.
          </span>
        </div>
        <button
          className="btn btn--primary btn--sm"
          onClick={handleSave}
          disabled={status === "checking"}
          style={{ flexShrink: 0, marginBottom: 18 }}
        >
          {status === "checking" ? "Probando…" : "Probar conexión"}
        </button>
      </div>
    </div>
  );
}

// ── Agent Assignments Summary ───────────────────────────────────────────────

function AgentAssignmentsSummary({
  assignments,
  assignmentsSectionRef,
}: {
  assignments: Record<string, AgentModelAssignment>;
  assignmentsSectionRef: React.RefObject<HTMLDivElement | null>;
}) {
  function scrollToFull() {
    assignmentsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="page-eyebrow" style={{ marginBottom: 2 }}>Resumen</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Agentes configurados</p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {aiAgentsMock.map((agent, idx) => {
          const asgn = assignments[agent.id] ?? DEFAULT_AGENT_MODELS[agent.id] ?? { provider: "gemini", model: "gemini-1.5-flash" };
          return (
            <div
              key={agent.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "9px 16px",
                borderBottom: idx < aiAgentsMock.length - 1 ? "1px solid var(--border)" : "none",
                flexWrap: "wrap",
              }}
            >
              <span style={{ flex: "1 1 140px", fontSize: 13, color: "var(--t1)", fontWeight: 500, minWidth: 120 }}>
                {agent.name}
              </span>
              <span
                style={{
                  flex: "2 1 180px",
                  fontSize: 12,
                  fontFamily: "var(--mono)",
                  color: "var(--t2)",
                  minWidth: 140,
                }}
              >
                {asgn.provider} · {asgn.model}
              </span>
              <button
                className="btn btn--ghost btn--sm"
                onClick={scrollToFull}
                style={{ fontSize: 11, flexShrink: 0 }}
              >
                Cambiar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Agent Model Assignments ─────────────────────────────────────────────────

function AgentModelAssignments({
  assignments,
  onChange,
  ollamaModels,
  sectionRef,
}: {
  assignments: Record<string, AgentModelAssignment>;
  onChange: (agentId: string, value: AgentModelAssignment) => void;
  ollamaModels: string[];
  sectionRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="card" ref={sectionRef}>
      <div className="card-header">
        <div>
          <p className="page-eyebrow" style={{ marginBottom: 2 }}>Asignaciones</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Modelos por agente</p>
        </div>
        <span className="badge badge--slate">
          {aiAgentsMock.length} agentes
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {aiAgentsMock.map((agent, idx) => {
          const asgn = (assignments[agent.id] ?? DEFAULT_AGENT_MODELS[agent.id] ?? { provider: "gemini", model: "gemini-1.5-flash" }) as AgentModelAssignment;
          const providerKey = asgn.provider;
          const baseModels = RECOMMENDED_MODELS[providerKey] ?? RECOMMENDED_MODELS.gemini;
          const models =
            providerKey === "ollama"
              ? [
                  ...RECOMMENDED_MODELS.ollama,
                  ...ollamaModels
                    .filter((m) => !RECOMMENDED_MODELS.ollama.find((r) => r.model === m))
                    .map((m) => ({ model: m, label: m, description: "Instalado localmente", recommended: false, size: undefined })),
                ]
              : baseModels;

          return (
            <div
              key={agent.id}
              style={{
                padding: "12px 16px",
                borderBottom: idx < aiAgentsMock.length - 1 ? "1px solid var(--border)" : "none",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              {/* Agent info */}
              <div style={{ flex: "0 0 auto", minWidth: 160 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{agent.name}</p>
                <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{agent.role}</p>
              </div>

              {/* Provider selector */}
              <div className="field" style={{ flex: "1 1 140px", minWidth: 140, marginBottom: 0 }}>
                <label className="field-label">Proveedor</label>
                <select
                  className="select"
                  value={asgn.provider}
                  onChange={(e) => {
                    const prov = e.target.value as AgentModelAssignment["provider"];
                    const firstModel = RECOMMENDED_MODELS[prov]?.[0]?.model ?? "";
                    onChange(agent.id, { provider: prov, model: firstModel });
                  }}
                >
                  <optgroup label="— Gratuitos —">
                    <option value="gemini">Gemini (Google · gratis)</option>
                    <option value="groq">Groq (Llama · gratis)</option>
                    <option value="sambanova">Sambanova (DeepSeek · gratis)</option>
                    <option value="openrouter">OpenRouter (varios · gratis)</option>
                    <option value="cerebras">Cerebras (ultra-rápido · gratis)</option>
                    <option value="mistral">Mistral AI (español · gratis)</option>
                    <option value="together">Together AI (gratis con créditos)</option>
                  </optgroup>
                  <optgroup label="— Local —">
                    <option value="ollama">Ollama (local)</option>
                  </optgroup>
                  <optgroup label="— De pago —">
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </optgroup>
                </select>
              </div>

              {/* Model selector */}
              <div className="field" style={{ flex: "2 1 200px", minWidth: 200, marginBottom: 0 }}>
                <label className="field-label">Modelo</label>
                <select
                  className="select"
                  value={asgn.model}
                  onChange={(e) => onChange(agent.id, { ...asgn, model: e.target.value })}
                >
                  {models.map((m) => (
                    <option key={m.model} value={m.model}>
                      {m.label}{m.recommended ? " ★" : ""}{"size" in m && m.size ? ` (${m.size})` : ""}
                    </option>
                  ))}
                </select>
                {/* Recommended badge + description */}
                {(() => {
                  const selected = models.find((m) => m.model === asgn.model);
                  if (!selected) return null;
                  return (
                    <p className="field-hint" style={{ marginTop: 4 }}>
                      {selected.recommended && (
                        <span className="badge badge--green" style={{ marginRight: 6, fontSize: 10 }}>
                          Recomendado
                        </span>
                      )}
                      {selected.description}
                    </p>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── API Keys ────────────────────────────────────────────────────────────────

function ApiKeyRow({
  label,
  storageKey,
  placeholder,
}: {
  label: string;
  storageKey: string;
  placeholder: string;
}) {
  const [value, setValue] = useState(() => getLS(storageKey, ""));
  const [saved, setSaved] = useState(false);

  function handleSave() {
    localStorage.setItem(storageKey, value.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label className="field-label">{label}</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          style={{ flex: 1 }}
        />
        <button
          className={saved ? "btn btn--success btn--sm" : "btn btn--ghost btn--sm"}
          onClick={handleSave}
          style={{ flexShrink: 0 }}
        >
          {saved ? "Guardado" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ── Provider Reference Table ────────────────────────────────────────────────

const PROVIDER_REF = [
  { name: "Gemini",      tag: "Google",      free: true,  speed: "~1-2 s",   envVar: "GEMINI_API_KEY",     url: "https://aistudio.google.com/app/apikey",           placeholder: "AQ.Ab8RN…",   note: "1,500 req/día gratis" },
  { name: "Groq",        tag: "Llama/Mixtral", free: true, speed: "<1 s",    envVar: "GROQ_API_KEY",       url: "https://console.groq.com/keys",                    placeholder: "gsk_…",       note: "14,400 req/día gratis" },
  { name: "Sambanova",   tag: "DeepSeek R1", free: true,  speed: "~2 s",     envVar: "SAMBANOVA_API_KEY",  url: "https://cloud.sambanova.ai/apis",                  placeholder: "uuid…",       note: "DeepSeek R1 gratis" },
  { name: "OpenRouter",  tag: "Multi-modelo", free: true, speed: "~2 s",     envVar: "OPENROUTER_API_KEY", url: "https://openrouter.ai/settings/keys",              placeholder: "sk-or-…",     note: "10+ modelos gratis" },
  { name: "Cerebras",    tag: "Ultra-rápido", free: true, speed: "~0.5 s",   envVar: "CEREBRAS_API_KEY",   url: "https://inference.cerebras.ai",                    placeholder: "csk-…",       note: "~1000 tok/s gratis" },
  { name: "Mistral",     tag: "Español",     free: true,  speed: "~1-2 s",   envVar: "MISTRAL_API_KEY",    url: "https://console.mistral.ai/api-keys",              placeholder: "…",           note: "1,000 req/día gratis" },
  { name: "Together AI", tag: "Multi-modelo", free: true, speed: "~2 s",     envVar: "TOGETHER_API_KEY",   url: "https://api.together.ai/settings/api-keys",        placeholder: "…",           note: "Créditos gratis al crear cuenta" },
  { name: "OpenAI",      tag: "GPT-4o",      free: false, speed: "~2-3 s",   envVar: "OPENAI_API_KEY",     url: "https://platform.openai.com/api-keys",             placeholder: "sk-…",        note: "Pago por uso (~$0.01/50 msgs)" },
  { name: "Anthropic",   tag: "Claude",      free: false, speed: "~2-3 s",   envVar: "ANTHROPIC_API_KEY",  url: "https://console.anthropic.com/settings/api-keys",  placeholder: "sk-ant-…",    note: "Pago por uso" },
];

function ProviderReferenceSection() {
  const [serverStatus, setServerStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/llm/status")
      .then((r) => r.json())
      .then(setServerStatus)
      .catch(() => {/* ignore */});
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="page-eyebrow" style={{ marginBottom: 2 }}>Referencia</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Proveedores disponibles</p>
        </div>
      </div>

      {/* How it works */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--blue-bg)" }}>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--blue-text)", marginBottom: 6 }}>
          ¿Cómo funcionan los modelos para todos los usuarios?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--blue-text)", lineHeight: 1.6 }}>
          <p><strong>Opción A — Vercel (recomendada):</strong> Agrega las keys en Vercel → Settings → Environment Variables. Todos los usuarios las usan automáticamente sin configurar nada. Las keys nunca llegan al navegador.</p>
          <p><strong>Opción B — Este navegador:</strong> Pega las keys en la sección de abajo. Solo tú las usas en este dispositivo. Sirve para pruebas o uso personal.</p>
        </div>
      </div>

      {/* Steps */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
          Pasos para activar un proveedor (todos los usuarios)
        </p>
        {[
          { n: 1, text: "Ve a la URL del proveedor en la tabla abajo y crea una cuenta gratuita." },
          { n: 2, text: "Crea una API Key en el panel del proveedor (sección Keys / API Keys)." },
          { n: 3, text: "Ve a vercel.com → tu proyecto oficina-tecnica-ia-01 → Settings → Environment Variables." },
          { n: 4, text: 'Agrega una variable con el nombre exacto de la columna "Env Var en Vercel" y pega la key como valor.' },
          { n: 5, text: "Haz clic en Redeploy en Vercel (o espera el próximo push). Todos los usuarios tendrán acceso." },
          { n: 6, text: "(Opcional) Para uso inmediato solo en tu navegador: pégala también en la sección de Claves API abajo." },
        ].map((s) => (
          <div key={s.n} style={{ display: "flex", gap: 10, marginBottom: 6, alignItems: "flex-start" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--blue)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.n}</div>
            <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.55 }}>{s.text}</p>
          </div>
        ))}
      </div>

      {/* Provider table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg-muted)" }}>
              {["Proveedor", "Velocidad", "Costo", "Env Var en Vercel", "URL de registro", "Nota", "Estado servidor"].map((h) => (
                <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontWeight: 600, color: "var(--t3)", fontSize: 11, whiteSpace: "nowrap", borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROVIDER_REF.map((p, i) => {
              const providerKey = p.name.toLowerCase().replace(/\s+/g, "");
              const configured = serverStatus[providerKey] ??
                serverStatus[p.envVar.replace("_API_KEY", "").toLowerCase()];
              return (
                <tr key={p.name} style={{ borderBottom: i < PROVIDER_REF.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--t1)", whiteSpace: "nowrap" }}>
                    {p.name}
                    <span style={{ marginLeft: 5, fontSize: 10, color: "var(--t3)", fontWeight: 400 }}>{p.tag}</span>
                  </td>
                  <td style={{ padding: "8px 12px", color: "var(--t2)", whiteSpace: "nowrap" }}>{p.speed}</td>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                    <span className={p.free ? "badge badge--green" : "badge badge--slate"} style={{ fontSize: 10 }}>
                      {p.free ? "Gratis" : "Pago"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <code style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--bg-muted)", padding: "2px 5px", borderRadius: 3, color: "var(--t1)" }}>{p.envVar}</code>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)", fontSize: 11, wordBreak: "break-all" }}>{p.url}</a>
                  </td>
                  <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--t3)" }}>{p.note}</td>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                    {configured === true
                      ? <span style={{ color: "var(--green-text)", fontWeight: 600 }}>✅ Activo</span>
                      : configured === false
                        ? <span style={{ color: "var(--t3)" }}>— No configurado</span>
                        : <span style={{ color: "var(--t3)" }}>…</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApiKeysSection({ sectionRef }: { sectionRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="card" ref={sectionRef}>
      <div className="card-header">
        <div>
          <p className="page-eyebrow" style={{ marginBottom: 2 }}>Solo este navegador</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Claves API — acceso inmediato</p>
        </div>
        <span className="badge badge--slate" style={{ fontSize: 10 }}>Solo tu dispositivo</span>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: "var(--r)", padding: "9px 12px", fontSize: 12, color: "var(--amber-text)", lineHeight: 1.5 }}>
          Estas keys se guardan <strong>solo en tu navegador</strong>. Otros usuarios no las ven. Para activarlas para todos, usa las variables de entorno de Vercel (tabla arriba).
        </div>

        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Gratuitos</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PROVIDER_REF.filter((p) => p.free).map((p) => {
              const lsKey = `ot:apikey:${p.name.toLowerCase().replace(/\s+/g, "")}`;
              return <ApiKeyRow key={p.envVar} label={`${p.name} — ${p.note}`} storageKey={lsKey} placeholder={p.placeholder} />;
            })}
          </div>
        </div>

        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>De pago</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ApiKeyRow label="OpenAI API Key (GPT-4o)" storageKey={LS_APIKEY_OPENAI} placeholder="sk-…" />
            <ApiKeyRow label="Anthropic API Key (Claude)" storageKey={LS_APIKEY_ANTHROPIC} placeholder="sk-ant-…" />
          </div>
        </div>

        <div style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.6 }}>
          <strong>Prioridad automática:</strong> Gemini → Groq → Sambanova → OpenRouter → Cerebras → Mistral → Together → Ollama → OpenAI → Anthropic
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export function ModelConnectionsPage() {
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>("checking");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, AgentModelAssignment>>({});
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile | null>(null);

  const apiKeysSectionRef = useRef<HTMLDivElement | null>(null);
  const assignmentsSectionRef = useRef<HTMLDivElement | null>(null);

  // Load persisted values on mount and detect device profile
  useEffect(() => {
    const savedUrl = getLS(LS_OLLAMA_URL, "http://localhost:11434");
    setOllamaUrl(savedUrl);

    const savedModels = getLS(LS_AGENT_MODELS, "");
    if (savedModels) {
      try {
        setAssignments(JSON.parse(savedModels));
      } catch {
        setAssignments(DEFAULT_AGENT_MODELS as Record<string, AgentModelAssignment>);
      }
    } else {
      setAssignments(DEFAULT_AGENT_MODELS as Record<string, AgentModelAssignment>);
    }

    // Load stored profile immediately, then refresh in background
    const stored = getStoredDeviceProfile();
    if (stored) setDeviceProfile(stored);
    detectDeviceProfile().then((p) => setDeviceProfile(p)).catch(() => {/* ignore */});
  }, []);

  const runConnectivityCheck = useCallback(async (url: string) => {
    setOllamaStatus("checking");
    const ok = await checkOllamaConnectivity(url);
    if (ok) {
      const models = await getOllamaModels(url);
      setOllamaModels(models);
      setOllamaStatus("connected");
      setSetupOpen(false);
    } else {
      setOllamaModels([]);
      setOllamaStatus("disconnected");
    }
  }, []);

  // Check on mount
  useEffect(() => {
    const savedUrl = getLS(LS_OLLAMA_URL, "http://localhost:11434");
    runConnectivityCheck(savedUrl);
  }, [runConnectivityCheck]);

  function handleUrlChange(url: string) {
    setOllamaUrl(url);
  }

  function handleAssignmentChange(agentId: string, value: AgentModelAssignment) {
    setAssignments((prev) => {
      const next = { ...prev, [agentId]: value };
      localStorage.setItem(LS_AGENT_MODELS, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* New device dismissible notice */}
      <NewDeviceNotice ollamaStatus={ollamaStatus} />

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <p className="page-eyebrow">Configuración</p>
          <h1 className="page-title">Conexiones y modelos LLM</h1>
          <p className="page-desc">
            Configura el proveedor de modelos para cada agente: Ollama local, OpenAI o Anthropic.
          </p>
        </div>
      </div>

      {/* Section 1: Ollama status + model compatibility */}
      <OllamaStatusBanner
        status={ollamaStatus}
        ollamaUrl={ollamaUrl}
        ollamaModels={ollamaModels}
        setupOpen={setupOpen}
        onToggleSetup={() => setSetupOpen((v) => !v)}
        deviceProfile={deviceProfile}
      />

      {/* No compatible models / disconnected warning */}
      <NoCompatibleModelsWarning
        ollamaStatus={ollamaStatus}
        ollamaModels={ollamaModels}
        deviceProfile={deviceProfile}
        apiKeysSectionRef={apiKeysSectionRef}
      />

      {/* Section 2: Ollama URL */}
      <OllamaUrlConfig
        ollamaUrl={ollamaUrl}
        onUrlChange={handleUrlChange}
        onTest={() => runConnectivityCheck(ollamaUrl)}
        status={ollamaStatus}
      />

      {/* Section 3: Agent assignments summary */}
      <AgentAssignmentsSummary
        assignments={assignments}
        assignmentsSectionRef={assignmentsSectionRef}
      />

      {/* Section 4: Full agent model assignments */}
      <AgentModelAssignments
        assignments={assignments}
        onChange={handleAssignmentChange}
        ollamaModels={ollamaModels}
        sectionRef={assignmentsSectionRef}
      />

      {/* Section 5: Provider Reference + Steps */}
      <ProviderReferenceSection />

      {/* Section 6: API Keys (browser-only) */}
      <ApiKeysSection sectionRef={apiKeysSectionRef} />
    </div>
  );
}
