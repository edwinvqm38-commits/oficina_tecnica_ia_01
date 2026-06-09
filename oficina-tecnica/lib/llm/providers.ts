// Supported LLM providers
export type LLMProvider = "ollama" | "openai" | "anthropic" | "gemini" | "groq" | "sambanova" | "openrouter" | "mistral" | "cerebras" | "together";

export type ModelConfig = {
  provider: LLMProvider;
  model: string;
  baseUrl?: string; // for ollama: configurable URL
  apiKey?: string;  // for cloud providers
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMResponse = {
  content: string;
  model: string;
  provider: LLMProvider;
  tokensUsed?: number;
};

// Check if Ollama is reachable
export async function checkOllamaConnectivity(baseUrl: string = "http://localhost:11434"): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// Get list of available Ollama models
export async function getOllamaModels(baseUrl: string = "http://localhost:11434"): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models ?? []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

// Send a chat message to the configured provider.
// For cloud providers, tries the server-side proxy first (Vercel env vars → all users benefit).
// Falls back to direct call with the localStorage API key if proxy returns 503.
export async function sendChat(messages: ChatMessage[], config: ModelConfig): Promise<LLMResponse> {
  if (config.provider === "ollama") return sendOllamaChat(messages, config);
  if (config.provider === "anthropic") return sendAnthropicChat(messages, config);

  // Try server proxy (Vercel env vars)
  try {
    const res = await fetch("/api/llm/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, provider: config.provider, model: config.model }),
    });
    if (res.ok) {
      const data = await res.json();
      return { content: data.content, model: data.model, provider: config.provider, tokensUsed: data.tokensUsed };
    }
    // 503 = env var not set → fall through to direct call
    if (res.status !== 503) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
  } catch (e) {
    // Network error calling our own proxy (e.g. running locally without Next.js) → fall through
    if (!(e instanceof Error && e.message.includes("fetch"))) throw e;
  }

  // Fallback: direct call with localStorage key (per-browser config)
  if (!config.apiKey) throw new Error(`No API key configured for ${config.provider}. Ve a Conexiones para configurarlo.`);
  return sendOpenAICompatChat(messages, config, getProviderBaseUrl(config.provider), getProviderExtraHeaders(config.provider));
}

function getProviderBaseUrl(provider: LLMProvider): string {
  const map: Partial<Record<LLMProvider, string>> = {
    gemini:     "https://generativelanguage.googleapis.com/v1beta/openai",
    groq:       "https://api.groq.com/openai/v1",
    sambanova:  "https://api.sambanova.ai/v1",
    openrouter: "https://openrouter.ai/api/v1",
    cerebras:   "https://api.cerebras.ai/v1",
    mistral:    "https://api.mistral.ai/v1",
    together:   "https://api.together.xyz/v1",
    openai:     "https://api.openai.com/v1",
  };
  return map[provider] ?? "https://api.openai.com/v1";
}

function getProviderExtraHeaders(provider: LLMProvider): Record<string, string> {
  if (provider === "openrouter") {
    return { "HTTP-Referer": "https://oficina-tecnica.vercel.app", "X-Title": "Oficina Técnica IA" };
  }
  return {};
}

// Shared OpenAI-compatible chat (Groq, Sambanova, OpenRouter, Gemini all use this)
async function sendOpenAICompatChat(
  messages: ChatMessage[],
  config: ModelConfig,
  baseUrl: string,
  extraHeaders: Record<string, string> = {}
): Promise<LLMResponse> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({ model: config.model, messages }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`${config.provider} error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    content: data.choices[0].message.content,
    model: config.model,
    provider: config.provider,
    tokensUsed: data.usage?.total_tokens,
  };
}

async function sendOllamaChat(messages: ChatMessage[], config: ModelConfig): Promise<LLMResponse> {
  const baseUrl = config.baseUrl ?? "http://localhost:11434";
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, messages, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
  const data = await res.json();
  return { content: data.message?.content ?? "", model: config.model, provider: "ollama" };
}

async function sendAnthropicChat(messages: ChatMessage[], config: ModelConfig): Promise<LLMResponse> {
  const systemMsg = messages.find(m => m.role === "system")?.content;
  const userMessages = messages.filter(m => m.role !== "system");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      system: systemMsg,
      messages: userMessages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${res.statusText}`);
  const data = await res.json();
  return {
    content: data.content[0].text,
    model: config.model,
    provider: "anthropic",
    tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
  };
}
