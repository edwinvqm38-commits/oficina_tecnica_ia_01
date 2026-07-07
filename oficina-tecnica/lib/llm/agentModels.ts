// Default model recommendations for each agent role
export const RECOMMENDED_MODELS = {
  gemini: [
    // Google retira versiones fechadas (1.5/2.0) periódicamente — usamos los
    // alias "latest", que Google redirige automáticamente al modelo vigente.
    { model: "gemini-flash-latest", label: "Gemini Flash (latest)", description: "Gratis · rápido · uso general y técnico · siempre vigente", recommended: true },
    { model: "gemini-pro-latest",   label: "Gemini Pro (latest)",   description: "Análisis profundo · siempre vigente · puede requerir facturación", recommended: false },
  ],
  groq: [
    { model: "llama-3.1-8b-instant",    label: "Llama 3.1 8B Instant", description: "Gratis · ultrarrápido · respuestas simples", recommended: true },
    { model: "llama-3.1-70b-versatile", label: "Llama 3.1 70B",        description: "Gratis · potente · análisis complejo",        recommended: false },
    { model: "mixtral-8x7b-32768",      label: "Mixtral 8×7B",         description: "Gratis · contexto largo · buen español",      recommended: false },
  ],
  sambanova: [
    { model: "DeepSeek-R1",                 label: "DeepSeek R1",   description: "Gratis · razonamiento avanzado · análisis técnico", recommended: true },
    { model: "Meta-Llama-3.1-70B-Instruct", label: "Llama 3.1 70B", description: "Gratis · potente · conversación",                  recommended: false },
  ],
  openrouter: [
    { model: "google/gemma-2-9b-it:free",              label: "Gemma 2 9B (free)",    description: "Gratis · eficiente · buenas respuestas",  recommended: true },
    { model: "meta-llama/llama-3.1-8b-instruct:free",  label: "Llama 3.1 8B (free)",  description: "Gratis · ligero · conversación general",  recommended: false },
    { model: "mistralai/mistral-7b-instruct:free",     label: "Mistral 7B (free)",    description: "Gratis · buen español",                   recommended: false },
    { model: "meta-llama/llama-3.1-70b-instruct:free", label: "Llama 3.1 70B (free)", description: "Gratis · análisis complejo",              recommended: false },
  ],
  cerebras: [
    { model: "llama3.1-8b",  label: "Llama 3.1 8B",  description: "Gratis · el más rápido (~1000 tok/s)", recommended: true },
    { model: "llama3.1-70b", label: "Llama 3.1 70B", description: "Gratis · potente · análisis complejo",  recommended: false },
  ],
  mistral: [
    { model: "mistral-small-latest", label: "Mistral Small", description: "Gratis · rápido · excelente español", recommended: true },
    { model: "mistral-large-latest", label: "Mistral Large", description: "Gratis · análisis avanzado",          recommended: false },
  ],
  together: [
    { model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",  label: "Llama 3.1 8B Turbo",  description: "Gratis (créditos) · rápido",  recommended: true },
    { model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", label: "Llama 3.1 70B Turbo", description: "Gratis (créditos) · potente", recommended: false },
  ],
  huggingface: [
    { model: "meta-llama/Llama-3.1-8B-Instruct",   label: "Llama 3.1 8B",  description: "Gratis · miles de modelos disponibles", recommended: true },
    { model: "mistralai/Mistral-7B-Instruct-v0.3",  label: "Mistral 7B",    description: "Gratis · buen español",                  recommended: false },
    { model: "meta-llama/Llama-3.1-70B-Instruct",   label: "Llama 3.1 70B", description: "Gratis · potente · más lento",            recommended: false },
  ],
  cloudflare: [
    { model: "@cf/meta/llama-3.1-8b-instruct",   label: "Llama 3.1 8B",   description: "Gratis · sin límite diario · rápido",    recommended: true },
    { model: "@cf/meta/llama-3.2-3b-instruct",   label: "Llama 3.2 3B",   description: "Gratis · muy rápido · respuestas simples", recommended: false },
    { model: "@cf/mistral/mistral-7b-instruct",  label: "Mistral 7B",     description: "Gratis · buen español",                   recommended: false },
  ],
  openai: [
    { model: "gpt-4o-mini", label: "GPT-4o Mini", description: "Pago · económico · rápido (~$0.01 / 50 msgs)",   recommended: true },
    { model: "gpt-4o",      label: "GPT-4o",      description: "Pago · análisis profundo y razonamiento",        recommended: false },
    { model: "o1-mini",     label: "o1 Mini",      description: "Pago · razonamiento avanzado",                  recommended: false },
  ],
  anthropic: [
    { model: "claude-haiku-4-5-20251001", label: "Claude Haiku", description: "Pago · rápido y económico",          recommended: true },
    { model: "claude-sonnet-4-6",          label: "Claude Sonnet", description: "Pago · análisis técnico detallado", recommended: false },
  ],
};

export const DEFAULT_AGENT_MODELS: Record<string, { provider: string; model: string }> = {
  "general-manager":    { provider: "gemini", model: "gemini-flash-latest" },
  "cost-engineer":      { provider: "gemini", model: "gemini-flash-latest" },
  "project-management": { provider: "gemini", model: "gemini-flash-latest" },
  "document-control":   { provider: "gemini", model: "gemini-flash-latest" },
  "systems-engineer":   { provider: "gemini", model: "gemini-flash-latest" },
};

// Maps chat agent ids (lib/chat/messageUtils.ts AGENT_IDS) to the agent ids
// used by the "Modelos por agente" assignment UI (ModelConnectionsPage).
// "ie" (Ingeniera Eléctrica) has no entry in that UI yet, so it keeps using
// automatic provider/key-based routing.
export const CHAT_AGENT_TO_SETTINGS_ID: Record<string, string> = {
  gg: "general-manager",
  ic: "cost-engineer",
  pm: "project-management",
  cd: "document-control",
  ti: "systems-engineer",
};

const LS_AGENT_MODELS = "ot:agent:models";

export type AgentModelAssignment = { provider: string; model: string };

// Google periodically shuts down dated Gemini model versions (1.5.x, 2.0.x
// were retired in 2026). Assignments saved before that switch would silently
// fail and fall back to other providers — remap them to the "latest" aliases,
// which Google keeps pointed at a working model.
const LEGACY_GEMINI_MODEL_MAP: Record<string, string> = {
  "gemini-1.5-flash": "gemini-flash-latest",
  "gemini-1.5-pro":   "gemini-pro-latest",
  "gemini-2.0-flash": "gemini-flash-latest",
};

export function normalizeAgentModel(assignment: AgentModelAssignment): AgentModelAssignment {
  if (assignment.provider !== "gemini") return assignment;
  const remapped = LEGACY_GEMINI_MODEL_MAP[assignment.model];
  return remapped ? { ...assignment, model: remapped } : assignment;
}

// Reads the per-agent model assignment configured in Conexiones → "Modelos
// por agente" (localStorage "ot:agent:models"), falling back to
// DEFAULT_AGENT_MODELS. Returns null for agents without a settings entry,
// so they keep using the automatic provider/key-based routing.
export function getAgentModelOverride(chatAgentId: string): AgentModelAssignment | null {
  const settingsId = CHAT_AGENT_TO_SETTINGS_ID[chatAgentId];
  if (!settingsId) return null;

  if (typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem(LS_AGENT_MODELS);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, AgentModelAssignment>;
        if (parsed[settingsId]) return normalizeAgentModel(parsed[settingsId]);
      }
    } catch {
      // Ignore malformed localStorage value, fall back to defaults below.
    }
  }

  return DEFAULT_AGENT_MODELS[settingsId] ?? null;
}
