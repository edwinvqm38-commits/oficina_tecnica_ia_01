import type { DatasetMemory } from "@/lib/chat/datasetMemory";
import { detectDocumentCodes, detectOtherCodes } from "@/lib/chat/messageUtils";

export type ResolvedScopeType = "requirement" | "quotation" | "project" | "items" | "none";
export type ScopeResolutionSource = "explicit" | "verified_memory" | "none";

export interface ScopeResolution {
  text: string;
  scopeType: ResolvedScopeType;
  code: string | null;
  source: ScopeResolutionSource;
  isValidationQuestion: boolean;
  needsClarification: boolean;
  clarification?: string;
}

const REFERENCE_RE = /\b(este|esta|ese|esa|aquel|aquella|dich[oa]|mism[oa]|anterior(?:es)?)\b/i;
const REQUIREMENT_RE = /\b(requerimiento|rq)\b/i;
const QUOTATION_RE = /\bcotizaci[oó]n\b|\bcot\b/i;
const PROJECT_RE = /\bproyecto\b/i;
const ITEMS_RE = /\b[íi]tems?|partidas?|materiales?\b/i;
const VALIDATION_RE = /\b(es\s+(?:verdad|cierto|correcto|real)|val[ií]da(?:me|r)?|conf[ií]rma(?:me|r)?|verifica(?:r)?|comprueba|corrobora|revisa\s+si|seguro\s+que|de\s+verdad)\b/i;

function explicitCode(text: string): { code: string; scopeType: ResolvedScopeType } | null {
  const documents = detectDocumentCodes(text);
  if (documents.length > 0) {
    const last = documents[documents.length - 1];
    return {
      code: last.code,
      scopeType: last.type === "RQ" ? "requirement" : last.type === "COT" ? "quotation" : "project",
    };
  }
  const other = detectOtherCodes(text);
  return other.length > 0 ? { code: other[other.length - 1], scopeType: "project" } : null;
}

function unresolved(text: string, scopeType: ResolvedScopeType, clarification: string, isValidationQuestion: boolean): ScopeResolution {
  return {
    text,
    scopeType,
    code: null,
    source: "none",
    isValidationQuestion,
    needsClarification: true,
    clarification,
  };
}

export function resolveVerifiedScope(text: string, memory: DatasetMemory): ScopeResolution {
  const cleanText = text.trim();
  const isValidationQuestion = VALIDATION_RE.test(cleanText);
  const explicit = explicitCode(cleanText);
  if (explicit) {
    return {
      text: cleanText,
      scopeType: explicit.scopeType,
      code: explicit.code,
      source: "explicit",
      isValidationQuestion,
      needsClarification: false,
    };
  }

  const refersBack = REFERENCE_RE.test(cleanText) || isValidationQuestion;
  if (!refersBack) {
    return {
      text: cleanText,
      scopeType: "none",
      code: null,
      source: "none",
      isValidationQuestion,
      needsClarification: false,
    };
  }

  if (REQUIREMENT_RE.test(cleanText) || ITEMS_RE.test(cleanText)) {
    const code = memory.lastVerifiedRequirementCode;
    if (!code) {
      return unresolved(
        cleanText,
        ITEMS_RE.test(cleanText) ? "items" : "requirement",
        "No tengo un RQ verificado en la memoria de este hilo. Indícame el código exacto RQ-XXXX para consultarlo sin adivinar.",
        isValidationQuestion,
      );
    }
    return {
      text: `${cleanText} ${code}`,
      scopeType: ITEMS_RE.test(cleanText) ? "items" : "requirement",
      code,
      source: "verified_memory",
      isValidationQuestion,
      needsClarification: false,
    };
  }

  if (QUOTATION_RE.test(cleanText)) {
    const code = memory.lastVerifiedCotizacionCode;
    if (!code) {
      return unresolved(
        cleanText,
        "quotation",
        "No tengo una cotización verificada en la memoria de este hilo. Indícame el código COT-XXXX para consultarla sin adivinar.",
        isValidationQuestion,
      );
    }
    return {
      text: `${cleanText} ${code}`,
      scopeType: "quotation",
      code,
      source: "verified_memory",
      isValidationQuestion,
      needsClarification: false,
    };
  }

  if (PROJECT_RE.test(cleanText) || isValidationQuestion) {
    const code = memory.lastVerifiedProjectCode ?? memory.lastVerifiedCotizacionCode;
    if (!code) {
      return unresolved(
        cleanText,
        "project",
        "No tengo un proyecto o cotización verificado en la memoria de este hilo. Indícame el código exacto para volver a consultar la fuente real.",
        isValidationQuestion,
      );
    }
    const validationText = isValidationQuestion
      ? `${cleanText} requerimientos del proyecto ${code}`
      : `${cleanText} ${code}`;
    return {
      text: validationText,
      scopeType: "project",
      code,
      source: "verified_memory",
      isValidationQuestion,
      needsClarification: false,
    };
  }

  return {
    text: cleanText,
    scopeType: "none",
    code: null,
    source: "none",
    isValidationQuestion,
    needsClarification: false,
  };
}
