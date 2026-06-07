// ig-models.js — Ollama local model registry + recommendation engine
// Simulates which models are "downloaded" and recommends the best one per task.
// Loads AFTER ig-store.js. No real Ollama connection — all simulated.
// ============================================================================

// ─── Model catalogue ─────────────────────────────────────────────────────────
const OLLAMA_MODELS = [
  {
    id: "llama3.2",     label: "Llama 3.2",     size: "2.0 GB",  params: "3B",
    downloaded: true,   speed: "rápido",
    strengths: ["chat general", "redacción", "resúmenes cortos"],
    keywords:  ["saludo","hola","qué es","explica","describe","escribe"],
    minTokens: 0,   maxTokens: 4096,
    ollama:    "llama3.2",
    badge: "meta",
    note: "Bueno para conversación rápida. Limitado en razonamiento complejo.",
  },
  {
    id: "llama3.1",     label: "Llama 3.1",     size: "4.7 GB",  params: "8B",
    downloaded: false,  speed: "medio",
    strengths: ["análisis", "instrucciones largas", "razonamiento general"],
    keywords:  ["analiza","evalúa","compara","explica en detalle","estrategia"],
    minTokens: 0,   maxTokens: 8192,
    ollama:    "llama3.1",
    badge: "meta",
    note: "Buena opción general para análisis técnico moderado.",
  },
  {
    id: "qwen2.5",      label: "Qwen 2.5",      size: "4.4 GB",  params: "7B",
    downloaded: true,   speed: "medio",
    strengths: ["cálculo", "presupuestos", "análisis numérico", "code"],
    keywords:  ["presupuesto","costo","precio","valoriz","desviación","número","calcul","s/","monto","apu","metrado"],
    minTokens: 200, maxTokens: 32768,
    ollama:    "qwen2.5",
    badge: "alibaba",
    note: "Recomendado para análisis de costos, presupuestos y datos numéricos.",
  },
  {
    id: "mistral",      label: "Mistral",        size: "4.1 GB",  params: "7B",
    downloaded: false,  speed: "medio",
    strengths: ["razonamiento general", "instrucciones largas", "multilingüe"],
    keywords:  ["planifica","riesgo","cronograma","restricción","hito","plazo","retraso"],
    minTokens: 0,   maxTokens: 8192,
    ollama:    "mistral",
    badge: "mistral-ai",
    note: "Sólido para gestión de proyectos y análisis de riesgos.",
  },
  {
    id: "phi3",         label: "Phi-3 mini",     size: "2.3 GB",  params: "3.8B",
    downloaded: true,   speed: "muy rápido",
    strengths: ["respuestas rápidas", "chat ligero", "consultas simples"],
    keywords:  ["resumen","breve","rápido","cuánto","cuándo","dónde","quién"],
    minTokens: 0,   maxTokens: 2048,
    ollama:    "phi3",
    badge: "microsoft",
    note: "El más rápido. Ideal para preguntas simples y resúmenes breves.",
  },
  {
    id: "gemma2",       label: "Gemma 2",        size: "5.4 GB",  params: "9B",
    downloaded: false,  speed: "lento",
    strengths: ["análisis de documentos", "comprensión larga", "técnico"],
    keywords:  ["documento","pdf","memoria descriptiva","norma","cne","iec","ieee","diseño","criterio"],
    minTokens: 500, maxTokens: 8192,
    ollama:    "gemma2",
    badge: "google",
    note: "Excelente para analizar documentos técnicos largos y normas.",
  },
  {
    id: "deepseek-r1",  label: "DeepSeek R1",    size: "4.7 GB",  params: "7B",
    downloaded: false,  speed: "lento",
    strengths: ["razonamiento complejo", "matemáticas", "análisis profundo"],
    keywords:  ["razona","demuestra","paso a paso","por qué","explicar detalladamente","prueba"],
    minTokens: 300, maxTokens: 16384,
    ollama:    "deepseek-r1",
    badge: "deepseek",
    note: "Para análisis complejos que requieren razonamiento paso a paso.",
  },
  {
    id: "nomic-embed",  label: "Nomic Embed",    size: "0.3 GB",  params: "137M",
    downloaded: false,  speed: "instantáneo",
    strengths: ["embeddings", "búsqueda semántica", "RAG"],
    keywords:  ["busca","encuentra","similar","relacionado"],
    minTokens: 0,   maxTokens: 2048,
    ollama:    "nomic-embed-text",
    badge: "nomic",
    note: "Solo para embeddings/RAG. No genera texto directamente.",
  },
];

// ─── Recommendation engine ────────────────────────────────────────────────────
function recommendModel(text, agentId) {
  const lower = (text||"").toLowerCase();
  const wordCount = lower.split(/\s+/).length;
  const downloaded = OLLAMA_MODELS.filter(m => m.downloaded);

  // Score each model
  const scored = downloaded.map(m => {
    let score = 0;
    // Keyword match
    m.keywords.forEach(kw => { if (lower.includes(kw)) score += 2; });
    // Length bonus for larger models
    if (wordCount > 100 && m.params.includes("7B") || m.params.includes("8B") || m.params.includes("9B")) score += 1;
    // Agent affinity
    if (agentId === "ic" && m.id === "qwen2.5") score += 3;
    if (agentId === "pm" && m.id === "mistral")  score += 2;
    if (agentId === "aa" && m.id === "gemma2")   score += 2;
    if (agentId === "ie" && m.id === "gemma2")   score += 3;
    return { ...m, score };
  });

  scored.sort((a,b) => b.score - a.score);
  const best = scored[0];

  // Find a not-downloaded model that would be even better
  const betterNotDownloaded = OLLAMA_MODELS.filter(m => !m.downloaded).find(m => {
    let s = 0;
    m.keywords.forEach(kw => { if (lower.includes(kw)) s += 2; });
    return s > (best?.score || 0);
  });

  return {
    recommended:       best || downloaded[0],
    betterAvailable:   betterNotDownloaded || null,
    score:             best?.score || 0,
    allScored:         scored,
  };
}

// ─── Store integration ────────────────────────────────────────────────────────
const ModelStore = {
  getActiveModel() {
    return IGStore.get().activeModelId || "qwen2.5";
  },
  setActiveModel(id) {
    IGStore.set({ activeModelId: id });
  },
  getAgentModel(agentId) {
    const overrides = IGStore.get().agentModelOverrides || {};
    return overrides[agentId] || OLLAMA_MODELS.find(m=>m.downloaded)?.id || "llama3.2";
  },
  setAgentModel(agentId, modelId) {
    const s = IGStore.get();
    IGStore.set({ agentModelOverrides: { ...(s.agentModelOverrides||{}), [agentId]: modelId } });
  },
  getDownloaded() {
    return OLLAMA_MODELS.filter(m => m.downloaded);
  },
  getAll() { return OLLAMA_MODELS; },
  findById(id) { return OLLAMA_MODELS.find(m => m.id === id); },
};

// ─── Ollama connection guide ──────────────────────────────────────────────────
const OLLAMA_SETUP_GUIDE = `# Conectar Ollama Real

## Requisitos
- Instalar Ollama: https://ollama.ai
- Descargar modelos: \`ollama pull llama3.2\`
- Habilitar CORS: \`OLLAMA_ORIGINS=* ollama serve\`

## Reemplazar callClaude por callOllama

\`\`\`js
async function callOllama(modelId, system, userText) {
  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: system },
        { role: "user",   content: userText }
      ],
      stream: false,
    }),
  });
  const data = await res.json();
  return { ok: true, text: data.message?.content || "" };
}
\`\`\`

## Comandos útiles
\`\`\`bash
ollama list          # ver modelos instalados
ollama pull qwen2.5  # descargar Qwen 2.5
ollama ps            # ver modelos corriendo
ollama run phi3      # probar un modelo
\`\`\`
`;

Object.assign(window, {
  OLLAMA_MODELS, ModelStore, recommendModel, OLLAMA_SETUP_GUIDE,
});
