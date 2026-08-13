import { supabase } from "@/lib/supabaseClient";

export type AgentKnowledgeApprovalStatus = "proposed" | "approved" | "rejected";

export type AgentKnowledgeApproval = {
  id: string;
  agentId: string;
  projectId: string | null;
  title: string;
  content: string;
  knowledgeType: string;
  status: AgentKnowledgeApprovalStatus;
  importance: number | null;
  source: string | null;
  proposedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AgentKnowledgeApprovalListResult = {
  rows: AgentKnowledgeApproval[];
  source: "supabase" | "unavailable";
  warning: string | null;
};

type AgentKnowledgeApprovalRow = {
  id: string;
  agent_id: string | null;
  project_id: string | null;
  title: string | null;
  content: string | null;
  knowledge_type: string | null;
  status: string | null;
  importance: number | null;
  source: string | null;
  proposed_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const AGENT_KNOWLEDGE_SELECT = `
  id,
  agent_id,
  project_id,
  title,
  content,
  knowledge_type,
  status,
  importance,
  source,
  proposed_by,
  created_at,
  updated_at
`;

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown): AgentKnowledgeApprovalStatus {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "approved" || normalized === "rejected") return normalized;
  return "proposed";
}

function mapAgentKnowledgeApproval(row: AgentKnowledgeApprovalRow): AgentKnowledgeApproval {
  const content = normalizeString(row.content);
  return {
    id: normalizeString(row.id),
    agentId: normalizeString(row.agent_id) || "agente",
    projectId: normalizeString(row.project_id) || null,
    title: normalizeString(row.title) || content.slice(0, 90) || "Conocimiento propuesto",
    content,
    knowledgeType: normalizeString(row.knowledge_type) || "criterion",
    status: normalizeStatus(row.status),
    importance: typeof row.importance === "number" && Number.isFinite(row.importance) ? row.importance : null,
    source: normalizeString(row.source) || null,
    proposedBy: normalizeString(row.proposed_by) || null,
    createdAt: normalizeString(row.created_at) || null,
    updatedAt: normalizeString(row.updated_at) || null,
  };
}

export async function listPendingAgentKnowledgeApprovals(limit = 50): Promise<AgentKnowledgeApprovalListResult> {
  const { data, error } = await supabase
    .from("agent_knowledge")
    .select(AGENT_KNOWLEDGE_SELECT)
    .eq("status", "proposed")
    .order("importance", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    return {
      rows: [],
      source: "unavailable",
      warning: "No se pudo leer la cola real de conocimientos propuestos.",
    };
  }

  return {
    rows: ((data ?? []) as AgentKnowledgeApprovalRow[]).map(mapAgentKnowledgeApproval),
    source: "supabase",
    warning: null,
  };
}

export async function updateAgentKnowledgeApprovalStatus(
  id: string,
  status: Exclude<AgentKnowledgeApprovalStatus, "proposed">,
): Promise<void> {
  const normalizedId = normalizeString(id);
  if (!normalizedId) throw new Error("No se encontro la aprobacion a actualizar.");

  const { error } = await supabase
    .from("agent_knowledge")
    .update({ status })
    .eq("id", normalizedId);

  if (error) {
    throw new Error("No se pudo actualizar la decision.");
  }
}
