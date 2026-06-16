// ── Flujo global de aclaración inteligente (anti-alucinación) ────────────────
//
// Cuando una consulta de datos es ambigua o de baja confianza (no queda clara la
// intención NI la fuente), NO llamamos al LLM ni adivinamos una tabla: ofrecemos
// hasta 3 interpretaciones accionables y dejamos que el usuario elija. Si luego
// responde "1" / "opción 1" / "la de recursos", resolvemos esa opción y
// ejecutamos la consulta correcta — sin mandar "1" al modelo.
//
// REGLAS (ver spec):
//   - Fuente explícita ("tabla requerimientos", "catálogo de recursos",
//     "requerimiento_items") tiene prioridad: si está, NO se pregunta.
//   - Un código explícito (RQ-/COT-/proyecto) hace la consulta inequívoca: tampoco
//     se pregunta.
//   - Solo se pregunta cuando hay ≥2 interpretaciones concretas que ofrecer.
//   - Las opciones cuya fuente/cruce no está implementado NO inventan: devuelven
//     una nota honesta ("esa fuente aún no está conectada al contexto IA").

import type { DatasetMemory } from "./datasetMemory";
import {
  detectDocumentCodes,
  detectOtherCodes,
  wantsElectricalClassification,
  stripAgentLabelsForRouting,
} from "./messageUtils";

export type ClarificationTopic = "electrical" | "latest_entity" | "previous_answer" | "dates" | "guides";

export type ClarificationSource =
  | "requerimiento_items"
  | "recursos"
  | "requerimientos"
  | "cotizaciones"
  | "proyecto"
  | "documentos"
  | "not_implemented";

export interface ClarificationOption {
  id: string; // "1" | "2" | "3"
  label: string;
  intent: string;
  source: ClarificationSource;
  /** Reformulación natural que el router resuelve de forma determinística (si es ejecutable). */
  resolvedQuery?: string;
  /** True → al resolver, re-verificar contra Supabase (no usar respuestas previas como verdad). */
  validation?: boolean;
  /** Si la fuente/cruce no está implementado: nota honesta en vez de inventar datos. */
  notImplementedNote?: string;
  explanation: string;
}

export interface PendingClarification {
  question: string;
  options: ClarificationOption[];
  createdAt: string;
  agent?: string;
  topic?: ClarificationTopic;
}

export interface ClarificationDecision {
  ask: boolean;
  options: ClarificationOption[];
  question: string;
  topic?: ClarificationTopic;
}

const NO_ASK: ClarificationDecision = { ask: false, options: [], question: "" };

// ── Fuente explícita (prioridad sobre la memoria y sobre la aclaración) ───────
const EXPLICIT_REQ_ITEMS_RE = /\brequerimiento_items\b|[íi]tems?\s+del?\s+(?:rq|requerimiento)\b|partidas?\s+del?\s+requerimiento\b/i;
const EXPLICIT_REQ_RE = /\btabla\s+requerimientos\b|\blog\s+de\s+requerimientos\b/i;
const EXPLICIT_RECURSOS_RE = /\bcat[aá]logo\s+de\s+recursos\b|\btabla\s+recursos\b|\brecursos\s+registrados\b|\bdel\s+cat[aá]logo\b/i;
const EXPLICIT_COT_RE = /\btabla\s+cotizaciones\b|\blog\s+de\s+cotizaciones\b/i;

/**
 * Detecta cuando el usuario nombra explícitamente la fuente que quiere usar. En
 * ese caso NO se pregunta: la fuente explícita actual gana sobre cualquier
 * ambigüedad o memoria previa.
 */
export function detectExplicitSource(cleanText: string): ClarificationSource | null {
  const t = cleanText.toLowerCase();
  if (EXPLICIT_REQ_ITEMS_RE.test(t)) return "requerimiento_items";
  if (EXPLICIT_REQ_RE.test(t)) return "requerimientos";
  if (EXPLICIT_RECURSOS_RE.test(t)) return "recursos";
  if (EXPLICIT_COT_RE.test(t)) return "cotizaciones";
  return null;
}

// ── Señales de ambigüedad por tópico ─────────────────────────────────────────
const ELECTRIC_RE = /\bel[eé]ctric[oa]s?\b/i;
// Señales de que "eléctrico" se refiere a datos/catálogo (no a una pregunta
// normativa/técnica como "qué protecciones eléctricas aplican en 22kV").
const PRICE_RE = /\bm[aá]s\s+car[oa]s?\b|\bm[aá]s\s+barat[oa]s?\b|\bcost[oa]s?\b|\bprecios?\b|\bvalor(?:es|izad)\b/i;
const DATA_NOUN_RE = /\b[íi]tems?\b|\bpartidas?\b|\bmateriales?\b|\bequipos?\b|\brecursos?\b/i;
const PREVIOUS_RE = /\blo\s+anterior\b|\besa\s+tabla\b|\blo\s+que\s+mostraste\b|\brespuestas?\s+anteriores?\b|\bqu[eé]\s+(?:opinas|piensas|dices)\b/i;
const DATES_RE = /\bfechas?\b/i;
const GUIDES_RE = /\bgu[ií]as?\b/i;
// "Tiene fechas?", "hay guías?", "incluye fechas?" — seguimiento vago de campo.
const FIELD_FOLLOWUP_RE = /\b(tiene[ns]?|tienes|hay|incluye[ns]?|existen?)\b/i;

/** True para preguntas vagas de campo ("tiene fechas?") — no para frases largas. */
function isVagueFieldQuestion(t: string, nounRe: RegExp): boolean {
  if (!nounRe.test(t)) return false;
  // Con signo de interrogación: pregunta breve ("¿tiene fechas?").
  if (/[?¿]/.test(t)) return t.length < 60;
  // Sin "?": solo un seguimiento muy corto ("tiene fechas") — nunca una frase larga.
  return FIELD_FOLLOWUP_RE.test(t) && t.length < 30;
}
const RECENT_RE = /\b(últim[oa]s?|reci[eé]n(?:temente)?|recientes?|lo\s+último)\b/i;
const REQ_NOUN_RE = /\brequerimientos?\b|\brqs?\b/i;
const COT_NOUN_RE = /\bcotizaci[oó]n(?:es)?\b|\bcots?\b/i;
const RECURSO_NOUN_RE = /\brecursos?\b|\bcat[aá]logo\b/i;

/** Extrae una entidad propia ("lo último de NEXA" → "NEXA") para los enunciados. */
function extractEntity(text: string): string | null {
  const m = text.match(/\b(?:de|sobre|para|del\s+cliente)\s+([A-ZÁÉÍÓÚÑ][A-Za-z0-9ÁÉÍÓÚÑáéíóúñ&.\- ]{1,30})/);
  if (!m) return null;
  return m[1].trim().replace(/\s+(?:y|con|que|para|en|los|las)\b.*$/i, "").trim() || null;
}

// ── Constructores de opciones por tópico ─────────────────────────────────────

// Opciones eléctricas CONTEXTUALES: si la memoria tiene un RQ o proyecto
// verificado, la opción 1 se adapta a ese alcance ("ítems eléctricos del RQ
// anterior" / "del proyecto anterior"). La opción de catálogo siempre existe.
function electricalOptions(memory: DatasetMemory): ClarificationOption[] {
  const rqCode = memory.lastVerifiedRequirementCode;
  const projCode = memory.lastVerifiedProjectCode ?? memory.lastVerifiedCotizacionCode;

  const catalogOpt: ClarificationOption = {
    id: "0",
    label: "Recursos eléctricos del catálogo",
    intent: "clasificar_recursos_electricos",
    source: "recursos",
    resolvedQuery: "recursos eléctricos del catálogo",
    explanation: "Clasifica el catálogo de recursos (Supabase) e identifica los eléctricos.",
  };

  const opts: ClarificationOption[] = [];
  if (rqCode) {
    opts.push({
      id: "0", label: `Ítems eléctricos del RQ anterior (${rqCode})`,
      intent: "items_electricos_rq", source: "requerimiento_items",
      resolvedQuery: rqCode,
      explanation: "Trae los ítems del último requerimiento consultado y marca los eléctricos.",
    });
    opts.push(catalogOpt);
    opts.push({
      id: "0", label: "Ítems eléctricos de todo el log de requerimientos",
      intent: "items_electricos_log", source: "requerimientos",
      notImplementedNote: "El cruce de ítems eléctricos sobre todo el log de requerimientos aún no está conectado al contexto IA.",
      explanation: "Buscaría ítems eléctricos en todos los requerimientos.",
    });
  } else if (projCode) {
    opts.push({
      id: "0", label: `Ítems eléctricos del proyecto anterior (${projCode})`,
      intent: "items_electricos_proyecto", source: "requerimientos",
      notImplementedNote: "El cruce de ítems eléctricos por proyecto aún no está conectado al contexto IA.",
      explanation: "Buscaría ítems eléctricos en los RQ de ese proyecto.",
    });
    opts.push({
      id: "0", label: `RQ del proyecto ${projCode} que contienen ítems eléctricos`,
      intent: "rq_con_items_electricos", source: "requerimientos",
      notImplementedNote: "Filtrar RQ por el tipo de sus ítems aún no está implementado en el contexto IA.",
      explanation: "Listaría los RQ del proyecto con ítems eléctricos.",
    });
    opts.push(catalogOpt);
  } else {
    opts.push({
      id: "0", label: "Ítems eléctricos en requerimiento_items",
      intent: "items_electricos_requerimientos", source: "requerimiento_items",
      notImplementedNote: "El cruce de ítems eléctricos sobre todo el log de requerimientos aún no está conectado al contexto IA. Si me das un código RQ-XXXX, reviso los ítems de ese requerimiento.",
      explanation: "Usa los ítems reales del log de requerimientos.",
    });
    opts.push(catalogOpt);
    opts.push({
      id: "0", label: "Requerimientos que tengan ítems eléctricos",
      intent: "requerimientos_con_items_electricos", source: "requerimientos",
      notImplementedNote: "Filtrar requerimientos por el tipo de sus ítems (eléctrico) aún no está implementado en el contexto IA.",
      explanation: "Busca requerimientos cuyos ítems sean eléctricos.",
    });
  }
  return opts.slice(0, 3).map((o, i) => ({ ...o, id: `${i + 1}` }));
}

function latestEntityOptions(entity: string): ClarificationOption[] {
  return [
    {
      id: "1",
      label: `Últimas cotizaciones de ${entity}`,
      intent: "buscar_cotizaciones",
      source: "cotizaciones",
      resolvedQuery: `últimas cotizaciones de ${entity}`,
      explanation: "Cotizaciones recientes asociadas a ese cliente/proyecto.",
    },
    {
      id: "2",
      label: `Últimos proyectos adjudicados de ${entity}`,
      intent: "proyectos_adjudicados",
      source: "proyecto",
      notImplementedNote:
        "La búsqueda de proyectos adjudicados por cliente aún no está conectada al contexto IA.",
      explanation: "Proyectos ganados/adjudicados de ese cliente.",
    },
    {
      id: "3",
      label: `Últimos requerimientos asociados a ${entity}`,
      intent: "buscar_requerimientos",
      source: "requerimientos",
      resolvedQuery: `últimos requerimientos de ${entity}`,
      explanation: "Requerimientos recientes relacionados con ese cliente/proyecto.",
    },
  ];
}

function previousAnswerOptions(memory: DatasetMemory): ClarificationOption[] {
  const rqCode = memory.lastVerifiedRequirementCode;
  const projCode = memory.lastVerifiedProjectCode ?? memory.lastVerifiedCotizacionCode;
  const hasRecursos = memory.lastDisplayedDataset === "recursos";
  const opts: ClarificationOption[] = [];

  if (rqCode) {
    opts.push({
      id: `${opts.length + 1}`,
      label: `Validar la última respuesta sobre ${rqCode}`,
      intent: "consulta_por_codigo",
      source: "requerimientos",
      resolvedQuery: rqCode,
      validation: true,
      explanation: "Re-verifica el requerimiento (existencia, ítems, estado/avance) en Supabase.",
    });
  }
  if (projCode) {
    opts.push({
      id: `${opts.length + 1}`,
      label: `Validar el último proyecto/cotización (${projCode})`,
      intent: "requerimientos_de_proyecto",
      source: "requerimientos",
      resolvedQuery: `requerimientos del proyecto ${projCode}`,
      validation: true,
      explanation: "Re-verifica el conteo de requerimientos del proyecto/cotización en Supabase.",
    });
  }
  if (hasRecursos) {
    opts.push({
      id: `${opts.length + 1}`,
      label: "Revisar los recursos que se mostraron antes",
      intent: "clasificar_recursos_electricos",
      source: "recursos",
      resolvedQuery: "recursos eléctricos del catálogo",
      explanation: "Clasifica el catálogo de recursos mostrado y muestra solo los eléctricos.",
    });
  }
  return opts.slice(0, 3);
}

function datesOptions(memory: DatasetMemory): ClarificationOption[] {
  const rqCode = memory.lastVerifiedRequirementCode;
  return [
    {
      id: "1",
      label: "Fechas del requerimiento",
      intent: "consulta_por_codigo",
      source: "requerimientos",
      ...(rqCode
        ? { resolvedQuery: `${rqCode} fecha` }
        : {
            notImplementedNote:
              "Para darte las fechas del requerimiento necesito un código exacto (RQ-XXXX). Indícamelo y lo consulto.",
          }),
      explanation: "Fecha requerida/estado del requerimiento en Supabase.",
    },
    {
      id: "2",
      label: "Fechas por ítem",
      intent: "fechas_por_item",
      source: "requerimiento_items",
      notImplementedNote: "La tabla `requerimiento_items` no tiene un campo de fecha por ítem.",
      explanation: "Fechas a nivel de cada ítem del requerimiento.",
    },
    {
      id: "3",
      label: "Fechas de documentos/logística",
      intent: "fechas_logistica",
      source: "documentos",
      notImplementedNote: "No hay una fuente de logística/documentos conectada al contexto IA.",
      explanation: "Fechas de despacho/entrega si la fuente existiera.",
    },
  ];
}

function guidesOptions(memory: DatasetMemory): ClarificationOption[] {
  const rqCode = memory.lastVerifiedRequirementCode;
  return [
    {
      id: "1",
      label: "Guías de remisión",
      intent: "guias_remision",
      source: "documentos",
      notImplementedNote: "Las guías de remisión/despacho no están conectadas al contexto IA.",
      explanation: "Buscar guías de remisión si la fuente estuviera implementada.",
    },
    {
      id: "2",
      label: "Columnas del requerimiento",
      intent: "consulta_por_codigo",
      source: "requerimientos",
      ...(rqCode
        ? { resolvedQuery: rqCode }
        : {
            notImplementedNote:
              "Para revisar las columnas del requerimiento necesito un código exacto (RQ-XXXX).",
          }),
      explanation: "Revisar los campos disponibles del requerimiento en Supabase.",
    },
    {
      id: "3",
      label: "Documentos/adjuntos relacionados",
      intent: "documentos_relacionados",
      source: "documentos",
      notImplementedNote: "No hay una fuente de documentos/adjuntos conectada al contexto IA.",
      explanation: "Documentos relacionados si la fuente existiera.",
    },
  ];
}

// ── Decisión: ¿debemos pedir aclaración? ──────────────────────────────────────

/**
 * Decide si la consulta es ambigua/baja confianza y, de serlo, arma hasta 3
 * interpretaciones accionables. Devuelve `ask:false` cuando la consulta es
 * inequívoca (código o fuente explícita) o cuando no hay ≥2 interpretaciones.
 */
export function shouldAskClarification(cleanText: string, memory: DatasetMemory): ClarificationDecision {
  // Quita prefijos de rol ("Ingeniero de Costos ...") para no confundir la
  // detección de entidad/fuente con el nombre del agente.
  const t = stripAgentLabelsForRouting(cleanText).trim();
  if (!t) return NO_ASK;

  // Un código explícito hace la consulta inequívoca.
  if (detectDocumentCodes(t).length > 0 || detectOtherCodes(t).length > 0) return NO_ASK;
  // Fuente explícita: prioridad, no se pregunta.
  if (detectExplicitSource(t)) return NO_ASK;

  const hadRecursos = memory.lastDisplayedDataset === "recursos";

  // (1) Eléctrico sin fuente clara, PERO solo cuando se trata de una consulta de
  // datos (precio/ítems/partidas) — no de una pregunta normativa/técnica
  // ("qué protecciones eléctricas aplican"). Si el sistema YA sabe clasificar
  // esto de forma determinística (seguimiento sobre recursos / "del catálogo"),
  // tampoco preguntamos: lo resuelve el clasificador.
  const electricalDataQuery = ELECTRIC_RE.test(t) && (PRICE_RE.test(t) || DATA_NOUN_RE.test(t));
  if (electricalDataQuery && !wantsElectricalClassification(t, hadRecursos)) {
    const options = electricalOptions(memory);
    return {
      ask: true,
      options,
      topic: "electrical",
      question:
        "No estoy completamente seguro de la fuente que deseas usar para los eléctricos. Puedo interpretarlo de estas formas:",
    };
  }

  // (2) "Lo último de <Entidad>" sin nombrar tabla → cotizaciones/proyectos/req.
  if (RECENT_RE.test(t) && !REQ_NOUN_RE.test(t) && !COT_NOUN_RE.test(t) && !RECURSO_NOUN_RE.test(t)) {
    const entity = extractEntity(t);
    if (entity) {
      const options = latestEntityOptions(entity);
      return {
        ask: true,
        options,
        topic: "latest_entity",
        question: `No estoy seguro de qué "${entity}" deseas. Puedo interpretarlo de estas formas:`,
      };
    }
  }

  // (3) "Qué opinas de lo anterior" / "esas respuestas" sin referencia clara.
  if (PREVIOUS_RE.test(t)) {
    const options = previousAnswerOptions(memory);
    if (options.length >= 2) {
      return {
        ask: true,
        options,
        topic: "previous_answer",
        question:
          "No tengo claro a qué respuesta/registro previo te refieres. Puedo revisar/validar contra Supabase:",
      };
    }
  }

  // (4) "Tiene fechas?" sin RQ/proyecto claro (seguimiento vago, no frase larga).
  if (isVagueFieldQuestion(t, DATES_RE) && !GUIDES_RE.test(t)) {
    const options = datesOptions(memory);
    return {
      ask: true,
      options,
      topic: "dates",
      question: "No tengo claro qué fechas necesitas. Puedo interpretarlo de estas formas:",
    };
  }

  // (5) "Tiene guías?" — fuente no implementada, pero ofrecemos interpretaciones.
  if (isVagueFieldQuestion(t, GUIDES_RE)) {
    const options = guidesOptions(memory);
    return {
      ask: true,
      options,
      topic: "guides",
      question: "No tengo una fuente de guías conectada. Puedo interpretarlo de estas formas:",
    };
  }

  return NO_ASK;
}

// ── Resolución de la opción elegida ──────────────────────────────────────────
const ORDINAL: Record<string, string> = {
  primera: "1", primero: "1", segunda: "2", segundo: "2", tercera: "3", tercero: "3",
};

/**
 * Interpreta la respuesta del usuario ("1", "opción 1", "la primera",
 * "la de recursos") como una de las opciones pendientes. Devuelve null si la
 * respuesta no es una elección (entonces el flujo normal sigue su curso).
 */
export function resolveClarificationChoice(
  userReply: string,
  pending: PendingClarification,
): ClarificationOption | null {
  const t = userReply.trim().toLowerCase();
  if (!t || t.length > 40) return null;

  // "1", "opción 1", "usa la 1", "la 1", "elijo la 2"
  const numM = t.match(/^(?:opci[oó]n\s*|usa\s+la\s*|la\s*|elijo\s+la\s*|quiero\s+la\s*|dame\s+la\s*)?([1-3])\b/);
  if (numM) return pending.options.find((o) => o.id === numM[1]) ?? null;

  // "la primera/segunda/tercera"
  const ordM = t.match(/\b(primera|primero|segunda|segundo|tercera|tercero)\b/);
  if (ordM) {
    const id = ORDINAL[ordM[1]];
    return pending.options.find((o) => o.id === id) ?? null;
  }

  // "la de requerimientos/recursos/proyecto/cotizaciones/catálogo/items"
  const ofM = t.match(/\bla\s+de\s+(?:los?\s+|las?\s+)?([a-záéíóúñ_]+)/);
  if (ofM) {
    const k = ofM[1];
    const synonyms: Record<string, ClarificationSource> = {
      requerimientos: "requerimientos", requerimiento: "requerimientos", rq: "requerimientos",
      recursos: "recursos", recurso: "recursos", catalogo: "recursos", catálogo: "recursos",
      cotizaciones: "cotizaciones", cotizacion: "cotizaciones", cotización: "cotizaciones",
      proyecto: "proyecto", proyectos: "proyecto",
      items: "requerimiento_items", ítems: "requerimiento_items", partidas: "requerimiento_items",
    };
    const wantedSource = synonyms[k];
    const found = pending.options.find(
      (o) => (wantedSource && o.source === wantedSource) || o.label.toLowerCase().includes(k),
    );
    if (found) return found;
  }

  return null;
}

// ── Render del mensaje estándar de aclaración (tabla GFM, fuente datos/Sistema) ─
const DASH = "—";
function cell(v: string): string {
  return (v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim() || DASH;
}

const SOURCE_LABEL: Record<ClarificationSource, string> = {
  requerimiento_items: "requerimiento_items",
  requerimientos: "requerimientos",
  recursos: "recursos (catálogo)",
  cotizaciones: "cotizaciones",
  proyecto: "proyectos",
  documentos: "documentos/logística",
  not_implemented: "(no implementada)",
};

/** Tabla Markdown uniforme con las interpretaciones. Sale como `datos/Sistema`. */
export function buildClarificationMessage(question: string, options: ClarificationOption[]): string {
  const header = "| Opción | Interpretación | Fuente | Qué haré |";
  const sep = "| ------ | -------------- | ------ | -------- |";
  const rows = options.map((o) => {
    const note = o.notImplementedNote ? ` (${o.notImplementedNote.split(".")[0]})` : "";
    return `| ${cell(o.id)} | ${cell(o.label)} | ${cell(SOURCE_LABEL[o.source])} | ${cell(o.explanation + note)} |`;
  });
  const ids = options.map((o) => o.id).join(", ");
  return `${question}\n\n${[header, sep, ...rows].join("\n")}\n\nResponde con ${ids}, o reformula la consulta.`;
}
