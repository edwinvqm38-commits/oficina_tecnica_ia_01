import type { ModelConfig, LLMProvider } from "./providers";
import { isOllamaEnabled } from "./providers";
import { isDataAccessQuestion, isLogTableQuestion } from "../chat/messageUtils";

export type RequestComplexity = "simple" | "technical" | "analytical" | "generative";

export type RoutingDecision = {
  config: ModelConfig;
  complexity: RequestComplexity;
  reason: string;
  modelLabel: string;
  // Shown as a small hint in the chat UI when the agent's manually
  // configured model is a "light" tier one for a question that would
  // benefit from a more capable model (less hallucination/contradiction).
  suggestion?: string;
};

const TECHNICAL_KEYWORDS = ["presupuesto", "costo", "metrado", "ingeniería", "estructura", "análisis", "calcul", "plazo", "cronograma", "especificación", "requerimiento", "cotización", "oferta"];
const ANALYTICAL_KEYWORDS = ["comparar", "evaluar", "decidir", "riesgo", "estrategia", "porqué", "diagnóstico", "tendencia", "histórico", "desviación", "proyección"];
const GENERATIVE_KEYWORDS = ["redacta", "escribe", "genera", "crea", "informe", "documento", "resumen ejecutivo", "carta", "acta", "propuesta"];

export function classifyRequest(text: string): RequestComplexity {
  const lower = text.toLowerCase();
  if (GENERATIVE_KEYWORDS.some((k) => lower.includes(k))) return "generative";
  if (ANALYTICAL_KEYWORDS.some((k) => lower.includes(k))) return "analytical";
  if (TECHNICAL_KEYWORDS.some((k) => lower.includes(k))) return "technical";
  return "simple";
}

function getKey(key: string): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(key) ?? "";
}

// Cloud providers we always try via server proxy even without a local key
const SERVER_PROXY_PROVIDERS: Array<{ provider: LLMProvider; modelSimple: string; modelDeep: string }> = [
  { provider: "gemini",     modelSimple: "gemini-1.5-flash",                        modelDeep: "gemini-1.5-pro" },
  { provider: "groq",       modelSimple: "llama-3.1-8b-instant",                    modelDeep: "llama-3.1-70b-versatile" },
  { provider: "sambanova",  modelSimple: "Meta-Llama-3.1-70B-Instruct",             modelDeep: "DeepSeek-R1" },
  { provider: "openrouter", modelSimple: "meta-llama/llama-3.1-8b-instruct:free",   modelDeep: "meta-llama/llama-3.1-70b-instruct:free" },
];

// "Light"/"deep" model pairs per free provider, used to auto-upgrade a
// manually-assigned agent model for log-table questions (cotizaciones/
// requerimientos) without requiring the user to change their selection.
const FREE_PROVIDER_TIERS: Partial<Record<LLMProvider, { light: string; deep: string }>> = {
  gemini:     { light: "gemini-1.5-flash",                       deep: "gemini-1.5-pro" },
  groq:       { light: "llama-3.1-8b-instant",                   deep: "llama-3.1-70b-versatile" },
  sambanova:  { light: "Meta-Llama-3.1-70B-Instruct",            deep: "DeepSeek-R1" },
  openrouter: { light: "meta-llama/llama-3.1-8b-instruct:free",  deep: "meta-llama/llama-3.1-70b-instruct:free" },
  cerebras:   { light: "llama3.1-8b",                            deep: "llama3.1-70b" },
  mistral:    { light: "mistral-small-latest",                   deep: "mistral-large-latest" },
  together:   { light: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", deep: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo" },
};

// Paid providers don't get auto-upgraded (that would silently increase
// cost) — instead we surface a `suggestion` so the user can decide.
const PAID_PROVIDER_TIERS: Partial<Record<LLMProvider, { light: string; deepLabel: string }>> = {
  openai:    { light: "gpt-4o-mini",              deepLabel: "GPT-4o" },
  anthropic: { light: "claude-haiku-4-5-20251001", deepLabel: "Claude Sonnet" },
};

const OLLAMA_DEEP_PREFERENCE = ["deepseek-r1:7b", "qwen2.5:7b", "mistral:7b"];

function pickOllama(availableOllamaModels: string[], preferred: string[], fallback: string): string {
  for (const m of preferred) {
    const found = availableOllamaModels.find((am) => am.startsWith(m));
    if (found) return found;
  }
  return availableOllamaModels[0] ?? fallback;
}

export function routeRequest(
  text: string,
  availableOllamaModels: string[],
  agentModelOverride?: { provider: string; model: string } | null,
): RoutingDecision {
  const complexity = classifyRequest(text);
  const ollamaBase = getKey("ot:ollama:baseUrl") || "http://localhost:11434";
  const ollamaEnabled = isOllamaEnabled();

  const geminiKey     = getKey("ot:apikey:gemini");
  const groqKey       = getKey("ot:apikey:groq");
  const sambanovaKey  = getKey("ot:apikey:sambanova");
  const openrouterKey = getKey("ot:apikey:openrouter");
  const cerebrasKey   = getKey("ot:apikey:cerebras");
  const mistralKey    = getKey("ot:apikey:mistral");
  const togetherKey   = getKey("ot:apikey:together");
  const huggingfaceKey = getKey("ot:apikey:huggingface");
  const openaiKey     = getKey("ot:apikey:openai");
  const anthropicKey  = getKey("ot:apikey:anthropic");

  // Meta-questions about the agent's own capabilities/data access ("¿tienes
  // acceso a la tabla de requerimientos?") need a model that can actually
  // reason over the HUMANIZE_CTX rules — small/fast models tend to ignore
  // them and flatly say "no tengo acceso". Same for ANY question about
  // "la tabla/log de cotizaciones/requerimientos": even when real Supabase
  // results are injected into context, small models (groq 8B) contradict
  // themselves or ignore the data and invent codes/projects. Route these
  // to the bigger model too.
  const isDeep = complexity === "analytical" || complexity === "generative" || isDataAccessQuestion(text) || isLogTableQuestion(text);

  if (agentModelOverride) {
    const prov = agentModelOverride.provider as LLMProvider;
    const keyMap: Record<string, string> = {
      openai: openaiKey, anthropic: anthropicKey,
      gemini: geminiKey, groq: groqKey,
      sambanova: sambanovaKey, openrouter: openrouterKey,
      mistral: mistralKey, cerebras: cerebrasKey,
      together: togetherKey, huggingface: huggingfaceKey,
    };
    const key = keyMap[prov];
    // The server proxy (/api/llm/chat, configured via Vercel env vars) can
    // serve these providers even without a per-browser API key — so a
    // manual model assignment for them should be honored regardless of
    // whether the user has a local key. Anthropic has no server proxy and
    // needs a local key; Ollama needs availableOllamaModels/baseUrl only.
    const usableWithoutLocalKey = prov !== "anthropic" && prov !== "ollama";
    if (key || prov === "ollama" || usableWithoutLocalKey) {
      let model = agentModelOverride.model;
      let reason = "Modelo configurado manualmente";
      let suggestion: string | undefined;

      if (isDeep) {
        const freeTier = FREE_PROVIDER_TIERS[prov];
        const paidTier = PAID_PROVIDER_TIERS[prov];
        if (freeTier && model === freeTier.light) {
          model = freeTier.deep;
          reason = "Modelo configurado manualmente → se usó la versión avanzada de este proveedor para esta consulta (anti-alucinación)";
        } else if (prov === "ollama" && availableOllamaModels.length > 0) {
          const upgraded = pickOllama(availableOllamaModels, OLLAMA_DEEP_PREFERENCE, model);
          if (upgraded !== model) {
            model = upgraded;
            reason = "Modelo configurado manualmente → se usó un modelo Ollama de razonamiento para esta consulta (anti-alucinación)";
          }
        } else if (paidTier && model === paidTier.light) {
          suggestion = `Este agente usa "${model}" para preguntas de cotizaciones/requerimientos. Se recomienda cambiarlo a ${paidTier.deepLabel} en Conexiones para reducir el riesgo de alucinaciones.`;
        }
      }

      return {
        config: { provider: prov, model, apiKey: key || undefined, baseUrl: prov === "ollama" ? ollamaBase : undefined },
        complexity,
        reason,
        modelLabel: model,
        suggestion,
      };
    }
  }

  if (geminiKey) {
    const model = isDeep ? "gemini-1.5-pro" : "gemini-1.5-flash";
    return { config: { provider: "gemini", model, apiKey: geminiKey }, complexity, reason: isDeep ? "Gemini Pro → análisis profundo (gratis)" : "Gemini Flash → rápido (gratis)", modelLabel: model };
  }

  if (groqKey) {
    const model = isDeep ? "llama-3.1-70b-versatile" : "llama-3.1-8b-instant";
    return { config: { provider: "groq", model, apiKey: groqKey }, complexity, reason: isDeep ? "Groq Llama 70B → análisis (gratis)" : "Groq Llama 8B → ultrarrápido (gratis)", modelLabel: model };
  }

  if (sambanovaKey) {
    const model = isDeep ? "DeepSeek-R1" : "Meta-Llama-3.1-70B-Instruct";
    return { config: { provider: "sambanova", model, apiKey: sambanovaKey }, complexity, reason: isDeep ? "Sambanova DeepSeek R1 → razonamiento (gratis)" : "Sambanova Llama 70B (gratis)", modelLabel: model };
  }

  if (openrouterKey) {
    const model = isDeep ? "meta-llama/llama-3.1-70b-instruct:free" : "meta-llama/llama-3.1-8b-instruct:free";
    return { config: { provider: "openrouter", model, apiKey: openrouterKey }, complexity, reason: "OpenRouter modelo gratuito", modelLabel: model.split("/").pop()?.replace(":free", "") ?? model };
  }

  if (cerebrasKey) {
    const model = isDeep ? "llama3.1-70b" : "llama3.1-8b";
    return { config: { provider: "cerebras", model, apiKey: cerebrasKey }, complexity, reason: "Cerebras → ultrarrápido (gratis)", modelLabel: model };
  }

  if (mistralKey) {
    const model = isDeep ? "mistral-large-latest" : "mistral-small-latest";
    return { config: { provider: "mistral", model, apiKey: mistralKey }, complexity, reason: isDeep ? "Mistral Large → análisis (gratis)" : "Mistral Small → rápido (gratis)", modelLabel: model };
  }

  if (togetherKey) {
    const model = isDeep ? "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo" : "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo";
    return { config: { provider: "together", model, apiKey: togetherKey }, complexity, reason: "Together AI (gratis)", modelLabel: model.split("/").pop() ?? model };
  }

  if (huggingfaceKey) {
    return { config: { provider: "huggingface", model: "meta-llama/Llama-3.1-8B-Instruct", apiKey: huggingfaceKey }, complexity, reason: "HuggingFace → gratuito, miles de modelos", modelLabel: "Llama-3.1-8B" };
  }

  if (ollamaEnabled && availableOllamaModels.length > 0) {
    if (isDeep) {
      const model = pickOllama(availableOllamaModels, OLLAMA_DEEP_PREFERENCE, "qwen2.5:7b");
      return { config: { provider: "ollama", model, baseUrl: ollamaBase }, complexity, reason: "Ollama local → modelo de razonamiento", modelLabel: model };
    }

    const model = pickOllama(availableOllamaModels, ["qwen2.5:7b", "mistral:7b", "llama3.1:8b"], "qwen2.5:7b");
    return { config: { provider: "ollama", model, baseUrl: ollamaBase }, complexity, reason: "Ollama local → modelo eficiente", modelLabel: model };
  }

  if (openaiKey) {
    const model = isDeep ? "gpt-4o" : "gpt-4o-mini";
    return { config: { provider: "openai", model, apiKey: openaiKey }, complexity, reason: isDeep ? "GPT-4o → análisis profundo (pago)" : "GPT-4o-mini → económico (pago)", modelLabel: model };
  }

  if (anthropicKey) {
    return { config: { provider: "anthropic", model: "claude-haiku-4-5-20251001", apiKey: anthropicKey }, complexity, reason: "Anthropic Claude Haiku (pago)", modelLabel: "claude-haiku" };
  }

  // No local keys configured → use server proxy (Vercel env vars) with cloud providers
  const sp = SERVER_PROXY_PROVIDERS[0];
  const spModel = isDeep ? sp.modelDeep : sp.modelSimple;
  return {
    config: { provider: sp.provider, model: spModel },
    complexity,
    reason: "Auto: servidor Vercel (Gemini)",
    modelLabel: spModel,
  };
}
