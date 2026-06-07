#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_DIR = "tmp_imports";
const DEFAULT_BATCH_ID = "IMPORT-2026-001";
const DRY_RUN_DIR_NAME = "dry_run";
const IMPORT_SOURCE = "historical_excel";
const ALLOWED_QUALITY_STATUS = new Set(["OK", "OBSERVADO", "COMPLETAR_DATOS", "CRITICO_REVISAR"]);

const REQUIRED_FILES = {
  cotizaciones: "enriched_preview_cotizaciones.csv",
  requerimientos: "enriched_preview_requerimientos.csv",
  detalleRq: "enriched_preview_detalle_rq.csv",
  enrichedSummary: "enriched_import_summary.json",
  validationIssues: "validation_issues.csv",
  compatibilityReport: "historical_import_compatibility_report.json",
};

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;

    const [rawKey, inlineValue] = current.slice(2).split("=");
    const key = rawKey.trim();
    const nextValue = inlineValue ?? argv[index + 1];
    const value = inlineValue ?? (nextValue && !nextValue.startsWith("--") ? nextValue : true);
    args[key] = value;

    if (inlineValue === undefined && value !== true) {
      index += 1;
    }
  }

  return args;
}

function printUsage() {
  console.log(`
Uso:
  npm run dry-run:historical-import -- --dir "tmp_imports" --batch-id "IMPORT-2026-001"

Opciones:
  --dir              Carpeta local con archivos enriched. Default: "${DEFAULT_DIR}".
  --batch-id         Lote a simular. Default: "${DEFAULT_BATCH_ID}".
  --check-supabase   Habilita chequeos opcionales solo por SELECT.
  --help             Muestra esta ayuda.
`);
}

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u00a0/g, " ").trim();
}

function parseBoolean(value) {
  return normalizeString(value).toLowerCase() === "true";
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value)
    .trim()
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readCsvRows(filePath) {
  const workbook = XLSX.readFile(filePath, { raw: true });
  const sheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: true,
  });
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function csvEscape(value) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function writeCsv(filePath, columns, rows) {
  const lines = [
    columns.map(csvEscape).join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column] ?? "")).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function summarizeByStatus(rows) {
  const counts = {
    OK: 0,
    OBSERVADO: 0,
    COMPLETAR_DATOS: 0,
    CRITICO_REVISAR: 0,
  };

  for (const row of rows) {
    const status = normalizeString(row.data_quality_status);
    if (counts[status] !== undefined) {
      counts[status] += 1;
    }
  }

  return counts;
}

function addConflict(conflicts, issue) {
  conflicts.push(issue);
}

function addPlannedIssue(plannedIssues, issue) {
  plannedIssues.push(issue);
}

function buildHistoricalImportMetadata(row, entityType, overrides = {}) {
  const sourceRowNumber = parseNumber(row.source_row_number);
  const sourceItem = overrides.source_item;
  return {
    historical_import: {
      import_batch_id: overrides.import_batch_id ?? normalizeString(row.import_batch_id),
      import_source: overrides.import_source ?? IMPORT_SOURCE,
      source_row_number: sourceRowNumber,
      historical_cotizacion_key: normalizeString(row.historical_cotizacion_key),
      historical_rq_key: normalizeString(row.historical_rq_key),
      historical_rq_code_suggested: normalizeString(row.historical_rq_code_suggested),
      data_quality_status: normalizeString(row.data_quality_status),
      data_quality_label: normalizeString(row.data_quality_label),
      data_quality_color: normalizeString(row.data_quality_color),
      data_quality_notes: normalizeString(row.data_quality_notes),
      data_quality_issues_count: parseNumber(row.data_quality_issues_count) ?? 0,
      data_quality_has_critical: parseBoolean(row.data_quality_has_critical),
      data_quality_has_warning: parseBoolean(row.data_quality_has_warning),
      entity_type: entityType,
      ...(sourceItem ? { source_item: sourceItem } : {}),
    },
  };
}

function buildHistoricalItemSource(row) {
  return {
    tipo_recurso: normalizeString(row.tipo_recurso),
    codigo_fabricante: normalizeString(row.codigo_fabricante),
    descripcion: normalizeString(row.descripcion),
    a_suministrar: normalizeString(row.recurso_a_suministrar),
    unidad: normalizeString(row.unidad),
    cantidad: parseNumber(row.cantidad),
    ajuste: parseNumber(row.ajuste),
    atencion_real: parseNumber(row.atencion_real),
    cant_stock: parseNumber(row.cant_stock),
    compra: parseNumber(row.compra),
    precio_unitario: parseNumber(row.precio_unitario),
    costo_unitario_dolar: parseNumber(row.costo_unitario_dolar) ?? null,
    costo_unitario_soles: parseNumber(row.precio_unitario),
    tipo_cambio: parseNumber(row.tc) ?? null,
    costo_total_presupuestado: parseNumber(row.costo_total_presupuestado),
    costo_total_presupuestado_usd: parseNumber(row.costo_total_presupuestado_usd) ?? null,
    moneda: normalizeString(row.moneda),
    observaciones_item: normalizeString(row.observaciones_item),
  };
}

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function runSupabaseChecks({
  client,
  batchId,
  cotizacionesRows,
  requerimientosRows,
  conflicts,
  warnings,
}) {
  const result = {
    attempted: true,
    completed: false,
    warnings,
  };

  if (!client) {
    warnings.push("No se encontro configuracion segura de Supabase. Se continuo en modo local.");
    return result;
  }

  try {
    const { count: batchCount, error: batchError } = await client
      .from("historical_import_batches")
      .select("id", { count: "exact", head: true })
      .eq("import_batch_id", batchId);

    if (batchError) {
      warnings.push("No se pudo verificar import_batch_id en Supabase. Se omitio el chequeo remoto.");
    } else if ((batchCount ?? 0) > 0) {
      addConflict(conflicts, {
        severity: "critical",
        conflict_type: "import_batch_id_ya_existe",
        entity_type: "historical_import_batches",
        entity_key: batchId,
        message: `El import_batch_id ${batchId} ya existe en historical_import_batches.`,
      });
    }

    const cotizacionCodigos = [...new Set(cotizacionesRows.map((row) => normalizeString(row.codigo)).filter(Boolean))];
    for (const chunk of chunkArray(cotizacionCodigos, 200)) {
      const { data, error } = await client.from("cotizaciones").select("codigo").in("codigo", chunk);
      if (error) {
        warnings.push("No se pudo verificar codigos de cotizaciones en Supabase. Se omitio ese chequeo remoto.");
        break;
      }

      for (const row of data ?? []) {
        addConflict(conflicts, {
          severity: "critical",
          conflict_type: "cotizacion_codigo_ya_existe",
          entity_type: "cotizaciones",
          entity_key: normalizeString(row.codigo),
          message: `La cotizacion ${normalizeString(row.codigo)} ya existe en Supabase.`,
        });
      }
    }

    const requerimientoCodigos = [
      ...new Set(requerimientosRows.map((row) => normalizeString(row.codigo_para_importacion_simulado)).filter(Boolean)),
    ];
    for (const chunk of chunkArray(requerimientoCodigos, 200)) {
      const { data, error } = await client.from("requerimientos").select("codigo").in("codigo", chunk);
      if (error) {
        warnings.push("No se pudo verificar codigos de requerimientos en Supabase. Se omitio ese chequeo remoto.");
        break;
      }

      for (const row of data ?? []) {
        addConflict(conflicts, {
          severity: "critical",
          conflict_type: "requerimiento_codigo_ya_existe",
          entity_type: "requerimientos",
          entity_key: normalizeString(row.codigo),
          message: `El requerimiento ${normalizeString(row.codigo)} ya existe en Supabase.`,
        });
      }
    }

    result.completed = true;
    return result;
  } catch (error) {
    warnings.push(
      `El chequeo remoto de Supabase fallo y se continuo en modo local: ${error instanceof Error ? error.message : "error desconocido"}.`
    );
    return result;
  }
}

function buildReadinessStatus({ compatibilityIssues, criticalConflicts, summaryByStatus }) {
  if (compatibilityIssues > 0) return "BLOCKED_BY_COMPATIBILITY";
  if (criticalConflicts > 0) return "BLOCKED_BY_CONFLICTS";
  if (
    summaryByStatus.requerimientos.CRITICO_REVISAR > 0 ||
    summaryByStatus.requerimientos.COMPLETAR_DATOS > 0 ||
    summaryByStatus.detalle_rq.CRITICO_REVISAR > 0 ||
    summaryByStatus.detalle_rq.COMPLETAR_DATOS > 0 ||
    summaryByStatus.cotizaciones.OBSERVADO > 0
  ) {
    return "READY_WITH_OBSERVATIONS";
  }
  return "READY_FOR_REVIEW";
}

function buildRecommendation(readinessStatus) {
  if (readinessStatus === "BLOCKED_BY_COMPATIBILITY") {
    return "El dry-run queda bloqueado por incompatibilidades estructurales. Corrige el pipeline enriched antes de cualquier carga observada.";
  }
  if (readinessStatus === "BLOCKED_BY_CONFLICTS") {
    return "El dry-run detecto conflictos que deben resolverse antes de una carga observada. No conviene avanzar a Fase 7 todavia.";
  }
  if (readinessStatus === "READY_WITH_OBSERVATIONS") {
    return "El lote puede pasar a revision funcional para una futura carga observada, manteniendo los registros observados y criticos en cola de revision.";
  }
  return "El lote esta listo para revision final previa a una carga observada controlada.";
}

function mainSyncGuard(requiredFiles) {
  for (const [label, fileName] of Object.entries(requiredFiles)) {
    const fullPath = path.resolve(fileName.baseDir ?? "", fileName.path ?? "");
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Falta archivo requerido para ${label}: ${fullPath}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const dir = typeof args.dir === "string" ? args.dir : DEFAULT_DIR;
  const batchId = typeof args["batch-id"] === "string" ? args["batch-id"] : DEFAULT_BATCH_ID;
  const shouldCheckSupabase = args["check-supabase"] === true;
  const baseDir = path.resolve(dir);
  const dryRunDir = path.join(baseDir, DRY_RUN_DIR_NAME);

  mainSyncGuard({
    cotizaciones: { baseDir, path: REQUIRED_FILES.cotizaciones },
    requerimientos: { baseDir, path: REQUIRED_FILES.requerimientos },
    detalleRq: { baseDir, path: REQUIRED_FILES.detalleRq },
    enrichedSummary: { baseDir, path: REQUIRED_FILES.enrichedSummary },
  });

  const cotizaciones = readCsvRows(path.join(baseDir, REQUIRED_FILES.cotizaciones));
  const requerimientos = readCsvRows(path.join(baseDir, REQUIRED_FILES.requerimientos));
  const detalleRq = readCsvRows(path.join(baseDir, REQUIRED_FILES.detalleRq));
  const enrichedSummary = readJsonIfExists(path.join(baseDir, REQUIRED_FILES.enrichedSummary)) ?? {};
  const validationIssues = fs.existsSync(path.join(baseDir, REQUIRED_FILES.validationIssues))
    ? readCsvRows(path.join(baseDir, REQUIRED_FILES.validationIssues))
    : [];
  const compatibilityReport = readJsonIfExists(path.join(baseDir, REQUIRED_FILES.compatibilityReport));

  ensureDir(dryRunDir);

  const conflicts = [];
  const plannedIssues = [];
  const compatibilityIssues = Number(compatibilityReport?.totalIssues ?? 0);
  if (compatibilityReport && compatibilityIssues > 0) {
    addConflict(conflicts, {
      severity: "critical",
      conflict_type: "compatibility_report_with_issues",
      entity_type: "batch",
      entity_key: batchId,
      message: `El compatibility report indica ${compatibilityIssues} issues.`,
    });
  }

  for (const row of [...cotizaciones, ...requerimientos, ...detalleRq]) {
    const status = normalizeString(row.data_quality_status);
    if (!ALLOWED_QUALITY_STATUS.has(status)) {
      addConflict(conflicts, {
        severity: "critical",
        conflict_type: "data_quality_status_invalido",
        entity_type: "batch",
        entity_key: normalizeString(row.historical_rq_key) || normalizeString(row.historical_cotizacion_key),
        message: `data_quality_status invalido: ${status || "(vacio)"}.`,
      });
    }
  }

  const cotizacionesByKey = new Map();
  const cotizacionesByCodigo = new Map();
  for (const row of cotizaciones) {
    const key = normalizeString(row.historical_cotizacion_key);
    const codigo = normalizeString(row.codigo);

    if (!key) {
      addConflict(conflicts, {
        severity: "critical",
        conflict_type: "cotizacion_key_sin_cotizacion_preview",
        entity_type: "cotizaciones",
        entity_key: codigo || "(sin_codigo)",
        message: "La cotizacion no tiene historical_cotizacion_key.",
      });
      continue;
    }

    const keyList = cotizacionesByKey.get(key) ?? [];
    keyList.push(row);
    cotizacionesByKey.set(key, keyList);

    if (codigo) {
      const codeList = cotizacionesByCodigo.get(codigo) ?? [];
      codeList.push(row);
      cotizacionesByCodigo.set(codigo, codeList);
    }
  }

  for (const [key, rows] of cotizacionesByKey.entries()) {
    if (rows.length > 1) {
      addConflict(conflicts, {
        severity: "critical",
        conflict_type: "historical_cotizacion_key_duplicado",
        entity_type: "cotizaciones",
        entity_key: key,
        message: `historical_cotizacion_key repetido ${rows.length} veces.`,
      });
    }
  }

  for (const [codigo, rows] of cotizacionesByCodigo.entries()) {
    if (rows.length > 1) {
      addConflict(conflicts, {
        severity: "critical",
        conflict_type: "cotizacion_codigo_duplicado_en_preview",
        entity_type: "cotizaciones",
        entity_key: codigo,
        message: `codigo de cotizacion repetido ${rows.length} veces en preview.`,
      });
    }
  }

  const requerimientosByKey = new Map();
  const requerimientosByCotizacionAndCodigo = new Map();
  for (const row of requerimientos) {
    const rqKey = normalizeString(row.historical_rq_key);
    const cotKey = normalizeString(row.historical_cotizacion_key);
    const codigoOriginal = normalizeString(row.codigo);

    if (!rqKey) {
      addConflict(conflicts, {
        severity: "critical",
        conflict_type: "historical_rq_key_duplicado",
        entity_type: "requerimientos",
        entity_key: "(sin_rq_key)",
        message: "El requerimiento no tiene historical_rq_key.",
      });
      continue;
    }

    const keyList = requerimientosByKey.get(rqKey) ?? [];
    keyList.push(row);
    requerimientosByKey.set(rqKey, keyList);

    if (cotKey && codigoOriginal) {
      const compound = `${cotKey}||${codigoOriginal}`;
      const list = requerimientosByCotizacionAndCodigo.get(compound) ?? [];
      list.push(row);
      requerimientosByCotizacionAndCodigo.set(compound, list);
    }

    if (cotKey && !cotizacionesByKey.has(cotKey)) {
      addConflict(conflicts, {
        severity: "critical",
        conflict_type: "cotizacion_key_sin_cotizacion_preview",
        entity_type: "requerimientos",
        entity_key: rqKey,
        message: `El requerimiento referencia cotizacion ${cotKey} que no existe en preview_cotizaciones.`,
      });
    }
  }

  for (const [rqKey, rows] of requerimientosByKey.entries()) {
    if (rows.length > 1) {
      addConflict(conflicts, {
        severity: "critical",
        conflict_type: "historical_rq_key_duplicado",
        entity_type: "requerimientos",
        entity_key: rqKey,
        message: `historical_rq_key repetido ${rows.length} veces.`,
      });
    }
  }

  for (const [compoundKey, rows] of requerimientosByCotizacionAndCodigo.entries()) {
    if (rows.length > 1) {
      addConflict(conflicts, {
        severity: "critical",
        conflict_type: "codigo_rq_duplicado_en_misma_cotizacion",
        entity_type: "requerimientos",
        entity_key: compoundKey,
        message: `codigo RQ duplicado ${rows.length} veces dentro de la misma cotizacion.`,
      });
    }
  }

  const detalleByRqKey = new Map();
  for (const row of detalleRq) {
    const rqKey = normalizeString(row.historical_rq_key);
    const cotKey = normalizeString(row.historical_cotizacion_key);
    const sourceRowNumber = normalizeString(row.source_row_number);

    if (!rqKey) {
      addConflict(conflicts, {
        severity: "critical",
        conflict_type: "detalle_sin_rq_key",
        entity_type: "detalle_rq",
        entity_key: sourceRowNumber || "(sin_source_row_number)",
        message: "El detalle no tiene historical_rq_key.",
      });
      continue;
    }

    const rqList = detalleByRqKey.get(rqKey) ?? [];
    rqList.push(row);
    detalleByRqKey.set(rqKey, rqList);

    if (!requerimientosByKey.has(rqKey)) {
      addConflict(conflicts, {
        severity: "critical",
        conflict_type: "detalle_rq_key_sin_requerimiento_preview",
        entity_type: "detalle_rq",
        entity_key: rqKey,
        message: `El detalle referencia historical_rq_key ${rqKey} sin requerimiento preview asociado.`,
      });
    }

    if (cotKey && !cotizacionesByKey.has(cotKey)) {
      addConflict(conflicts, {
        severity: "critical",
        conflict_type: "cotizacion_key_sin_cotizacion_preview",
        entity_type: "detalle_rq",
        entity_key: rqKey,
        message: `El detalle referencia cotizacion ${cotKey} que no existe en preview_cotizaciones.`,
      });
    }
  }

  const supabaseWarnings = [];
  if (shouldCheckSupabase) {
    const cotizacionesForSupabase = cotizaciones.map((row) => ({
      codigo: normalizeString(row.codigo),
    }));
    const requerimientosForSupabase = requerimientos.map((row) => ({
      codigo_para_importacion_simulado:
        normalizeString(row.codigo) || normalizeString(row.historical_rq_code_suggested),
    }));

    await runSupabaseChecks({
      client: createSupabaseClient(),
      batchId,
      cotizacionesRows: cotizacionesForSupabase,
      requerimientosRows: requerimientosForSupabase,
      conflicts,
      warnings: supabaseWarnings,
    });
  }

  const validationIssuesByEntity = new Map();
  for (const issue of validationIssues) {
    const entityType = normalizeString(issue.entity_type);
    const entityKey = normalizeString(issue.entity_key);
    const mapKey = `${entityType}::${entityKey}`;
    const list = validationIssuesByEntity.get(mapKey) ?? [];
    list.push(issue);
    validationIssuesByEntity.set(mapKey, list);
  }

  const plannedCotizaciones = cotizaciones.map((row) => {
    const entityKey = normalizeString(row.historical_cotizacion_key);
    const rowConflicts = conflicts.filter(
      (conflict) => conflict.entity_type === "cotizaciones" && normalizeString(conflict.entity_key) === entityKey
    );
    const hasCriticalConflict = rowConflicts.some((conflict) => conflict.severity === "critical");
    const metadata = buildHistoricalImportMetadata(
      { ...row, import_batch_id: batchId, import_source: IMPORT_SOURCE },
      "cotizacion"
    );

    let actionPlanned = "insert_planned";
    if (hasCriticalConflict) actionPlanned = "skip_conflict";
    else if (normalizeString(row.data_quality_status) === "CRITICO_REVISAR") actionPlanned = "review_required";

    return {
      action_planned: actionPlanned,
      target_table: "public.cotizaciones",
      historical_cotizacion_key: entityKey,
      codigo: normalizeString(row.codigo),
      cliente_nombre: normalizeString(row.cliente),
      proyecto: "",
      unidad_trabajo_nombre: normalizeString(row.unidad_trabajo),
      oc: normalizeString(row.oc),
      moneda_codigo: normalizeString(row.moneda_cotizacion),
      estado: normalizeString(row.estado),
      estado_propuesta: normalizeString(row.estado_propuesta),
      fecha_registro: normalizeString(row.fecha_registro),
      fecha_entrega: "",
      monto: normalizeString(row.monto),
      data_quality_status: normalizeString(row.data_quality_status),
      data_quality_label: normalizeString(row.data_quality_label),
      data_quality_color: normalizeString(row.data_quality_color),
      data_quality_notes: normalizeString(row.data_quality_notes),
      metadata_historical_import_json: JSON.stringify(metadata),
      conflict_status: hasCriticalConflict ? "critical_conflict" : rowConflicts.length > 0 ? "warning_conflict" : "none",
      conflict_notes: rowConflicts.map((conflict) => conflict.conflict_type).join("; "),
    };
  });

  const plannedRequerimientos = requerimientos.map((row) => {
    const entityKey = normalizeString(row.historical_rq_key);
    const rowConflicts = conflicts.filter(
      (conflict) => conflict.entity_type === "requerimientos" && normalizeString(conflict.entity_key) === entityKey
    );
    const hasCriticalConflict = rowConflicts.some((conflict) => conflict.severity === "critical");
    const simulatedCode = normalizeString(row.codigo) || normalizeString(row.historical_rq_code_suggested);
    const metadata = buildHistoricalImportMetadata(
      { ...row, import_batch_id: batchId, import_source: IMPORT_SOURCE },
      "requerimiento"
    );
    const issueList =
      validationIssuesByEntity.get(`requerimiento::${entityKey}`) ??
      validationIssuesByEntity.get(`requerimientos::${entityKey}`) ??
      [];

    let actionPlanned = "insert_planned";
    if (hasCriticalConflict) actionPlanned = "skip_conflict";
    else if (normalizeString(row.data_quality_status) === "CRITICO_REVISAR") actionPlanned = "review_required";

    return {
      action_planned: actionPlanned,
      target_table: "public.requerimientos",
      historical_cotizacion_key: normalizeString(row.historical_cotizacion_key),
      historical_rq_key: entityKey,
      codigo_original: normalizeString(row.codigo),
      historical_rq_code_suggested: normalizeString(row.historical_rq_code_suggested),
      codigo_para_importacion_simulado: simulatedCode,
      cotizacion_codigo: normalizeString(row.cotizacion_codigo),
      proyecto_servicio: "",
      oc: normalizeString(row.oc),
      solicitante_rq: normalizeString(row.solicitante_rq),
      responsable: "",
      estado: normalizeString(row.estado_rq),
      fecha_solicitud: normalizeString(row.fecha_solicitud),
      fecha_requerida: "",
      total_rq: normalizeString(row.items_totales),
      data_quality_status: normalizeString(row.data_quality_status),
      data_quality_label: normalizeString(row.data_quality_label),
      data_quality_color: normalizeString(row.data_quality_color),
      data_quality_notes:
        normalizeString(row.data_quality_notes) ||
        issueList.map((issue) => normalizeString(issue.issue_type)).filter(Boolean).join("; "),
      metadata_historical_import_json: JSON.stringify(metadata),
      conflict_status: hasCriticalConflict ? "critical_conflict" : rowConflicts.length > 0 ? "warning_conflict" : "none",
      conflict_notes: rowConflicts.map((conflict) => conflict.conflict_type).join("; "),
    };
  });

  const plannedDetalle = detalleRq.map((row) => {
    const entityKey = `${normalizeString(row.historical_rq_key)}::${normalizeString(row.source_row_number)}`;
    const rowConflicts = conflicts.filter(
      (conflict) =>
        conflict.entity_type === "detalle_rq" &&
        (normalizeString(conflict.entity_key) === normalizeString(row.historical_rq_key) ||
          normalizeString(conflict.entity_key) === normalizeString(row.source_row_number))
    );
    const hasCriticalConflict = rowConflicts.some((conflict) => conflict.severity === "critical");
    const cantidad = parseNumber(row.cantidad);
    const precioUnitario = parseNumber(row.precio_unitario);
    const subtotal =
      cantidad !== null && precioUnitario !== null && Number.isFinite(cantidad) && Number.isFinite(precioUnitario)
        ? Number((cantidad * precioUnitario).toFixed(2))
        : "";
    const metadata = buildHistoricalImportMetadata(
      { ...row, import_batch_id: batchId, import_source: IMPORT_SOURCE },
      "requerimiento_item",
      { source_item: buildHistoricalItemSource(row) }
    );

    let actionPlanned = "insert_planned";
    if (hasCriticalConflict) actionPlanned = "skip_conflict";
    else if (
      normalizeString(row.data_quality_status) === "CRITICO_REVISAR" ||
      cantidad === null ||
      cantidad <= 0
    ) {
      actionPlanned = "review_required";
    }

    return {
      action_planned: actionPlanned,
      target_table: "public.requerimiento_items",
      historical_cotizacion_key: normalizeString(row.historical_cotizacion_key),
      historical_rq_key: normalizeString(row.historical_rq_key),
      source_row_number: normalizeString(row.source_row_number),
      tipo_recurso: normalizeString(row.tipo_recurso),
      codigo_fabricante: normalizeString(row.codigo_fabricante),
      descripcion: normalizeString(row.descripcion),
      unidad: normalizeString(row.unidad),
      recurso_a_suministrar: normalizeString(row.recurso_a_suministrar),
      informacion_adicional: "",
      cantidad: normalizeString(row.cantidad),
      ajuste: normalizeString(row.ajuste),
      atencion_real: normalizeString(row.atencion_real),
      cant_stock: normalizeString(row.cant_stock),
      compra: normalizeString(row.compra),
      precio_unitario: normalizeString(row.precio_unitario),
      subtotal: subtotal === "" ? "" : String(subtotal),
      costo_total_presupuestado: normalizeString(row.costo_total_presupuestado),
      moneda_codigo: normalizeString(row.moneda),
      tc: normalizeString(row.tc),
      estado: normalizeString(row.estado),
      proveedor_nombre: normalizeString(row.proveedor),
      observaciones_item: normalizeString(row.observaciones_item),
      data_quality_status: normalizeString(row.data_quality_status),
      data_quality_label: normalizeString(row.data_quality_label),
      data_quality_color: normalizeString(row.data_quality_color),
      data_quality_notes: normalizeString(row.data_quality_notes),
      metadata_historical_import_json: JSON.stringify(metadata),
      conflict_status: hasCriticalConflict ? "critical_conflict" : rowConflicts.length > 0 ? "warning_conflict" : "none",
      conflict_notes: rowConflicts.map((conflict) => conflict.conflict_type).join("; "),
      _entity_key: entityKey,
    };
  });

  for (const issue of validationIssues) {
    const entityType = normalizeString(issue.entity_type) || "unknown";
    const entityKey = normalizeString(issue.entity_key);
    const sourceRowNumber = normalizeString(issue.source_row_number);
    addPlannedIssue(plannedIssues, {
      import_batch_id: batchId,
      entity_type: entityType,
      entity_key: entityKey,
      issue_type: normalizeString(issue.issue_type),
      severity: normalizeString(issue.severity),
      message: normalizeString(issue.message),
      source_row_number: sourceRowNumber,
      field_name: normalizeString(issue.field_name),
      raw_value: normalizeString(issue.raw_value),
      suggested_action: normalizeString(issue.suggested_action),
      metadata_json: JSON.stringify({
        historical_import: {
          import_batch_id: batchId,
          import_source: IMPORT_SOURCE,
          source_row_number: parseNumber(sourceRowNumber),
          entity_type: entityType,
        },
      }),
    });
  }

  const combinedStatusCounts = {
    OK:
      (enrichedSummary?.count_by_data_quality_status?.cotizaciones?.OK ?? 0) +
      (enrichedSummary?.count_by_data_quality_status?.requerimientos?.OK ?? 0) +
      (enrichedSummary?.count_by_data_quality_status?.detalle_rq?.OK ?? 0),
    OBSERVADO:
      (enrichedSummary?.count_by_data_quality_status?.cotizaciones?.OBSERVADO ?? 0) +
      (enrichedSummary?.count_by_data_quality_status?.requerimientos?.OBSERVADO ?? 0) +
      (enrichedSummary?.count_by_data_quality_status?.detalle_rq?.OBSERVADO ?? 0),
    COMPLETAR_DATOS:
      (enrichedSummary?.count_by_data_quality_status?.cotizaciones?.COMPLETAR_DATOS ?? 0) +
      (enrichedSummary?.count_by_data_quality_status?.requerimientos?.COMPLETAR_DATOS ?? 0) +
      (enrichedSummary?.count_by_data_quality_status?.detalle_rq?.COMPLETAR_DATOS ?? 0),
    CRITICO_REVISAR:
      (enrichedSummary?.count_by_data_quality_status?.cotizaciones?.CRITICO_REVISAR ?? 0) +
      (enrichedSummary?.count_by_data_quality_status?.requerimientos?.CRITICO_REVISAR ?? 0) +
      (enrichedSummary?.count_by_data_quality_status?.detalle_rq?.CRITICO_REVISAR ?? 0),
  };

  const plannedImportBatch = {
    import_batch_id: batchId,
    source_file_name: "",
    status: "dry_run_prepared",
    total_cotizaciones: cotizaciones.length,
    total_requerimientos: requerimientos.length,
    total_detalle_rq: detalleRq.length,
    total_ok: combinedStatusCounts.OK,
    total_observado: combinedStatusCounts.OBSERVADO,
    total_completar_datos: combinedStatusCounts.COMPLETAR_DATOS,
    total_critico_revisar: combinedStatusCounts.CRITICO_REVISAR,
    metadata: {
      historical_import: {
        import_batch_id: batchId,
        import_source: IMPORT_SOURCE,
        dry_run: true,
        compatibility_total_issues: compatibilityIssues,
        supabase_check_enabled: shouldCheckSupabase,
        supabase_check_warnings: supabaseWarnings,
      },
    },
  };

  const conflictsByType = Object.fromEntries(
    [...conflicts.reduce((map, conflict) => {
      const key = normalizeString(conflict.conflict_type);
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map()).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
  );

  const summaryByStatus = {
    cotizaciones: summarizeByStatus(cotizaciones),
    requerimientos: summarizeByStatus(requerimientos),
    detalle_rq: summarizeByStatus(detalleRq),
  };

  const criticalConflicts = conflicts.filter((conflict) => conflict.severity === "critical").length;
  const readinessStatus = buildReadinessStatus({
    compatibilityIssues,
    criticalConflicts,
    summaryByStatus,
  });

  const dryRunSummary = {
    import_batch_id: batchId,
    generated_at: new Date().toISOString(),
    mode: shouldCheckSupabase ? "local_with_supabase_check" : "local",
    total_cotizaciones: cotizaciones.length,
    total_requerimientos: requerimientos.length,
    total_detalle_rq: detalleRq.length,
    count_by_data_quality_status: combinedStatusCounts,
    count_by_entity_and_quality_status: summaryByStatus,
    total_planned_cotizaciones: plannedCotizaciones.length,
    total_planned_requerimientos: plannedRequerimientos.length,
    total_planned_detalle_rq: plannedDetalle.length,
    total_planned_import_issues: plannedIssues.length,
    total_conflicts: conflicts.length,
    conflicts_by_type: conflictsByType,
    readiness_status: readinessStatus,
    recommendation: buildRecommendation(readinessStatus),
    supabase_check_warnings: supabaseWarnings,
  };

  const reportLines = [
    "# Dry Run de Importacion Historica Observada",
    "",
    `- Lote: \`${batchId}\``,
    `- Modo: \`${dryRunSummary.mode}\``,
    `- Generado: \`${dryRunSummary.generated_at}\``,
    "",
    "**Resumen del lote**",
    `- Cotizaciones: ${cotizaciones.length}`,
    `- Requerimientos: ${requerimientos.length}`,
    `- Detalle RQ: ${detalleRq.length}`,
    `- Planned import issues: ${plannedIssues.length}`,
    `- Conflictos: ${conflicts.length}`,
    "",
    "**Calidad de datos**",
    `- OK: ${combinedStatusCounts.OK}`,
    `- OBSERVADO: ${combinedStatusCounts.OBSERVADO}`,
    `- COMPLETAR_DATOS: ${combinedStatusCounts.COMPLETAR_DATOS}`,
    `- CRITICO_REVISAR: ${combinedStatusCounts.CRITICO_REVISAR}`,
    "",
    "**Readiness**",
    `- readiness_status: \`${readinessStatus}\``,
    `- recommendation: ${dryRunSummary.recommendation}`,
    "",
    "**Conflictos detectados**",
  ];

  if (conflicts.length === 0) {
    reportLines.push("- No se detectaron conflictos locales de bloqueo.");
  } else {
    for (const [conflictType, count] of Object.entries(conflictsByType)) {
      reportLines.push(`- ${conflictType}: ${count}`);
    }
  }

  if (supabaseWarnings.length > 0) {
    reportLines.push("", "**Warnings de chequeo remoto**");
    for (const warning of supabaseWarnings) {
      reportLines.push(`- ${warning}`);
    }
  }

  reportLines.push(
    "",
    "Este dry-run es solo una simulacion local.",
    "- No se inserto nada.",
    "- No se ejecuto SQL.",
    "- No se modifico Supabase.",
    "",
    "**Siguiente paso recomendado**",
    "- Revisar conflictos y planned files antes de cualquier Fase 7 de carga observada."
  );

  writeJson(path.join(dryRunDir, "historical_import_dry_run_summary.json"), dryRunSummary);
  writeCsv(
    path.join(dryRunDir, "planned_cotizaciones.csv"),
    [
      "action_planned",
      "target_table",
      "historical_cotizacion_key",
      "codigo",
      "cliente_nombre",
      "proyecto",
      "unidad_trabajo_nombre",
      "oc",
      "moneda_codigo",
      "estado",
      "estado_propuesta",
      "fecha_registro",
      "fecha_entrega",
      "monto",
      "data_quality_status",
      "data_quality_label",
      "data_quality_color",
      "data_quality_notes",
      "metadata_historical_import_json",
      "conflict_status",
      "conflict_notes",
    ],
    plannedCotizaciones
  );
  writeCsv(
    path.join(dryRunDir, "planned_requerimientos.csv"),
    [
      "action_planned",
      "target_table",
      "historical_cotizacion_key",
      "historical_rq_key",
      "codigo_original",
      "historical_rq_code_suggested",
      "codigo_para_importacion_simulado",
      "cotizacion_codigo",
      "proyecto_servicio",
      "oc",
      "solicitante_rq",
      "responsable",
      "estado",
      "fecha_solicitud",
      "fecha_requerida",
      "total_rq",
      "data_quality_status",
      "data_quality_label",
      "data_quality_color",
      "data_quality_notes",
      "metadata_historical_import_json",
      "conflict_status",
      "conflict_notes",
    ],
    plannedRequerimientos
  );
  writeCsv(
    path.join(dryRunDir, "planned_detalle_rq.csv"),
    [
      "action_planned",
      "target_table",
      "historical_cotizacion_key",
      "historical_rq_key",
      "source_row_number",
      "tipo_recurso",
      "codigo_fabricante",
      "descripcion",
      "unidad",
      "recurso_a_suministrar",
      "informacion_adicional",
      "cantidad",
      "ajuste",
      "atencion_real",
      "cant_stock",
      "compra",
      "precio_unitario",
      "subtotal",
      "costo_total_presupuestado",
      "moneda_codigo",
      "tc",
      "estado",
      "proveedor_nombre",
      "observaciones_item",
      "data_quality_status",
      "data_quality_label",
      "data_quality_color",
      "data_quality_notes",
      "metadata_historical_import_json",
      "conflict_status",
      "conflict_notes",
    ],
    plannedDetalle
  );
  writeJson(path.join(dryRunDir, "planned_import_batch.json"), plannedImportBatch);
  writeCsv(
    path.join(dryRunDir, "planned_import_issues.csv"),
    [
      "import_batch_id",
      "entity_type",
      "entity_key",
      "issue_type",
      "severity",
      "message",
      "source_row_number",
      "field_name",
      "raw_value",
      "suggested_action",
      "metadata_json",
    ],
    plannedIssues
  );
  writeCsv(
    path.join(dryRunDir, "conflict_report.csv"),
    ["severity", "conflict_type", "entity_type", "entity_key", "message"],
    conflicts
  );
  fs.writeFileSync(path.join(dryRunDir, "import_readiness_report.md"), `${reportLines.join("\n")}\n`, "utf8");

  console.log(`\nDry-run generado en: ${dryRunDir}`);
  console.log(
    JSON.stringify(
      {
        import_batch_id: batchId,
        mode: dryRunSummary.mode,
        total_cotizaciones: dryRunSummary.total_cotizaciones,
        total_requerimientos: dryRunSummary.total_requerimientos,
        total_detalle_rq: dryRunSummary.total_detalle_rq,
        total_planned_import_issues: dryRunSummary.total_planned_import_issues,
        total_conflicts: dryRunSummary.total_conflicts,
        readiness_status: dryRunSummary.readiness_status,
        recommendation: dryRunSummary.recommendation,
      },
      null,
      2
    )
  );
  console.log("\nEste script solo simula una carga observada. No inserta datos, no ejecuta SQL y no modifica Supabase.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Error desconocido en dry-run.");
  process.exit(1);
});
