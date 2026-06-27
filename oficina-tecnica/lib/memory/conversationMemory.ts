import { supabase } from "@/lib/supabaseClient";

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  agentId: string;
  projectId?: string;
  modelUsed?: string;
  complexity?: string;
};

const DEFAULT_MEMORY_DAYS = 5;

export async function saveConversation(
  userId: string,
  agentId: string,
  userMessage: string,
  assistantResponse: string,
  modelUsed: string,
  complexity: string,
  projectId?: string
): Promise<void> {
  const rows = [
    { user_id: userId, agent_id: agentId, project_id: projectId ?? null, role: "user", content: userMessage, model_used: null, complexity: null },
    { user_id: userId, agent_id: agentId, project_id: projectId ?? null, role: "assistant", content: assistantResponse, model_used: modelUsed, complexity },
  ];
  await supabase.from("agent_conversations").insert(rows);
}

export async function loadConversationHistory(
  userId: string,
  agentId: string,
  projectId?: string,
  limit = 20,
  days = DEFAULT_MEMORY_DAYS
): Promise<ConversationMessage[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from("agent_conversations")
    .select("role, content, agent_id, project_id, model_used, complexity")
    .eq("user_id", userId)
    .eq("agent_id", agentId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as Array<{
    role: string; content: string; agent_id: string;
    project_id: string | null; model_used: string | null; complexity: string | null;
  }>)
    .reverse()
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
      agentId: row.agent_id,
      projectId: row.project_id ?? undefined,
      modelUsed: row.model_used ?? undefined,
      complexity: row.complexity ?? undefined,
    }));
}

export async function saveAgentMemory(
  agentId: string,
  content: string,
  memoryType: "decision" | "learning" | "context",
  projectId?: string,
  importance = 1
): Promise<void> {
  await supabase.from("agent_memories").insert({
    agent_id: agentId,
    project_id: projectId ?? null,
    memory_type: memoryType,
    content,
    importance,
  });
}

export async function loadAgentMemories(
  agentId: string,
  projectId?: string,
  limit = 8,
  days = DEFAULT_MEMORY_DAYS
): Promise<string[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from("agent_memories")
    .select("content")
    .eq("agent_id", agentId)
    .gte("created_at", since)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as Array<{ content: string }>).map((row) => row.content).filter(Boolean);
}

export function buildAgentMemoryPrompt(memories: string[]): string {
  if (!memories.length) return "";
  return `\n\nMemoria reciente del agente (ultimos ${DEFAULT_MEMORY_DAYS} dias; usala como contexto, no la repitas literal):\n${memories.map((m) => `- ${m}`).join("\n")}`;
}
