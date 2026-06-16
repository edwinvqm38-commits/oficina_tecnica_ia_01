// ── Perfiles por agente (especialización de respuesta) ───────────────────────
//
// No todos los agentes responden igual (sección 6 del spec). Estos perfiles:
//   - documentan las prioridades de cada agente;
//   - aportan un addendum de system prompt (`buildAgentPriorityCtx`) para que el
//     LLM, cuando responde (no la vía determinística), enfoque su especialidad.
// La adaptación de las OPCIONES de aclaración por agente vive en clarification.ts.

export type AgentId = "ic" | "pm" | "ie" | "gg";

export interface AgentProfile {
  id: AgentId;
  nombre: string;
  prioridades: string[];
}

export const AGENT_PROFILES: Record<AgentId, AgentProfile> = {
  ic: {
    id: "ic",
    nombre: "Ingeniero de Costos",
    prioridades: ["costos", "precios", "moneda", "proveedor", "ranking", "partidas sin precio", "cotizaciones", "RQ"],
  },
  pm: {
    id: "pm",
    nombre: "Project Manager",
    prioridades: ["estado", "avance", "pendientes", "responsables", "riesgos", "bloqueos", "trazabilidad"],
  },
  ie: {
    id: "ie",
    nombre: "Ingeniera Eléctrica",
    prioridades: ["clasificación técnica eléctrica", "equipo/material/instrumento/consumible", "ítems dudosos", "criterio técnico inferido"],
  },
  gg: {
    id: "gg",
    nombre: "Gerencia General",
    prioridades: ["resumen ejecutivo", "decisión", "riesgo comercial", "prioridad", "acciones"],
  },
};

const PRIORITY_CTX: Record<AgentId, string> = {
  ic: `\n\nComo Ingeniero de Costos, prioriza el ángulo económico: costos, precios, moneda y proveedor; usa tablas, totales y observaciones de costo; ordena por monto cuando aplique; señala partidas sin precio. Si hay montos en PEN y USD, NO los mezcles en un solo total/ranking sin un tipo de cambio verificado: sepáralos por moneda.`,
  pm: `\n\nComo Project Manager, prioriza estado, avance, pendientes, responsables, riesgos y trazabilidad. Responde con situación → riesgo → impacto → acción. No listes de más salvo que lo pidan.`,
  ie: `\n\nComo Ingeniera Eléctrica, prioriza la clasificación técnica: diferencia equipo eléctrico, material eléctrico, instrumento de medición, consumible, dudoso y no eléctrico. Explica el criterio técnico SIN inventar campos formales; si clasificas por inferencia (no hay campo formal en Supabase), dilo explícitamente.`,
  gg: `\n\nComo Gerencia General, prioriza el resumen ejecutivo: conclusión, riesgo comercial/costo/plazo, prioridad y acciones recomendadas. No entregues tablas largas salvo que se pidan; cierra con una recomendación clara.`,
};

/** Addendum de system prompt que enfoca la respuesta del LLM según el agente. */
export function buildAgentPriorityCtx(agentId: string | null | undefined): string {
  if (!agentId) return "";
  const key = agentId.toLowerCase() as AgentId;
  return PRIORITY_CTX[key] ?? "";
}
