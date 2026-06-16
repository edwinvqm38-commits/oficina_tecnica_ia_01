// ── ScopeResolver general (resolución de alcance/referencia) ─────────────────
//
// Resuelve a QUÉ se refiere una consulta cuando usa referencias relativas
// ("este proyecto", "ese RQ", "la cotización anterior", "los ítems anteriores",
// "lo que dijo IC", "de lo anterior"). Devuelve un alcance concreto (códigos +
// dataset) tomado de la memoria VERIFICADA del hilo o de un código explícito en
// el propio texto.
//
// REGLA DE ORO (anti-alucinación): solo se usa memoria verificada desde Supabase
// / deterministicAnswer (DatasetMemory). NUNCA se usa texto libre del LLM como
// evidencia. Una fuente/código explícito en el mensaje ACTUAL siempre gana sobre
// la memoria previa (ver crossIntentRegistry: "fuente explícita gana").

import type { DatasetMemory } from "./datasetMemory";
import { detectDocumentCodes, detectOtherCodes, stripAgentLabelsForRouting } from "./messageUtils";

export type ScopeKind = "project" | "cotizacion" | "oc" | "requirement" | "client" | "global" | "none";

export interface ResolvedScope {
  kind: ScopeKind;
  projectCode?: string;
  cotizacionCode?: string;
  requirementCode?: string;
  ocCode?: string;
  client?: string;
  dataset?: DatasetMemory["lastDisplayedDataset"];
  /** Cómo se resolvió el alcance. */
  via: "explicit" | "memory" | "none";
  /** Agente referido ("lo que dijo IC") si aplica. */
  referencedAgent?: "ic" | "pm" | "ie" | "gg";
  confidence: number;
}

const DEMONSTRATIVE_RE = /\b(este|esta|estos|estas|ese|esa|esos|esas|aquel|aquella|dich[oa]s?|mism[oa]s?|anterior(?:es)?|el\s+anterior|la\s+anterior|lo\s+anterior)\b/i;
// Referencia con artículo a un sustantivo de contexto ("del RQ", "los ítems",
// "de la cotización"): cuenta como referencia a la memoria si no hay código.
const ARTICLE_NOUN_RE = /\b(?:el|del|de\s+la|la|los|las)\s+(?:rq|requerimiento|proyecto|cotizaci[oó]n|oc|[íi]tems?|partidas?)\b/i;
const PROJECT_NOUN_RE = /\bproyectos?\b/i;
const COT_NOUN_RE = /\bcotizaci[oó]n(?:es)?\b|\bcots?\b/i;
const OC_NOUN_RE = /\boc\b|\borden(?:es)?\s+de\s+compra\b/i;
const RQ_NOUN_RE = /\brequerimientos?\b|\brqs?\b/i;
const ITEMS_NOUN_RE = /\b[íi]tems?\b|\bpartidas?\b|\btabla\s+anterior\b|\blo\s+que\s+mostraste\b/i;

// "lo que dijo IC", "lo que mostró el PM", "la respuesta del IC".
const AGENT_REF_RE = /\b(?:dijo|mostr[oó]|respondi[oó]|respuesta\s+del?|seg[uú]n)\s+(?:el\s+|la\s+)?(ic|pm|ie|gg|ingenier[oa]\s+de\s+costos|project\s+manager|ingenier[oa]\s+el[eé]ctric[oa]|geren(?:te|cia)\s*(?:general)?)\b/i;

function agentFromLabel(label: string): "ic" | "pm" | "ie" | "gg" | undefined {
  const l = label.toLowerCase();
  if (l === "ic" || l.includes("costos")) return "ic";
  if (l === "pm" || l.includes("project")) return "pm";
  if (l === "ie" || l.includes("eléctric") || l.includes("electric")) return "ie";
  if (l === "gg" || l.includes("geren")) return "gg";
  return undefined;
}

/** Extrae un cliente nombrado explícitamente ("cliente NEXA", "de NEXA"). */
function detectExplicitClient(text: string): string | null {
  const m =
    text.match(/\bcliente\s+([A-ZÁÉÍÓÚÑ][A-Za-z0-9ÁÉÍÓÚÑáéíóúñ&.\-]{1,30})/) ??
    text.match(/\b(?:de|para|del\s+cliente)\s+([A-ZÁÉÍÓÚÑ]{2,}[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ&.\-]*)/);
  if (!m) return null;
  const cand = m[1].trim();
  // Evita capturar roles ("de Costos") o palabras comunes mayúsculas.
  if (/^(costos|costo|proyecto|requerimiento|cotizaci)/i.test(cand)) return null;
  return cand;
}

/**
 * Resuelve el alcance de una consulta. Prioriza códigos/cliente explícitos en el
 * mensaje; si no hay y la consulta usa una referencia relativa, recurre a la
 * memoria verificada del hilo.
 */
export function resolveScope(cleanText: string, memory: DatasetMemory = {}): ResolvedScope {
  const t = stripAgentLabelsForRouting(cleanText).trim();

  // 1) Código explícito en el mensaje actual → gana sobre la memoria.
  const docs = detectDocumentCodes(t);
  const rq = docs.find((d) => d.type === "RQ");
  const cot = docs.find((d) => d.type === "COT");
  const oc = docs.find((d) => d.type === "OC");
  const others = detectOtherCodes(t, new Set(docs.map((d) => d.code)));

  if (rq) return { kind: "requirement", requirementCode: rq.code, via: "explicit", confidence: 0.95 };
  if (cot) return { kind: "cotizacion", cotizacionCode: cot.code, via: "explicit", confidence: 0.95 };
  if (oc) return { kind: "oc", ocCode: oc.code, via: "explicit", confidence: 0.9 };
  if (others.length) return { kind: "project", projectCode: others[0], via: "explicit", confidence: 0.85 };

  const explicitClient = detectExplicitClient(t);
  if (explicitClient) return { kind: "client", client: explicitClient, via: "explicit", confidence: 0.8 };

  // 2) Referencia a un agente previo ("lo que dijo IC") → su último alcance.
  const agentRef = t.match(AGENT_REF_RE);
  const referencedAgent = agentRef ? agentFromLabel(agentRef[1]) : undefined;

  // 3) Referencia relativa → memoria verificada.
  const hasDemonstrative = DEMONSTRATIVE_RE.test(t) || ARTICLE_NOUN_RE.test(t);
  if (hasDemonstrative || referencedAgent) {
    // El sustantivo de la referencia decide qué código de memoria usar.
    if (RQ_NOUN_RE.test(t) && memory.lastVerifiedRequirementCode) {
      return { kind: "requirement", requirementCode: memory.lastVerifiedRequirementCode, via: "memory", referencedAgent, confidence: 0.7 };
    }
    if (COT_NOUN_RE.test(t) && memory.lastVerifiedCotizacionCode) {
      return { kind: "cotizacion", cotizacionCode: memory.lastVerifiedCotizacionCode, via: "memory", referencedAgent, confidence: 0.7 };
    }
    if (OC_NOUN_RE.test(t) && memory.lastVerifiedOC) {
      return { kind: "oc", ocCode: memory.lastVerifiedOC, via: "memory", referencedAgent, confidence: 0.7 };
    }
    if (PROJECT_NOUN_RE.test(t) && memory.lastVerifiedProjectCode) {
      return { kind: "project", projectCode: memory.lastVerifiedProjectCode, via: "memory", referencedAgent, confidence: 0.7 };
    }
    if (ITEMS_NOUN_RE.test(t) && memory.lastVerifiedRequirementCode) {
      return { kind: "requirement", requirementCode: memory.lastVerifiedRequirementCode, dataset: "requirement_items", via: "memory", referencedAgent, confidence: 0.65 };
    }
    // "lo anterior" / "eso" / "lo que dijo IC" sin sustantivo: el dato más
    // específico verificado (RQ > COT > proyecto > cliente).
    if (memory.lastVerifiedRequirementCode) return { kind: "requirement", requirementCode: memory.lastVerifiedRequirementCode, dataset: memory.lastDisplayedDataset, via: "memory", referencedAgent, confidence: 0.55 };
    if (memory.lastVerifiedCotizacionCode) return { kind: "cotizacion", cotizacionCode: memory.lastVerifiedCotizacionCode, via: "memory", referencedAgent, confidence: 0.55 };
    if (memory.lastVerifiedProjectCode) return { kind: "project", projectCode: memory.lastVerifiedProjectCode, via: "memory", referencedAgent, confidence: 0.55 };
    if (memory.lastVerifiedClient) return { kind: "client", client: memory.lastVerifiedClient, via: "memory", referencedAgent, confidence: 0.5 };
    if (memory.lastDisplayedDataset) return { kind: "global", dataset: memory.lastDisplayedDataset, via: "memory", referencedAgent, confidence: 0.45 };
  }

  return { kind: "none", via: "none", confidence: 0 };
}

/** True si el alcance apunta a un objetivo consultable concreto. */
export function hasConcreteScope(scope: ResolvedScope): boolean {
  return Boolean(scope.requirementCode || scope.cotizacionCode || scope.projectCode || scope.ocCode || scope.client);
}
