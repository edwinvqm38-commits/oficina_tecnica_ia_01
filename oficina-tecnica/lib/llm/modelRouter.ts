import type { ModelConfig, LLMProvider } from "./providers";
import type { DeviceProfile } from "./deviceDetection";

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
  return localStorage.getItem(key) ?? "";
}

export function routeRequest(
  text: string,
  availableOllamaModels: string[],
  deviceProfile: DeviceProfile | null,
  agentModelOverride?: { provider: string; model: string } | null,
): RoutingDecision {
  const complexity = classifyRequest(text);
  const ollamaBase = getKey("ot:ollama:baseUrl") || "http://localhost:11434";

  // Keys for all providers
  const geminiKey     = getKey("ot:apikey:gemini");
  const groqKey       = getKey("ot:apikey:groq");
  const sambanovaKey  = getKey("ot:apikey:sambanova");
  const openrouterKey = getKey("ot:apikey:openrouter");
  const mistralKey    = getKey("ot:apikey:mistral");
  const cerebrasKey   = getKey("ot:apikey:cerebras");
  const togetherKey   = getKey("ot:apikey:together");
  const openaiKey     = getKey("ot:apikey:openai");
  const anthropicKey  = getKey("ot:apikey:anthropic");

  // Respect manual agent override if key still valid
  if (agentModelOverride) {
    const prov = agentModelOverride.provider as LLMProvider;
    const keyMap: Record<string, string> = {
      openai: openaiKey, anthropic: anthropicKey,
      gemini: geminiKey, groq: groqKey,
      sambanova: sambanovaKey, openrouter: openrouterKey,
      mistral: mistralKey, cerebras: cerebrasKey, together: togetherKey,
    };
    const key = keyMap[prov];
    if (key || prov === "ollama") {
      return {
        config: {
          provider: prov,
          model: agentModelOverride.model,
          apiKey: key || undefined,
          baseUrl: prov === "ollama" ? ollamaBase : undefined,
        },
        complexity,
        reason: "Modelo configurado manualmente",
        modelLabel: agentModelOverride.model,
      };
    }
  }

  const isDeep = complexity === "analytical" || complexity === "generative";

  // ── Priority 1: Gemini (gratis, rápido) ────────────────────────────────────
  if (geminiKey) {
    const model = isDeep ? "gemini-1.5-pro" : "gemini-1.5-flash";
    return {
      config: { provider: "gemini", model, apiKey: geminiKey },
      complexity,
      reason: isDeep ? "Gemini Pro → análisis profundo (gratis)" : "Gemini Flash → rápido (gratis)",
      modelLabel: model,
    };
  }

  // ── Priority 2: Groq (gratis, ultrarrápido) ────────────────────────────────
  if (groqKey) {
    const model = isDeep ? "llama-3.1-70b-versatile" : "llama-3.1-8b-instant";
    return {
      config: { provider: "groq", model, apiKey: groqKey },
      complexity,
      reason: isDeep ? "Groq Llama 70B → análisis (gratis)" : "Groq Llama 8B → ultrarrápido (gratis)",
      modelLabel: model,
    };
  }

  // ── Priority 3: Sambanova (gratis, DeepSeek R1) ────────────────────────────
  if (sambanovaKey) {
    const model = isDeep ? "DeepSeek-R1" : "Meta-Llama-3.1-70B-Instruct";
    return {
      config: { provider: "sambanova", model, apiKey: sambanovaKey },
      complexity,
      reason: isDeep ? "Sambanova DeepSeek R1 → razonamiento (gratis)" : "Sambanova Llama 70B (gratis)",
      modelLabel: model,
    };
  }

  // ── Priority 4: OpenRouter (modelos gratuitos) ─────────────────────────────
  if (openrouterKey) {
    const model = isDeep
      ? "meta-llama/llama-3.1-70b-instruct:free"
      : "meta-llama/llama-3.1-8b-instruct:free";
    return {
      config: { provider: "openrouter", model, apiKey: openrouterKey },
      complexity,
      reason: "OpenRouter modelo gratuito",
      modelLabel: model.split("/").pop()?.replace(":free", "") ?? model,
    };
  }

  // ── Priority 5: Cerebras (ultrarrápido, gratis) ────────────────────────────
  if (cerebrasKey) {
    const model = isDeep ? "llama3.1-70b" : "llama3.1-8b";
    return {
      config: { provider: "cerebras", model, apiKey: cerebrasKey },
      complexity,
      reason: "Cerebras → ultrarrápido (gratis)",
      modelLabel: model,
    };
  }

  // ── Priority 6: Mistral (gratis, buen español) ─────────────────────────────
  if (mistralKey) {
    const model = isDeep ? "mistral-large-latest" : "mistral-small-latest";
    return {
      config: { provider: "mistral", model, apiKey: mistralKey },
      complexity,
      reason: isDeep ? "Mistral Large → análisis (gratis)" : "Mistral Small → rápido (gratis)",
      modelLabel: model,
    };
  }

  // ── Priority 7: Together AI (gratis con créditos) ──────────────────────────
  if (togetherKey) {
    const model = isDeep ? "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo" : "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo";
    return {
      config: { provider: "together", model, apiKey: togetherKey },
      complexity,
      reason: "Together AI (gratis)",
      modelLabel: model.split("/").pop() ?? model,
    };
  }

  // ── Priority 8: Ollama local ───────────────────────────────────────────────
  if (availableOllamaModels.length > 0) {
    const canRun14b = deviceProfile?.tier === "high";

    function pickOllama(preferred: string[], fallback: string): string {
      for (const m of preferred) {
        const found = availableOllamaModels.find((am) => am.startsWith(m));
        if (found) return found;
      }
      return availableOllamaModels[0] ?? fallback;
    }

    if (isDeep) {
      const model = pickOllama(
        canRun14b
          ? ["deepseek-r1:14b", "phi4:14b", "qwen2.5:14b", "deepseek-r1:7b", "qwen2.5:7b"]
          : ["deepseek-r1:7b", "qwen2.5:7b", "mistral:7b"],
        "qwen2.5:7b"
      );
      return {
        config: { provider: "ollama", model, baseUrl: ollamaBase },
        complexity,
        reason: "Ollama local → modelo de razonamiento",
        modelLabel: model,
      };
    }

    if (complexity === "technical") {
      const model = pickOllama(
        canRun14b
          ? ["deepseek-r1:14b", "qwen2.5-coder:7b", "deepseek-r1:7b", "qwen2.5:7b"]
          : ["qwen2.5-coder:7b", "deepseek-r1:7b", "qwen2.5:7b"],
        "qwen2.5:7b"
      );
      return {
        config: { provider: "ollama", model, baseUrl: ollamaBase },
        complexity,
        reason: "Ollama local → consulta técnica",
        modelLabel: model,
      };
    }

    const model = pickOllama(["qwen2.5:7b", "mistral:7b", "llama3.1:8b"], "qwen2.5:7b");
    return {
      config: { provider: "ollama", model, baseUrl: ollamaBase },
      complexity,
      reason: "Ollama local → modelo eficiente",
      modelLabel: model,
    };
  }

  // ── Priority 6: OpenAI (pago, última opción) ───────────────────────────────
  if (openaiKey) {
    const model = isDeep ? "gpt-4o" : "gpt-4o-mini";
    return {
      config: { provider: "openai", model, apiKey: openaiKey },
      complexity,
      reason: isDeep ? "GPT-4o → análisis profundo (pago)" : "GPT-4o-mini → económico (pago)",
      modelLabel: model,
    };
  }

  // ── Priority 7: Anthropic ──────────────────────────────────────────────────
  if (anthropicKey) {
    return {
      config: { provider: "anthropic", model: "claude-haiku-4-5-20251001", apiKey: anthropicKey },
      complexity,
      reason: "Anthropic Claude Haiku (pago)",
      modelLabel: "claude-haiku",
    };
  }

  // Fallback sin configuración
  return {
    config: { provider: "ollama", model: "qwen2.5:7b", baseUrl: ollamaBase },
    complexity,
    reason: "Sin proveedor configurado — ve a Conexiones",
    modelLabel: "sin modelo",
  };
}
