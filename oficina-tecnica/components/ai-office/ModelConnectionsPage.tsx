"use client";

import { useEffect, useState } from "react";
import { aiAgentsMock } from "@/lib/ai-office/aiAgentsMock";
import { DEFAULT_AGENT_MODELS, RECOMMENDED_MODELS, normalizeAgentModel } from "@/lib/llm/agentModels";

type ProviderKey =
  | "gemini" | "groq" | "sambanova" | "openrouter"
  | "cerebras" | "mistral" | "together" | "huggingface"
  | "openai" | "anthropic";

type AgentModelAssignment = { provider: ProviderKey; model: string };

const LS_AGENT_MODELS = "ot:agent:models";

const API_KEY_FIELDS: { label: string; key: string; placeholder: string; envVar: string }[] = [
  { label: "Gemini (Google)",   key: "ot:apikey:gemini",      placeholder: "AIza…",                    envVar: "NEXT_PUBLIC_GEMINI_API_KEY" },
  { label: "Groq",              key: "ot:apikey:groq",        placeholder: "gsk_…",                    envVar: "GROQ_API_KEY" },
  { label: "Sambanova",         key: "ot:apikey:sambanova",   placeholder: "xxxxxxxx-xxxx-xxxx-…",     envVar: "SAMBANOVA_API_KEY" },
  { label: "OpenRouter",        key: "ot:apikey:openrouter",  placeholder: "sk-or-v1-…",              envVar: "OPENROUTER_API_KEY" },
  { label: "Cerebras",          key: "ot:apikey:cerebras",    placeholder: "csk-…",                    envVar: "CEREBRAS_API_KEY" },
  { label: "Mistral AI",        key: "ot:apikey:mistral",     placeholder: "…",                        envVar: "MISTRAL_API_KEY" },
  { label: "Together AI",       key: "ot:apikey:together",    placeholder: "…",                        envVar: "TOGETHER_API_KEY" },
  { label: "Hugging Face",      key: "ot:apikey:huggingface", placeholder: "hf_…",                     envVar: "HUGGINGFACE_API_KEY" },
  { label: "OpenAI",            key: "ot:apikey:openai",      placeholder: "sk-…",                     envVar: "OPENAI_API_KEY" },
  { label: "Anthropic",         key: "ot:apikey:anthropic",   placeholder: "sk-ant-…",                 envVar: "ANTHROPIC_API_KEY" },
];

function getLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

// ── Agent Model Assignments ───────────────────────────────────────────────────

function AgentModelAssignments({ assignments, onChange }: {
  assignments: Record<string, AgentModelAssignment>;
  onChange: (agentId: string, value: AgentModelAssignment) => void;
}) {

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="page-eyebrow" style={{ marginBottom: 2 }}>Asignaciones</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Modelos por agente</p>
        </div>
        <span className="badge badge--slate">{aiAgentsMock.length} agentes</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {aiAgentsMock.map((agent, idx) => {
          const asgn: AgentModelAssignment = (assignments[agent.id] as AgentModelAssignment | undefined) ?? (DEFAULT_AGENT_MODELS[agent.id] as AgentModelAssignment | undefined) ?? { provider: "gemini", model: "gemini-flash-latest" };
          const models = RECOMMENDED_MODELS[asgn.provider] ?? RECOMMENDED_MODELS.gemini;

          return (
            <div key={agent.id} style={{ padding: "12px 16px", borderBottom: idx < aiAgentsMock.length - 1 ? "1px solid var(--border)" : "none", display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 auto", minWidth: 160 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{agent.name}</p>
                <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{agent.role}</p>
              </div>

              <div className="field" style={{ flex: "1 1 140px", minWidth: 140, marginBottom: 0 }}>
                <label className="field-label">Proveedor</label>
                <select
                  className="select"
                  value={asgn.provider}
                  onChange={(e) => {
                    const prov = e.target.value as ProviderKey;
                    const firstModel = (RECOMMENDED_MODELS[prov] ?? RECOMMENDED_MODELS.gemini)[0]?.model ?? "";
                    onChange(agent.id, { provider: prov, model: firstModel });
                  }}
                >
                  <optgroup label="Gratuitos (recomendados)">
                    <option value="gemini">Gemini (Google)</option>
                    <option value="groq">Groq</option>
                    <option value="sambanova">Sambanova</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="cerebras">Cerebras</option>
                    <option value="mistral">Mistral AI</option>
                    <option value="together">Together AI</option>
                    <option value="huggingface">Hugging Face</option>
                  </optgroup>
                  <optgroup label="De pago">
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </optgroup>
                </select>
              </div>

              <div className="field" style={{ flex: "2 1 200px", minWidth: 200, marginBottom: 0 }}>
                <label className="field-label">Modelo</label>
                <select className="select" value={asgn.model} onChange={(e) => onChange(agent.id, { ...asgn, model: e.target.value })}>
                  {models.map((m) => (
                    <option key={m.model} value={m.model}>
                      {m.label}{m.recommended ? " ★" : ""}{"size" in m && m.size ? ` (${m.size})` : ""}
                    </option>
                  ))}
                </select>
                {(() => {
                  const selected = models.find((m) => m.model === asgn.model);
                  if (!selected) return null;
                  return (
                    <p className="field-hint" style={{ marginTop: 4 }}>
                      {selected.recommended && <span className="badge badge--green" style={{ marginRight: 6, fontSize: 10 }}>Recomendado</span>}
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

// ── API Keys (solo este navegador) ────────────────────────────────────────────

function ServerStatusSection() {
  const [status, setStatus] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    fetch("/api/llm/status").then((r) => r.json()).then(setStatus).catch(() => null);
  }, []);

  if (!status) return null;

  const configured = Object.entries(status).filter(([, v]) => v).map(([k]) => k);

  if (configured.length === 0) return null;

  return (
    <div style={{ background: "var(--green-bg)", border: "1px solid var(--green-border)", borderRadius: "var(--r)", padding: "10px 14px", fontSize: 12, color: "var(--green-text)" }}>
      <strong>Proveedores activos en Vercel (disponibles para todos los usuarios):</strong>{" "}
      {configured.join(", ")}
    </div>
  );
}

function ApiKeyRow({ label, storageKey, placeholder, envVar }: {
  label: string; storageKey: string; placeholder: string; envVar: string;
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
      <label className="field-label">
        {label}
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--t3)", marginLeft: 6 }}>{envVar}</span>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input" type="password" value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder} autoComplete="off" style={{ flex: 1 }}
        />
        <button className={saved ? "btn btn--success btn--sm" : "btn btn--ghost btn--sm"} onClick={handleSave} style={{ flexShrink: 0 }}>
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
          <p className="page-eyebrow" style={{ marginBottom: 2 }}>Solo este navegador</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>API keys locales</p>
        </div>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: "var(--r)", padding: "10px 12px", fontSize: 12, color: "var(--amber-text)", lineHeight: 1.6 }}>
          Estas claves solo funcionan en este dispositivo. Para que todos los usuarios las usen, agrégalas en Vercel → Settings → Environment Variables y luego <strong>Redeploy</strong>. Ver Wiki IA para instrucciones.
        </div>
        {API_KEY_FIELDS.map((f) => (
          <ApiKeyRow key={f.key} label={f.label} storageKey={f.key} placeholder={f.placeholder} envVar={f.envVar} />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ModelConnectionsPage() {
  const [assignments, setAssignments] = useState<Record<string, AgentModelAssignment>>({});

  useEffect(() => {
    const savedModels = getLS(LS_AGENT_MODELS, "");
    if (savedModels) {
      try {
        const parsed = JSON.parse(savedModels) as Record<string, AgentModelAssignment>;
        const normalized = Object.fromEntries(Object.entries(parsed).map(([id, asgn]) => [id, normalizeAgentModel(asgn)]));
        setAssignments(normalized as Record<string, AgentModelAssignment>);
      } catch { setAssignments(DEFAULT_AGENT_MODELS as Record<string, AgentModelAssignment>); }
    } else {
      setAssignments(DEFAULT_AGENT_MODELS as Record<string, AgentModelAssignment>);
    }
  }, []);

  function handleAssignmentChange(agentId: string, value: AgentModelAssignment) {
    setAssignments((prev) => {
      const next = { ...prev, [agentId]: value };
      localStorage.setItem(LS_AGENT_MODELS, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="page-header">
        <div className="page-header-left">
          <p className="page-eyebrow">Configuración · Admin</p>
          <h1 className="page-title">Conexiones y modelos LLM</h1>
          <p className="page-desc">
            Configura proveedores de modelos: Gemini, Groq, Sambanova, Mistral, Cerebras, Together, HuggingFace, OpenAI y Anthropic.
            Los proveedores gratuitos se usan primero; la app rota automáticamente si uno falla. Sin modelos locales — todos los agentes usan proveedores cloud vía API key.
          </p>
        </div>
      </div>

      <ServerStatusSection />

      <AgentModelAssignments assignments={assignments} onChange={handleAssignmentChange} />
      <ProviderReferenceSection />
    </div>
  );
}
