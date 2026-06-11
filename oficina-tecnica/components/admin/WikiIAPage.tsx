"use client";

import { useEffect, useState } from "react";

type ProviderInfo = {
  id: string;
  name: string;
  url: string;
  envVar: string;
  speed: string;
  cost: string;
  highlight: string;
  models: string[];
  priority: number;
};

const PROVIDERS: ProviderInfo[] = [
  { id: "gemini",      name: "Google Gemini",    url: "https://aistudio.google.com/apikey",                         envVar: "NEXT_PUBLIC_GEMINI_API_KEY", speed: "Rápido",          cost: "Gratis (límite diario)",       highlight: "Excelente español y análisis",  models: ["gemini-flash-latest", "gemini-pro-latest"], priority: 1 },
  { id: "groq",        name: "Groq",             url: "https://console.groq.com/keys",                              envVar: "GROQ_API_KEY",               speed: "⚡ Ultra",         cost: "Gratis",                       highlight: "El más rápido en texto",        models: ["llama-3.1-8b-instant", "llama-3.1-70b-versatile", "mixtral-8x7b-32768"], priority: 2 },
  { id: "sambanova",   name: "Sambanova AI",     url: "https://cloud.sambanova.ai/apis",                            envVar: "SAMBANOVA_API_KEY",          speed: "Rápido",          cost: "Gratis",                       highlight: "DeepSeek R1 gratuito",          models: ["DeepSeek-R1", "Meta-Llama-3.1-70B-Instruct"], priority: 3 },
  { id: "openrouter",  name: "OpenRouter",       url: "https://openrouter.ai/settings/keys",                        envVar: "OPENROUTER_API_KEY",         speed: "Variable",        cost: "Gratis (modelos :free)",       highlight: "Acceso a 100+ modelos",         models: ["google/gemma-2-9b-it:free", "meta-llama/llama-3.1-8b-instruct:free"], priority: 4 },
  { id: "cerebras",    name: "Cerebras",         url: "https://inference.cerebras.ai/",                             envVar: "CEREBRAS_API_KEY",           speed: "⚡ 1000 tok/s",   cost: "Gratis",                       highlight: "Chip propio, velocidad extrema", models: ["llama3.1-8b", "llama3.1-70b"], priority: 5 },
  { id: "mistral",     name: "Mistral AI",       url: "https://console.mistral.ai/api-keys",                        envVar: "MISTRAL_API_KEY",            speed: "Rápido",          cost: "Gratis (tier gratuito)",       highlight: "Mejor español del mercado",     models: ["mistral-small-latest", "mistral-large-latest"], priority: 6 },
  { id: "together",    name: "Together AI",      url: "https://api.together.ai/settings/api-keys",                  envVar: "TOGETHER_API_KEY",           speed: "Rápido",          cost: "Gratis (créditos iniciales)",  highlight: "20+ modelos abiertos",          models: ["meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"], priority: 7 },
  { id: "huggingface", name: "Hugging Face",     url: "https://huggingface.co/settings/tokens",                     envVar: "HUGGINGFACE_API_KEY",        speed: "Variable",        cost: "Gratis",                       highlight: "Miles de modelos disponibles",  models: ["meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"], priority: 8 },
  { id: "cloudflare",  name: "Cloudflare AI",    url: "https://dash.cloudflare.com/profile/api-tokens",             envVar: "CLOUDFLARE_API_TOKEN",       speed: "Rápido",          cost: "Gratis (sin límite diario)",   highlight: "Sin límite de peticiones",      models: ["@cf/meta/llama-3.1-8b-instruct", "@cf/mistral/mistral-7b-instruct"], priority: 9 },
  { id: "openai",      name: "OpenAI",           url: "https://platform.openai.com/api-keys",                       envVar: "OPENAI_API_KEY",             speed: "Rápido",          cost: "Pago ($0.01–$0.03/1K tok)",   highlight: "GPT-4o — el más capaz",         models: ["gpt-4o-mini", "gpt-4o", "o1-mini"], priority: 10 },
  { id: "anthropic",   name: "Anthropic",        url: "https://console.anthropic.com/settings/keys",                envVar: "ANTHROPIC_API_KEY",          speed: "Rápido",          cost: "Pago ($0.01/1K tok)",          highlight: "Claude — razonamiento superior", models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"], priority: 11 },
];

const VERCEL_STEPS = [
  { n: 1, text: "Abre Vercel → tu proyecto → Settings → Environment Variables." },
  { n: 2, text: 'Clic en "Add New" para cada proveedor.' },
  { n: 3, text: "Name = nombre de la variable (ej. GROQ_API_KEY), Value = tu API key." },
  { n: 4, text: 'Environments: marca "Production", "Preview" y "Development".' },
  { n: 5, text: 'Clic "Save" para cada variable.' },
  { n: 6, text: 'Ve a Deployments → clic en los tres puntos → "Redeploy" para aplicar los cambios.' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn--ghost btn--sm"
      style={{ fontSize: 10, padding: "2px 8px", flexShrink: 0 }}
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
    >
      {copied ? "✓" : "Copiar"}
    </button>
  );
}

function ProviderCard({ p }: { p: ProviderInfo }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: "var(--r)", background: "var(--blue-bg)", border: "1px solid var(--blue-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--blue)" }}>
            {p.priority}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>{p.name}</div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>{p.highlight}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <span className="badge badge--blue" style={{ fontSize: 10 }}>{p.speed}</span>
          <span className={`badge ${p.cost.startsWith("Pago") ? "badge--amber" : "badge--green"}`} style={{ fontSize: 10 }}>{p.cost}</span>
        </div>
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--t3)", width: 90 }}>Crear API key:</span>
          <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--blue)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.url}
          </a>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--t3)", width: 90 }}>Variable Vercel:</span>
          <code style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 4, flex: 1 }}>{p.envVar}</code>
          <CopyButton text={p.envVar} />
        </div>

        {p.id === "cloudflare" && (
          <div style={{ fontSize: 11, color: "var(--amber-text)", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: "var(--r)", padding: "6px 10px", lineHeight: 1.5 }}>
            Cloudflare AI también requiere <code style={{ fontFamily: "var(--mono)" }}>CLOUDFLARE_ACCOUNT_ID</code>.
            Ve a dash.cloudflare.com → clic en tu cuenta → copia el "Account ID" del panel derecho.
          </div>
        )}

        <div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>Modelos disponibles:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {p.models.map((m) => (
              <span key={m} className="badge badge--slate" style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{m}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ServerStatusSection() {
  const [status, setStatus] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    fetch("/api/llm/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => null);
  }, []);

  if (!status) return null;

  const configured = Object.entries(status).filter(([, v]) => v).map(([k]) => k);
  const missing = Object.entries(status).filter(([, v]) => !v).map(([k]) => k);

  return (
    <div className="card" style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)", marginBottom: 10 }}>Estado actual en Vercel</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {configured.map((k) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, background: "var(--green-bg)", border: "1px solid var(--green-border)", borderRadius: "var(--r)", padding: "3px 8px", color: "var(--green-text)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }} />
            {k}
          </span>
        ))}
        {missing.map((k) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "3px 8px", color: "var(--t3)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--t3)" }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

export function WikiIAPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="page-header">
        <div className="page-header-left">
          <p className="page-eyebrow">Admin · Solo tú ves esto</p>
          <h1 className="page-title">Wiki IA · Proveedores y API keys</h1>
          <p className="page-desc">
            Referencia completa de todos los proveedores de modelos: dónde crear las API keys, qué variable usar en Vercel, y cómo renovarlas cuando venzan.
          </p>
        </div>
      </div>

      {/* Reminder banner */}
      <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: "var(--r)", padding: "12px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--amber-text)", marginBottom: 6 }}>
          ⚠️ Recordatorio: renueva las claves cuando venzan o el servicio falle
        </div>
        <ul style={{ fontSize: 12, color: "var(--amber-text)", lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
          <li>Los proveedores gratuitos no cobran, pero sus tokens diarios se resetean a medianoche UTC.</li>
          <li>Si un proveedor da error, la app rota automáticamente al siguiente en la lista de prioridad.</li>
          <li>Cuando crees una nueva key, actualízala en Vercel → Settings → Environment Variables → Redeploy.</li>
          <li>Guarda una copia de cada key en un gestor de contraseñas (nunca en el código fuente).</li>
        </ul>
      </div>

      {/* Server status */}
      <ServerStatusSection />

      {/* Priority explanation */}
      <div className="card" style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)", marginBottom: 8 }}>Orden de rotación automática</div>
        <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.7, marginBottom: 8 }}>
          Cuando envías un mensaje, la app intenta los proveedores en este orden. Si uno falla (límite alcanzado, key vencida, error de red), pasa automáticamente al siguiente sin interrumpir la conversación.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PROVIDERS.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, background: "var(--blue-bg)", border: "1px solid var(--blue-border)", color: "var(--blue)", borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>{i + 1}</span>
              <span style={{ fontSize: 11, color: "var(--t2)" }}>{p.name}</span>
              {i < PROVIDERS.length - 1 && <span style={{ fontSize: 10, color: "var(--t3)" }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Vercel setup steps */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header">
          <div>
            <p className="page-eyebrow" style={{ marginBottom: 2 }}>Guía rápida</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Cómo agregar o renovar una API key en Vercel</p>
          </div>
        </div>
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {VERCEL_STEPS.map((s) => (
            <div key={s.n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--blue)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                {s.n}
              </div>
              <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6, margin: 0 }}>{s.text}</p>
            </div>
          ))}
          <div style={{ marginTop: 4, padding: "8px 12px", background: "var(--blue-bg)", border: "1px solid var(--blue-border)", borderRadius: "var(--r)", fontSize: 12, color: "var(--blue-text)", lineHeight: 1.6 }}>
            Una vez configuradas las variables en Vercel, todos los usuarios de la app se benefician de los modelos sin necesitar sus propias API keys.
          </div>
        </div>
      </div>

      {/* Provider cards */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t2)", textTransform: "uppercase", letterSpacing: ".08em", paddingTop: 4 }}>
        Todos los proveedores (en orden de prioridad)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 12 }}>
        {PROVIDERS.map((p) => (
          <ProviderCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}
