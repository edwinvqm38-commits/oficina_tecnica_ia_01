// Supported LLM providers
import { authFetch } from "@/lib/api/authFetch";

export type LLMProvider =
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
  maxTokens?: number;
};

export type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: ChatContent;
};

export type LLMResponse = {
  content: string;
  model: string;
  provider: LLMProvider;
  tokensUsed?: number;
};

function llmTimeoutMs(config: ModelConfig): number {
  return config.maxTokens && config.maxTokens > 4096 ? 65_000 : 35_000;
}

// Tries server proxy first (Vercel env vars); falls back to direct call with localStorage key
export async function sendChat(messages: ChatMessage[], config: ModelConfig): Promise<LLMResponse> {
  if (config.provider === "anthropic") return sendAnthropicChat(messages, config);
  if (config.provider === "cloudflare") return sendCloudflareChat(messages, config);

  // Try server-side proxy (uses Vercel env vars → shared for all users)
  try {
    const res = await authFetch("/api/llm/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        provider: config.provider,
        model: config.model,
        maxTokens: config.maxTokens,
      }),
      signal: AbortSignal.timeout(llmTimeoutMs(config)),
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
  const payload: Record<string, unknown> = {
    model: config.model,
    messages,
  };
  if (config.maxTokens && config.maxTokens > 0) payload.max_tokens = config.maxTokens;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(llmTimeoutMs(config)),
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
      max_tokens: config.maxTokens ?? 4096,
      system: typeof systemMsg === "string" ? systemMsg : contentToPlainText(systemMsg),
      messages: userMessages.map((m) => ({ role: m.role, content: contentToPlainText(m.content) })),
    }),
    signal: AbortSignal.timeout(llmTimeoutMs(config)),
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

function summarizeLLMError(err: unknown): string {
  if (!(err instanceof Error)) return "error desconocido";
  const msg = err.message || "error desconocido";
  if (/fetch failed|failed to fetch|network|dns|econn|timeout|aborted/i.test(msg)) {
    return "fallo de red/proveedor no disponible";
  }
  if (/401|unauthorized|invalid api key|api[_ -]?key/i.test(msg)) {
    return "clave API inválida o sin permiso";
  }
  if (/429|quota|rate limit|insufficient_quota/i.test(msg)) {
    return "límite/cuota del proveedor";
  }
  if (/503|not configured|sin clave api/i.test(msg)) {
    return msg.slice(0, 140);
  }
  return msg.slice(0, 140);
}

function contentToPlainText(content: ChatContent | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .map((part) => part.type === "text" ? part.text : "[Imagen adjunta no enviada a este proveedor]")
    .join("\n");
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
    signal: AbortSignal.timeout(45000),
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
  complexity: "simple" | "technical" | "analytical" | "generative" = "simple",
): Promise<{ response: LLMResponse; actualConfig: ModelConfig; usedFallback: boolean }> {
  const failures: string[] = [];
  try {
    const response = await sendChat(messages, primaryConfig);
    return { response, actualConfig: primaryConfig, usedFallback: false };
  } catch (err) {
    failures.push(`${primaryConfig.provider}: ${summarizeLLMError(err)}`);
  }

  // Cloud providers: try server proxy (Vercel env vars) first, then localStorage key as fallback
  const deep = complexity !== "simple";
  const CLOUD_FALLBACKS: Array<{ provider: LLMProvider; lsKey: string; model: string }> = [
    { provider: "openai",      lsKey: "ot:apikey:openai",      model: deep ? "gpt-4o" : "gpt-4o-mini" },
    { provider: "gemini",      lsKey: "ot:apikey:gemini",      model: deep ? "gemini-pro-latest" : "gemini-flash-latest" },
    { provider: "cerebras",    lsKey: "ot:apikey:cerebras",    model: deep ? "llama3.1-70b" : "llama3.1-8b" },
    { provider: "mistral",     lsKey: "ot:apikey:mistral",     model: deep ? "mistral-large-latest" : "mistral-small-latest" },
    { provider: "groq",        lsKey: "ot:apikey:groq",        model: deep ? "llama-3.1-70b-versatile" : "llama-3.1-8b-instant" },
    { provider: "sambanova",   lsKey: "ot:apikey:sambanova",   model: deep ? "DeepSeek-R1" : "Meta-Llama-3.1-70B-Instruct" },
    { provider: "openrouter",  lsKey: "ot:apikey:openrouter",  model: deep ? "meta-llama/llama-3.1-70b-instruct:free" : "meta-llama/llama-3.1-8b-instruct:free" },
    { provider: "together",    lsKey: "ot:apikey:together",    model: deep ? "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo" : "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo" },
    { provider: "huggingface", lsKey: "ot:apikey:huggingface", model: "meta-llama/Llama-3.1-8B-Instruct" },
  ];

  for (const fb of CLOUD_FALLBACKS) {
    if (fb.provider === primaryConfig.provider) continue;
    // Always try server proxy (no key needed); also pass localStorage key if available
    const key = localStorage.getItem(fb.lsKey) ?? undefined;
    const config: ModelConfig = {
      provider: fb.provider,
      model: fb.model,
      apiKey: key,
      maxTokens: deep ? 4096 : 1024,
    };
    try {
      const response = await sendChat(messages, config);
      return { response, actualConfig: config, usedFallback: true };
    } catch (err) {
      failures.push(`${fb.provider}: ${summarizeLLMError(err)}`);
    }
  }

  const detail = failures.slice(0, 4).join(" | ");
  throw new Error(`Sin conexión con ningún proveedor. Revisa internet, cuotas y API keys en Conexiones.${detail ? ` Detalle: ${detail}` : ""}`);
}
