"use client";

import { useEffect, useState } from "react";

const API_KEY_FIELDS: { label: string; key: string; placeholder: string; envVar: string }[] = [
  { label: "Gemini (Google)",   key: "ot:apikey:gemini",      placeholder: "AIza…",                    envVar: "GEMINI_API_KEY" },
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

function AutomaticRoutingSection() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="page-eyebrow" style={{ marginBottom: 2 }}>Automático</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Enrutamiento inteligente de agentes</p>
        </div>
        <span className="badge badge--green">Activo</span>
      </div>
      <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>Simple</p>
          <p style={{ fontSize: 12, color: "var(--t2)", marginTop: 4 }}>Respuestas rápidas con Gemini Flash.</p>
        </div>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>Técnico</p>
          <p style={{ fontSize: 12, color: "var(--t2)", marginTop: 4 }}>Ingeniería, costos o cronograma con Cerebras/Gemini/OpenAI según disponibilidad.</p>
        </div>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>Analítico</p>
          <p style={{ fontSize: 12, color: "var(--t2)", marginTop: 4 }}>Datos, históricos y decisiones con modelos de mayor razonamiento.</p>
        </div>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>Fallback</p>
          <p style={{ fontSize: 12, color: "var(--t2)", marginTop: 4 }}>Si un proveedor falla, la app rota automáticamente a otro configurado.</p>
        </div>
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

function ProviderReferenceSection() {
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

      <AutomaticRoutingSection />
      <ProviderReferenceSection />
    </div>
  );
}
