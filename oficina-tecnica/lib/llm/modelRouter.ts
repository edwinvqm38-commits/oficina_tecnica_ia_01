import type { ModelConfig } from "./providers";
import type { DeviceProfile } from "./deviceDetection";

export type RequestComplexity = "simple" | "technical" | "analytical" | "generative";

export type RoutingDecision = {
  config: ModelConfig;
  complexity: RequestComplexity;
  reason: string;
  modelLabel: string;
};

// Keywords that signal complexity level
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

export function routeRequest(
  text: string,
  availableOllamaModels: string[],
  deviceProfile: DeviceProfile | null,
  agentModelOverride?: { provider: string; model: string } | null,
): RoutingDecision {
  const complexity = classifyRequest(text);
  const ollamaBase = localStorage.getItem("ot:ollama:baseUrl") ?? "http://localhost:11434";
  const openaiKey = localStorage.getItem("ot:apikey:openai") ?? "";
  const anthropicKey = localStorage.getItem("ot:apikey:anthropic") ?? "";

  // Helper: pick best available Ollama model for complexity
  function pickOllama(preferred: string[], fallback: string): string {
    for (const m of preferred) {
      if (availableOllamaModels.some((am) => am.startsWith(m))) {
        return availableOllamaModels.find((am) => am.startsWith(m))!;
      }
    }
    return availableOllamaModels[0] ?? fallback;
  }

  const canRun14b = deviceProfile?.tier === "high";

  // If agent has a manual override configured, respect it but may upgrade for complexity
  if (agentModelOverride?.provider === "openai" && openaiKey) {
    return {
      config: { provider: "openai", model: agentModelOverride.model, apiKey: openaiKey },
      complexity,
      reason: "Modelo configurado manualmente",
      modelLabel: agentModelOverride.model,
    };
  }

  if (agentModelOverride?.provider === "anthropic" && anthropicKey) {
    return {
      config: { provider: "anthropic", model: agentModelOverride.model, apiKey: anthropicKey },
      complexity,
      reason: "Modelo configurado manualmente",
      modelLabel: agentModelOverride.model,
    };
  }

  // Route by complexity
  if (complexity === "analytical" || complexity === "generative") {
    // Try deepseek-r1 14b first for analytical, or API if available
    if (complexity === "analytical" && openaiKey) {
      return {
        config: { provider: "openai", model: "gpt-4o", apiKey: openaiKey },
        complexity,
        reason: "Análisis complejo → GPT-4o",
        modelLabel: "gpt-4o",
      };
    }
    if (canRun14b) {
      const model = pickOllama(["deepseek-r1:14b", "phi4:14b", "qwen2.5:14b", "deepseek-r1:7b", "qwen2.5:7b"], "qwen2.5:7b");
      return {
        config: { provider: "ollama", model, baseUrl: ollamaBase },
        complexity,
        reason: complexity === "analytical" ? "Razonamiento profundo → modelo 14B" : "Generación de documento → modelo 14B",
        modelLabel: model,
      };
    }
    const model = pickOllama(["deepseek-r1:7b", "qwen2.5:7b", "mistral:7b"], "qwen2.5:7b");
    return {
      config: { provider: "ollama", model, baseUrl: ollamaBase },
      complexity,
      reason: complexity === "analytical" ? "Razonamiento → deepseek-r1" : "Generación de contenido",
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
      reason: "Consulta técnica de ingeniería",
      modelLabel: model,
    };
  }

  // Simple: use lightest available model
  const model = pickOllama(["qwen2.5:7b", "mistral:7b", "llama3.1:8b"], "qwen2.5:7b");
  return {
    config: { provider: "ollama", model, baseUrl: ollamaBase },
    complexity,
    reason: "Consulta simple → modelo eficiente",
    modelLabel: model,
  };
}
