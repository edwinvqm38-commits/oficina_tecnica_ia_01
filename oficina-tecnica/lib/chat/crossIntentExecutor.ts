import type { DatasetMemory } from "@/lib/chat/datasetMemory";
import {
  findCrossIntent,
  looksLikeUnsupportedGlobalQuery,
  type CrossIntentDefinition,
  type CrossIntentFamily,
} from "@/lib/chat/crossIntentRegistry";
import { getAgentProfile } from "@/lib/chat/agentProfiles";
import { detectQueryFeedback, recordQueryFeedback } from "@/lib/chat/queryFeedback";
import { resolveVerifiedScope, type ScopeResolution } from "@/lib/chat/scopeResolver";

export type CrossIntentPreflightStatus =
  | "continue"
  | "not_implemented"
  | "needs_clarification"
  | "system_response";

export interface CrossIntentPreflightResult {
  status: CrossIntentPreflightStatus;
  text: string;
  scope: ScopeResolution;
  family?: CrossIntentFamily;
  answer?: string;
  isValidationQuestion: boolean;
}

export interface CrossIntentExecutorOptions {
  threadKey?: string;
  agentId?: string;
  memory?: DatasetMemory;
}

function capabilityAnswer(): string {
  return [
    "En este turno no ejecuté ninguna consulta.",
    "",
    "Capacidades implementadas:",
    "- consultar cotizaciones/proyectos y sus requerimientos por código;",
    "- consultar un RQ y sus ítems;",
    "- buscar requerimientos y cotizaciones con filtros acotados;",
    "- consultar recursos y clasificar recursos eléctricos;",
    "- consultar propuestas técnicas por código.",
    "",
    "No están implementados todavía los rankings globales, análisis globales de proveedores, búsqueda global de ítems sin precio ni cruces globales entre proyectos.",
  ].join("\n");
}

function feedbackAnswer(target: string): string {
  const labels: Record<string, string> = {
    recursos: "recursos",
    requerimientos: "requerimientos",
    requerimiento: "el RQ anterior",
    proyecto: "proyecto",
    cotizacion: "cotización",
    items: "ítems",
  };
  return `Entendido: registraré en la memoria de esta sesión que te referías a **${labels[target] ?? target}**. No ejecuté una consulta con esta corrección. Indícame el código o filtro concreto y consultaré la fuente correspondiente.`;
}

function scopeRequiredButMissing(definition: CrossIntentDefinition, scope: ScopeResolution): string | null {
  if (!definition.requiredScope) return null;
  if (scope.code) return null;
  if (definition.requiredScope === "requirement") {
    return "Para consultar los ítems necesito un RQ exacto. No tengo un RQ verificado para esta referencia; indícame el código RQ-XXXX.";
  }
  return "Para consultar los requerimientos necesito un proyecto, cotización u OC exactos. No tengo un código verificado para esta referencia; indícame el código.";
}

function pendingAnswer(definition: CrossIntentDefinition, agentId?: string): string {
  const profile = getAgentProfile(agentId ?? "gg");
  return `${definition.honestResponse ?? "Esta capacidad aún no está implementada. No ejecuté una consulta ni voy a inventar resultados."}\n\nEl enfoque de ${profile.id.toUpperCase()} seguirá siendo ${profile.focus} cuando exista evidencia real para analizar.`;
}

export function executeCrossIntentPreflight(
  cleanText: string,
  options: CrossIntentExecutorOptions = {},
): CrossIntentPreflightResult {
  const memory = options.memory ?? {};
  const threadKey = options.threadKey ?? "default";
  const feedback = detectQueryFeedback(cleanText);
  const scope = resolveVerifiedScope(cleanText, memory);

  if (feedback) {
    const recorded = recordQueryFeedback(threadKey, feedback);
    return {
      status: "system_response",
      text: cleanText,
      scope,
      family: "feedback_correction",
      answer: feedbackAnswer(recorded.to),
      isValidationQuestion: scope.isValidationQuestion,
    };
  }

  const definition = findCrossIntent(scope.text);
  if (definition?.family === "capability_question") {
    return {
      status: "system_response",
      text: scope.text,
      scope,
      family: definition.family,
      answer: capabilityAnswer(),
      isValidationQuestion: scope.isValidationQuestion,
    };
  }

  // Un RQ exacto sí puede recuperar sus ítems y precios. Lo pendiente es la
  // búsqueda sin alcance/global sobre todos los ítems del sistema.
  const scopedItemsWithoutPrice = definition?.family === "items_without_price"
    && Boolean(scope.code)
    && (scope.scopeType === "requirement" || scope.scopeType === "items");

  if ((definition?.status === "pending" && !scopedItemsWithoutPrice)
      || (!definition && looksLikeUnsupportedGlobalQuery(scope.text))) {
    const pendingDefinition = definition ?? {
      family: "global_analysis",
      label: "Análisis global no implementado",
      status: "pending",
      patterns: [],
      honestResponse:
        "Ese análisis global aún no tiene una herramienta implementada que garantice revisar todos los registros. No ejecuté una consulta global ni voy a inventar un resultado. Puedo ayudarte con una consulta acotada por código o filtro.",
    } satisfies CrossIntentDefinition;
    return {
      status: "not_implemented",
      text: scope.text,
      scope,
      family: pendingDefinition.family,
      answer: pendingAnswer(pendingDefinition, options.agentId),
      isValidationQuestion: scope.isValidationQuestion,
    };
  }

  if (scopedItemsWithoutPrice) {
    return {
      status: "continue",
      text: scope.text,
      scope,
      family: "requirement_items",
      isValidationQuestion: scope.isValidationQuestion,
    };
  }

  if (scope.needsClarification) {
    return {
      status: "needs_clarification",
      text: scope.text,
      scope,
      family: definition?.family,
      answer: scope.clarification,
      isValidationQuestion: scope.isValidationQuestion,
    };
  }

  if (definition) {
    const missingScope = scopeRequiredButMissing(definition, scope);
    if (missingScope) {
      return {
        status: "needs_clarification",
        text: scope.text,
        scope,
        family: definition.family,
        answer: missingScope,
        isValidationQuestion: scope.isValidationQuestion,
      };
    }
  }

  return {
    status: "continue",
    text: scope.text,
    scope,
    family: definition?.family,
    isValidationQuestion: scope.isValidationQuestion,
  };
}
