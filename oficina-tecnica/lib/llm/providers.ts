// Supported LLM providers
export type LLMProvider = "ollama" | "openai" | "anthropic";

export type ModelConfig = {
  provider: LLMProvider;
  model: string;
  baseUrl?: string; // for ollama: configurable URL
  apiKey?: string;  // for openai/anthropic
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

// Check if Ollama is reachable at the given URL
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

// Send a chat message to the configured provider
export async function sendChat(
  messages: ChatMessage[],
  config: ModelConfig
): Promise<LLMResponse> {
  if (config.provider === "ollama") {
    return sendOllamaChat(messages, config);
  } else if (config.provider === "openai") {
    return sendOpenAIChat(messages, config);
  } else {
    return sendAnthropicChat(messages, config);
  }
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

async function sendOpenAIChat(messages: ChatMessage[], config: ModelConfig): Promise<LLMResponse> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, messages }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.statusText}`);
  const data = await res.json();
  return { content: data.choices[0].message.content, model: config.model, provider: "openai", tokensUsed: data.usage?.total_tokens };
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
  return { content: data.content[0].text, model: config.model, provider: "anthropic", tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens };
}
