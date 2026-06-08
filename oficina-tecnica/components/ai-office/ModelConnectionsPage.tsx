"use client";

import { useCallback, useEffect, useState } from "react";
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

type OllamaStatus = "checking" | "connected" | "disconnected";

type AgentModelAssignment = {
  provider: "ollama" | "openai" | "anthropic";
  model: string;
};

const LS_OLLAMA_URL = "ot:ollama:baseUrl";
const LS_AGENT_MODELS = "ot:agent:models";
const LS_APIKEY_OPENAI = "ot:apikey:openai";
const LS_APIKEY_ANTHROPIC = "ot:apikey:anthropic";

function getLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

// ── Ollama Status Banner ────────────────────────────────────────────────────

function OllamaStatusBanner({
  status,
  ollamaUrl,
  ollamaModels,
  setupOpen,
  onToggleSetup,
}: {
  status: OllamaStatus;
  ollamaUrl: string;
  ollamaModels: string[];
  setupOpen: boolean;
  onToggleSetup: () => void;
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
        {ollamaModels.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {ollamaModels.map((m) => (
              <span key={m} className="badge badge--slate" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                {m}
              </span>
            ))}
          </div>
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

// ── Agent Model Assignments ─────────────────────────────────────────────────

function AgentModelAssignments({
  assignments,
  onChange,
  ollamaModels,
}: {
  assignments: Record<string, AgentModelAssignment>;
  onChange: (agentId: string, value: AgentModelAssignment) => void;
  ollamaModels: string[];
}) {
  return (
    <div className="card">
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
          const asgn = assignments[agent.id] ?? DEFAULT_AGENT_MODELS[agent.id] ?? { provider: "ollama", model: "qwen2.5:7b" };
          const providerKey = asgn.provider as "ollama" | "openai" | "anthropic";
          const models =
            providerKey === "ollama"
              ? [
                  ...RECOMMENDED_MODELS.ollama,
                  ...ollamaModels
                    .filter((m) => !RECOMMENDED_MODELS.ollama.find((r) => r.model === m))
                    .map((m) => ({ model: m, label: m, description: "Instalado localmente", recommended: false, size: undefined })),
                ]
              : RECOMMENDED_MODELS[providerKey];

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
                    const prov = e.target.value as "ollama" | "openai" | "anthropic";
                    const firstModel = RECOMMENDED_MODELS[prov][0]?.model ?? "";
                    onChange(agent.id, { provider: prov, model: firstModel });
                  }}
                >
                  <option value="ollama">Ollama (local)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
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

function ApiKeysSection() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="page-eyebrow" style={{ marginBottom: 2 }}>Seguridad</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Claves API</p>
        </div>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ApiKeyRow
          label="OpenAI API Key"
          storageKey={LS_APIKEY_OPENAI}
          placeholder="sk-…"
        />
        <ApiKeyRow
          label="Anthropic API Key"
          storageKey={LS_APIKEY_ANTHROPIC}
          placeholder="sk-ant-…"
        />
        <div
          style={{
            background: "var(--blue-bg)",
            border: "1px solid var(--blue-border)",
            borderRadius: "var(--r)",
            padding: "10px 12px",
            fontSize: 12,
            color: "var(--blue-text)",
            lineHeight: 1.6,
          }}
        >
          Las claves se guardan solo en este navegador. Para acceso desde múltiples
          dispositivos, configúralas como variables de entorno en Vercel (
          <code style={{ fontFamily: "var(--mono)", fontSize: 11 }}>OPENAI_API_KEY</code>
          {" / "}
          <code style={{ fontFamily: "var(--mono)", fontSize: 11 }}>ANTHROPIC_API_KEY</code>
          ).
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

  // Load persisted values on mount
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

      {/* Section 1: Ollama status */}
      <OllamaStatusBanner
        status={ollamaStatus}
        ollamaUrl={ollamaUrl}
        ollamaModels={ollamaModels}
        setupOpen={setupOpen}
        onToggleSetup={() => setSetupOpen((v) => !v)}
      />

      {/* Section 2: Ollama URL */}
      <OllamaUrlConfig
        ollamaUrl={ollamaUrl}
        onUrlChange={handleUrlChange}
        onTest={() => runConnectivityCheck(ollamaUrl)}
        status={ollamaStatus}
      />

      {/* Section 3: Agent model assignments */}
      <AgentModelAssignments
        assignments={assignments}
        onChange={handleAssignmentChange}
        ollamaModels={ollamaModels}
      />

      {/* Section 4: API Keys */}
      <ApiKeysSection />
    </div>
  );
}
