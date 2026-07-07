import { supabase } from "@/lib/supabaseClient";

export type AgentPerformanceEventType =
  | "answer"
  | "supabase_grounded"
  | "knowledge_proposed"
  | "knowledge_approved"
  | "skill_proposed"
  | "skill_approved"
  | "correction"
  | "repeated_question"
  | "hallucination"
  | "clarification_needed"
  | "clarification_unnecessary"
  | "user_positive_signal"
  | "user_negative_signal";

type RecordPerformanceEventInput = {
  agentId: string;
  projectId?: string;
  conversationScope: "private" | "roundtable" | "system";
  eventType: AgentPerformanceEventType;
  scoreDelta?: number;
  source?: string;
  message?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
};

function scoreFor(eventType: AgentPerformanceEventType): number {
  switch (eventType) {
    case "supabase_grounded":
      return 2;
    case "knowledge_proposed":
    case "skill_proposed":
      return 3;
    case "knowledge_approved":
    case "skill_approved":
      return 8;
    case "user_positive_signal":
      return 4;
    case "clarification_needed":
      return 1;
    case "correction":
    case "repeated_question":
      return -2;
    case "clarification_unnecessary":
      return -1;
    case "hallucination":
    case "user_negative_signal":
      return -6;
    default:
      return 1;
  }
}

const CORRECTION_SIGNAL_RE =
  /\b(no aparece|no existe|no hay|no corresponde|esta mal|está mal|inventaste|invento|inventó|alucinaste|alucino|alucinó|no inventes|no se ve|no está en el plano|no esta en el plano|corrige|corrijan)\b/i;
const HALLUCINATION_SIGNAL_RE =
  /\b(inventaste|invento|inventó|alucinaste|alucino|alucinó|no existe|no aparece|no está en el plano|no esta en el plano|no corresponde)\b/i;

export async function recordAgentPerformanceEvent(input: RecordPerformanceEventInput): Promise<void> {
  const { error } = await supabase.from("agent_performance_events").insert({
    agent_id: input.agentId,
    project_id: input.projectId ?? null,
    conversation_scope: input.conversationScope,
    event_type: input.eventType,
    score_delta: input.scoreDelta ?? scoreFor(input.eventType),
    source: input.source ?? "chat",
    message: input.message ? input.message.slice(0, 600) : null,
    created_by: input.createdBy ?? null,
    metadata: input.metadata ?? {},
  });

  // La tabla existe despues de ejecutar supabase/sql/190_agent_skills_and_performance.sql.
  // Si aun no se ejecuto, no detenemos el chat.
  if (error && process.env.NODE_ENV !== "production") {
    console.debug("[agentPerformance] event skipped", error.message);
  }
}

export function recordAgentAnswerPerformance(input: {
  agentId: string;
  projectId?: string;
  conversationScope: "private" | "roundtable";
  userMessage: string;
  assistantResponse: string;
  modelLabel: string;
  groundedInSupabase: boolean;
  proposedKnowledge: boolean;
  createdBy?: string;
}): void {
  const baseMetadata = {
    model: input.modelLabel,
    user_message_preview: input.userMessage.slice(0, 180),
    assistant_preview: input.assistantResponse.slice(0, 180),
  };

  recordAgentPerformanceEvent({
    agentId: input.agentId,
    projectId: input.projectId,
    conversationScope: input.conversationScope,
    eventType: "answer",
    createdBy: input.createdBy,
    metadata: baseMetadata,
  }).catch(() => {});

  if (input.groundedInSupabase) {
    recordAgentPerformanceEvent({
      agentId: input.agentId,
      projectId: input.projectId,
      conversationScope: input.conversationScope,
      eventType: "supabase_grounded",
      createdBy: input.createdBy,
      metadata: baseMetadata,
    }).catch(() => {});
  }

  if (input.proposedKnowledge) {
    recordAgentPerformanceEvent({
      agentId: input.agentId,
      projectId: input.projectId,
      conversationScope: input.conversationScope,
      eventType: "knowledge_proposed",
      createdBy: input.createdBy,
      metadata: baseMetadata,
    }).catch(() => {});
  }

  if (CORRECTION_SIGNAL_RE.test(input.userMessage)) {
    recordAgentPerformanceEvent({
      agentId: input.agentId,
      projectId: input.projectId,
      conversationScope: input.conversationScope,
      eventType: "correction",
      createdBy: input.createdBy,
      message: input.userMessage,
      metadata: baseMetadata,
    }).catch(() => {});
  }

  if (HALLUCINATION_SIGNAL_RE.test(input.userMessage)) {
    recordAgentPerformanceEvent({
      agentId: input.agentId,
      projectId: input.projectId,
      conversationScope: input.conversationScope,
      eventType: "hallucination",
      createdBy: input.createdBy,
      message: input.userMessage,
      metadata: baseMetadata,
    }).catch(() => {});
  }
}
