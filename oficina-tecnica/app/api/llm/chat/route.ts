// Server-side LLM proxy — reads API keys from Vercel env vars.
// When keys are set here, ALL users benefit without any browser config.
// Falls back gracefully: client uses localStorage key if env var not set.

const PROVIDER_CONFIG: Record<string, {
  baseUrl: string;
  envKey: string;
  extraHeaders?: Record<string, string>;
}> = {
  gemini:     { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", envKey: "GEMINI_API_KEY" },
  groq:       { baseUrl: "https://api.groq.com/openai/v1",                          envKey: "GROQ_API_KEY" },
  sambanova:  { baseUrl: "https://api.sambanova.ai/v1",                             envKey: "SAMBANOVA_API_KEY" },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    extraHeaders: { "HTTP-Referer": "https://oficina-tecnica.vercel.app", "X-Title": "Oficina Técnica IA" },
  },
  cerebras:   { baseUrl: "https://api.cerebras.ai/v1",   envKey: "CEREBRAS_API_KEY" },
  mistral:    { baseUrl: "https://api.mistral.ai/v1",     envKey: "MISTRAL_API_KEY" },
  together:   { baseUrl: "https://api.together.xyz/v1",   envKey: "TOGETHER_API_KEY" },
  openai:     { baseUrl: "https://api.openai.com/v1",     envKey: "OPENAI_API_KEY" },
};

export async function POST(request: Request) {
  const { messages, provider, model } = await request.json();

  // Anthropic uses a different API format — not proxied here, handled client-side
  if (provider === "anthropic" || provider === "ollama") {
    return Response.json({ error: "Provider handled client-side" }, { status: 503 });
  }

  const cfg = PROVIDER_CONFIG[provider];
  if (!cfg) {
    return Response.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  }

  const apiKey = process.env[cfg.envKey];
  if (!apiKey) {
    // Tell client to fall back to localStorage key
    return Response.json({ error: "Provider not configured on server" }, { status: 503 });
  }

  const upstream = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...cfg.extraHeaders,
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => upstream.statusText);
    return Response.json({ error: errText.slice(0, 300) }, { status: upstream.status });
  }

  const data = await upstream.json();
  return Response.json({
    content: data.choices[0].message.content,
    model,
    provider,
    tokensUsed: data.usage?.total_tokens,
  });
}
