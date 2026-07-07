// Server-side LLM proxy — reads keys from Vercel env vars so all users benefit without needing their own keys.
// Returns 503 when the requested provider is not configured, so the client can fall back to direct calls.

type ProviderCfg = {
  envKey: string;
  baseUrl: string;
  extraHeaders?: Record<string, string>;
};

const PROVIDER_CONFIG: Record<string, ProviderCfg> = {
  gemini:      { envKey: "GEMINI_API_KEY",      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  groq:        { envKey: "GROQ_API_KEY",         baseUrl: "https://api.groq.com/openai/v1" },
  sambanova:   { envKey: "SAMBANOVA_API_KEY",    baseUrl: "https://api.sambanova.ai/v1" },
  openrouter:  { envKey: "OPENROUTER_API_KEY",   baseUrl: "https://openrouter.ai/api/v1", extraHeaders: { "HTTP-Referer": "https://oficina-tecnica.vercel.app", "X-Title": "Oficina Técnica IA" } },
  cerebras:    { envKey: "CEREBRAS_API_KEY",     baseUrl: "https://api.cerebras.ai/v1" },
  mistral:     { envKey: "MISTRAL_API_KEY",      baseUrl: "https://api.mistral.ai/v1" },
  together:    { envKey: "TOGETHER_API_KEY",     baseUrl: "https://api.together.xyz/v1" },
  huggingface: { envKey: "HUGGINGFACE_API_KEY",  baseUrl: "https://router.huggingface.co/v1" },
  openai:      { envKey: "OPENAI_API_KEY",       baseUrl: "https://api.openai.com/v1" },
};

export async function POST(request: Request) {
  const body = await request.json() as { messages: unknown; provider: string; model: string; maxTokens?: number };
  const { messages, provider, model } = body;
  const maxTokens = typeof body.maxTokens === "number"
    ? Math.max(128, Math.min(body.maxTokens, 12000))
    : undefined;

  const cfg = PROVIDER_CONFIG[provider];
  if (!cfg) return Response.json({ error: "Provider not supported" }, { status: 400 });

  // Check both regular and NEXT_PUBLIC_ prefix (Gemini uses NEXT_PUBLIC_GEMINI_API_KEY on some deployments)
  const apiKey = process.env[cfg.envKey] ?? process.env[`NEXT_PUBLIC_${cfg.envKey}`];
  if (!apiKey) return Response.json({ error: "Provider not configured on server" }, { status: 503 });

  let res: Response;
  try {
    const payload: Record<string, unknown> = { model, messages };
    if (maxTokens) payload.max_tokens = maxTokens;

    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(cfg.extraHeaders ?? {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    return Response.json(
      { error: `No se pudo conectar con ${provider}. Revisa internet, DNS/firewall o disponibilidad del proveedor. Detalle: ${msg}` },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    return Response.json({ error: errText.slice(0, 200) }, { status: res.status });
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }>; usage?: { total_tokens?: number } };
  return Response.json({
    content: data.choices[0].message.content,
    model,
    tokensUsed: data.usage?.total_tokens,
  });
}
