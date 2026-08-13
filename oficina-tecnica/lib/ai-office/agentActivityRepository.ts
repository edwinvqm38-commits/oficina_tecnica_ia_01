import { supabase } from "@/lib/supabaseClient";

export type AgentConversationActivity = {
  agentId: string;
  interactions: number;
  lastActivityAt: string | null;
};

export type AgentConversationActivityResult = {
  rows: AgentConversationActivity[];
  source: "supabase" | "unavailable";
  warning: string | null;
};

type AgentConversationRow = {
  agent_id: string | null;
  created_at: string | null;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

export async function listAgentConversationActivity(limit = 500): Promise<AgentConversationActivityResult> {
  const { data, error } = await supabase
    .from("agent_conversations")
    .select("agent_id, created_at")
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    return {
      rows: [],
      source: "unavailable",
      warning: "No se pudo leer la actividad real de agentes.",
    };
  }

  const byAgent = new Map<string, AgentConversationActivity>();
  ((data ?? []) as AgentConversationRow[]).forEach((row) => {
    const agentId = normalizeString(row.agent_id);
    if (!agentId) return;
    const current = byAgent.get(agentId);
    if (!current) {
      byAgent.set(agentId, {
        agentId,
        interactions: 1,
        lastActivityAt: normalizeString(row.created_at) || null,
      });
      return;
    }
    current.interactions += 1;
    if (!current.lastActivityAt && row.created_at) current.lastActivityAt = row.created_at;
  });

  return {
    rows: Array.from(byAgent.values()),
    source: "supabase",
    warning: null,
  };
}
