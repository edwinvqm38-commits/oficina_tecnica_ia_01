import type { ModelConfig, LLMProvider } from "./providers";
import { isDataAccessQuestion, isLogTableQuestion } from "../chat/messageUtils";

export type RequestComplexity = "simple" | "technical" | "analytical" | "generative";

export type RoutingDecision = {
  config: ModelConfig;
  complexity: RequestComplexity;
  reason: string;
  modelLabel: string;
  suggestion?: string;
};

const TECHNICAL_KEYWORDS = ["presupuesto", "costo", "metrado", "ingeniería", "estructura", "análisis", "calcul", "plazo", "cronograma", "especificación", "requerimiento", "cotización", "oferta"];
const ANALYTICAL_KEYWORDS = ["comparar", "evaluar", "decidir", "riesgo", "estrategia", "porqué", "diagnóstico", "tendencia", "histórico", "desviación", "proyección"];
const GENERATIVE_KEYWORDS = ["redacta", "escribe", "genera", "crea", "informe", "documento", "resumen ejecutivo", "carta", "acta", "propuesta"];
const APP_GENERATION_KEYWORDS = [
  "html-app",
  "aplicacion",
  "aplicación",
  "app ",
  "simulador",
  "calculadora",
  "dashboard interactivo",
  "prototipo",
  "replica",
  "réplica",
  "mejoralo",
  "mejóralo",
  "similar al html",
  "descargable",
  "ventana completa",
  "probarlo en la mesa",
  "probar en la mesa",
];

function isAppGenerationRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return APP_GENERATION_KEYWORDS.some((k) => lower.includes(k)) || /\.html\b/i.test(text) || /```html/i.test(text);
}

export function classifyRequest(text: string): RequestComplexity {
  const lower = text.toLowerCase();
  if (isAppGenerationRequest(text)) return "generative";
  if (GENERATIVE_KEYWORDS.some((k) => lower.includes(k))) return "generative";
  if (ANALYTICAL_KEYWORDS.some((k) => lower.includes(k))) return "analytical";
  if (TECHNICAL_KEYWORDS.some((k) => lower.includes(k))) return "technical";
  return "simple";
}

function getKey(key: string): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(key) ?? "";
}

const LOCAL_KEY_BY_PROVIDER: Partial<Record<LLMProvider, string>> = {
  gemini: "ot:apikey:gemini",
  groq: "ot:apikey:groq",
  sambanova: "ot:apikey:sambanova",
  openrouter: "ot:apikey:openrouter",
  cerebras: "ot:apikey:cerebras",
  mistral: "ot:apikey:mistral",
  together: "ot:apikey:together",
  huggingface: "ot:apikey:huggingface",
  openai: "ot:apikey:openai",
  anthropic: "ot:apikey:anthropic",
};

function config(provider: LLMProvider, model: string): ModelConfig {
  const localKey = LOCAL_KEY_BY_PROVIDER[provider];
  return { provider, model, apiKey: localKey ? getKey(localKey) || undefined : undefined };
}

export function routeRequest(text: string): RoutingDecision {
  const complexity = classifyRequest(text);
  const isDeep = complexity === "analytical" || complexity === "generative" || isDataAccessQuestion(text) || isLogTableQuestion(text);
  const appGeneration = isAppGenerationRequest(text);

  if (isDeep) {
    const model = appGeneration || complexity !== "generative" ? "gemini-pro-latest" : "gpt-4o";
    const provider: LLMProvider = appGeneration || complexity !== "generative" ? "gemini" : "openai";
    return {
      config: config(provider, model),
      complexity,
      reason: appGeneration
        ? "Auto: app HTML/simulador -> modelo largo con mejor tolerancia de salida"
        : "Auto: consulta compleja -> modelo de mayor razonamiento",
      modelLabel: model,
    };
  }

  if (complexity === "technical") {
    return {
      config: config("cerebras", "llama3.1-70b"),
      complexity,
      reason: "Auto: consulta tecnica -> modelo rapido y fuerte para ingenieria",
      modelLabel: "llama3.1-70b",
    };
  }

  return {
    config: config("gemini", "gemini-flash-latest"),
    complexity,
    reason: "Auto: consulta simple -> respuesta rapida",
    modelLabel: "gemini-flash-latest",
  };
}
