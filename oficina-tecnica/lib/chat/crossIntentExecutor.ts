// ── Ejecutor de intenciones cruzadas ─────────────────────────────────────────
//
// Toma un match del crossIntentRegistry + el alcance resuelto y produce una
// respuesta determinística (datos reales) o, si la capacidad aún no existe, una
// respuesta HONESTA con alternativas accionables (nunca inventa). Es la cola del
// pipeline: solo se invoca cuando el router estándar no resolvió nada y hay un
// alcance concreto.

import type { ResolvedScope } from "./scopeResolver";
import type { CrossIntentMatch } from "./crossIntentRegistry";
import {
  buscarRequerimientoPorCodigo,
  buscarItemsDeRequerimiento,
  DEFAULT_CONTEXT_LIMIT,
  type ContextToolResult,
} from "./contextTools";
import {
  analyzeRequirementItems,
  renderItemsAnalysis,
  queryProjectRequirements,
  queryClientProjects,
  queryProjectSummary,
  queryGlobalRequirementLog,
  queryCatalogResources,
} from "./genericTools";
import { classifyTechnicalItems } from "./technicalClassifier";
import { buildDeterministicAnswer } from "./contextDeterministic";
import { buildClarificationMessage, type ClarificationOption, type PendingClarification } from "./clarification";

export interface CrossIntentOutcome {
  deterministicAnswer?: string;
  fallbackAnswer?: string;
  results: ContextToolResult[];
  isClarification?: boolean;
  pendingClarification?: PendingClarification;
}

const DISCIPLINA_LABEL: Record<string, string> = {
  electrico: "eléctricos", mecanico: "mecánicos", civil: "civiles",
  instrumentacion: "de instrumentación", seguridad: "de seguridad", otros: "sin disciplina clara",
};

// ── Respuesta honesta para capacidades pendientes (sección 10 del spec) ──────
function pendingOptions(scope: ResolvedScope, match: CrossIntentMatch): ClarificationOption[] {
  const code = scope.projectCode ?? scope.cotizacionCode ?? scope.ocCode;
  const opts: ClarificationOption[] = [];

  if (match.family === "project_requirements" && code) {
    opts.push({ id: "1", label: `Lista los RQ del proyecto ${code}`, intent: "requerimientos_de_proyecto", source: "requerimientos", resolvedQuery: `requerimientos del proyecto ${code}`, explanation: "Requerimientos asociados (conteo exacto)." });
    opts.push({ id: "2", label: "Recursos eléctricos del catálogo", intent: "clasificar_recursos_electricos", source: "recursos", resolvedQuery: "recursos eléctricos del catálogo", explanation: "Clasifica el catálogo e identifica los eléctricos." });
    opts.push({ id: "3", label: "Abrir un RQ específico y clasificar sus ítems", intent: "items_rq", source: "requerimiento_items", notImplementedNote: "Indícame un código RQ-XXXX y clasifico/analizo sus ítems.", explanation: "Ítems de un requerimiento concreto." });
  } else if (match.family === "client_summary") {
    const client = scope.client ?? "ese cliente";
    opts.push({ id: "1", label: `Últimas cotizaciones de ${client}`, intent: "buscar_cotizaciones", source: "cotizaciones", resolvedQuery: `últimas cotizaciones de ${client}`, explanation: "Cotizaciones recientes del cliente." });
    opts.push({ id: "2", label: "Proyectos adjudicados del cliente", intent: "proyectos_adjudicados", source: "proyecto", notImplementedNote: "La búsqueda de proyectos adjudicados por cliente aún no está conectada.", explanation: "Proyectos ganados del cliente." });
    opts.push({ id: "3", label: "Cruce cliente ↔ RQ asociados", intent: "cliente_rq", source: "requerimientos", notImplementedNote: "El cruce cliente↔RQ aún no está implementado.", explanation: "Requerimientos por cliente." });
  } else {
    // global_log analítico
    opts.push({ id: "1", label: "Recursos eléctricos del catálogo", intent: "clasificar_recursos_electricos", source: "recursos", resolvedQuery: "recursos eléctricos del catálogo", explanation: "Clasifica el catálogo e identifica los eléctricos." });
    opts.push({ id: "2", label: "Requerimientos por estado (pendientes/atendidos)", intent: "buscar_requerimientos", source: "requerimientos", resolvedQuery: "requerimientos pendientes", explanation: "Filtra el log por estado." });
    opts.push({ id: "3", label: "Ranking transversal por costo / sin precio / frecuencias", intent: "global_analytics", source: "requerimientos", notImplementedNote: "El análisis transversal del log (rankings globales por costo, escaneos sin-precio, frecuencias de proveedor) aún no está conectado al contexto IA.", explanation: "Análisis global del log de requerimientos." });
  }
  return opts.slice(0, 3);
}

function pendingPreface(match: CrossIntentMatch): string {
  if (match.family === "project_requirements") {
    return "Tengo acceso a los requerimientos del proyecto y a los ítems de cada RQ por separado, pero el cruce de ítems (clasificación/precio/moneda) sobre TODOS los RQ del proyecto aún no está implementado en el contexto IA. Puedo interpretarlo así:";
  }
  if (match.family === "client_summary") {
    return "Tengo acceso a las cotizaciones, pero el cruce cliente ↔ proyectos adjudicados ↔ RQ aún no está conectado al contexto IA. Puedo interpretarlo así:";
  }
  return "Tengo acceso al log de requerimientos, pero el análisis transversal (rankings globales por costo, escaneos sin-precio, frecuencias) aún no está conectado al contexto IA. Puedo interpretarlo así:";
}

/**
 * Ejecuta un match cruzado. Devuelve null si no aplica (el caller sigue con su
 * flujo normal). Para capacidades pendientes devuelve una respuesta honesta con
 * alternativas; para implementadas, datos reales.
 */
export async function executeCrossIntent(
  cleanText: string,
  scope: ResolvedScope,
  match: CrossIntentMatch,
): Promise<CrossIntentOutcome | null> {
  // Capacidad pendiente → respuesta honesta + alternativas (no inventar).
  if (match.capability === "pending") {
    const options = pendingOptions(scope, match);
    const pending: PendingClarification = { question: pendingPreface(match), options, createdAt: new Date().toISOString() };
    return { fallbackAnswer: buildClarificationMessage(pendingPreface(match), options), isClarification: true, pendingClarification: pending, results: [] };
  }

  // ── Familia: ítems de un requerimiento concreto ────────────────────────────
  if (match.family === "requirement_items" && scope.requirementCode) {
    const rqRes = await buscarRequerimientoPorCodigo(scope.requirementCode);
    if (rqRes.status !== "success" || rqRes.records.length !== 1) {
      return { fallbackAnswer: `No encontré el requerimiento ${scope.requirementCode} en Supabase para analizar sus ítems.`, results: [rqRes] };
    }
    const rq = rqRes.records[0];
    const itemsRes = await buscarItemsDeRequerimiento(rq.id, match.options.limitItems ?? DEFAULT_CONTEXT_LIMIT, rq.codigo);
    const results: ContextToolResult[] = [rqRes, itemsRes];
    const items = itemsRes.status === "success" ? itemsRes.records : [];

    if (items.length === 0) {
      return { deterministicAnswer: `El requerimiento **${rq.codigo}** no tiene ítems registrados en Supabase.`, results };
    }

    // Clasificación técnica por disciplina.
    if (match.tool === "classifyTechnicalItems") {
      const target = match.options.classification;
      const classified = classifyTechnicalItems(items.map((it, i) => ({ codigo: `${i + 1}`, descripcion: it.descripcion })), target);
      const label = target ? DISCIPLINA_LABEL[target] : "por disciplina";
      if (classified.length === 0) {
        return { deterministicAnswer: `Clasifiqué los ${items.length} ítem(s) de **${rq.codigo}** (inferencia técnica por descripción). No encontré ítems ${label}.`, results };
      }
      const rows = classified.map((c) => `| ${c.codigo} | ${c.descripcion.replace(/\|/g, "\\|")} | ${c.subclase} | ${c.motivo.replace(/\|/g, "\\|")} |`);
      const ans = [
        `Clasifiqué los **${items.length}** ítem(s) de **${rq.codigo}** (inferencia técnica por descripción, no un campo formal de Supabase). Ítems ${label}: **${classified.length}**.`,
        "", `| # | Descripción | Subclase | Motivo |`, `| - | --- | --- | --- |`, ...rows,
      ].join("\n");
      return { deterministicAnswer: ans, results };
    }

    // Análisis económico (ranking, faltantes, monedas).
    const analysis = analyzeRequirementItems(items, match.options);
    return { deterministicAnswer: renderItemsAnalysis(rq.codigo, analysis, match.options), results };
  }

  // ── Familia: requerimientos de un proyecto/cotización/OC (con filtro estado) ─
  if (match.family === "project_requirements") {
    if (match.tool === "queryProjectSummary") {
      const result = await queryProjectSummary(match.options);
      const det = buildDeterministicAnswer(cleanText, [result]);
      return det ? { deterministicAnswer: det, results: [result] } : { fallbackAnswer: "No obtuve datos del resumen del proyecto.", results: [result] };
    }
    const g = await queryProjectRequirements(match.options);
    if (g.status !== "success") {
      return { fallbackAnswer: `No encontré requerimientos asociados a ${g.projectCode ?? "ese código"} en Supabase.`, results: [] };
    }
    const filtroNota = g.statusFilter ? ` con estado **${g.statusFilter}**` : "";
    const head = `El proyecto/cotización **${g.projectCode}** tiene **${g.total}** requerimiento(s) asociado(s) en Supabase. Muestro ${g.records.length}${filtroNota}:`;
    const rows = g.records.map((r) => `| ${r.codigo} | ${r.estado ?? "—"} | ${r.avance != null ? r.avance + "%" : "—"} | ${r.responsable ?? "—"} | ${r.fecha_requerida ?? "—"} |`);
    const ans = rows.length
      ? [head, "", `| Código | Estado | Avance | Responsable | Fecha req. |`, `| --- | --- | --- | --- | --- |`, ...rows].join("\n")
      : `El proyecto/cotización **${g.projectCode}** tiene **${g.total}** requerimiento(s), pero ninguno coincide con el filtro${filtroNota}.`;
    return { deterministicAnswer: ans, results: [] };
  }

  // ── Familias que devuelven ContextToolResult → renderer determinístico ─────
  let result: ContextToolResult | null = null;
  if (match.family === "client_summary") {
    result = await queryClientProjects(match.options);
  } else if (match.family === "global_log") {
    result = await queryGlobalRequirementLog(match.options);
  } else if (match.family === "catalog_resources") {
    result = await queryCatalogResources(match.options);
  }

  if (!result) return null;
  const det = buildDeterministicAnswer(cleanText, [result]);
  if (det) return { deterministicAnswer: det, results: [result] };
  return { fallbackAnswer: "Consulté la fuente pero no obtuve registros para mostrar. No voy a inventar datos.", results: [result] };
}
