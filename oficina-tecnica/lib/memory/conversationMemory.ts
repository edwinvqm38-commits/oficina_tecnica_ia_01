import { supabase } from "@/lib/supabaseClient";

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  agentId: string;
  projectId?: string;
  modelUsed?: string;
  complexity?: string;
};

const DEFAULT_CONVERSATION_DAYS = 5;
const DEFAULT_OPERATIONAL_MEMORY_DAYS = 60;
const DEFAULT_KNOWLEDGE_LIMIT = 8;
const LEARNING_SIGNAL_RE =
  /\b(aprende|aprendan|recuerda|recuerden|te enseño|les enseño|para la próxima|para la proxima|cuando pase|regla|criterio|estandar|estándar|en eka|en nuestra empresa|nuestro formato|asi trabajamos|así trabajamos)\b/i;
const CORRECTION_SIGNAL_RE =
  /\b(no aparece|no existe|no hay|no corresponde|esta mal|está mal|inventaste|invento|inventó|alucinaste|alucino|alucinó|no inventes|no se ve|no está en el plano|no esta en el plano|solo lo visible|corrige|corrijan)\b/i;
const PLAN_LEARNING_RE =
  /\b(plano|pdf|imagen|diagrama|unifilar|tablero|cuadro de carga|leyenda|metrado|enumerar|interpretar|símbolo|simbolo)\b/i;
const VALIDATION_SIGNAL_RE =
  /\b(valido|válido|aprobado|correcto|esta bien|está bien|quedo bien|quedó bien|funciona|me sirve|usar como base|base futura|para futuros|plantilla|guarda este criterio|guarden este criterio)\b/i;
const APP_LEARNING_RE =
  /\b(html|html-app|aplicacion|aplicación|app|simulador|calculadora|dashboard|grafica|gráfica|formula|fórmula|plantilla|diseno|diseño|interfaz|ux)\b/i;

export function buildMemoryCandidate(
  agentId: string,
  userMessage: string,
  assistantResponse: string,
  complexity: string,
  source: "private" | "roundtable",
): { content: string; memoryType: "decision" | "learning" | "context"; importance: number; proposeKnowledge: boolean } | null {
  const cleanUserMessage = userMessage.trim();
  if (cleanUserMessage.length < 40) return null;

  const isLearning = LEARNING_SIGNAL_RE.test(cleanUserMessage);
  const isCorrection = CORRECTION_SIGNAL_RE.test(cleanUserMessage);
  const isValidation = VALIDATION_SIGNAL_RE.test(cleanUserMessage);
  const memoryType = isLearning || isCorrection || isValidation ? "learning" : "context";
  const importance = isCorrection ? 5 : isLearning || isValidation ? 4 : complexity === "simple" ? 1 : 2;
  const sourceLabel = source === "private" ? "Chat privado" : "Mesa de trabajo";
  const correctionPrefix = isCorrection ? "Corrección del usuario: " : "";
  const validationPrefix = isValidation && !isCorrection ? "Validación del usuario: " : "";

  return {
    memoryType,
    importance,
    proposeKnowledge:
      isLearning ||
      (isCorrection && PLAN_LEARNING_RE.test(cleanUserMessage)) ||
      (isValidation && APP_LEARNING_RE.test(`${cleanUserMessage}\n${assistantResponse}`)),
    content: `${sourceLabel}. ${correctionPrefix}${validationPrefix}Usuario: ${cleanUserMessage.slice(0, 320)}. Enfoque/respuesta de ${agentId.toUpperCase()}: ${assistantResponse.slice(0, 420)}`,
  };
}

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
  days = DEFAULT_CONVERSATION_DAYS
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
  days = DEFAULT_OPERATIONAL_MEMORY_DAYS
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

function knowledgeTitle(content: string): string {
  return content
    .replace(/\s+/g, " ")
    .slice(0, 90)
    .trim() || "Conocimiento propuesto";
}

export async function proposeAgentKnowledge(
  agentId: string,
  content: string,
  projectId?: string,
  importance = 4,
  proposedBy?: string,
): Promise<void> {
  const payload = {
    agent_id: agentId,
    project_id: projectId ?? null,
    title: knowledgeTitle(content),
    content,
    knowledge_type: "criterion",
    status: "proposed",
    source: "agent_learning",
    importance,
    proposed_by: proposedBy ?? null,
    metadata: { created_from: "conversationMemory" },
  };
  const { error } = await supabase.from("agent_knowledge").insert(payload);
  // La tabla puede no existir hasta ejecutar supabase/sql/180_agent_memory_layers.sql.
  // No rompemos el chat por eso: la memoria operativa igual queda guardada.
  if (error && process.env.NODE_ENV !== "production") {
    console.debug("[conversationMemory] proposeAgentKnowledge skipped", error.message);
  }
}

export async function loadApprovedAgentKnowledge(
  agentId: string,
  projectId?: string,
  limit = DEFAULT_KNOWLEDGE_LIMIT,
): Promise<string[]> {
  let query = supabase
    .from("agent_knowledge")
    .select("title, content, knowledge_type, importance")
    .eq("agent_id", agentId)
    .eq("status", "approved")
    .order("importance", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (projectId) query = query.or(`project_id.is.null,project_id.eq.${projectId}`);
  else query = query.is("project_id", null);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as Array<{ title: string; content: string; knowledge_type: string; importance: number }>)
    .map((row) => `${row.title}: ${row.content}`)
    .filter(Boolean);
}

export function buildAgentMemoryPrompt(memories: string[], approvedKnowledge: string[] = []): string {
  const blocks: string[] = [];
  if (approvedKnowledge.length) {
    blocks.push(
      `Conocimiento permanente aprobado del agente (estable; úsalo como criterio operativo):\n${approvedKnowledge.map((m) => `- ${m}`).join("\n")}`,
    );
  }
  if (memories.length) {
    blocks.push(
      `Memoria operativa temporal del agente (ultimos ${DEFAULT_OPERATIONAL_MEMORY_DAYS} dias; usala como contexto, no la repitas literal):\n${memories.map((m) => `- ${m}`).join("\n")}`,
    );
  }
  if (!blocks.length) return "";
  return `\n\n${blocks.join("\n\n")}`;
}
