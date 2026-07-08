// ── Constructor del bloque de contexto real para el LLM ──────────────────────
//
// Convierte los resultados normalizados de `contextTools` en un único bloque de
// texto claro que se inyecta en el system prompt. El formato es estable y
// autoexplicativo para que cualquier modelo (incluso uno pequeño) entienda que
// son datos reales y no debe inventar fuera de ellos.

import {
  buildProjectReferencePrompt,
  moneyPrefix,
  type CotizacionSummary,
  type RequirementSummary,
  type RequirementItemSummary,
} from "@/lib/chat/contextQuery";
import type {
  ContextToolResult,
  TechnicalProposalLite,
  RecursoLite,
  QuotationDocumentLite,
} from "@/lib/chat/contextTools";
import { CONTEXT_GUARDRAIL_RULES, phraseForStatus } from "@/lib/chat/contextGuardrails";

const BLOCK_START = "--- CONTEXTO REAL CONSULTADO ---";
const BLOCK_END = "--- FIN CONTEXTO REAL CONSULTADO ---";

// Etiquetas legibles por fuente, para el encabezado de cada sección.
const SOURCE_LABELS: Record<ContextToolResult["source"], string> = {
  cotizaciones: "Supabase.cotizaciones",
  requerimientos: "Supabase.requerimientos",
  requerimiento_items: "Supabase.requerimiento_items",
  technical_proposals: "Supabase.technical_proposals",
  recursos: "Supabase.recursos",
  quotation_documents: "Supabase.quotation_documents",
  conteo: "Supabase.conteo",
  proyecto: "Supabase (cascada por código)",
};

function describeQuery(query: Record<string, unknown>): string {
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return parts.length ? parts.join(", ") : "sin filtros";
}

function renderCotizacion(c: CotizacionSummary): string {
  const bits = [`**${c.codigo}**`, `Estado: ${c.estado ?? "—"}`, `Avance: ${c.avance ?? "—"}%`];
  if (c.cliente_nombre) bits.push(`Cliente: ${c.cliente_nombre}`);
  if (c.unidad_trabajo_nombre) bits.push(`Unidad: ${c.unidad_trabajo_nombre}`);
  if (c.proyecto) bits.push(`Proyecto: ${c.proyecto}`);
  if (c.estado_propuesta) bits.push(`Estado propuesta: ${c.estado_propuesta}`);
  if (c.tipo_servicio_nombre) bits.push(`Tipo: ${c.tipo_servicio_nombre}`);
  if (c.monto != null) bits.push(`Monto: ${moneyPrefix(c.moneda_codigo)} ${c.monto.toLocaleString("es-PE")}`);
  if (c.fecha_registro) bits.push(`Fecha registro: ${c.fecha_registro}`);
  if (c.fecha_invitacion) bits.push(`Fecha invitación: ${c.fecha_invitacion}`);
  if (c.fecha_visita_tecnica) bits.push(`Visita técnica: ${c.fecha_visita_tecnica}`);
  if (c.fecha_consultas) bits.push(`Consultas: ${c.fecha_consultas}`);
  if (c.fecha_abs_consultas) bits.push(`Abs. consultas: ${c.fecha_abs_consultas}`);
  if (c.fecha_entrega) bits.push(`Fecha entrega: ${c.fecha_entrega}`);
  if (c.fecha_entregada) bits.push(`Fecha entregada: ${c.fecha_entregada}`);
  if (c.fecha_oc) bits.push(`Fecha OC: ${c.fecha_oc}`);
  if (c.solicitante) bits.push(`Solicitante: ${c.solicitante}`);
  if (c.responsable_tecnico) bits.push(`Resp: ${c.responsable_tecnico}`);
  if (c.responsable_economico) bits.push(`Resp. económico: ${c.responsable_economico}`);

  const economicRows = (c.resumen_economico ?? []).filter((row) => row.base !== 0 || row.oferta !== 0 || (row.real ?? 0) !== 0);
  if (!economicRows.length) return bits.join(" · ");

  const economicSummary = economicRows
    .map((row) => {
      const margen = row.margen_ofertado_manual ?? row.oferta - row.base;
      return `${row.tipo_recurso}: Base ${moneyPrefix(c.moneda_codigo)} ${row.base.toLocaleString("es-PE")} / Oferta ${moneyPrefix(c.moneda_codigo)} ${row.oferta.toLocaleString("es-PE")} / Margen ${moneyPrefix(c.moneda_codigo)} ${margen.toLocaleString("es-PE")}`;
    })
    .join("; ");

  return `${bits.join(" · ")}\n  Detalle económico registrado: ${economicSummary}`;
}

function renderRequerimiento(r: RequirementSummary): string {
  const bits = [`**${r.codigo}**`, `Estado: ${r.estado}`, `Avance: ${r.avance ?? "—"}%`];
  if (r.responsable) bits.push(`Responsable: ${r.responsable}`);
  if (r.cotizacion_codigo) bits.push(`Cotización: ${r.cotizacion_codigo}`);
  if (r.fecha_requerida) bits.push(`Req: ${r.fecha_requerida}`);
  return bits.join(" · ");
}

function renderItem(it: RequirementItemSummary): string {
  const moneda = it.moneda ?? "PEN";
  const bits = [`${it.descripcion}`, `${it.cantidad} ${it.unidad}`, `P.U. ${moneda} ${it.precio_unitario.toFixed(2)}`];
  if (it.estado) bits.push(`Estado: ${it.estado}`);
  if (it.proveedor_nombre) bits.push(`Proveedor: ${it.proveedor_nombre}`);
  if (it.costo_total_presupuestado != null) bits.push(`Costo: ${moneda} ${it.costo_total_presupuestado.toFixed(2)}`);
  return bits.join(" · ");
}

function renderProposal(p: TechnicalProposalLite): string {
  const bits = [`**${p.code}**`, `Cotización: ${p.cotizacion_codigo}`, `Rev: ${p.revision}`, `Estado: ${p.status}`];
  if (p.work_status) bits.push(`Avance: ${p.work_status}`);
  if (p.document_date) bits.push(`Fecha: ${p.document_date}`);
  return bits.join(" · ");
}

function renderRecurso(r: RecursoLite): string {
  const bits = [`**${r.codigo_recurso}**`, r.descripcion];
  if (r.tipo_recurso_nombre) bits.push(`Tipo: ${r.tipo_recurso_nombre}`);
  if (r.precio_unitario_ref != null) bits.push(`P.U. ref: ${r.moneda_codigo ?? "PEN"} ${r.precio_unitario_ref.toFixed(2)}`);
  if (r.proveedor_nombre) bits.push(`Proveedor: ${r.proveedor_nombre}`);
  if (r.marca_nombre) bits.push(`Marca: ${r.marca_nombre}`);
  if (r.estado) bits.push(`Estado: ${r.estado}`);
  if (r.image_url) bits.push(`Imagen disponible: ${r.image_url}`);
  return bits.join(" · ");
}

function renderQuotationDocument(d: QuotationDocumentLite): string {
  const size = d.file_size > 0 ? `${Math.round(d.file_size / 1024)} KB` : "—";
  const bits = [`**${d.original_name}**`, `Carpeta: ${d.folder_name}`, `Link: ${d.drive_file_url}`];
  if (d.requirement_code) bits.push(`RQ: ${d.requirement_code}`);
  if (d.mime_type) bits.push(`Tipo: ${d.mime_type}`);
  bits.push(`Tamaño: ${size}`);
  if (d.uploaded_at) bits.push(`Subido: ${d.uploaded_at}`);
  return bits.join(" · ");
}

// Construye el cuerpo "Registros" de una sección según la fuente.
function renderRecords(result: ContextToolResult): string {
  switch (result.source) {
    case "cotizaciones":
      return result.records.map((c, i) => `${i + 1}. ${renderCotizacion(c)}`).join("\n");
    case "requerimientos":
      return result.records.map((r, i) => `${i + 1}. ${renderRequerimiento(r)}`).join("\n");
    case "requerimiento_items":
      return result.records.map((it, i) => `${i + 1}. ${renderItem(it)}`).join("\n");
    case "technical_proposals":
      return result.records.map((p, i) => `${i + 1}. ${renderProposal(p)}`).join("\n");
    case "recursos":
      return result.records.map((r, i) => `${i + 1}. ${renderRecurso(r)}`).join("\n");
    case "quotation_documents":
      return result.records.map((d, i) => `${i + 1}. ${renderQuotationDocument(d)}`).join("\n");
    case "conteo":
      return `Conteo real: **${result.total} ${result.label}**.`;
    case "proyecto":
      // Reutiliza el formateo probado (incluye resumen histórico agregado),
      // recortando su encabezado en blanco inicial.
      return buildProjectReferencePrompt(result.code, result.reference).trim();
  }
}

// Renderiza una sección completa para un resultado de herramienta.
function renderSection(result: ContextToolResult): string {
  const label = SOURCE_LABELS[result.source];
  const lines: string[] = [];
  lines.push(`Fuente: ${label}`);
  lines.push(`Consulta aplicada: ${describeQuery(result.query)}`);

  if (result.status === "success") {
    if (result.source === "conteo") {
      lines.push(`Resultados encontrados: ${result.total}`);
      lines.push(`Agregado: ${renderRecords(result)}`);
      return lines.join("\n");
    }
    const shown = result.source === "proyecto" ? result.total : result.records.length;
    lines.push(`Resultados encontrados: ${result.total}${shown !== result.total ? ` (mostrando ${result.records.length})` : ""}`);
    const body = renderRecords(result);
    if (body) {
      lines.push("Registros:");
      lines.push(body);
    }
    // Aviso de truncado cuando hay más de lo mostrado.
    if (result.source !== "proyecto" && result.total > result.records.length) {
      lines.push(`Limitación: hay ${result.total - result.records.length} registro(s) adicionales no mostrados. Pide un filtro más específico para acotar.`);
    }
  } else {
    const phrase = phraseForStatus(result.status, "code" in result.query || "codigo" in result.query);
    lines.push(`Resultados encontrados: 0`);
    lines.push(`Estado: ${result.status}${result.message ? ` (${result.message})` : ""}`);
    if (phrase) lines.push(`Indicación al usuario: ${phrase}`);
  }

  return lines.join("\n");
}

export interface ContextPackOptions {
  /** Intención detectada por el router (para trazabilidad en el bloque). */
  intent?: string;
}

/**
 * Construye el bloque de contexto real a partir de los resultados de las
 * herramientas. Devuelve "" si no hay ningún resultado (para no inyectar ruido
 * cuando el mensaje no requería consultar datos).
 */
export function buildContextPack(results: ContextToolResult[], options: ContextPackOptions = {}): string {
  if (results.length === 0) return "";

  const sections = results.map(renderSection).filter(Boolean);
  if (sections.length === 0) return "";

  const header = [BLOCK_START];
  if (options.intent) header.push(`Intención detectada: ${options.intent}`);

  return [
    "\n\n" + header.join("\n"),
    sections.join("\n\n"),
    CONTEXT_GUARDRAIL_RULES,
    BLOCK_END,
  ].join("\n\n");
}

/** True si algún resultado trajo datos reales (status success con registros). */
export function hasRealData(results: ContextToolResult[]): boolean {
  return results.some((r) => r.status === "success" && (r.source === "conteo" || (r.source === "proyecto" ? r.total > 0 : r.records.length > 0)));
}
