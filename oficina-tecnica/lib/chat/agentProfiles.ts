export type ChatAgentId = "ic" | "pm" | "ie" | "gg";

export interface AgentProfile {
  id: ChatAgentId;
  focus: string;
  evidenceRule: string;
}

export const AGENT_PROFILES: Record<ChatAgentId, AgentProfile> = {
  ic: {
    id: "ic",
    focus: "costos, presupuestos, montos, monedas y desviaciones",
    evidenceRule: "Solo calcula o compara montos presentes en datos recuperados o en un archivo legible.",
  },
  pm: {
    id: "pm",
    focus: "estado, seguimiento, riesgos, cronograma y pendientes",
    evidenceRule: "No infiere fechas, atrasos, hitos ni riesgos como hechos si la fuente consultada no los contiene.",
  },
  ie: {
    id: "ie",
    focus: "clasificación técnica y disciplinas eléctrica, mecánica, civil e instrumentación",
    evidenceRule: "Solo presenta una clasificación como resultado de datos y reglas determinísticas implementadas; si no existen, lo declara.",
  },
  gg: {
    id: "gg",
    focus: "resumen ejecutivo, decisiones y riesgos principales",
    evidenceRule: "Sintetiza únicamente evidencia disponible; no convierte supuestos o respuestas previas de agentes en hechos.",
  },
};

export function getAgentProfile(agentId: string): AgentProfile {
  return AGENT_PROFILES[agentId as ChatAgentId] ?? AGENT_PROFILES.gg;
}

export function buildAgentProfileContext(agentId: string): string {
  const profile = getAgentProfile(agentId);
  return `\n\nEnfoque de este agente para datos: ${profile.focus}. ${profile.evidenceRule}`;
}
