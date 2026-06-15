import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  persistenceFailure,
  persistenceSuccess,
  type PersistenceResult,
} from "@/lib/supabase/persistenceErrors";

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  agentId: string;
  projectId?: string;
  modelUsed?: string;
  complexity?: string;
};

export async function saveConversation(
  userId: string,
  agentId: string,
  userMessage: string,
  assistantResponse: string,
  modelUsed: string,
  complexity: string,
  projectId?: string
): Promise<PersistenceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return persistenceSuccess(undefined);

  const rows = [
    { user_id: userId, agent_id: agentId, project_id: projectId ?? null, role: "user", content: userMessage, model_used: null, complexity: null },
    { user_id: userId, agent_id: agentId, project_id: projectId ?? null, role: "assistant", content: assistantResponse, model_used: modelUsed, complexity },
  ];
  try {
    const { error } = await supabase.from("agent_conversations").insert(rows);
    return error
      ? persistenceFailure("conversation-write", error)
      : persistenceSuccess(undefined);
  } catch (error) {
    return persistenceFailure("conversation-write", error);
  }
}

export async function loadConversationHistory(
  userId: string,
  agentId: string,
  projectId?: string,
  limit = 20
): Promise<PersistenceResult<ConversationMessage[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return persistenceSuccess([]);

  let query = supabase
    .from("agent_conversations")
    .select("role, content, agent_id, project_id, model_used, complexity")
    .eq("user_id", userId)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projectId) query = query.eq("project_id", projectId);

  try {
    const { data, error } = await query;
    if (error) return persistenceFailure("conversation-read", error);
    if (!data) return persistenceSuccess([]);

    return persistenceSuccess(
      (data as Array<{
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
        }))
    );
  } catch (error) {
    return persistenceFailure("conversation-read", error);
  }
}

export async function saveAgentMemory(
  agentId: string,
  content: string,
  memoryType: "decision" | "learning" | "context",
  projectId?: string,
  importance = 1
): Promise<PersistenceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return persistenceSuccess(undefined);

  try {
    const { error } = await supabase.from("agent_memories").insert({
      agent_id: agentId,
      project_id: projectId ?? null,
      memory_type: memoryType,
      content,
      importance,
    });
    return error
      ? persistenceFailure("memory-write", error)
      : persistenceSuccess(undefined);
  } catch (error) {
    return persistenceFailure("memory-write", error);
  }
}
