import type { ModelConfig, LLMProvider } from "./providers";

export type RequestComplexity = "simple" | "technical" | "analytical" | "generative";

export type RoutingDecision = {
  config: ModelConfig;
  complexity: RequestComplexity;
  reason: string;
  modelLabel: string;
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

export function routeRequest(
  text: string,
  availableOllamaModels: string[],
  agentModelOverride?: { provider: string; model: string } | null,
): RoutingDecision {
  const complexity = classifyRequest(text);
  const ollamaBase = getKey("ot:ollama:baseUrl") || "http://localhost:11434";

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
    if (key || prov === "ollama") {
      return {
        config: { provider: prov, model: agentModelOverride.model, apiKey: key || undefined, baseUrl: prov === "ollama" ? ollamaBase : undefined },
        complexity,
        reason: "Modelo configurado manualmente",
        modelLabel: agentModelOverride.model,
      };
    }
  }

  const isDeep = complexity === "analytical" || complexity === "generative";

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

  if (availableOllamaModels.length > 0) {
    function pickOllama(preferred: string[], fallback: string): string {
      for (const m of preferred) {
        const found = availableOllamaModels.find((am) => am.startsWith(m));
        if (found) return found;
      }
      return availableOllamaModels[0] ?? fallback;
    }

    if (isDeep) {
      const model = pickOllama(["deepseek-r1:7b", "qwen2.5:7b", "mistral:7b"], "qwen2.5:7b");
      return { config: { provider: "ollama", model, baseUrl: ollamaBase }, complexity, reason: "Ollama local → modelo de razonamiento", modelLabel: model };
    }

    const model = pickOllama(["qwen2.5:7b", "mistral:7b", "llama3.1:8b"], "qwen2.5:7b");
    return { config: { provider: "ollama", model, baseUrl: ollamaBase }, complexity, reason: "Ollama local → modelo eficiente", modelLabel: model };
  }

  if (openaiKey) {
    const model = isDeep ? "gpt-4o" : "gpt-4o-mini";
    return { config: { provider: "openai", model, apiKey: openaiKey }, complexity, reason: isDeep ? "GPT-4o → análisis profundo (pago)" : "GPT-4o-mini → económico (pago)", modelLabel: model };
  }

  if (anthropicKey) {
    return { config: { provider: "anthropic", model: "claude-haiku-4-5-20251001", apiKey: anthropicKey }, complexity, reason: "Anthropic Claude Haiku (pago)", modelLabel: "claude-haiku" };
  }

  return {
    config: { provider: "ollama", model: "qwen2.5:7b", baseUrl: ollamaBase },
    complexity,
    reason: "Sin proveedor configurado — ve a Conexiones",
    modelLabel: "sin modelo",
  };
}
