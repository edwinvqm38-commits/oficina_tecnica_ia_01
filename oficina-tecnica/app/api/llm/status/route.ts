// Returns which providers are configured via Vercel env vars — used by Conexiones page.
import { apiAuthErrorResponse, requireApprovedUser } from "@/lib/api/serverAuth";

export async function GET(request: Request) {
  try {
    await requireApprovedUser(request, { moduleKey: "chat", action: "view" });
  } catch (error) {
    return apiAuthErrorResponse(error);
  }

  return Response.json({
    gemini:      !!(process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY),
    groq:        !!process.env.GROQ_API_KEY,
    sambanova:   !!process.env.SAMBANOVA_API_KEY,
    openrouter:  !!process.env.OPENROUTER_API_KEY,
    cerebras:    !!process.env.CEREBRAS_API_KEY,
    mistral:     !!process.env.MISTRAL_API_KEY,
    together:    !!process.env.TOGETHER_API_KEY,
    huggingface: !!process.env.HUGGINGFACE_API_KEY,
    openai:      !!process.env.OPENAI_API_KEY,
    anthropic:   !!process.env.ANTHROPIC_API_KEY,
  });
}
