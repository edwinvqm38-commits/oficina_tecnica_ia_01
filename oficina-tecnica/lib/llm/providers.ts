// Supported LLM providers
export type LLMProvider =
  | "ollama"
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "sambanova"
  | "openrouter"
  | "mistral"
  | "cerebras"
  | "together"
  | "huggingface"
  | "cloudflare";

export type ModelConfig = {
  provider: LLMProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
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

export async function checkOllamaConnectivity(baseUrl = "http://localhost:11434"): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getOllamaModels(baseUrl = "http://localhost:11434"): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models ?? []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

// Tries server proxy first (Vercel env vars); falls back to direct call with localStorage key
export async function sendChat(messages: ChatMessage[], config: ModelConfig): Promise<LLMResponse> {
  if (config.provider === "ollama") return sendOllamaChat(messages, config);
  if (config.provider === "anthropic") return sendAnthropicChat(messages, config);
  if (config.provider === "cloudflare") return sendCloudflareChat(messages, config);

  // Try server-side proxy (uses Vercel env vars → shared for all users)
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
    if (res.status !== 503) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
  } catch (e) {
    if (!(e instanceof Error && e.message.includes("fetch"))) throw e;
  }

  // Fallback: direct call with localStorage API key
  if (!config.apiKey) throw new Error(`Sin clave API para ${config.provider}. Configúrala en Conexiones.`);
  return sendOpenAICompatChat(messages, config, getProviderBaseUrl(config.provider), getProviderExtraHeaders(config.provider));
}

function getProviderBaseUrl(provider: LLMProvider): string {
  const map: Partial<Record<LLMProvider, string>> = {
    gemini:      "https://generativelanguage.googleapis.com/v1beta/openai",
    groq:        "https://api.groq.com/openai/v1",
    sambanova:   "https://api.sambanova.ai/v1",
    openrouter:  "https://openrouter.ai/api/v1",
    cerebras:    "https://api.cerebras.ai/v1",
    mistral:     "https://api.mistral.ai/v1",
    together:    "https://api.together.xyz/v1",
    huggingface: "https://router.huggingface.co/v1",
    openai:      "https://api.openai.com/v1",
  };
  return map[provider] ?? "https://api.openai.com/v1";
}

function getProviderExtraHeaders(provider: LLMProvider): Record<string, string> {
  if (provider === "openrouter") {
    return { "HTTP-Referer": "https://oficina-tecnica.vercel.app", "X-Title": "Oficina Técnica IA" };
  }
  return {};
}

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
      Authorization: `Bearer ${config.apiKey}`,
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
  const systemMsg = messages.find((m) => m.role === "system")?.content;
  const userMessages = messages.filter((m) => m.role !== "system");
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
      messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${res.statusText}`);
  const data = await res.json();
  return {
    content: data.content[0].text,
    model: config.model,
    provider: "anthropic",
    tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
  };
}

async function sendCloudflareChat(messages: ChatMessage[], config: ModelConfig): Promise<LLMResponse> {
  // baseUrl = https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1
  const baseUrl = config.baseUrl ?? "";
  if (!baseUrl) throw new Error("Cloudflare AI requiere Account ID configurado en Conexiones.");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model: config.model, messages }),
  });
  if (!res.ok) throw new Error(`Cloudflare AI error: ${res.statusText}`);
  const data = await res.json();
  return {
    content: data.result?.response ?? data.choices?.[0]?.message?.content ?? "",
    model: config.model,
    provider: "cloudflare",
    tokensUsed: data.usage?.total_tokens,
  };
}

// Tries primary config; if it fails iterates through all configured providers
export async function sendChatWithFallback(
  messages: ChatMessage[],
  primaryConfig: ModelConfig,
  ollamaModels: string[]
): Promise<{ response: LLMResponse; actualConfig: ModelConfig; usedFallback: boolean }> {
  try {
    const response = await sendChat(messages, primaryConfig);
    return { response, actualConfig: primaryConfig, usedFallback: false };
  } catch { /* fall through */ }

  const FALLBACK_CHAIN: Array<{ provider: LLMProvider; lsKey: string; model: string }> = [
    { provider: "gemini",      lsKey: "ot:apikey:gemini",      model: "gemini-1.5-flash" },
    { provider: "groq",        lsKey: "ot:apikey:groq",        model: "llama-3.1-8b-instant" },
    { provider: "sambanova",   lsKey: "ot:apikey:sambanova",   model: "Meta-Llama-3.1-70B-Instruct" },
    { provider: "openrouter",  lsKey: "ot:apikey:openrouter",  model: "meta-llama/llama-3.1-8b-instruct:free" },
    { provider: "cerebras",    lsKey: "ot:apikey:cerebras",    model: "llama3.1-8b" },
    { provider: "mistral",     lsKey: "ot:apikey:mistral",     model: "mistral-small-latest" },
    { provider: "together",    lsKey: "ot:apikey:together",    model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo" },
    { provider: "huggingface", lsKey: "ot:apikey:huggingface", model: "meta-llama/Llama-3.1-8B-Instruct" },
  ];

  const ollamaBase = localStorage.getItem("ot:ollama:baseUrl") ?? "http://localhost:11434";

  for (const fb of FALLBACK_CHAIN) {
    if (fb.provider === primaryConfig.provider) continue;
    const key = localStorage.getItem(fb.lsKey);
    const config: ModelConfig = { provider: fb.provider, model: fb.model, apiKey: key ?? undefined };
    try {
      const response = await sendChat(messages, config);
      return { response, actualConfig: config, usedFallback: true };
    } catch { /* try next */ }
  }

  if (primaryConfig.provider !== "ollama" && ollamaModels.length > 0) {
    const config: ModelConfig = { provider: "ollama", model: ollamaModels[0], baseUrl: ollamaBase };
    try {
      const response = await sendChat(messages, config);
      return { response, actualConfig: config, usedFallback: true };
    } catch { /* give up */ }
  }

  throw new Error("Sin conexión con ningún proveedor. Verifica tu conexión y las API keys en Conexiones.");
}
