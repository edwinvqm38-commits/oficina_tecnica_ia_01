// Default model recommendations for each agent role
export const RECOMMENDED_MODELS = {
  ollama: [
    { model: "qwen2.5:7b", label: "Qwen 2.5 7B", description: "Mejor para español + análisis técnico", size: "4.4 GB", recommended: true },
    { model: "deepseek-r1:7b", label: "DeepSeek R1 7B", description: "Razonamiento y análisis profundo", size: "4.7 GB", recommended: false },
    { model: "llama3.1:8b", label: "Llama 3.1 8B", description: "Conversación general", size: "4.7 GB", recommended: false },
    { model: "mistral:7b", label: "Mistral 7B", description: "Tareas de ingeniería, rápido", size: "4.1 GB", recommended: false },
  ],
  openai: [
    { model: "gpt-4o", label: "GPT-4o", description: "Análisis profundo y razonamiento complejo", recommended: true },
    { model: "gpt-4o-mini", label: "GPT-4o Mini", description: "Rápido y económico", recommended: false },
    { model: "o1-mini", label: "o1 Mini", description: "Razonamiento avanzado", recommended: false },
  ],
  anthropic: [
    { model: "claude-sonnet-4-6", label: "Claude Sonnet", description: "Análisis técnico detallado", recommended: true },
    { model: "claude-haiku-4-5-20251001", label: "Claude Haiku", description: "Respuestas rápidas", recommended: false },
  ],
};

// Default agent model assignments (stored in localStorage)
export const DEFAULT_AGENT_MODELS: Record<string, { provider: string; model: string }> = {
  "general-manager": { provider: "ollama", model: "qwen2.5:7b" },
  "cost-engineer": { provider: "ollama", model: "deepseek-r1:7b" },
  "project-management": { provider: "ollama", model: "qwen2.5:7b" },
};

export const OLLAMA_SETUP_STEPS = [
  { step: 1, title: "Descargar Ollama", description: "Ve a ollama.com y descarga el instalador para tu sistema operativo (Windows/Mac/Linux).", link: "https://ollama.com/download" },
  { step: 2, title: "Instalar Ollama", description: "Ejecuta el instalador. Ollama correrá automáticamente en segundo plano en el puerto 11434." },
  { step: 3, title: "Descargar un modelo", description: "Abre una terminal y ejecuta:", command: "ollama pull qwen2.5:7b" },
  { step: 4, title: "Verificar instalación", description: "Ejecuta el siguiente comando para probar que funciona:", command: "ollama run qwen2.5:7b \"Hola, ¿puedes presentarte?\"" },
  { step: 5, title: "Acceso remoto (opcional)", description: "Si quieres usar la app desde otra PC o desde Vercel, instala Cloudflare Tunnel:", command: "cloudflared tunnel --url http://localhost:11434", link: "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/" },
];
