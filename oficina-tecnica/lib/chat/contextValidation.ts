// ── Post-validación anti-alucinación de respuestas del LLM ───────────────────
//
// Última red de seguridad para los casos en que el LLM SÍ se usa con contexto
// real: antes de mostrar su respuesta, comprobamos que no haya inventado datos
// que no estén sustentados por los `records` recuperados de Supabase.
//
// Señales que bloquean la respuesta:
//   - códigos RQ/COT/OC/FOR que no aparecen en el contexto,
//   - clientes/empresas tipo placeholder ("Client A", "Cliente 1", "Empresa B"),
//   - montos (S/, USD, $) que no coinciden con ningún monto recuperado,
//   - fechas que no aparecen en el contexto.
//
// Conservador a propósito: ante la duda NO bloquea (para no romper respuestas
// válidas), pero sí corta los patrones claramente fabricados de las pruebas.

import type { ContextToolResult } from "@/lib/chat/contextTools";

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  /** Lista de valores sospechosos detectados (para debug). */
  violations: string[];
}

// ── Extracción de valores permitidos desde los records reales ────────────────
interface AllowedValues {
  codes: Set<string>;
  amounts: number[];
  dates: Set<string>;
}

function addCode(set: Set<string>, code: string | null | undefined) {
  if (code && code.trim()) set.add(code.trim().toUpperCase());
}
function addDate(set: Set<string>, d: string | null | undefined) {
  if (!d) return;
  const iso = d.trim().slice(0, 10);
  set.add(iso);
  // dd/mm/yyyy equivalente para comparar contra lo que escriba el modelo.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) set.add(`${m[3]}/${m[2]}/${m[1]}`);
}

function collectAllowed(results: ContextToolResult[]): AllowedValues {
  const codes = new Set<string>();
  const amounts: number[] = [];
  const dates = new Set<string>();

  for (const r of results) {
    switch (r.source) {
      case "cotizaciones":
        for (const c of r.records) {
          addCode(codes, c.codigo); addCode(codes, c.oc);
          if (c.monto != null) amounts.push(c.monto);
          if (c.avance != null) amounts.push(c.avance);
          addDate(dates, c.created_at);
        }
        break;
      case "requerimientos":
        for (const rq of r.records) {
          addCode(codes, rq.codigo); addCode(codes, rq.cotizacion_codigo);
          if (rq.avance != null) amounts.push(rq.avance);
          addDate(dates, rq.fecha_requerida); addDate(dates, rq.created_at);
        }
        break;
      case "requerimiento_items":
        for (const it of r.records) {
          if (it.precio_unitario) amounts.push(it.precio_unitario);
          if (it.costo_total_presupuestado != null) amounts.push(it.costo_total_presupuestado);
          if (it.precio_unitario && it.cantidad) amounts.push(it.precio_unitario * it.cantidad);
        }
        if (r.requerimientoCodigo) addCode(codes, r.requerimientoCodigo);
        break;
      case "technical_proposals":
        for (const p of r.records) { addCode(codes, p.code); addCode(codes, p.cotizacion_codigo); addDate(dates, p.document_date); }
        break;
      case "recursos":
        for (const rc of r.records) { addCode(codes, rc.codigo_recurso); if (rc.precio_unitario_ref != null) amounts.push(rc.precio_unitario_ref); }
        break;
      case "proyecto": {
        addCode(codes, r.code);
        const ref = r.reference;
        if (ref.cotizacion) { addCode(codes, ref.cotizacion.codigo); if (ref.cotizacion.monto != null) amounts.push(ref.cotizacion.monto); }
        for (const rq of ref.requirements ?? []) { addCode(codes, rq.codigo); addDate(dates, rq.fecha_requerida); }
        if (ref.historicalSummary) {
          amounts.push(ref.historicalSummary.total, ref.historicalSummary.totalCosto);
          for (const rq of ref.historicalSummary.sample) addCode(codes, rq.codigo);
        }
        break;
      }
    }
  }
  return { codes, amounts, dates };
}

// ── Detectores en la respuesta del LLM ───────────────────────────────────────
const CODE_RE = /\b(?:RQ|COT|OC|FOR)[-A-Z0-9_./]*\d[-A-Z0-9_./]*/gi;
// Clientes/empresas placeholder: "Client A", "Cliente 1", "Empresa B", "Client_2".
const PLACEHOLDER_CLIENT_RE = /\b(?:client|cliente|empresa|proveedor)[\s_-]*([a-d]|[0-9]{1,2})\b/gi;
// Montos con símbolo de moneda.
const MONEY_RE = /(?:S\/\.?|US\$|USD|\$|€)\s?\d[\d.,]*/gi;
// Fechas dd/mm/yyyy o yyyy-mm-dd.
const DATE_RE = /\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\b/g;

function parseMoney(raw: string): number | null {
  const digits = raw.replace(/[^\d.,]/g, "");
  if (!digits) return null;
  // Normaliza separadores: el último separador de 1-2 dígitos finales es decimal.
  let normalized = digits;
  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");
  const decSep = Math.max(lastComma, lastDot);
  if (decSep !== -1 && digits.length - decSep <= 3 && digits.length - decSep >= 2) {
    normalized = digits.slice(0, decSep).replace(/[.,]/g, "") + "." + digits.slice(decSep + 1);
  } else {
    normalized = digits.replace(/[.,]/g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function codeSupported(code: string, allowed: Set<string>): boolean {
  const c = code.toUpperCase();
  for (const a of allowed) {
    if (a === c || a.includes(c) || c.includes(a)) return true;
  }
  return false;
}

function amountSupported(value: number, allowed: number[]): boolean {
  // Tolerancia del 1% (o 1 unidad) para reformateos/redondeos legítimos.
  return allowed.some((a) => Math.abs(a - value) <= Math.max(1, Math.abs(a) * 0.01));
}

/**
 * Valida la respuesta del LLM contra los datos reales recuperados.
 * Conservador: solo marca violaciones inequívocas (códigos/montos/fechas
 * inexistentes o clientes placeholder).
 */
export function validateLlmAnswer(answer: string, results: ContextToolResult[]): ValidationResult {
  const violations: string[] = [];
  const allowed = collectAllowed(results);

  // 1) Clientes/empresas placeholder: siempre sospechosos.
  for (const m of answer.matchAll(PLACEHOLDER_CLIENT_RE)) violations.push(`cliente placeholder: "${m[0].trim()}"`);

  // 2) Códigos no sustentados por el contexto.
  for (const m of answer.matchAll(CODE_RE)) {
    const code = m[0];
    if (!codeSupported(code, allowed.codes)) violations.push(`código no sustentado: "${code}"`);
  }

  // 3) Montos no sustentados (solo si el contexto trae algún monto: si no hay
  //    ninguno y la respuesta inventa cifras, también se marca).
  for (const m of answer.matchAll(MONEY_RE)) {
    const value = parseMoney(m[0]);
    if (value == null) continue;
    if (!amountSupported(value, allowed.amounts)) violations.push(`monto no sustentado: "${m[0].trim()}"`);
  }

  // 4) Fechas no sustentadas (solo si el contexto trae alguna fecha: evita
  //    falsos positivos con fechas conversacionales cuando no consultamos fechas).
  if (allowed.dates.size > 0) {
    for (const m of answer.matchAll(DATE_RE)) {
      if (!allowed.dates.has(m[0])) violations.push(`fecha no sustentada: "${m[0]}"`);
    }
  }

  if (violations.length === 0) return { ok: true, violations };
  return { ok: false, reason: "La respuesta contenía datos no sustentados por el contexto recuperado.", violations };
}

/** Mensaje seguro cuando se bloquea una respuesta del LLM por alucinación. */
export function buildBlockedAnswer(safeContent: string | null): string {
  const head = "La respuesta generada contenía datos no sustentados por el contexto recuperado, por lo que fue bloqueada.";
  if (safeContent && safeContent.trim()) {
    return `${head}\n\nCon los datos reales disponibles puedo indicar lo siguiente:\n\n${safeContent.trim()}`;
  }
  return `${head} No encontré datos reales suficientes para responder con seguridad; indícame un código exacto o un filtro para volver a consultar.`;
}
