import { supabase } from "@/lib/supabaseClient";

export type DataAvailability = "supabase" | "unavailable";

export type AgentKnowledgeStatus = "proposed" | "approved" | "rejected" | "archived";

export type AgentKnowledgeItem = {
  id: string;
  agentId: string;
  projectId: string | null;
  title: string;
  content: string;
  knowledgeType: string;
  status: AgentKnowledgeStatus;
  source: string | null;
  importance: number | null;
  proposedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
};

export type AgentSkillStatus = "draft" | "proposed" | "review" | "active" | "observed" | "rejected" | "archived";
export type AgentSkillEffectiveStatus = AgentSkillStatus | "approved";

export type AgentSkillVersion = {
  id: string;
  agentId: string;
  skillKey: string;
  name: string;
  version: string;
  status: AgentSkillStatus;
  effectiveStatus: AgentSkillEffectiveStatus;
  governanceStatus: "approved" | null;
  discipline: string | null;
  skillType: string | null;
  summary: string;
  triggerText: string | null;
  inputs: string[];
  workflow: string[];
  safetyRules: string[];
  source: string | null;
  proposedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  metadata: Record<string, unknown>;
};

export type AgentPerformanceSummary = {
  agentId: string;
  totalEvents: number;
  answers: number;
  groundedAnswers: number;
  knowledgeProposals: number;
  knowledgeApproved: number;
  skillProposals: number;
  skillApproved: number;
  negativeSignals: number;
  usefulClarifications: number;
  lastEventAt: string | null;
};

export type AgentTimelineEvent = {
  id: string;
  type: "conversation" | "knowledge" | "skill" | "approval" | "performance";
  occurredAt: string | null;
  sourceAgentId: string | null;
  targetAgentId: string | null;
  summary: string;
  relatedEntity: string | null;
  status: string | null;
  source: string;
};

export type ListResult<T> = {
  rows: T[];
  source: DataAvailability;
  warning: string | null;
};

type AgentKnowledgeRow = {
  id: string;
  agent_id: string | null;
  project_id: string | null;
  title: string | null;
  content: string | null;
  knowledge_type: string | null;
  status: string | null;
  source: string | null;
  importance: number | null;
  proposed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata?: unknown;
  tags?: unknown;
};

type AgentSkillRow = {
  id: string;
  agent_id: string | null;
  skill_key: string | null;
  name: string | null;
  version: string | null;
  status: string | null;
  discipline: string | null;
  skill_type: string | null;
  summary: string | null;
  trigger_text: string | null;
  inputs: unknown;
  workflow: unknown;
  safety_rules: unknown;
  source: string | null;
  proposed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata: unknown;
};

type AgentPerformanceRow = {
  agent_id: string | null;
  total_events: number | null;
  answers: number | null;
  grounded_answers: number | null;
  knowledge_proposals: number | null;
  knowledge_approved: number | null;
  skill_proposals: number | null;
  skill_approved: number | null;
  negative_signals: number | null;
  useful_clarifications: number | null;
  last_event_at: string | null;
};

type PerformanceEventRow = {
  id: string;
  agent_id: string | null;
  project_id: string | null;
  event_type: string | null;
  source: string | null;
  message: string | null;
  created_by: string | null;
  created_at: string | null;
};

const KNOWLEDGE_SELECT = `
  id,
  agent_id,
  project_id,
  title,
  content,
  knowledge_type,
  status,
  source,
  importance,
  proposed_by,
  approved_by,
  approved_at,
  created_at,
  updated_at,
  metadata,
  tags
`;

const SKILL_SELECT = `
  id,
  agent_id,
  skill_key,
  name,
  version,
  status,
  discipline,
  skill_type,
  summary,
  trigger_text,
  inputs,
  workflow,
  safety_rules,
  source,
  proposed_by,
  approved_by,
  approved_at,
  created_at,
  updated_at,
  metadata
`;

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => normalizeString(item)).filter(Boolean) : [];
}

function recordObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function knowledgeStatus(value: unknown): AgentKnowledgeStatus {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "approved" || normalized === "rejected" || normalized === "archived") return normalized;
  return "proposed";
}

function skillStatus(value: unknown): AgentSkillStatus {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "in_review" || normalized === "en_revision") return "review";
  if (["draft", "proposed", "review", "active", "observed", "rejected", "archived"].includes(normalized)) {
    return normalized as AgentSkillStatus;
  }
  return "proposed";
}

function mapKnowledge(row: AgentKnowledgeRow): AgentKnowledgeItem {
  const content = normalizeString(row.content);
  return {
    id: normalizeString(row.id),
    agentId: normalizeString(row.agent_id) || "agente",
    projectId: normalizeString(row.project_id) || null,
    title: normalizeString(row.title) || content.slice(0, 90) || "Conocimiento",
    content,
    knowledgeType: normalizeString(row.knowledge_type) || "criterion",
    status: knowledgeStatus(row.status),
    source: normalizeString(row.source) || null,
    importance: row.importance === null ? null : toNumber(row.importance),
    proposedBy: normalizeString(row.proposed_by) || null,
    approvedBy: normalizeString(row.approved_by) || null,
    approvedAt: normalizeString(row.approved_at) || null,
    createdAt: normalizeString(row.created_at) || null,
    updatedAt: normalizeString(row.updated_at) || null,
    metadata: recordObject(row.metadata),
    tags: stringArray(row.tags),
  };
}

function mapSkill(row: AgentSkillRow): AgentSkillVersion {
  const metadata = recordObject(row.metadata);
  const governanceStatus = metadata.governance_status === "approved" ? "approved" : null;
  const status = skillStatus(row.status);
  return {
    id: normalizeString(row.id),
    agentId: normalizeString(row.agent_id) || "agente",
    skillKey: normalizeString(row.skill_key) || normalizeString(row.id),
    name: normalizeString(row.name) || "Skill sin nombre",
    version: normalizeString(row.version) || "v0.1",
    status,
    effectiveStatus: status === "active" ? "active" : governanceStatus === "approved" ? "approved" : status,
    governanceStatus,
    discipline: normalizeString(row.discipline) || null,
    skillType: normalizeString(row.skill_type) || null,
    summary: normalizeString(row.summary),
    triggerText: normalizeString(row.trigger_text) || null,
    inputs: stringArray(row.inputs),
    workflow: stringArray(row.workflow),
    safetyRules: stringArray(row.safety_rules),
    source: normalizeString(row.source) || null,
    proposedBy: normalizeString(row.proposed_by) || null,
    approvedBy: normalizeString(row.approved_by) || null,
    approvedAt: normalizeString(row.approved_at) || null,
    createdAt: normalizeString(row.created_at) || null,
    updatedAt: normalizeString(row.updated_at) || null,
    metadata,
  };
}

function mapPerformance(row: AgentPerformanceRow): AgentPerformanceSummary {
  return {
    agentId: normalizeString(row.agent_id) || "agente",
    totalEvents: toNumber(row.total_events),
    answers: toNumber(row.answers),
    groundedAnswers: toNumber(row.grounded_answers),
    knowledgeProposals: toNumber(row.knowledge_proposals),
    knowledgeApproved: toNumber(row.knowledge_approved),
    skillProposals: toNumber(row.skill_proposals),
    skillApproved: toNumber(row.skill_approved),
    negativeSignals: toNumber(row.negative_signals),
    usefulClarifications: toNumber(row.useful_clarifications),
    lastEventAt: normalizeString(row.last_event_at) || null,
  };
}

export async function listAgentKnowledge(limit = 120): Promise<ListResult<AgentKnowledgeItem>> {
  const { data, error } = await supabase
    .from("agent_knowledge")
    .select(KNOWLEDGE_SELECT)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    return { rows: [], source: "unavailable", warning: "No se pudo leer agent_knowledge." };
  }

  return { rows: ((data ?? []) as AgentKnowledgeRow[]).map(mapKnowledge), source: "supabase", warning: null };
}

export async function updateAgentKnowledgeStatus(
  id: string,
  status: Exclude<AgentKnowledgeStatus, "proposed">,
  userEmail?: string | null,
): Promise<void> {
  const patch = {
    status,
    approved_by: status === "approved" ? userEmail ?? null : null,
    approved_at: status === "approved" ? new Date().toISOString() : null,
  };
  const { error } = await supabase.from("agent_knowledge").update(patch).eq("id", id);
  if (error) throw new Error("No se pudo actualizar conocimiento.");
}

export async function listAgentSkillVersions(limit = 120): Promise<ListResult<AgentSkillVersion>> {
  const { data, error } = await supabase
    .from("agent_skill_versions")
    .select(SKILL_SELECT)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    return { rows: [], source: "unavailable", warning: "No se pudo leer agent_skill_versions." };
  }

  return { rows: ((data ?? []) as AgentSkillRow[]).map(mapSkill), source: "supabase", warning: null };
}

export async function updateAgentSkillStatus(
  id: string,
  status: AgentSkillStatus,
  userEmail?: string | null,
): Promise<void> {
  const patch = {
    status,
    approved_by: status === "active" ? userEmail ?? null : null,
    approved_at: status === "active" ? new Date().toISOString() : null,
  };
  const { error } = await supabase.from("agent_skill_versions").update(patch).eq("id", id);
  if (error) throw new Error("No se pudo actualizar skill.");
}

export async function approveAgentSkillVersion(
  skill: AgentSkillVersion,
  userEmail?: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("agent_skill_versions")
    .update({
      approved_by: userEmail ?? null,
      approved_at: now,
      metadata: {
        ...skill.metadata,
        governance_status: "approved",
        governance_updated_at: now,
      },
    })
    .eq("id", skill.id);

  if (error) throw new Error("No se pudo aprobar la versión de skill.");
}

export async function activateAgentSkillVersion(
  skill: AgentSkillVersion,
  userEmail?: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("agent_skill_versions")
    .update({
      status: "active",
      approved_by: skill.approvedBy ?? userEmail ?? null,
      approved_at: skill.approvedAt ?? now,
      metadata: {
        ...skill.metadata,
        governance_status: "approved",
        activated_at: now,
      },
    })
    .eq("id", skill.id);

  if (error) throw new Error("No se pudo activar la skill.");
}

export async function listAgentPerformanceSummary(): Promise<ListResult<AgentPerformanceSummary>> {
  const { data, error } = await supabase
    .from("v_agent_performance_summary")
    .select("agent_id,total_events,answers,grounded_answers,knowledge_proposals,knowledge_approved,skill_proposals,skill_approved,negative_signals,useful_clarifications,last_event_at")
    .order("last_event_at", { ascending: false, nullsFirst: false });

  if (error) {
    return { rows: [], source: "unavailable", warning: "No se pudo leer v_agent_performance_summary." };
  }

  return { rows: ((data ?? []) as AgentPerformanceRow[]).map(mapPerformance), source: "supabase", warning: null };
}

export async function listAgentTimelineEvents(limit = 80): Promise<ListResult<AgentTimelineEvent>> {
  const warnings: string[] = [];
  const events: AgentTimelineEvent[] = [];

  const [knowledge, skills, performance] = await Promise.all([
    supabase
      .from("agent_knowledge")
      .select("id,agent_id,project_id,title,status,knowledge_type,updated_at,created_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(limit),
    supabase
      .from("agent_skill_versions")
      .select("id,agent_id,skill_key,name,version,status,updated_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(limit),
    supabase
      .from("agent_performance_events")
      .select("id,agent_id,project_id,event_type,source,message,created_by,created_at")
      .in("event_type", [
        "knowledge_proposed",
        "knowledge_approved",
        "skill_proposed",
        "skill_approved",
        "correction",
        "hallucination",
        "user_negative_signal",
        "user_positive_signal",
      ])
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(limit),
  ]);

  if (knowledge.error) warnings.push("agent_knowledge no disponible.");
  else ((knowledge.data ?? []) as Array<AgentKnowledgeRow & { updated_at: string | null }>).forEach((row) => {
    events.push({
      id: `knowledge-${row.id}`,
      type: row.status === "approved" || row.status === "rejected" ? "approval" : "knowledge",
      occurredAt: normalizeString(row.updated_at ?? row.created_at) || null,
      sourceAgentId: normalizeString(row.agent_id) || null,
      targetAgentId: null,
      summary: `${normalizeString(row.title) || "Conocimiento"} (${normalizeString(row.knowledge_type) || "tipo no registrado"})`,
      relatedEntity: normalizeString(row.project_id) || null,
      status: normalizeString(row.status) || null,
      source: "agent_knowledge",
    });
  });

  if (skills.error) warnings.push("agent_skill_versions no disponible.");
  else ((skills.data ?? []) as AgentSkillRow[]).forEach((row) => {
    events.push({
      id: `skill-${row.id}`,
      type: "skill",
      occurredAt: normalizeString(row.updated_at) || null,
      sourceAgentId: normalizeString(row.agent_id) || null,
      targetAgentId: null,
      summary: `${normalizeString(row.name) || "Skill"} ${normalizeString(row.version)}`,
      relatedEntity: normalizeString(row.skill_key) || null,
      status: normalizeString(row.status) || null,
      source: "agent_skill_versions",
    });
  });

  if (performance.error) warnings.push("agent_performance_events no disponible.");
  else ((performance.data ?? []) as PerformanceEventRow[]).forEach((row) => {
    events.push({
      id: `performance-${row.id}`,
      type: normalizeString(row.event_type).startsWith("skill_") ? "skill" : normalizeString(row.event_type).startsWith("knowledge_") ? "knowledge" : "performance",
      occurredAt: normalizeString(row.created_at) || null,
      sourceAgentId: normalizeString(row.agent_id) || null,
      targetAgentId: null,
      summary: normalizeString(row.message) || normalizeString(row.event_type) || "Evento de desempeño",
      relatedEntity: normalizeString(row.project_id) || null,
      status: normalizeString(row.event_type) || null,
      source: normalizeString(row.source) || "agent_performance_events",
    });
  });

  events.sort((a, b) => new Date(b.occurredAt ?? 0).getTime() - new Date(a.occurredAt ?? 0).getTime());

  return {
    rows: events.slice(0, limit),
    source: warnings.length === 3 ? "unavailable" : "supabase",
    warning: warnings.length ? warnings.join(" ") : null,
  };
}
