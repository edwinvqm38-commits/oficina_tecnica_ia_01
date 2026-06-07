#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_DIR = "tmp_imports/dry_run";
const DEFAULT_BATCH_ID = "IMPORT-2026-001";
const ALLOWED_READINESS = new Set(["READY_WITH_OBSERVATIONS", "READY_FOR_REVIEW"]);
const REQUIRED_CONFIRM_RISK = "OBSERVED_IMPORT_APPROVED";
const REMOTE_QUERY_CHUNK_SIZE = 100;
const METADATA_CHECK_SAMPLE_SIZE = 10;
const FALLBACK_SUPER_ADMIN_EMAIL = "edwin.qm@outlook.com";
const EXECUTION_CHUNK_SIZES = {
  cotizaciones: 50,
  requerimientos: 50,
  detalle_rq: 500,
  import_issues: 500,
};
const ALLOWED_PAYLOAD_COLUMNS = {
  historical_import_batches: new Set([
    "import_batch_id",
    "source_file_name",
    "source_file_path",
    "status",
    "total_cotizaciones",
    "total_requerimientos",
    "total_detalle_rq",
    "total_ok",
    "total_observado",
    "total_completar_datos",
    "total_critico_revisar",
    "metadata",
  ]),
  cotizaciones: new Set([
    "codigo",
    "oc",
    "cliente_nombre",
    "proyecto",
    "unidad_trabajo_nombre",
    "moneda_codigo",
    "estado",
    "estado_propuesta",
    "fecha_registro",
    "fecha_entrega",
    "tipo_servicio_nombre",
    "prioridad",
    "avance",
    "observaciones",
    "monto",
    "metadata",
  ]),
  requerimientos: new Set([
    "codigo",
    "cotizacion_id",
    "cotizacion_codigo",
    "codigo_cliente",
    "codigo_unidad",
    "proyecto_servicio",
    "oc",
    "anio",
    "solicitante_rq",
    "tipo_servicio_nombre",
    "area_nombre",
    "estado",
    "fecha_solicitud",
    "fecha_requerida",
    "responsable",
    "avance",
    "total_rq",
    "observaciones",
    "metadata",
  ]),
  requerimiento_items: new Set([
    "requerimiento_id",
    "cantidad",
    "precio_unitario",
    "subtotal",
    "ajuste",
    "atencion_real",
    "cant_stock",
    "compra",
    "costo_unitario",
    "moneda_codigo",
    "tc",
    "factor_eq_herr",
    "costo_total_presupuestado",
    "fecha_coti",
    "estado",
    "informacion_adicional",
    "observaciones_item",
    "recurso_a_suministrar",
    "proveedor_nombre",
    "metadata",
  ]),
  historical_import_issues: new Set([
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
    "metadata",
  ]),
};

const REQUIRED_FILES = {
  summary: "historical_import_dry_run_summary.json",
  plannedCotizaciones: "planned_cotizaciones.csv",
  plannedRequerimientos: "planned_requerimientos.csv",
  plannedDetalleRq: "planned_detalle_rq.csv",
  plannedImportBatch: "planned_import_batch.json",
  plannedImportIssues: "planned_import_issues.csv",
  conflictReport: "conflict_report.csv",
  reviewSummary: "review_summary.json",
  reviewReport: "review_report.md",
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
  npm run import:historical-observed -- --dir "tmp_imports/dry_run" --batch-id "IMPORT-2026-001" --dry-run
  npm run import:historical-observed -- --dir "tmp_imports/dry_run" --batch-id "IMPORT-2026-001" --preflight-execute
  npm run import:historical-observed -- --dir "tmp_imports/dry_run" --batch-id "IMPORT-2026-002" --diagnose-failed-batch "IMPORT-2026-002"

Modo real futuro:
  npm run import:historical-observed -- --dir "tmp_imports/dry_run" --batch-id "IMPORT-2026-001" --execute --confirm-batch "IMPORT-2026-001" --confirm-risk "${REQUIRED_CONFIRM_RISK}" --confirm-no-conflicts

Opciones:
  --dir                 Carpeta con salidas del dry-run. Default: "${DEFAULT_DIR}".
  --batch-id            Batch a validar. Default: "${DEFAULT_BATCH_ID}".
  --dry-run             Solo valida y genera plan. No inserta nada.
  --preflight-execute   Valida payloads y readiness de permisos para la rama real. No inserta nada.
  --diagnose-failed-batch Diagnostica por SELECT un batch fallido existente. No modifica datos.
  --execute             Ruta futura de ejecucion real. Sigue bloqueada si faltan confirmaciones o prerrequisitos.
  --confirm-batch       Confirmacion exacta del batch.
  --confirm-risk        Confirmacion explicita del riesgo controlado.
  --confirm-no-conflicts Confirmacion explicita de ausencia de conflictos.
  --help                Muestra esta ayuda.
`);
}

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u00a0/g, " ").trim();
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const exportLess = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
  const separatorIndex = exportLess.indexOf("=");
  if (separatorIndex === -1) return null;

  const key = exportLess.slice(0, separatorIndex).trim();
  let value = exportLess.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  value = value.replace(/\\n/g, "\n");
  return key ? { key, value } : null;
}

function loadLocalEnvFiles(baseDir) {
  const files = [".env.local", ".env"];
  const loadedFiles = [];

  for (const fileName of files) {
    const filePath = path.join(baseDir, fileName);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (!process.env[parsed.key]) {
        process.env[parsed.key] = parsed.value;
      }
    }
    loadedFiles.push(fileName);
  }

  return loadedFiles;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readCsvRows(filePath) {
  const workbook = XLSX.readFile(filePath, { raw: true });
  const sheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: true,
  });
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
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

function addValidation(
  validations,
  validationName,
  status,
  severity,
  message,
  suggestedAction,
  safeError = {}
) {
  validations.push({
    validation_name: validationName,
    status,
    severity,
    message,
    suggested_action: suggestedAction,
    safe_error_code: safeError.code ?? "",
    safe_error_message: safeError.message ?? "",
  });
}

function addBlocker(blockers, code, message) {
  if (!blockers.some((blocker) => blocker.code === code)) {
    blockers.push({ code, message });
  }
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function getUniqueNormalizedValues(rows, fieldName) {
  return [...new Set(rows.map((row) => normalizeString(row[fieldName])).filter(Boolean))];
}

function createSafeError(error, extra = {}) {
  const safeError = {
    code: normalizeString(error?.code) || "UNKNOWN_ERROR",
    message: normalizeString(error?.message) || "Error remoto no detallado.",
    details: normalizeString(error?.details),
    hint: normalizeString(error?.hint),
    ...extra,
  };

  return safeError;
}

function registerRemoteError(remoteContext, safeError) {
  remoteContext.remote_errors_safe.push(safeError);
}

function recordRemoteCheck(remoteContext, checkName, status, message, extra = {}) {
  remoteContext.checks.push({
    check_name: checkName,
    status,
    message,
    ...extra,
  });
}

function setRemoteStatus(remoteContext, nextStatus) {
  const priority = {
    skipped: 0,
    passed: 1,
    warning: 2,
    failed: 3,
  };

  const current = remoteContext.status ?? "skipped";
  if ((priority[nextStatus] ?? 0) > (priority[current] ?? 0)) {
    remoteContext.status = nextStatus;
  }
}

async function queryByChunks({ client, table, selectColumns, column, values, chunkSize = REMOTE_QUERY_CHUNK_SIZE }) {
  const uniqueValues = [...new Set(values.map((value) => normalizeString(value)).filter(Boolean))];
  const chunks = chunkArray(uniqueValues, chunkSize);
  const foundRows = [];

  for (const chunk of chunks) {
    const { data, error } = await client.from(table).select(selectColumns).in(column, chunk);
    if (error) {
      return {
        data: foundRows,
        error,
        checkedCount: uniqueValues.length,
        chunkCount: chunks.length,
      };
    }

    if (Array.isArray(data) && data.length > 0) {
      foundRows.push(...data);
    }
  }

  return {
    data: foundRows,
    error: null,
    checkedCount: uniqueValues.length,
    chunkCount: chunks.length,
  };
}

function parseJsonObject(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  const normalized = normalizeString(value);
  if (!normalized) return { ...fallback };

  try {
    const parsed = JSON.parse(normalized);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function parseNumber(value, defaultValue = null) {
  const normalized = normalizeString(value);
  if (!normalized) return defaultValue;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function parseDateValue(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function isAllowedAction(row) {
  return normalizeString(row.action_planned).toLowerCase() !== "skip_conflict";
}

function normalizeCurrency(value) {
  const normalized = normalizeString(value).toUpperCase();
  if (!normalized) return null;
  if (normalized === "USD" || normalized === "US$" || normalized === "$" || normalized.includes("DOLAR")) return "USD";
  if (normalized === "PEN" || normalized === "S/" || normalized.includes("SOL")) return "PEN";
  return normalized;
}

function mapRequirementEstado(value) {
  const normalized = normalizeString(value).toUpperCase();
  if (!normalized) return "Pendiente";
  if (normalized.includes("ATEND")) return "Atendido";
  if (normalized.includes("PARCIAL") || normalized.includes("PROCESO")) return "En proceso";
  return "Pendiente";
}

function buildExecutionMetadata(metadataValue, extra = {}) {
  const metadata = parseJsonObject(metadataValue, {});
  const historicalImport = parseJsonObject(metadata.historical_import, {});
  return {
    ...metadata,
    historical_import: {
      ...historicalImport,
      ...extra,
    },
  };
}

function computeFinalImportStatus(reviewSummary) {
  const quality = reviewSummary?.count_by_data_quality_status ?? {};
  const nonOkTotal =
    Number(quality.OBSERVADO ?? 0) +
    Number(quality.COMPLETAR_DATOS ?? 0) +
    Number(quality.CRITICO_REVISAR ?? 0);
  return nonOkTotal > 0 ? "imported_with_observations" : "imported";
}

function suggestNextBatchId(batchId) {
  const match = normalizeString(batchId).match(/^(.*?)(\d+)$/);
  if (!match) return `${normalizeString(batchId)}-NEXT`;
  const prefix = match[1];
  const numeric = match[2];
  const nextValue = String(Number(numeric) + 1).padStart(numeric.length, "0");
  return `${prefix}${nextValue}`;
}

function extractInsertedCountsFromBatchMetadata(batchRow) {
  const metadata = parseJsonObject(batchRow?.metadata, {});
  const historicalImport = parseJsonObject(metadata.historical_import, {});
  const insertedCounts = parseJsonObject(
    historicalImport.inserted_counts ?? metadata.inserted_counts,
    {}
  );

  return {
    cotizaciones: Number(insertedCounts.cotizaciones ?? 0),
    requerimientos: Number(insertedCounts.requerimientos ?? 0),
    detalle_rq: Number(insertedCounts.detalle_rq ?? 0),
    import_issues: Number(insertedCounts.import_issues ?? 0),
  };
}

function getHistoricalImportMetadata(row, metadataField = "metadata_historical_import_json") {
  const metadata = parseJsonObject(row?.[metadataField], {});
  return parseJsonObject(metadata.historical_import, {});
}

function getSourceRowNumber(row, fallbackIndex = 0) {
  const historicalImport = getHistoricalImportMetadata(row);
  return parseNumber(historicalImport.source_row_number ?? row?.source_row_number, fallbackIndex || null);
}

function buildHistoricalDuplicateCode(row, fallbackIndex = 0, usedCodes = new Set()) {
  const sourceRowNumber = getSourceRowNumber(row, fallbackIndex);
  const baseNumber = Number.isFinite(sourceRowNumber) && sourceRowNumber > 0 ? sourceRowNumber : fallbackIndex;
  let candidate = `RQ-HIST-ROW-${String(baseNumber || 1).padStart(4, "0")}`;
  let sequence = 2;

  while (usedCodes.has(candidate)) {
    candidate = `RQ-HIST-ROW-${String(baseNumber || 1).padStart(4, "0")}-${sequence}`;
    sequence += 1;
  }

  return candidate;
}

function getRequirementImportCodeBase(row, fallbackIndex = 0) {
  const originalCode = normalizeString(row.codigo_original);
  const simulatedCode = normalizeString(row.codigo_para_importacion_simulado);
  const suggestedCode = normalizeString(row.historical_rq_code_suggested);

  return (
    simulatedCode ||
    originalCode ||
    suggestedCode ||
    buildHistoricalDuplicateCode(row, fallbackIndex)
  );
}

function collectDuplicateValues(rows, getter) {
  const grouped = new Map();

  rows.forEach((row, index) => {
    const value = normalizeString(getter(row, index));
    if (!value) return;
    const existing = grouped.get(value) ?? [];
    existing.push(row);
    grouped.set(value, existing);
  });

  return new Map([...grouped.entries()].filter(([, groupedRows]) => groupedRows.length > 1));
}

function resolveRequirementImportCodes(rows) {
  const filteredRows = rows.filter(isAllowedAction);
  const baseCodeCounts = new Map();
  const rowsWithBaseCode = filteredRows.map((row, index) => {
    const baseCode = getRequirementImportCodeBase(row, index + 1);
    baseCodeCounts.set(baseCode, Number(baseCodeCounts.get(baseCode) ?? 0) + 1);
    return { row, index, baseCode };
  });

  const usedFinalCodes = new Set();
  const resolvedRows = rows.map((row) => ({ ...row }));

  rowsWithBaseCode.forEach(({ row, index, baseCode }) => {
    const duplicateCount = Number(baseCodeCounts.get(baseCode) ?? 0);
    let finalCode = baseCode;

    if (duplicateCount > 1 || usedFinalCodes.has(finalCode)) {
      finalCode = buildHistoricalDuplicateCode(row, index + 1, usedFinalCodes);
    }

    usedFinalCodes.add(finalCode);

    const targetIndex = rows.indexOf(row);
    const sourceRowNumber = getSourceRowNumber(row, index + 1);
    const resolvedRow = {
      ...row,
      source_row_number: sourceRowNumber || "",
      codigo_para_importacion_final: finalCode,
      duplicate_code_resolution: duplicateCount > 1 || finalCode !== baseCode ? "true" : "false",
    };

    resolvedRows[targetIndex] = resolvedRow;

  });

  const duplicateSimulatedCodes = collectDuplicateValues(
    filteredRows,
    (row, index) => getRequirementImportCodeBase(row, index + 1)
  );
  const duplicateOriginalCodes = collectDuplicateValues(filteredRows, (row) => row.codigo_original);
  const duplicateFinalCodes = collectDuplicateValues(
    resolvedRows.filter(isAllowedAction),
    (row) => row.codigo_para_importacion_final
  );
  const resolvedByHistoricalKey = new Map(
    resolvedRows.map((row) => [normalizeString(row.historical_rq_key), row])
  );

  const duplicateRows = [];
  const pushDuplicateRows = (duplicateMap, duplicateSourceField, codeGetter) => {
    duplicateMap.forEach((groupedRows, repeatedCode) => {
      groupedRows.forEach((row, index) => {
        const resolvedRow = resolvedByHistoricalKey.get(normalizeString(row.historical_rq_key)) ?? row;
        duplicateRows.push({
          duplicate_source_field: duplicateSourceField,
          codigo_repetido: repeatedCode,
          cantidad: groupedRows.length,
          historical_rq_key: normalizeString(row.historical_rq_key),
          historical_cotizacion_key: normalizeString(row.historical_cotizacion_key),
          source_row_number: getSourceRowNumber(row, index + 1) || "",
          codigo_original: normalizeString(row.codigo_original),
          codigo_para_importacion_simulado: normalizeString(codeGetter(row, index)),
          data_quality_status: normalizeString(row.data_quality_status),
          propuesta_codigo_importacion_unico:
            normalizeString(resolvedRow.codigo_para_importacion_final) ||
            buildHistoricalDuplicateCode(row, index + 1),
        });
      });
    });
  };

  pushDuplicateRows(duplicateSimulatedCodes, "codigo_para_importacion_simulado", (row, index) =>
    getRequirementImportCodeBase(row, index + 1)
  );
  pushDuplicateRows(duplicateOriginalCodes, "codigo_original", (row) => row.codigo_original);

  return {
    rows: resolvedRows,
    duplicateRows,
    summary: {
      duplicate_codes_in_simulated: duplicateSimulatedCodes.size,
      duplicate_rows_in_simulated: duplicateRows.filter(
        (row) => row.duplicate_source_field === "codigo_para_importacion_simulado"
      ).length,
      duplicate_codes_in_original: duplicateOriginalCodes.size,
      duplicate_rows_in_original: duplicateRows.filter(
        (row) => row.duplicate_source_field === "codigo_original"
      ).length,
      duplicate_final_codes: duplicateFinalCodes.size,
      duplicate_final_rows: [...duplicateFinalCodes.values()].reduce(
        (accumulator, groupedRows) => accumulator + groupedRows.length,
        0
      ),
      duplicate_simulated_codes: [...duplicateSimulatedCodes.keys()],
      duplicate_original_codes: [...duplicateOriginalCodes.keys()],
      duplicate_final_codes_list: [...duplicateFinalCodes.keys()],
    },
  };
}

function writeDuplicateRequirementReports({ batchId, executionDir, resolvedRows, duplicateRows, summary }) {
  const reportPath = path.join(executionDir, "duplicate_rq_codes_report.csv");
  const summaryPath = path.join(executionDir, "duplicate_rq_codes_summary.json");

  writeCsv(
    reportPath,
    [
      "duplicate_source_field",
      "codigo_repetido",
      "cantidad",
      "historical_rq_key",
      "historical_cotizacion_key",
      "source_row_number",
      "codigo_original",
      "codigo_para_importacion_simulado",
      "data_quality_status",
      "propuesta_codigo_importacion_unico",
    ],
    duplicateRows
  );

  writeJson(summaryPath, {
    import_batch_id: batchId,
    total_requerimientos: resolvedRows.filter(isAllowedAction).length,
    duplicate_codes_in_simulated: summary.duplicate_codes_in_simulated,
    duplicate_rows_in_simulated: summary.duplicate_rows_in_simulated,
    duplicate_codes_in_original: summary.duplicate_codes_in_original,
    duplicate_rows_in_original: summary.duplicate_rows_in_original,
    duplicate_final_codes: summary.duplicate_final_codes,
    duplicate_final_rows: summary.duplicate_final_rows,
    duplicate_simulated_codes: summary.duplicate_simulated_codes,
    duplicate_original_codes: summary.duplicate_original_codes,
    duplicate_final_codes_list: summary.duplicate_final_codes_list,
    recommendation:
      summary.duplicate_codes_in_simulated > 0 || summary.duplicate_codes_in_original > 0
        ? "Resolver el siguiente lote con codigo_para_importacion_final unico antes de una nueva ejecucion real."
        : "No se detectaron duplicados de codigo RQ en el plan local.",
  });
}

function buildCotizacionPayload(row) {
  const codigo = normalizeString(row.codigo);
  return {
    codigo,
    proyecto: normalizeString(row.proyecto) || `Histórico ${codigo}`,
    oc: normalizeString(row.oc),
    cliente_nombre: normalizeString(row.cliente_nombre),
    unidad_trabajo_nombre: normalizeString(row.unidad_trabajo_nombre),
    moneda_codigo: normalizeCurrency(row.moneda_codigo) ?? "PEN",
    estado: normalizeString(row.estado) || "Histórico",
    estado_propuesta: normalizeString(row.estado_propuesta) || "Histórico",
    fecha_registro: parseDateValue(row.fecha_registro),
    fecha_entrega: parseDateValue(row.fecha_entrega),
    tipo_servicio_nombre: normalizeString(row.tipo_servicio_nombre) || null,
    prioridad: normalizeString(row.prioridad) || null,
    avance: 0,
    observaciones: normalizeString(row.data_quality_notes),
    monto: parseNumber(row.monto, 0),
    metadata: buildExecutionMetadata(row.metadata_historical_import_json, {
      action_planned: normalizeString(row.action_planned),
      conflict_status: normalizeString(row.conflict_status),
      conflict_notes: normalizeString(row.conflict_notes),
      execution_entity: "cotizacion",
    }),
  };
}

function buildRequerimientoPayload(row, cotizacionId) {
  const codigoParaImportacionSimulado = getRequirementImportCodeBase(row);
  const codigoParaImportacionFinal =
    normalizeString(row.codigo_para_importacion_final) || codigoParaImportacionSimulado;
  const codigoOriginal = normalizeString(row.codigo_original);
  const totalRq = parseNumber(row.total_rq, 0);
  const estado = mapRequirementEstado(row.estado);
  const avance = estado === "Atendido" ? 100 : estado === "En proceso" ? 50 : 0;

  return {
    codigo: codigoParaImportacionFinal,
    cotizacion_id: cotizacionId,
    cotizacion_codigo: normalizeString(row.cotizacion_codigo),
    codigo_cliente: normalizeString(row.codigo_cliente) || null,
    codigo_unidad: normalizeString(row.codigo_unidad) || null,
    proyecto_servicio: normalizeString(row.proyecto_servicio),
    oc: normalizeString(row.oc),
    anio: parseNumber(row.anio, null),
    solicitante_rq: normalizeString(row.solicitante_rq) || "Importación histórica",
    tipo_servicio_nombre: normalizeString(row.tipo_servicio_nombre) || null,
    area_nombre: normalizeString(row.area_nombre) || null,
    estado,
    fecha_solicitud: parseDateValue(row.fecha_solicitud),
    fecha_requerida: parseDateValue(row.fecha_requerida),
    responsable: normalizeString(row.responsable) || "Importación histórica",
    avance,
    total_rq: totalRq,
    observaciones: normalizeString(row.data_quality_notes),
    metadata: buildExecutionMetadata(row.metadata_historical_import_json, {
      action_planned: normalizeString(row.action_planned),
      conflict_status: normalizeString(row.conflict_status),
      conflict_notes: normalizeString(row.conflict_notes),
      execution_entity: "requerimiento",
      codigo_rq_original: codigoOriginal,
      codigo_para_importacion_simulado: codigoParaImportacionSimulado,
      codigo_para_importacion_final: codigoParaImportacionFinal,
      duplicate_code_resolution: normalizeString(row.duplicate_code_resolution) === "true",
    }),
  };
}

function buildDetalleSourceItem(row) {
  return {
    tipo_recurso: normalizeString(row.tipo_recurso),
    codigo_fabricante: normalizeString(row.codigo_fabricante),
    descripcion: normalizeString(row.descripcion),
    a_suministrar: normalizeString(row.recurso_a_suministrar),
    unidad: normalizeString(row.unidad),
    cantidad: parseNumber(row.cantidad, null),
    ajuste: parseNumber(row.ajuste, null),
    atencion_real: parseNumber(row.atencion_real, null),
    cant_stock: parseNumber(row.cant_stock, null),
    compra: parseNumber(row.compra, null),
    precio_unitario: parseNumber(row.precio_unitario, null),
    costo_unitario_dolar: parseNumber(row.costo_unitario_dolar, null),
    costo_unitario_soles: parseNumber(row.precio_unitario, null),
    tipo_cambio: parseNumber(row.tc, null),
    costo_total_presupuestado: parseNumber(row.costo_total_presupuestado, null),
    costo_total_presupuestado_usd: parseNumber(row.costo_total_presupuestado_usd, null),
    moneda: normalizeString(row.moneda_codigo),
    observaciones_item: normalizeString(row.observaciones_item),
  };
}

function buildDetallePayload(row, requerimientoId) {
  const cantidad = parseNumber(row.cantidad, 0);
  const precioUnitario = parseNumber(row.precio_unitario, 0);
  const subtotal = parseNumber(row.subtotal, Number((cantidad * precioUnitario).toFixed(2)));
  const costoTotal = parseNumber(row.costo_total_presupuestado, subtotal);

  return {
    requerimiento_id: requerimientoId,
    cantidad,
    precio_unitario: precioUnitario,
    subtotal,
    ajuste: parseNumber(row.ajuste, 0),
    atencion_real: parseNumber(row.atencion_real, 0),
    cant_stock: parseNumber(row.cant_stock, 0),
    compra: parseNumber(row.compra, 0),
    costo_unitario: precioUnitario,
    moneda_codigo: normalizeCurrency(row.moneda_codigo) ?? "PEN",
    tc: parseNumber(row.tc, 1),
    factor_eq_herr: 1,
    costo_total_presupuestado: costoTotal,
    fecha_coti: parseDateValue(row.fecha_coti),
    estado: normalizeString(row.estado) || "Pendiente",
    informacion_adicional: normalizeString(row.informacion_adicional),
    observaciones_item: normalizeString(row.observaciones_item) || normalizeString(row.data_quality_notes),
    recurso_a_suministrar: normalizeString(row.recurso_a_suministrar),
    proveedor_nombre: normalizeString(row.proveedor_nombre),
    metadata: buildExecutionMetadata(row.metadata_historical_import_json, {
      action_planned: normalizeString(row.action_planned),
      conflict_status: normalizeString(row.conflict_status),
      conflict_notes: normalizeString(row.conflict_notes),
      execution_entity: "requerimiento_item",
      review_required: normalizeString(row.action_planned) === "review_required",
      source_item: buildDetalleSourceItem(row),
    }),
  };
}

function buildImportIssuePayload(row) {
  return {
    import_batch_id: normalizeString(row.import_batch_id),
    entity_type: normalizeString(row.entity_type),
    entity_key: normalizeString(row.entity_key),
    issue_type: normalizeString(row.issue_type),
    severity: normalizeString(row.severity),
    message: normalizeString(row.message),
    source_row_number: parseNumber(row.source_row_number, null),
    field_name: normalizeString(row.field_name),
    raw_value: normalizeString(row.raw_value),
    suggested_action: normalizeString(row.suggested_action),
    metadata: buildExecutionMetadata(row.metadata_json, {
      execution_entity: "historical_import_issue",
    }),
  };
}

async function insertRowsInChunks({
  client,
  table,
  rows,
  chunkSize,
  buildPayload,
  returningColumns,
}) {
  const filteredRows = rows.filter(isAllowedAction);
  const chunks = chunkArray(filteredRows, chunkSize);
  const insertedRows = [];
  let insertedCount = 0;
  let insertedChunks = 0;

  for (const chunk of chunks) {
    const payloads = chunk.map(buildPayload);
    const query = client.from(table).insert(payloads);
    const { data, error } = returningColumns
      ? await query.select(returningColumns)
      : await query.select();

    if (error) {
      return {
        ok: false,
        error,
        insertedCount,
        insertedChunks,
        insertedRows,
      };
    }

    insertedCount += payloads.length;
    insertedChunks += 1;
    if (Array.isArray(data) && data.length > 0) {
      insertedRows.push(...data);
    }
  }

  return {
    ok: true,
    insertedCount,
    insertedChunks,
    insertedRows,
  };
}

async function updateBatchRecord(client, batchId, patch) {
  return client
    .from("historical_import_batches")
    .update(patch)
    .eq("import_batch_id", batchId);
}

function buildExecutionResultMarkdown(result) {
  const lines = [
    "# Resultado de ejecucion controlada de importacion historica observada",
    "",
    `- Batch: \`${result.import_batch_id}\``,
    `- Estado: \`${result.status}\``,
    `- inserted_cotizaciones: ${result.inserted_counts.cotizaciones}`,
    `- inserted_requerimientos: ${result.inserted_counts.requerimientos}`,
    `- inserted_detalle_rq: ${result.inserted_counts.detalle_rq}`,
    `- inserted_import_issues: ${result.inserted_counts.import_issues}`,
    "",
    "## Confirmacion",
    result.status === "success"
      ? "- La ejecucion controlada completo su flujo previsto."
      : "- La ejecucion encontro una falla y se detuvo sin reintento automatico.",
    "",
    "## Error",
    `- table: ${result.error_table || "-"}`,
    `- probable_column: ${result.error_column || "-"}`,
    `- message: ${result.error_message || "-"}`,
    "",
    "## Siguiente paso",
    `- ${result.next_steps}`,
  ];

  return `${lines.join("\n")}\n`;
}

function enrichExecutionError(error, defaultTable = "") {
  const safeError = createSafeError(error, {
    table: normalizeString(error?.table) || defaultTable,
  });
  const columnMatch = safeError.message.match(/Could not find the '([^']+)' column of '([^']+)'/i);
  if (columnMatch) {
    safeError.probable_column = columnMatch[1];
    safeError.table = safeError.table || `public.${columnMatch[2]}`;
  }
  return safeError;
}

function validateNotNullPayloads(payloads, entityType, requiredFields) {
  const issues = [];

  payloads.forEach((payload, index) => {
    for (const field of requiredFields) {
      const value = payload[field];
      if (value === null || value === undefined || value === "") {
        issues.push({
          entity_type: entityType,
          row_index: index,
          field_name: field,
          message: `${entityType} payload tiene valor vacio para campo NOT NULL ${field}.`,
        });
      }
    }
  });

  return issues;
}

function validateAllowedPayloadColumns(payloads, tableName) {
  const allowedColumns = ALLOWED_PAYLOAD_COLUMNS[tableName];
  const invalidColumns = new Set();

  payloads.forEach((payload) => {
    for (const key of Object.keys(payload)) {
      if (!allowedColumns?.has(key)) {
        invalidColumns.add(key);
      }
    }
  });

  return [...invalidColumns];
}

function buildPreflightReportMarkdown(review) {
  const lines = [
    "# Preflight antes de ejecucion real",
    "",
    `- Batch: \`${review.import_batch_id}\``,
    `- execute_branch_ready: ${review.execute_branch_ready ? "true" : "false"}`,
    `- payload_validation_status: \`${review.payload_validation_status}\``,
    `- remote_validation_status: \`${review.remote_validation_status}\``,
    `- permission_readiness_status: \`${review.permission_readiness_status}\``,
    "",
    "## Totales de payload",
    `- Cotizaciones: ${review.total_payload_cotizaciones}`,
    `- Requerimientos: ${review.total_payload_requerimientos}`,
    `- Items: ${review.total_payload_items}`,
    `- Issues: ${review.total_payload_issues}`,
    "",
    "## Blockers",
  ];

  if (review.blockers.length === 0) {
    lines.push("- No se detectaron blockers de preflight.");
  } else {
    review.blockers.forEach((blocker) => lines.push(`- ${blocker.code}: ${blocker.message}`));
  }

  lines.push("", "## Warnings");
  if (review.warnings.length === 0) {
    lines.push("- No se registraron warnings.");
  } else {
    review.warnings.forEach((warning) => lines.push(`- ${warning}`));
  }

  lines.push("", "## SQL requerido antes de ejecutar");
  if ((review.required_sql_before_execute ?? []).length === 0) {
    lines.push("- No se detecto SQL pendiente obligatorio desde este preflight.");
  } else {
    review.required_sql_before_execute.forEach((item) => lines.push(`- ${item}`));
  }

  lines.push(
    "",
    "## Recomendacion final",
    `- ${review.final_recommendation}`,
    "",
    "## Checklist final antes de carga real",
    "- [ ] Validar permisos INSERT/UPDATE reales sobre tablas principales.",
    "- [ ] Confirmar que SQL 015 fue revisado y, si aplica, ejecutado en entorno controlado.",
    "- [ ] Confirmar payloads contra esquema real desplegado.",
    "- [ ] Confirmar aprobacion humana antes de cualquier --execute.",
    "",
    "## Nota",
    "- Este preflight no inserta datos y no ejecuta SQL.",
  );

  return `${lines.join("\n")}\n`;
}

async function tryReadGrantMetadata(client, tableNames) {
  if (!client?.schema) {
    return {
      ok: false,
      warning: "El cliente actual no expone cambio de schema para consultar information_schema.",
      rows: [],
    };
  }

  try {
    const { data, error } = await client
      .schema("information_schema")
      .from("role_table_grants")
      .select("grantee,table_schema,table_name,privilege_type")
      .eq("table_schema", "public")
      .eq("grantee", "authenticated")
      .in("table_name", tableNames);

    if (error) {
      return {
        ok: false,
        warning: `No se pudo consultar information_schema.role_table_grants: ${normalizeString(error.message) || error.code || "sin detalle"}.`,
        rows: [],
      };
    }

    return {
      ok: true,
      rows: Array.isArray(data) ? data : [],
    };
  } catch (error) {
    return {
      ok: false,
      warning: `No se pudo consultar information_schema.role_table_grants: ${error instanceof Error ? error.message : "sin detalle"}.`,
      rows: [],
    };
  }
}

async function tryReadPolicyMetadata(client, tableNames) {
  if (!client?.schema) {
    return {
      ok: false,
      warning: "El cliente actual no expone cambio de schema para consultar pg_policies.",
      rows: [],
    };
  }

  try {
    const { data, error } = await client
      .schema("pg_catalog")
      .from("pg_policies")
      .select("schemaname,tablename,policyname,cmd,roles")
      .eq("schemaname", "public")
      .in("tablename", tableNames);

    if (error) {
      return {
        ok: false,
        warning: `No se pudo consultar pg_policies: ${normalizeString(error.message) || error.code || "sin detalle"}.`,
        rows: [],
      };
    }

    return {
      ok: true,
      rows: Array.isArray(data) ? data : [],
    };
  } catch (error) {
    return {
      ok: false,
      warning: `No se pudo consultar pg_policies: ${error instanceof Error ? error.message : "sin detalle"}.`,
      rows: [],
    };
  }
}

async function authenticateSupabaseAdminForDiagnostics(client) {
  const adminEmail = process.env.HISTORICAL_IMPORT_ADMIN_EMAIL ?? "";
  const adminPassword = process.env.HISTORICAL_IMPORT_ADMIN_PASSWORD ?? "";

  if (!client) {
    return {
      ok: false,
      warning: "No existe cliente Supabase configurado para diagnostico remoto.",
    };
  }

  if (!adminEmail || !adminPassword) {
    return {
      ok: false,
      warning: "Faltan HISTORICAL_IMPORT_ADMIN_EMAIL y/o HISTORICAL_IMPORT_ADMIN_PASSWORD para diagnostico remoto.",
    };
  }

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (signInError) {
    return {
      ok: false,
      warning: `No se pudo autenticar para diagnostico remoto: ${normalizeString(signInError.message) || signInError.code || "sin detalle"}.`,
    };
  }

  const session = signInData?.session ?? null;
  const authUser = signInData?.user ?? session?.user ?? null;
  if (!session || !authUser?.id) {
    return {
      ok: false,
      warning: "La autenticacion remota no devolvio una session utilizable para diagnostico.",
    };
  }

  const { data: profileRows, error: profileError } = await client
    .from("user_profiles")
    .select("id,email,status,is_super_admin")
    .eq("id", authUser.id)
    .limit(1);

  if (profileError) {
    return {
      ok: false,
      warning: `No se pudo consultar user_profiles para diagnostico remoto: ${normalizeString(profileError.message) || profileError.code || "sin detalle"}.`,
    };
  }

  const profileRow = profileRows?.[0] ?? null;
  const approvedFallback =
    normalizeString(profileRow?.status).toLowerCase() === "approved" &&
    normalizeString(profileRow?.email).toLowerCase() === FALLBACK_SUPER_ADMIN_EMAIL;

  if (
    !profileRow ||
    normalizeString(profileRow.status).toLowerCase() !== "approved" ||
    (profileRow.is_super_admin !== true && !approvedFallback)
  ) {
    return {
      ok: false,
      warning: "La cuenta autenticada no cumple el patron de super admin approved para diagnostico remoto.",
    };
  }

  return {
    ok: true,
    user: {
      id: normalizeString(authUser.id),
      email: normalizeString(authUser.email),
    },
    profile: {
      email: normalizeString(profileRow.email),
      status: normalizeString(profileRow.status),
      is_super_admin: profileRow.is_super_admin === true,
    },
  };
}

function buildFailedBatchDiagnosisMarkdown(diagnosis) {
  const lines = [
    "# Diagnostico de lote fallido de importacion historica",
    "",
    `- Batch diagnosticado: \`${diagnosis.import_batch_id}\``,
    `- Diagnostico remoto disponible: ${diagnosis.remote_diagnosis_available ? "true" : "false"}`,
    `- Batch encontrado: ${diagnosis.batch_found ? "true" : "false"}`,
    `- Batch status: \`${diagnosis.batch_status || "-"}\``,
    `- suggested_next_batch_id: \`${diagnosis.suggested_next_batch_id}\``,
    "",
    "## Conteos remotos por batch",
    `- cotizaciones: ${diagnosis.remote_counts.cotizaciones}`,
    `- requerimientos: ${diagnosis.remote_counts.requerimientos}`,
    `- requerimiento_items: ${diagnosis.remote_counts.requerimiento_items}`,
    `- historical_import_issues: ${diagnosis.remote_counts.historical_import_issues}`,
    "",
    "## Inserted counts reportados por el batch",
    `- cotizaciones: ${diagnosis.reported_inserted_counts.cotizaciones}`,
    `- requerimientos: ${diagnosis.reported_inserted_counts.requerimientos}`,
    `- detalle_rq: ${diagnosis.reported_inserted_counts.detalle_rq}`,
    `- import_issues: ${diagnosis.reported_inserted_counts.import_issues}`,
    "",
    "## Warnings",
  ];

  if ((diagnosis.warnings ?? []).length === 0) {
    lines.push("- No se registraron warnings.");
  } else {
    for (const warning of diagnosis.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push(
    "",
    "## Recomendacion",
    `- ${diagnosis.recommendation}`,
    "",
    "## Nota",
    "- Este diagnostico solo consulta por SELECT y no borra ni inserta datos."
  );

  return `${lines.join("\n")}\n`;
}

async function diagnoseFailedBatch({
  client,
  diagnoseBatchId,
  executionDir,
}) {
  const diagnosis = {
    import_batch_id: diagnoseBatchId,
    remote_diagnosis_available: false,
    batch_found: false,
    batch_status: "",
    batch_error_message: "",
    batch_metadata: {},
    reported_inserted_counts: {
      cotizaciones: 0,
      requerimientos: 0,
      detalle_rq: 0,
      import_issues: 0,
    },
    remote_counts: {
      cotizaciones: 0,
      requerimientos: 0,
      requerimiento_items: 0,
      historical_import_issues: 0,
    },
    suggested_next_batch_id: suggestNextBatchId(diagnoseBatchId),
    warnings: [],
    recommendation:
      "Revisar y aplicar manualmente el rollback controlado antes de preparar un nuevo lote historico.",
  };

  const auth = await authenticateSupabaseAdminForDiagnostics(client);
  if (!auth.ok) {
    diagnosis.warnings.push(auth.warning);
    writeJson(path.join(executionDir, "failed_batch_diagnosis.json"), diagnosis);
    fs.writeFileSync(
      path.join(executionDir, "failed_batch_diagnosis.md"),
      buildFailedBatchDiagnosisMarkdown(diagnosis),
      "utf8"
    );
    return diagnosis;
  }

  diagnosis.remote_diagnosis_available = true;

  const { data: batchRows, error: batchError } = await client
    .from("historical_import_batches")
    .select("id,import_batch_id,status,metadata")
    .eq("import_batch_id", diagnoseBatchId)
    .limit(1);

  if (batchError) {
    diagnosis.warnings.push(
      `No se pudo consultar historical_import_batches para ${diagnoseBatchId}: ${normalizeString(batchError.message) || batchError.code || "sin detalle"}.`
    );
  } else if ((batchRows ?? []).length > 0) {
    const batchRow = batchRows[0];
    diagnosis.batch_found = true;
    diagnosis.batch_status = normalizeString(batchRow.status);
    diagnosis.batch_metadata = parseJsonObject(batchRow.metadata, {});
    diagnosis.reported_inserted_counts = extractInsertedCountsFromBatchMetadata(batchRow);
    diagnosis.batch_error_message = normalizeString(
      diagnosis.batch_metadata?.historical_import?.execution_error?.message ??
      diagnosis.batch_metadata?.error ??
      ""
    );
  }

  const remoteCountChecks = [
    ["cotizaciones", "public.cotizaciones"],
    ["requerimientos", "public.requerimientos"],
    ["requerimiento_items", "public.requerimiento_items"],
    ["historical_import_issues", "public.historical_import_issues"],
  ];

  for (const [tableName, label] of remoteCountChecks) {
    try {
      const { count, error } = await client
        .from(tableName)
        .select("id", { count: "exact", head: true })
        .contains("metadata", { historical_import: { import_batch_id: diagnoseBatchId } });

      if (error) {
        diagnosis.warnings.push(
          `No se pudo contar ${label} por metadata.historical_import.import_batch_id: ${normalizeString(error.message) || error.code || "sin detalle"}.`
        );
        continue;
      }

      diagnosis.remote_counts[tableName] = Number(count ?? 0);
    } catch (error) {
      diagnosis.warnings.push(
        `No se pudo contar ${label} por metadata.historical_import.import_batch_id: ${error instanceof Error ? error.message : "sin detalle"}.`
      );
    }
  }

  writeJson(path.join(executionDir, "failed_batch_diagnosis.json"), diagnosis);
  fs.writeFileSync(
    path.join(executionDir, "failed_batch_diagnosis.md"),
    buildFailedBatchDiagnosisMarkdown(diagnosis),
    "utf8"
  );

  return diagnosis;
}

async function runPreflightExecute({
  client,
  batchId,
  plan,
  plannedCotizaciones,
  plannedRequerimientos,
  plannedDetalleRq,
  plannedImportIssues,
  executionDir,
}) {
  const cotizacionPayloads = plannedCotizaciones
    .filter(isAllowedAction)
    .map((row) => buildCotizacionPayload(row));

  const simulatedCotizacionIdMap = new Map(
    plannedCotizaciones
      .filter(isAllowedAction)
      .map((row, index) => [normalizeString(row.historical_cotizacion_key), `sim-cot-${index + 1}`])
  );

  const requerimientoPayloads = plannedRequerimientos
    .filter(isAllowedAction)
    .map((row, index) =>
      buildRequerimientoPayload(
        row,
        simulatedCotizacionIdMap.get(normalizeString(row.historical_cotizacion_key)) || `missing-cot-${index + 1}`
      )
    );

  const simulatedRqIdMap = new Map(
    plannedRequerimientos
      .filter(isAllowedAction)
      .map((row, index) => [normalizeString(row.historical_rq_key), `sim-rq-${index + 1}`])
  );

  const detallePayloads = plannedDetalleRq
    .filter(isAllowedAction)
    .map((row, index) =>
      buildDetallePayload(
        row,
        simulatedRqIdMap.get(normalizeString(row.historical_rq_key)) || `missing-rq-${index + 1}`
      )
    );

  const issuePayloads = plannedImportIssues.map(buildImportIssuePayload);
  const duplicateFinalCodes = collectDuplicateValues(
    plannedRequerimientos.filter(isAllowedAction),
    (row) => row.codigo_para_importacion_final
  );

  const invalidPayloadColumns = {
    historical_import_batches: validateAllowedPayloadColumns(
      [
        {
          import_batch_id: normalizeString(batchId),
          source_file_name: "",
          source_file_path: "",
          status: "importing",
          total_cotizaciones: Number(plan.total_cotizaciones ?? 0),
          total_requerimientos: Number(plan.total_requerimientos ?? 0),
          total_detalle_rq: Number(plan.total_detalle_rq ?? 0),
          total_ok: 0,
          total_observado: 0,
          total_completar_datos: 0,
          total_critico_revisar: 0,
          metadata: {},
        },
      ],
      "historical_import_batches"
    ),
    cotizaciones: validateAllowedPayloadColumns(cotizacionPayloads, "cotizaciones"),
    requerimientos: validateAllowedPayloadColumns(requerimientoPayloads, "requerimientos"),
    requerimiento_items: validateAllowedPayloadColumns(detallePayloads, "requerimiento_items"),
    historical_import_issues: validateAllowedPayloadColumns(issuePayloads, "historical_import_issues"),
  };

  const payloadIssues = [
    ...validateNotNullPayloads(cotizacionPayloads, "cotizaciones", [
      "codigo",
      "proyecto",
      "moneda_codigo",
      "estado",
      "avance",
      "monto",
      "metadata",
    ]),
    ...validateNotNullPayloads(requerimientoPayloads, "requerimientos", [
      "codigo",
      "cotizacion_id",
      "estado",
      "avance",
      "total_rq",
      "metadata",
    ]),
    ...validateNotNullPayloads(detallePayloads, "requerimiento_items", [
      "requerimiento_id",
      "cantidad",
      "precio_unitario",
      "subtotal",
      "ajuste",
      "atencion_real",
      "cant_stock",
      "compra",
      "costo_unitario",
      "moneda_codigo",
      "tc",
      "factor_eq_herr",
      "costo_total_presupuestado",
      "estado",
      "metadata",
    ]),
  ];

  const blockers = [];
  const warnings = [];
  const validations = [];
  const requiredSqlBeforeExecute = [];

  const invalidPayloadColumnMessages = Object.entries(invalidPayloadColumns)
    .filter(([, columns]) => columns.length > 0)
    .map(([tableName, columns]) => `${tableName}: ${columns.join(", ")}`);

  if (invalidPayloadColumnMessages.length > 0) {
    addValidation(
      validations,
      "payload_allowed_columns_validation",
      "fail",
      "critical",
      `Se detectaron columnas no permitidas en payloads: ${invalidPayloadColumnMessages.join(" | ")}.`,
      "Corregir el mapeo local antes de una futura ejecucion real."
    );
    addBlocker(
      blockers,
      "invalid_payload_column",
      `Se detectaron columnas no permitidas en payloads: ${invalidPayloadColumnMessages.join(" | ")}.`
    );
  } else {
    addValidation(
      validations,
      "payload_allowed_columns_validation",
      "pass",
      "info",
      "Todos los payloads usan solo columnas permitidas por tabla.",
      "OK"
    );
  }

  const payloadValidationStatus =
    payloadIssues.length === 0 && invalidPayloadColumnMessages.length === 0 ? "passed" : "failed";
  addValidation(
    validations,
    "payload_not_null_validation",
    payloadIssues.length === 0 ? "pass" : "fail",
    payloadIssues.length === 0 ? "info" : "critical",
    payloadIssues.length === 0
      ? "Los payloads cumplen las columnas NOT NULL conocidas."
      : `Se detectaron ${payloadIssues.length} problemas contra columnas NOT NULL conocidas.`,
    payloadIssues.length === 0
      ? "OK"
      : "Revisar builders de payload antes de una futura ejecucion real."
  );
  if (payloadIssues.length > 0) {
    addBlocker(blockers, "payload_not_null_validation_failed", "Los payloads no cumplen columnas NOT NULL conocidas.");
  }

  if (duplicateFinalCodes.size > 0) {
    const duplicateCodes = [...duplicateFinalCodes.keys()];
    addValidation(
      validations,
      "duplicate_final_rq_code_check",
      "fail",
      "critical",
      `Se detectaron codigos finales duplicados para requerimientos: ${duplicateCodes.join(", ")}.`,
      "Corregir codigo_para_importacion_final antes de una futura ejecucion real."
    );
    addBlocker(
      blockers,
      "duplicate_final_rq_code_check_failed",
      `Se detectaron codigos finales duplicados para requerimientos: ${duplicateCodes.join(", ")}.`
    );
  } else {
    addValidation(
      validations,
      "duplicate_final_rq_code_check",
      "pass",
      "info",
      "No se detectaron duplicados en codigo_para_importacion_final.",
      "OK"
    );
  }

  if (client) {
    try {
      const { data: batchRows, error: batchError } = await client
        .from("historical_import_batches")
        .select("id,import_batch_id,status,metadata")
        .eq("import_batch_id", batchId)
        .limit(1);

      if (batchError) {
        warnings.push(
          `No se pudo verificar el estado actual del batch en historical_import_batches: ${normalizeString(batchError.message) || batchError.code || "sin detalle"}.`
        );
        addValidation(
          validations,
          "existing_batch_state_check",
          "warning",
          "warning",
          "No se pudo verificar el estado actual del batch en historical_import_batches.",
          "Revisar manualmente el batch en Supabase antes de una futura ejecucion real.",
          createSafeError(batchError, {
            table: "public.historical_import_batches",
          })
        );
      } else if ((batchRows ?? []).length > 0) {
        const existingBatch = batchRows[0];
        const insertedCounts = extractInsertedCountsFromBatchMetadata(existingBatch);
        const hasZeroInsertedMainData =
          insertedCounts.cotizaciones === 0 &&
          insertedCounts.requerimientos === 0 &&
          insertedCounts.detalle_rq === 0 &&
          insertedCounts.import_issues === 0;

        if (normalizeString(existingBatch.status) === "failed_partial" && hasZeroInsertedMainData) {
          const suggestedBatchId = suggestNextBatchId(batchId);
          addValidation(
            validations,
            "existing_failed_batch_zero_inserted",
            "fail",
            "critical",
            `El batch ${batchId} ya existe con status failed_partial y sin inserciones principales. Se recomienda usar ${suggestedBatchId}.`,
            `Preparar un nuevo lote, por ejemplo ${suggestedBatchId}, y no reutilizar ${batchId}.`
          );
          addBlocker(
            blockers,
            "existing_failed_batch_zero_inserted",
            `El batch ${batchId} ya existe como failed_partial sin inserciones principales. Preparar un nuevo batch, por ejemplo ${suggestedBatchId}.`
          );
        } else if (normalizeString(existingBatch.status) === "failed_partial") {
          const suggestedBatchId = suggestNextBatchId(batchId);
          requiredSqlBeforeExecute.push("supabase/sql/016_rollback_failed_partial_import_2026_002.sql");
          addValidation(
            validations,
            "existing_failed_batch_partial_inserted",
            "fail",
            "critical",
            `El batch ${batchId} ya existe con status failed_partial y con inserciones parciales. No se debe reutilizar.`,
            `Revisar rollback manual y preparar un nuevo lote, por ejemplo ${suggestedBatchId}.`
          );
          addBlocker(
            blockers,
            "existing_failed_batch_partial_inserted",
            `El batch ${batchId} ya existe como failed_partial con inserciones parciales. No reutilizarlo; preparar un nuevo batch, por ejemplo ${suggestedBatchId}.`
          );
        } else {
          addValidation(
            validations,
            "existing_batch_state_check",
            "fail",
            "critical",
            `El batch ${batchId} ya existe en historical_import_batches con status ${normalizeString(existingBatch.status)}.`,
            "No reutilizar el mismo batch-id para una nueva ejecucion real."
          );
          addBlocker(
            blockers,
            "existing_batch_already_present",
            `El batch ${batchId} ya existe en historical_import_batches.`
          );
        }
      } else {
        addValidation(
          validations,
          "existing_batch_state_check",
          "pass",
          "info",
          "El batch-id no existe actualmente en historical_import_batches.",
          "OK"
        );
      }
    } catch (error) {
      warnings.push(
        `No se pudo verificar el estado actual del batch en historical_import_batches: ${error instanceof Error ? error.message : "sin detalle"}.`
      );
      addValidation(
        validations,
        "existing_batch_state_check",
        "warning",
        "warning",
        "No se pudo verificar el estado actual del batch en historical_import_batches.",
        "Revisar manualmente el batch en Supabase antes de una futura ejecucion real."
      );
    }
  }

  let permissionReadinessStatus = "warning";
  const permissionTables = ["cotizaciones", "requerimientos", "requerimiento_items", "historical_import_batches"];
  const grantIntrospection = await tryReadGrantMetadata(client, permissionTables);
  const policyIntrospection = await tryReadPolicyMetadata(client, ["cotizaciones", "requerimientos", "requerimiento_items"]);

  if (!grantIntrospection.ok || !policyIntrospection.ok) {
    permissionReadinessStatus = "warning";
    requiredSqlBeforeExecute.push("supabase/sql/015_historical_import_execute_permissions.sql");
    if (grantIntrospection.warning) warnings.push(grantIntrospection.warning);
    if (policyIntrospection.warning) warnings.push(policyIntrospection.warning);
    addValidation(
      validations,
      "insert_permission_introspection",
      "warning",
      "warning",
      "No se pudo confirmar completamente GRANT/INSERT y politicas RLS INSERT desde el cliente actual.",
      "Revisar y, si aplica, ejecutar la propuesta SQL 015 en entorno controlado."
    );
  } else {
    const rows = grantIntrospection.rows;
    const hasInsertCotizaciones = rows.some((row) => row.table_name === "cotizaciones" && row.privilege_type === "INSERT");
    const hasInsertRequerimientos = rows.some((row) => row.table_name === "requerimientos" && row.privilege_type === "INSERT");
    const hasInsertItems = rows.some((row) => row.table_name === "requerimiento_items" && row.privilege_type === "INSERT");
    const policies = policyIntrospection.rows;
    const hasCotPolicy = policies.some((row) => row.tablename === "cotizaciones" && row.cmd === "INSERT");
    const hasReqPolicy = policies.some((row) => row.tablename === "requerimientos" && row.cmd === "INSERT");
    const hasItemPolicy = policies.some((row) => row.tablename === "requerimiento_items" && row.cmd === "INSERT");

    const missingPieces = [];
    if (!hasInsertCotizaciones) missingPieces.push("GRANT INSERT cotizaciones");
    if (!hasInsertRequerimientos) missingPieces.push("GRANT INSERT requerimientos");
    if (!hasInsertItems) missingPieces.push("GRANT INSERT requerimiento_items");
    if (!hasCotPolicy) missingPieces.push("RLS INSERT cotizaciones");
    if (!hasReqPolicy) missingPieces.push("RLS INSERT requerimientos");
    if (!hasItemPolicy) missingPieces.push("RLS INSERT requerimiento_items");

    if (missingPieces.length > 0) {
      permissionReadinessStatus = "failed";
      requiredSqlBeforeExecute.push("supabase/sql/015_historical_import_execute_permissions.sql");
      addValidation(
        validations,
        "insert_permission_readiness",
        "fail",
        "critical",
        `Faltan permisos/politicas para INSERT: ${missingPieces.join(", ")}.`,
        "Revisar y, si aplica, ejecutar la propuesta SQL 015 antes de una futura ejecucion real."
      );
      addBlocker(
        blockers,
        "insert_permission_readiness_failed",
        `Faltan permisos/politicas para INSERT: ${missingPieces.join(", ")}.`
      );
    } else {
      permissionReadinessStatus = "passed";
      addValidation(
        validations,
        "insert_permission_readiness",
        "pass",
        "info",
        "Los permisos y politicas INSERT requeridos parecen presentes para las tablas principales.",
        "OK"
      );
    }
  }

  const executeBranchReady =
    plan.can_execute === true &&
    normalizeString(plan.remote_validation_status) === "passed" &&
    blockers.length === 0 &&
    payloadValidationStatus === "passed" &&
    permissionReadinessStatus !== "failed";

  const review = {
    import_batch_id: batchId,
    execute_branch_ready: executeBranchReady,
    payload_validation_status: payloadValidationStatus,
    remote_validation_status: normalizeString(plan.remote_validation_status),
    permission_readiness_status: permissionReadinessStatus,
    required_sql_before_execute: [...new Set(requiredSqlBeforeExecute)],
    blockers,
    warnings,
    total_payload_cotizaciones: cotizacionPayloads.length,
    total_payload_requerimientos: requerimientoPayloads.length,
    total_payload_items: detallePayloads.length,
    total_payload_issues: issuePayloads.length,
    final_recommendation: executeBranchReady
      ? "La rama --execute queda lista desde el preflight, pero aun requiere aprobacion humana antes de cualquier ejecucion real."
      : "La rama --execute aun no debe usarse. Resolver blockers de payload o permisos antes de una futura carga real.",
  };

  writeJson(path.join(executionDir, "preflight_execute_review.json"), review);
  writeCsv(
    path.join(executionDir, "preflight_execute_validation.csv"),
    ["validation_name", "status", "severity", "message", "suggested_action", "safe_error_code", "safe_error_message"],
    validations
  );
  fs.writeFileSync(
    path.join(executionDir, "preflight_execute_report.md"),
    buildPreflightReportMarkdown(review),
    "utf8"
  );

  return review;
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

function getExecutionDir(baseDir) {
  const normalizedBaseName = path.basename(baseDir).toLowerCase();
  if (normalizedBaseName === "dry_run") {
    return path.join(path.dirname(baseDir), "import_execution");
  }
  return path.join(baseDir, "import_execution");
}

async function runSelectOnlyChecks({
  client,
  batchId,
  plannedCotizaciones,
  plannedRequerimientos,
  validations,
  blockers,
  remoteContext,
}) {
  const adminEmail = process.env.HISTORICAL_IMPORT_ADMIN_EMAIL ?? "";
  const adminPassword = process.env.HISTORICAL_IMPORT_ADMIN_PASSWORD ?? "";
  remoteContext.session_detected = false;
  remoteContext.authenticated_user = {
    id: "",
    email: "",
  };

  const addSkippedRemoteChecks = (reasonMessage, suggestedAction) => {
    const skippedChecks = [
      "supabase_session_available",
      "supabase_user_detected",
      "supabase_user_email_matches_env",
      "supabase_super_admin_check",
      "remote_batch_conflict_check",
      "remote_cotizacion_conflict_check",
      "remote_requerimiento_conflict_check",
      "remote_metadata_key_check",
    ];

    for (const checkName of skippedChecks) {
      recordRemoteCheck(remoteContext, checkName, "skipped", reasonMessage);
      addValidation(
        validations,
        checkName,
        "skipped",
        "warning",
        reasonMessage,
        suggestedAction
      );
    }
  };

  if (!client) {
    remoteContext.mode = "unavailable";
    remoteContext.status = "skipped";
    recordRemoteCheck(
      remoteContext,
      "supabase_env_available",
      "warning",
      "No se encontro configuracion segura de Supabase para chequeos remotos."
    );
    remoteContext.warnings.push(
      "No se encontro configuracion segura de Supabase para chequeos remotos."
    );
    addValidation(
      validations,
      "supabase_env_available",
      "warning",
      "warning",
      "No se encontro configuracion segura de Supabase para chequeos remotos.",
      "Definir NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY si se quiere validar por SELECT."
    );
    addBlocker(blockers, "missing_supabase_client", "No se pudo crear cliente Supabase para validacion remota.");
    addSkippedRemoteChecks(
      "Chequeo remoto omitido porque no se pudo crear cliente Supabase.",
      "Definir NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY para habilitar validaciones remotas."
    );
    return;
  }

  remoteContext.mode = "available";
  recordRemoteCheck(
    remoteContext,
    "supabase_env_available",
    "pass",
    "Se encontro configuracion base de Supabase para chequeos remotos."
  );
  addValidation(
    validations,
    "supabase_env_available",
    "pass",
    "info",
    "Se encontro configuracion base de Supabase para chequeos remotos.",
    "OK"
  );

  if (!adminEmail || !adminPassword) {
    setRemoteStatus(remoteContext, "warning");
    recordRemoteCheck(
      remoteContext,
      "supabase_auth_success",
      "warning",
      "Faltan credenciales normales para autenticacion remota."
    );
    remoteContext.warnings.push(
      "Faltan HISTORICAL_IMPORT_ADMIN_EMAIL y/o HISTORICAL_IMPORT_ADMIN_PASSWORD para validacion remota autenticada."
    );
    addValidation(
      validations,
      "supabase_auth_success",
      "warning",
      "warning",
      "No existen credenciales de autenticacion normal para ejecutar validaciones remotas autenticadas.",
      "Definir HISTORICAL_IMPORT_ADMIN_EMAIL y HISTORICAL_IMPORT_ADMIN_PASSWORD para habilitar chequeos previos a una futura ejecucion real."
    );
    addBlocker(
      blockers,
      "missing_supabase_credentials",
      "Faltan HISTORICAL_IMPORT_ADMIN_EMAIL y/o HISTORICAL_IMPORT_ADMIN_PASSWORD para una futura ejecucion real."
    );
    addSkippedRemoteChecks(
      "Chequeo remoto autenticado omitido porque faltan credenciales normales.",
      "Definir HISTORICAL_IMPORT_ADMIN_EMAIL y HISTORICAL_IMPORT_ADMIN_PASSWORD."
    );
    return;
  }

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (signInError) {
    const safeError = createSafeError(signInError, {
      check_type: "supabase_auth",
    });
    setRemoteStatus(remoteContext, "failed");
    recordRemoteCheck(
      remoteContext,
      "supabase_auth_success",
      "fail",
      "No se pudo autenticar con credenciales normales para chequeos remotos.",
      { safe_error_code: safeError.code }
    );
    registerRemoteError(remoteContext, safeError);
    addValidation(
      validations,
      "supabase_auth_success",
      "fail",
      "critical",
      "No se pudo autenticar con credenciales normales para chequeos remotos.",
      "Verificar HISTORICAL_IMPORT_ADMIN_EMAIL / HISTORICAL_IMPORT_ADMIN_PASSWORD y permisos RLS.",
      safeError
    );
    addBlocker(
      blockers,
      "auth_failed",
      "No se pudo autenticar contra Supabase para una futura ejecucion real."
    );
    addSkippedRemoteChecks(
      "Chequeo remoto posterior omitido porque la autenticacion fallo.",
      "Verificar credenciales y acceso RLS antes de reintentar."
    );
    return;
  }

  const session = signInData?.session ?? null;
  const authUser = signInData?.user ?? session?.user ?? null;
  const normalizedAdminEmail = adminEmail.toLowerCase();
  const authenticatedEmail = normalizeString(authUser?.email).toLowerCase();

  if (!session) {
    setRemoteStatus(remoteContext, "failed");
    recordRemoteCheck(
      remoteContext,
      "supabase_session_available",
      "fail",
      "La autenticacion respondio sin session utilizable."
    );
    addValidation(
      validations,
      "supabase_session_available",
      "fail",
      "critical",
      "La autenticacion respondio sin session utilizable.",
      "Revisar credenciales normales y configuracion de auth en Supabase."
    );
    addBlocker(blockers, "supabase_session_missing", "No se obtuvo session autenticada para chequeos remotos.");
    addSkippedRemoteChecks(
      "Chequeo remoto posterior omitido porque no existe session autenticada.",
      "Corregir autenticacion normal antes de reintentar."
    );
    return;
  }

  remoteContext.session_detected = true;
  addValidation(
    validations,
    "supabase_session_available",
    "pass",
    "info",
    "La autenticacion devolvio una session valida para chequeos remotos.",
    "OK"
  );
  recordRemoteCheck(
    remoteContext,
    "supabase_session_available",
    "pass",
    "La autenticacion devolvio una session valida para chequeos remotos."
  );

  if (!authUser?.id || !authUser?.email) {
    setRemoteStatus(remoteContext, "failed");
    recordRemoteCheck(
      remoteContext,
      "supabase_user_detected",
      "fail",
      "La session no devolvio user.id y user.email completos."
    );
    addValidation(
      validations,
      "supabase_user_detected",
      "fail",
      "critical",
      "La session no devolvio user.id y user.email completos.",
      "Verificar el flujo de autenticacion normal antes de reintentar."
    );
    addBlocker(
      blockers,
      "supabase_user_missing",
      "La session autenticada no devolvio user.id y user.email completos."
    );
    addSkippedRemoteChecks(
      "Chequeo remoto posterior omitido porque no se detecto usuario autenticado completo.",
      "Corregir autenticacion normal antes de reintentar."
    );
    return;
  }

  remoteContext.authenticated_user = {
    id: normalizeString(authUser.id),
    email: normalizeString(authUser.email),
  };

  addValidation(
    validations,
    "supabase_user_detected",
    "pass",
    "info",
    `Usuario autenticado detectado para chequeos remotos: ${normalizeString(authUser.email)}.`,
    "OK"
  );
  recordRemoteCheck(
    remoteContext,
    "supabase_user_detected",
    "pass",
    "Usuario autenticado detectado para chequeos remotos.",
    {
      user_id_detected: normalizeString(authUser.id),
      user_email_detected: normalizeString(authUser.email),
    }
  );

  if (authenticatedEmail !== normalizedAdminEmail) {
    setRemoteStatus(remoteContext, "failed");
    recordRemoteCheck(
      remoteContext,
      "supabase_user_email_matches_env",
      "fail",
      "El email autenticado no coincide con HISTORICAL_IMPORT_ADMIN_EMAIL."
    );
    addValidation(
      validations,
      "supabase_user_email_matches_env",
      "fail",
      "critical",
      "El email autenticado no coincide con HISTORICAL_IMPORT_ADMIN_EMAIL.",
      "Revisar credenciales normales y variables locales."
    );
    addBlocker(
      blockers,
      "supabase_user_email_mismatch",
      "El email autenticado no coincide con HISTORICAL_IMPORT_ADMIN_EMAIL."
    );
    addSkippedRemoteChecks(
      "Chequeo remoto posterior omitido porque el email autenticado no coincide con la configuracion esperada.",
      "Corregir credenciales normales o variables locales."
    );
    return;
  }

  addValidation(
    validations,
    "supabase_user_email_matches_env",
    "pass",
    "info",
    "El email autenticado coincide con HISTORICAL_IMPORT_ADMIN_EMAIL.",
    "OK"
  );
  recordRemoteCheck(
    remoteContext,
    "supabase_user_email_matches_env",
    "pass",
    "El email autenticado coincide con HISTORICAL_IMPORT_ADMIN_EMAIL."
  );

  addValidation(
    validations,
    "supabase_auth_success",
    "pass",
    "info",
    "Autenticacion normal de Supabase disponible para chequeos previos a ejecucion real.",
    "Mantener credenciales fuera del repo."
  );
  recordRemoteCheck(
    remoteContext,
    "supabase_auth_success",
    "pass",
    "Autenticacion normal disponible para chequeos remotos."
  );

  const { data: profileRows, error: profileError } = await client
    .from("user_profiles")
    .select("id,email,status,is_super_admin")
    .eq("id", authUser.id)
    .limit(1);

  const profileRow = profileRows?.[0] ?? null;
  const approvedFallback =
    normalizeString(profileRow?.status).toLowerCase() === "approved" &&
    normalizeString(profileRow?.email).toLowerCase() === FALLBACK_SUPER_ADMIN_EMAIL;

  if (profileError) {
    const safeError = createSafeError(profileError, {
      check_type: "user_profiles_select",
      table: "public.user_profiles",
      session_detected: remoteContext.session_detected,
      authenticated_user_id: remoteContext.authenticated_user.id,
      authenticated_user_email: remoteContext.authenticated_user.email,
    });
    setRemoteStatus(remoteContext, "failed");
    recordRemoteCheck(
      remoteContext,
      "supabase_super_admin_check",
      "fail",
      "No se pudo consultar public.user_profiles para confirmar super admin.",
      { safe_error_code: safeError.code }
    );
    registerRemoteError(remoteContext, safeError);
    addValidation(
      validations,
      "supabase_super_admin_check",
      "fail",
      "critical",
      "No se pudo consultar public.user_profiles para confirmar super admin.",
      "Revisar RLS de user_profiles o confirmar que el usuario autenticado este aprobado.",
      safeError
    );
    addBlocker(
      blockers,
      "user_profiles_select_failed",
      "No se pudo consultar public.user_profiles para confirmar super admin."
    );
    addSkippedRemoteChecks(
      "Chequeo remoto posterior omitido porque fallo la consulta a user_profiles.",
      "Revisar RLS o confirmar que el usuario autenticado tenga acceso aprobado."
    );
    return;
  }

  if (
    !profileRow ||
    normalizeString(profileRow.status).toLowerCase() !== "approved" ||
    (profileRow.is_super_admin !== true && !approvedFallback)
  ) {
    setRemoteStatus(remoteContext, "failed");
    recordRemoteCheck(
      remoteContext,
      "supabase_super_admin_check",
      "fail",
      "La cuenta autenticada no pudo validarse como super admin approved.",
      {
        user_email_detected: normalizeString(profileRow?.email ?? authUser.email),
        user_status_detected: normalizeString(profileRow?.status),
        is_super_admin_detected: profileRow?.is_super_admin === true ? "true" : "false",
      }
    );
    addValidation(
      validations,
      "supabase_super_admin_check",
      "fail",
      "critical",
      "La cuenta autenticada no pudo validarse como super admin approved.",
      "Confirmar user_profiles.is_super_admin = true o fallback aprobado, y status = approved."
    );
    addBlocker(
      blockers,
      "super_admin_check_failed",
      "La cuenta autenticada no cumple con el patron de super admin requerido."
    );
    addSkippedRemoteChecks(
      "Chequeo remoto posterior omitido porque no se pudo confirmar super admin.",
      "Confirmar user_profiles.is_super_admin y status approved."
    );
    return;
  }

  addValidation(
    validations,
    "supabase_super_admin_check",
    "pass",
    "info",
    "La cuenta autenticada cumple el patron de super admin approved.",
    "OK"
  );
  recordRemoteCheck(
    remoteContext,
    "supabase_super_admin_check",
    "pass",
    "La cuenta autenticada cumple el patron de super admin approved.",
    {
      user_email_detected: normalizeString(profileRow.email),
      user_status_detected: normalizeString(profileRow.status),
      is_super_admin_detected: profileRow.is_super_admin === true ? "true" : "false",
    }
  );

  const { data: batchRows, error: batchError } = await client
    .from("historical_import_batches")
    .select("id,import_batch_id")
    .eq("import_batch_id", batchId)
    .limit(1);

  remoteContext.remote_checked_counts.batch_import_batch_id = 1;

  if (batchError) {
    const safeError = createSafeError(batchError, {
      check_type: "remote_batch_conflict_check",
      table: "public.historical_import_batches",
      values_checked: 1,
      session_detected: remoteContext.session_detected,
      authenticated_user_id: remoteContext.authenticated_user.id,
      authenticated_user_email: remoteContext.authenticated_user.email,
    });
    setRemoteStatus(remoteContext, "failed");
    recordRemoteCheck(
      remoteContext,
      "remote_batch_conflict_check",
      "fail",
      "No se pudo verificar si el batch ya existe en historical_import_batches.",
      { safe_error_code: safeError.code, values_checked: 1 }
    );
    registerRemoteError(remoteContext, safeError);
    remoteContext.warnings.push(
      "No se pudo verificar remotamente si el batch ya existe en historical_import_batches."
    );
    addValidation(
      validations,
      "remote_batch_conflict_check",
      "fail",
      "critical",
      "No se pudo verificar si el batch ya existe en historical_import_batches.",
      "Revisar RLS y acceso select para historical_import_batches.",
      safeError
    );
    addBlocker(blockers, "remote_batch_check_failed", "No se pudo verificar remotamente si el batch ya existe.");
  } else if ((batchRows ?? []).length > 0) {
    setRemoteStatus(remoteContext, "failed");
    remoteContext.remote_conflicts_found.batch_import_batch_id = 1;
    recordRemoteCheck(
      remoteContext,
      "remote_batch_conflict_check",
      "fail",
      `El import_batch_id ${batchId} ya existe en historical_import_batches.`,
      { conflicts_found: 1 }
    );
    addValidation(
      validations,
      "remote_batch_conflict_check",
      "fail",
      "critical",
      `El import_batch_id ${batchId} ya existe en historical_import_batches.`,
      "Usar un batch nuevo o revisar el lote previo."
    );
    addBlocker(blockers, "batch_already_exists", `El batch ${batchId} ya existe en historical_import_batches.`);
  } else {
    remoteContext.remote_conflicts_found.batch_import_batch_id = 0;
    recordRemoteCheck(
      remoteContext,
      "remote_batch_conflict_check",
      "pass",
      `El import_batch_id ${batchId} no existe en historical_import_batches.`,
      { conflicts_found: 0 }
    );
    addValidation(
      validations,
      "remote_batch_conflict_check",
      "pass",
      "info",
      `El import_batch_id ${batchId} no existe en historical_import_batches.`,
      "OK"
    );
  }

  const cotizacionCodigos = getUniqueNormalizedValues(plannedCotizaciones, "codigo");
  remoteContext.remote_checked_counts.cotizacion_codigos = cotizacionCodigos.length;
  const {
    data: existingCotizaciones,
    error: existingCotizacionesError,
    chunkCount: cotizacionChunkCount,
  } = await queryByChunks({
    client,
    table: "cotizaciones",
    selectColumns: "codigo",
    column: "codigo",
    values: cotizacionCodigos,
  });

  if (existingCotizacionesError) {
    const safeError = createSafeError(existingCotizacionesError, {
      check_type: "remote_cotizacion_conflict_check",
      table: "public.cotizaciones",
      values_checked: cotizacionCodigos.length,
      chunk_count: cotizacionChunkCount,
      session_detected: remoteContext.session_detected,
      authenticated_user_id: remoteContext.authenticated_user.id,
      authenticated_user_email: remoteContext.authenticated_user.email,
    });
    setRemoteStatus(remoteContext, "failed");
    recordRemoteCheck(
      remoteContext,
      "remote_cotizacion_conflict_check",
      "fail",
      "No se pudo verificar existencia remota de codigos de cotizacion.",
      {
        safe_error_code: safeError.code,
        values_checked: cotizacionCodigos.length,
        chunk_count: cotizacionChunkCount,
      }
    );
    registerRemoteError(remoteContext, safeError);
    remoteContext.warnings.push(
      "No se pudo verificar remotamente la existencia de codigos de cotizacion."
    );
    addValidation(
      validations,
      "remote_cotizacion_conflict_check",
      "fail",
      "critical",
      "No se pudo verificar existencia remota de codigos de cotizacion.",
      "Revisar RLS o el acceso SELECT sobre public.cotizaciones.",
      safeError
    );
    addBlocker(
      blockers,
      "remote_cotizacion_check_failed",
      "No se pudo verificar remotamente la existencia de codigos de cotizacion."
    );
  } else if ((existingCotizaciones ?? []).length > 0) {
    const existingCotizacionCodes = [...new Set(existingCotizaciones.map((row) => normalizeString(row.codigo)).filter(Boolean))];
    setRemoteStatus(remoteContext, "failed");
    remoteContext.remote_conflicts_found.cotizacion_codigos = existingCotizacionCodes.length;
    recordRemoteCheck(
      remoteContext,
      "remote_cotizacion_conflict_check",
      "fail",
      `Se detectaron ${existingCotizacionCodes.length} codigos de cotizacion ya existentes en Supabase.`,
      {
        conflicts_found: existingCotizacionCodes.length,
        values_checked: cotizacionCodigos.length,
        chunk_count: cotizacionChunkCount,
      }
    );
    addValidation(
      validations,
      "remote_cotizacion_conflict_check",
      "fail",
      "critical",
      `Se detectaron ${existingCotizacionCodes.length} codigos de cotizacion ya existentes en Supabase.`,
      "Revisar planned_cotizaciones.csv antes de una ejecucion real."
    );
    addBlocker(
      blockers,
      "cotizacion_codigo_conflicts_detected",
      "Se detectaron codigos de cotizacion ya existentes en Supabase."
    );
  } else {
    remoteContext.remote_conflicts_found.cotizacion_codigos = 0;
    recordRemoteCheck(
      remoteContext,
      "remote_cotizacion_conflict_check",
      "pass",
      "No se detectaron codigos de cotizacion existentes en Supabase para el lote.",
      {
        conflicts_found: 0,
        values_checked: cotizacionCodigos.length,
        chunk_count: cotizacionChunkCount,
      }
    );
    addValidation(
      validations,
      "remote_cotizacion_conflict_check",
      "pass",
      "info",
      "No se detectaron codigos de cotizacion existentes en Supabase para el lote.",
      "OK"
    );
  }

  const requerimientoCodigos = [
    ...new Set(
      plannedRequerimientos
        .filter(isAllowedAction)
        .map((row) => normalizeString(row.codigo_para_importacion_final) || getRequirementImportCodeBase(row))
        .filter(Boolean)
    ),
  ];
  remoteContext.remote_checked_counts.requerimiento_codigos = requerimientoCodigos.length;
  const {
    data: existingRequerimientos,
    error: existingRequerimientosError,
    chunkCount: requerimientoChunkCount,
  } = await queryByChunks({
    client,
    table: "requerimientos",
    selectColumns: "codigo",
    column: "codigo",
    values: requerimientoCodigos,
  });

  if (existingRequerimientosError) {
    const safeError = createSafeError(existingRequerimientosError, {
      check_type: "remote_requerimiento_conflict_check",
      table: "public.requerimientos",
      values_checked: requerimientoCodigos.length,
      chunk_count: requerimientoChunkCount,
      session_detected: remoteContext.session_detected,
      authenticated_user_id: remoteContext.authenticated_user.id,
      authenticated_user_email: remoteContext.authenticated_user.email,
    });
    setRemoteStatus(remoteContext, "failed");
    recordRemoteCheck(
      remoteContext,
      "remote_requerimiento_conflict_check",
      "fail",
      "No se pudo verificar existencia remota de codigos de requerimiento.",
      {
        safe_error_code: safeError.code,
        values_checked: requerimientoCodigos.length,
        chunk_count: requerimientoChunkCount,
      }
    );
    registerRemoteError(remoteContext, safeError);
    remoteContext.warnings.push(
      "No se pudo verificar remotamente la existencia de codigos de requerimiento."
    );
    addValidation(
      validations,
      "remote_requerimiento_conflict_check",
      "fail",
      "critical",
      "No se pudo verificar existencia remota de codigos de requerimiento.",
      "Revisar RLS o el acceso SELECT sobre public.requerimientos.",
      safeError
    );
    addBlocker(
      blockers,
      "remote_requerimiento_check_failed",
      "No se pudo verificar remotamente la existencia de codigos de requerimiento."
    );
  } else if ((existingRequerimientos ?? []).length > 0) {
    const existingRqCodes = [...new Set(existingRequerimientos.map((row) => normalizeString(row.codigo)).filter(Boolean))];
    setRemoteStatus(remoteContext, "failed");
    remoteContext.remote_conflicts_found.requerimiento_codigos = existingRqCodes.length;
    recordRemoteCheck(
      remoteContext,
      "remote_requerimiento_conflict_check",
      "fail",
      `Se detectaron ${existingRqCodes.length} codigos de requerimiento ya existentes en Supabase.`,
      {
        conflicts_found: existingRqCodes.length,
        values_checked: requerimientoCodigos.length,
        chunk_count: requerimientoChunkCount,
      }
    );
    addValidation(
      validations,
      "remote_requerimiento_conflict_check",
      "fail",
      "critical",
      `Se detectaron ${existingRqCodes.length} codigos de requerimiento ya existentes en Supabase.`,
      "Revisar planned_requerimientos.csv antes de una ejecucion real."
    );
    addBlocker(
      blockers,
      "requerimiento_codigo_conflicts_detected",
      "Se detectaron codigos de requerimiento ya existentes en Supabase."
    );
  } else {
    remoteContext.remote_conflicts_found.requerimiento_codigos = 0;
    recordRemoteCheck(
      remoteContext,
      "remote_requerimiento_conflict_check",
      "pass",
      "No se detectaron codigos de requerimiento existentes en Supabase para el lote.",
      {
        conflicts_found: 0,
        values_checked: requerimientoCodigos.length,
        chunk_count: requerimientoChunkCount,
      }
    );
    addValidation(
      validations,
      "remote_requerimiento_conflict_check",
      "pass",
      "info",
      "No se detectaron codigos de requerimiento existentes en Supabase para el lote.",
      "OK"
    );
  }

  if (existingCotizacionesError || existingRequerimientosError) {
    setRemoteStatus(remoteContext, "warning");
    recordRemoteCheck(
      remoteContext,
      "remote_metadata_key_check",
      "warning",
      "La consulta de metadata historica se omitio porque fallaron checks base de lectura remota.",
      {
        values_checked: 0,
      }
    );
    remoteContext.warnings.push(
      "La verificacion remota de metadata.historical_import se omitio porque fallaron checks base de lectura remota."
    );
    addValidation(
      validations,
      "remote_metadata_key_check",
      "warning",
      "warning",
      "La consulta de metadata historica se omitio porque fallaron checks base de lectura remota.",
      "Resolver primero los permisos SELECT/RLS sobre tablas base antes de revisar metadata.historical_import."
    );
    return;
  }

  const cotizacionKeys = getUniqueNormalizedValues(plannedCotizaciones, "historical_cotizacion_key");
  const requerimientoKeys = getUniqueNormalizedValues(plannedRequerimientos, "historical_rq_key");
  remoteContext.remote_checked_counts.metadata_historical_cotizacion_keys = Math.min(
    cotizacionKeys.length,
    METADATA_CHECK_SAMPLE_SIZE
  );
  remoteContext.remote_checked_counts.metadata_historical_rq_keys = Math.min(
    requerimientoKeys.length,
    METADATA_CHECK_SAMPLE_SIZE
  );

  try {
    let metadataCotizacionConflicts = 0;
    let metadataRqConflicts = 0;

    for (const historicalCotizacionKey of cotizacionKeys.slice(0, METADATA_CHECK_SAMPLE_SIZE)) {
      const { count, error } = await client
        .from("cotizaciones")
        .select("id", { count: "exact", head: true })
        .contains("metadata", { historical_import: { historical_cotizacion_key: historicalCotizacionKey } });

      if (error) {
        throw error;
      }

      metadataCotizacionConflicts += count ?? 0;
    }

    for (const historicalRqKey of requerimientoKeys.slice(0, METADATA_CHECK_SAMPLE_SIZE)) {
      const { count, error } = await client
        .from("requerimientos")
        .select("id", { count: "exact", head: true })
        .contains("metadata", { historical_import: { historical_rq_key: historicalRqKey } });

      if (error) {
        throw error;
      }

      metadataRqConflicts += count ?? 0;
    }

    const metadataKeyConflicts = metadataCotizacionConflicts + metadataRqConflicts;
    remoteContext.remote_conflicts_found.metadata_historical_cotizacion_keys = metadataCotizacionConflicts;
    remoteContext.remote_conflicts_found.metadata_historical_rq_keys = metadataRqConflicts;

    if (metadataKeyConflicts > 0) {
      setRemoteStatus(remoteContext, "warning");
      recordRemoteCheck(
        remoteContext,
        "remote_metadata_key_check",
        "warning",
        `Se detectaron ${metadataKeyConflicts} claves historicas ya presentes en metadata dentro del muestreo remoto.`,
        {
          conflicts_found: metadataKeyConflicts,
          values_checked:
            remoteContext.remote_checked_counts.metadata_historical_cotizacion_keys +
            remoteContext.remote_checked_counts.metadata_historical_rq_keys,
        }
      );
      remoteContext.warnings.push(
        `Se detectaron ${metadataKeyConflicts} claves historicas ya presentes en metadata dentro del muestreo remoto.`
      );
      addValidation(
        validations,
        "remote_metadata_key_check",
        "warning",
        "warning",
        `Se detectaron ${metadataKeyConflicts} claves historicas ya presentes en metadata dentro del muestreo remoto.`,
        "Revisar metadata.historical_import manualmente antes de una futura ejecucion real."
      );
    } else {
      recordRemoteCheck(
        remoteContext,
        "remote_metadata_key_check",
        "pass",
        "No se detectaron claves historicas previas en metadata dentro del muestreo remoto.",
        {
          conflicts_found: 0,
          values_checked:
            remoteContext.remote_checked_counts.metadata_historical_cotizacion_keys +
            remoteContext.remote_checked_counts.metadata_historical_rq_keys,
        }
      );
      addValidation(
        validations,
        "remote_metadata_key_check",
        "pass",
        "info",
        "No se detectaron claves historicas previas en metadata dentro del muestreo remoto.",
        "OK"
      );
    }
  } catch (error) {
    const safeError = createSafeError(error, {
      check_type: "remote_metadata_key_check",
      table: "public.cotizaciones/public.requerimientos",
      values_checked:
        remoteContext.remote_checked_counts.metadata_historical_cotizacion_keys +
        remoteContext.remote_checked_counts.metadata_historical_rq_keys,
      session_detected: remoteContext.session_detected,
      authenticated_user_id: remoteContext.authenticated_user.id,
      authenticated_user_email: remoteContext.authenticated_user.email,
    });
    setRemoteStatus(remoteContext, "warning");
    recordRemoteCheck(
      remoteContext,
      "remote_metadata_key_check",
      "warning",
      "La consulta de metadata historica no fue viable de forma segura con el cliente actual.",
      {
        safe_error_code: safeError.code,
        values_checked: safeError.values_checked,
      }
    );
    registerRemoteError(remoteContext, safeError);
    remoteContext.warnings.push(
      "La verificacion remota de metadata.historical_import no fue viable de forma segura con el cliente actual."
    );
    addValidation(
      validations,
      "remote_metadata_key_check",
      "warning",
      "warning",
      "La consulta de metadata historica no fue viable de forma segura con el cliente actual.",
      "Mantener esta validacion como warning y revisar manualmente si se requiere mas certeza.",
      safeError
    );
  }

  if (!remoteContext.status || remoteContext.status === "skipped") {
    remoteContext.status = remoteContext.warnings.length > 0 ? "warning" : "passed";
  } else if (remoteContext.status !== "failed" && remoteContext.status !== "warning") {
    remoteContext.status = "passed";
  }
}

function buildReportMarkdown({
  batchId,
  mode,
  canExecute,
  blockers,
  totals,
  readinessStatus,
  totalConflicts,
  requiredConfirmations,
  recommendation,
  validations,
  remoteContext,
}) {
  const lines = [
    "# Plan de ejecucion controlada de importacion historica observada",
    "",
    `- Batch: \`${batchId}\``,
    `- Modo: \`${mode}\``,
    `- readiness_status: \`${readinessStatus}\``,
    `- total_conflicts: ${totalConflicts}`,
    `- can_execute: ${canExecute ? "true" : "false"}`,
    "",
    "## Confirmacion de seguridad",
    "- No se inserto nada.",
    "- No se ejecuto SQL.",
    "- No se modifico Supabase.",
    "",
    "## Validacion remota",
    `- remote_validation_mode: \`${remoteContext.mode}\``,
    `- remote_validation_status: \`${remoteContext.status}\``,
    `- session_detected: ${remoteContext.session_detected ? "true" : "false"}`,
    `- authenticated_user_email: ${remoteContext.authenticated_user.email || "(no detectado)"}`,
    "",
    "## Totales del lote",
    `- Cotizaciones: ${totals.cotizaciones}`,
    `- Requerimientos: ${totals.requerimientos}`,
    `- Detalle RQ: ${totals.detalle_rq}`,
    `- Import issues planeados: ${totals.import_issues}`,
    "",
    "## Flags requeridos para una futura ejecucion real",
  ];

  for (const flag of requiredConfirmations) {
    lines.push(`- ${flag}`);
  }

  lines.push("", "## Blockers");

  if (blockers.length === 0) {
    lines.push("- No se detectaron blockers para preparar una futura ejecucion controlada.");
  } else {
    for (const blocker of blockers) {
      lines.push(`- ${blocker.code}: ${blocker.message}`);
    }
  }

  lines.push("", "## Remote warnings");
  if (remoteContext.warnings.length === 0) {
    lines.push("- No se registraron warnings remotos.");
  } else {
    for (const warning of remoteContext.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push("", "## Remote checks");
  for (const check of remoteContext.checks) {
    lines.push(`- [${check.status}] ${check.check_name}: ${check.message}`);
  }

  lines.push("", "## Errores remotos seguros");
  if (remoteContext.remote_errors_safe.length === 0) {
    lines.push("- No se registraron errores remotos seguros.");
  } else {
    for (const error of remoteContext.remote_errors_safe) {
      lines.push(
        `- ${error.check_type || "remote_check"} | tabla=${error.table || "n/a"} | code=${error.code} | message=${error.message}`
      );
    }
  }

  lines.push("", "## Validaciones realizadas");
  for (const validation of validations) {
    lines.push(`- [${validation.status}] ${validation.validation_name}: ${validation.message}`);
  }

  lines.push(
    "",
    "## Riesgos pendientes",
    "- El modo real sigue bloqueado si faltan credenciales normales o confirmaciones explicitas.",
    "- La ausencia de conflictos no reemplaza la revision funcional del lote.",
    "- Los registros CRITICO_REVISAR deben mantenerse como review_required en una futura carga observada.",
    "",
    "## Recomendacion",
    `- ${recommendation}`,
    "",
    "## Checklist antes de autorizar modo real",
    "- [ ] Revisar blockers",
    "- [ ] Revisar import_execution_validation.csv",
    "- [ ] Confirmar credenciales normales de super admin",
    "- [ ] Confirmar batch-id final",
    "- [ ] Confirmar aprobacion funcional de registros CRITICO_REVISAR",
    "- [ ] Confirmar que se usaran las cuatro confirmaciones explicitas"
  );

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const baseDir = path.resolve(typeof args.dir === "string" ? args.dir : DEFAULT_DIR);
  const repoRoot = process.cwd();
  const batchId = typeof args["batch-id"] === "string" ? args["batch-id"] : DEFAULT_BATCH_ID;
  const diagnoseFailedBatchId =
    typeof args["diagnose-failed-batch"] === "string" ? normalizeString(args["diagnose-failed-batch"]) : "";
  const dryRunMode = args["dry-run"] === true || args.execute !== true;
  const executionDir = getExecutionDir(baseDir);
  const loadedEnvFiles = loadLocalEnvFiles(repoRoot);

  for (const fileName of Object.values(REQUIRED_FILES)) {
    const fullPath = path.join(baseDir, fileName);
    if (!fs.existsSync(fullPath)) {
      console.error(`Falta archivo requerido: ${fullPath}`);
      process.exit(1);
    }
  }

  const summary = readJson(path.join(baseDir, REQUIRED_FILES.summary));
  const plannedCotizaciones = readCsvRows(path.join(baseDir, REQUIRED_FILES.plannedCotizaciones));
  const plannedRequerimientosRaw = readCsvRows(path.join(baseDir, REQUIRED_FILES.plannedRequerimientos));
  const plannedDetalleRq = readCsvRows(path.join(baseDir, REQUIRED_FILES.plannedDetalleRq));
  const plannedImportBatch = readJson(path.join(baseDir, REQUIRED_FILES.plannedImportBatch));
  const plannedImportIssues = readCsvRows(path.join(baseDir, REQUIRED_FILES.plannedImportIssues));
  const conflictReport = readCsvRows(path.join(baseDir, REQUIRED_FILES.conflictReport));
  const reviewSummary = readJson(path.join(baseDir, REQUIRED_FILES.reviewSummary));
  const finalExecutionReviewPath = path.join(executionDir, "final_execution_review.json");
  const finalExecutionReview = fs.existsSync(finalExecutionReviewPath) ? readJson(finalExecutionReviewPath) : null;

  ensureDir(executionDir);

  const resolvedRequirementCodes = resolveRequirementImportCodes(plannedRequerimientosRaw);
  const plannedRequerimientos = resolvedRequirementCodes.rows;
  writeDuplicateRequirementReports({
    batchId,
    executionDir,
    resolvedRows: plannedRequerimientos,
    duplicateRows: resolvedRequirementCodes.duplicateRows,
    summary: resolvedRequirementCodes.summary,
  });

  const validations = [];
  const blockers = [];
  const remoteContext = {
    mode: "unavailable",
    status: "skipped",
    checks: [],
    warnings: [],
    remote_errors_safe: [],
    remote_checked_counts: {},
    remote_conflicts_found: {},
    session_detected: false,
    authenticated_user: {
      id: "",
      email: "",
    },
  };

  addValidation(
    validations,
    "local_env_files_checked",
    "pass",
    "info",
    loadedEnvFiles.length > 0
      ? `Se cargaron variables locales desde: ${loadedEnvFiles.join(", ")}.`
      : "No se encontraron .env.local ni .env en el repo; se uso process.env actual.",
    "OK"
  );

  addValidation(
    validations,
    "required_files_present",
    "pass",
    "info",
    "Se encontraron todos los archivos requeridos del dry-run.",
    "OK"
  );

  addValidation(
    validations,
    "duplicate_rq_code_analysis_generated",
    "pass",
    "info",
    `Se genero duplicate_rq_codes_summary.json con ${resolvedRequirementCodes.summary.duplicate_codes_in_simulated} codigos repetidos en el plan local.`,
    "Revisar duplicate_rq_codes_report.csv antes de una futura ejecucion real."
  );

  if (normalizeString(summary.import_batch_id) !== batchId) {
    addValidation(
      validations,
      "batch_id_matches_summary",
      "fail",
      "critical",
      `El batch-id solicitado (${batchId}) no coincide con historical_import_dry_run_summary (${normalizeString(summary.import_batch_id)}).`,
      "Usar el mismo batch-id del dry-run."
    );
    addBlocker(blockers, "batch_id_mismatch", "El batch-id no coincide con el dry-run.");
  } else {
    addValidation(
      validations,
      "batch_id_matches_summary",
      "pass",
      "info",
      "El batch-id coincide con el dry-run.",
      "OK"
    );
  }

  if (!ALLOWED_READINESS.has(normalizeString(summary.readiness_status))) {
    addValidation(
      validations,
      "readiness_status_allowed",
      "fail",
      "critical",
      `readiness_status no permitido: ${normalizeString(summary.readiness_status)}.`,
      "Corregir dry-run o detener una futura ejecucion."
    );
    addBlocker(blockers, "invalid_readiness_status", "El readiness_status no permite una futura carga observada.");
  } else {
    addValidation(
      validations,
      "readiness_status_allowed",
      "pass",
      "info",
      `readiness_status permitido: ${normalizeString(summary.readiness_status)}.`,
      "OK"
    );
  }

  const totalConflicts = Number(summary.total_conflicts ?? conflictReport.length);
  if (totalConflicts !== 0) {
    addValidation(
      validations,
      "total_conflicts_zero",
      "fail",
      "critical",
      `El dry-run reporta ${totalConflicts} conflictos.`,
      "Resolver conflictos antes de una futura ejecucion real."
    );
    addBlocker(blockers, "conflicts_detected", "El dry-run tiene conflictos y bloquea una futura ejecucion.");
  } else {
    addValidation(
      validations,
      "total_conflicts_zero",
      "pass",
      "info",
      "El dry-run no reporta conflictos.",
      "OK"
    );
  }

  const expectedCounts = {
    cotizaciones: Number(summary.total_cotizaciones ?? 0),
    requerimientos: Number(summary.total_requerimientos ?? 0),
    detalle_rq: Number(summary.total_detalle_rq ?? 0),
  };
  const actualCounts = {
    cotizaciones: plannedCotizaciones.length,
    requerimientos: plannedRequerimientos.length,
    detalle_rq: plannedDetalleRq.length,
  };

  for (const key of Object.keys(expectedCounts)) {
    if (expectedCounts[key] !== actualCounts[key]) {
      addValidation(
        validations,
        `planned_${key}_count_match`,
        "fail",
        "critical",
        `El total planeado de ${key} no coincide. summary=${expectedCounts[key]}, planned=${actualCounts[key]}.`,
        "Regenerar dry-run antes de una futura ejecucion."
      );
      addBlocker(blockers, `planned_${key}_count_mismatch`, `Los totales de ${key} no coinciden con el summary.`);
    } else {
      addValidation(
        validations,
        `planned_${key}_count_match`,
        "pass",
        "info",
        `El total planeado de ${key} coincide con el summary.`,
        "OK"
      );
    }
  }

  const minimalCotizacionColumns = [
    "action_planned",
    "target_table",
    "historical_cotizacion_key",
    "codigo",
    "metadata_historical_import_json",
  ];
  const minimalRqColumns = [
    "action_planned",
    "target_table",
    "historical_cotizacion_key",
    "historical_rq_key",
    "codigo_para_importacion_simulado",
    "metadata_historical_import_json",
  ];
  const minimalDetalleColumns = [
    "action_planned",
    "target_table",
    "historical_cotizacion_key",
    "historical_rq_key",
    "source_row_number",
    "metadata_historical_import_json",
  ];

  const columnChecks = [
    ["planned_cotizaciones_columns", plannedCotizaciones[0] ?? {}, minimalCotizacionColumns],
    ["planned_requerimientos_columns", plannedRequerimientos[0] ?? {}, minimalRqColumns],
    ["planned_detalle_rq_columns", plannedDetalleRq[0] ?? {}, minimalDetalleColumns],
  ];

  for (const [validationName, sampleRow, expectedColumns] of columnChecks) {
    const missingColumns = expectedColumns.filter((column) => !(column in sampleRow));
    if (missingColumns.length > 0) {
      addValidation(
        validations,
        validationName,
        "fail",
        "critical",
        `Faltan columnas minimas: ${missingColumns.join(", ")}.`,
        "Regenerar planned files del dry-run."
      );
      addBlocker(blockers, `${validationName}_missing`, `Faltan columnas minimas: ${missingColumns.join(", ")}.`);
    } else {
      addValidation(
        validations,
        validationName,
        "pass",
        "info",
        "Las columnas minimas esperadas estan presentes.",
        "OK"
      );
    }
  }

  const traceabilityFailures = [];
  for (const row of plannedCotizaciones) {
    if (!normalizeString(row.historical_cotizacion_key) || !normalizeString(row.metadata_historical_import_json)) {
      traceabilityFailures.push("cotizaciones");
      break;
    }
  }
  for (const row of plannedRequerimientos) {
    if (
      !normalizeString(row.historical_cotizacion_key) ||
      !normalizeString(row.historical_rq_key) ||
      !normalizeString(row.metadata_historical_import_json)
    ) {
      traceabilityFailures.push("requerimientos");
      break;
    }
  }
  for (const row of plannedDetalleRq) {
    if (
      !normalizeString(row.historical_cotizacion_key) ||
      !normalizeString(row.historical_rq_key) ||
      !normalizeString(row.source_row_number) ||
      !normalizeString(row.metadata_historical_import_json)
    ) {
      traceabilityFailures.push("detalle_rq");
      break;
    }
  }

  if (traceabilityFailures.length > 0) {
    addValidation(
      validations,
      "traceability_fields_present",
      "fail",
      "critical",
      `Faltan campos minimos de trazabilidad en: ${traceabilityFailures.join(", ")}.`,
      "Revisar planned files antes de cualquier ejecucion."
    );
    addBlocker(
      blockers,
      "missing_traceability_fields",
      `Faltan campos minimos de trazabilidad en: ${traceabilityFailures.join(", ")}.`
    );
  } else {
    addValidation(
      validations,
      "traceability_fields_present",
      "pass",
      "info",
      "Todos los planned files mantienen trazabilidad minima esperada.",
      "OK"
    );
  }

  if (normalizeString(plannedImportBatch.import_batch_id) !== batchId) {
    addValidation(
      validations,
      "planned_import_batch_matches",
      "fail",
      "critical",
      "planned_import_batch.json no coincide con el batch solicitado.",
      "Regenerar dry-run o usar el batch correcto."
    );
    addBlocker(blockers, "planned_import_batch_mismatch", "planned_import_batch.json no coincide con el batch solicitado.");
  } else {
    addValidation(
      validations,
      "planned_import_batch_matches",
      "pass",
      "info",
      "planned_import_batch.json coincide con el batch solicitado.",
      "OK"
    );
  }

  const supabaseClient = createSupabaseClient();

  await runSelectOnlyChecks({
    client: supabaseClient,
    batchId,
    plannedCotizaciones,
    plannedRequerimientos,
    validations,
    blockers,
    remoteContext,
  });

  const requiredConfirmations = [
    "--execute",
    `--confirm-batch "${batchId}"`,
    `--confirm-risk "${REQUIRED_CONFIRM_RISK}"`,
    "--confirm-no-conflicts",
  ];

  const canExecute = blockers.length === 0;
  const insertOrder = [
    "public.historical_import_batches",
    "public.cotizaciones",
    "public.requerimientos",
    "public.requerimiento_items",
    "public.historical_import_issues",
  ];

  const plan = {
    import_batch_id: batchId,
    generated_at: new Date().toISOString(),
    mode: dryRunMode ? "dry_run" : "execute_requested",
    remote_validation_mode: remoteContext.mode,
    remote_validation_status: remoteContext.status,
    remote_checks: remoteContext.checks,
    remote_errors_safe: remoteContext.remote_errors_safe,
    remote_checked_counts: remoteContext.remote_checked_counts,
    remote_conflicts_found: remoteContext.remote_conflicts_found,
    remote_warnings: remoteContext.warnings,
    can_execute: canExecute,
    blockers,
    warnings: remoteContext.warnings,
    total_cotizaciones: actualCounts.cotizaciones,
    total_requerimientos: actualCounts.requerimientos,
    total_detalle_rq: actualCounts.detalle_rq,
    total_import_issues: plannedImportIssues.length,
    readiness_status: normalizeString(summary.readiness_status),
    total_conflicts: totalConflicts,
    required_confirmations_for_execute: requiredConfirmations,
    insert_order: insertOrder,
    recommendation: canExecute
      ? "El lote puede pasar a una futura ejecucion controlada solo si se mantienen las confirmaciones explicitas y la aprobacion funcional."
      : "El lote sigue bloqueado para ejecucion real. Revisar blockers y validaciones antes de cualquier intento de carga observada.",
  };

  writeJson(path.join(executionDir, "import_execution_plan.json"), plan);
  writeCsv(
    path.join(executionDir, "import_execution_validation.csv"),
    [
      "validation_name",
      "status",
      "severity",
      "message",
      "suggested_action",
      "safe_error_code",
      "safe_error_message",
    ],
    validations
  );
  fs.writeFileSync(
    path.join(executionDir, "import_execution_report.md"),
    buildReportMarkdown({
      batchId,
      mode: plan.mode,
      canExecute: plan.can_execute,
      blockers: plan.blockers,
      totals: {
        cotizaciones: plan.total_cotizaciones,
        requerimientos: plan.total_requerimientos,
        detalle_rq: plan.total_detalle_rq,
        import_issues: plan.total_import_issues,
      },
      readinessStatus: plan.readiness_status,
      totalConflicts: plan.total_conflicts,
      requiredConfirmations: plan.required_confirmations_for_execute,
      recommendation: plan.recommendation,
      validations,
      remoteContext,
    }),
    "utf8"
  );

  if (diagnoseFailedBatchId) {
    const diagnosis = await diagnoseFailedBatch({
      client: supabaseClient,
      diagnoseBatchId: diagnoseFailedBatchId,
      executionDir,
    });

    console.log(`\nDiagnostico de lote fallido generado en: ${executionDir}`);
    console.log(
      JSON.stringify(
        {
          import_batch_id: diagnosis.import_batch_id,
          remote_diagnosis_available: diagnosis.remote_diagnosis_available,
          batch_found: diagnosis.batch_found,
          batch_status: diagnosis.batch_status,
          reported_inserted_counts: diagnosis.reported_inserted_counts,
          remote_counts: diagnosis.remote_counts,
          suggested_next_batch_id: diagnosis.suggested_next_batch_id,
          warnings: diagnosis.warnings,
          recommendation: diagnosis.recommendation,
        },
        null,
        2
      )
    );
    console.log("\nEste diagnostico solo consulto por SELECT. No inserto ni borro datos.");
    process.exit(0);
  }

  if (args["preflight-execute"] === true) {
    const preflightReview = await runPreflightExecute({
      client: supabaseClient,
      batchId,
      plan,
      plannedCotizaciones,
      plannedRequerimientos,
      plannedDetalleRq,
      plannedImportIssues,
      executionDir,
    });

    console.log(`\nPreflight de ejecucion generado en: ${executionDir}`);
    console.log(
      JSON.stringify(
        {
          import_batch_id: preflightReview.import_batch_id,
          execute_branch_ready: preflightReview.execute_branch_ready,
          payload_validation_status: preflightReview.payload_validation_status,
          remote_validation_status: preflightReview.remote_validation_status,
          permission_readiness_status: preflightReview.permission_readiness_status,
          blockers: preflightReview.blockers,
          warnings: preflightReview.warnings,
          required_sql_before_execute: preflightReview.required_sql_before_execute,
          final_recommendation: preflightReview.final_recommendation,
        },
        null,
        2
      )
    );
    console.log("\nEste script no ejecuto inserciones ni SQL. Solo genero un preflight de la rama real.");
    process.exit(0);
  }

  if (args.execute === true) {
    const confirmBatch = normalizeString(args["confirm-batch"]);
    const confirmRisk = normalizeString(args["confirm-risk"]);
    const confirmNoConflicts = args["confirm-no-conflicts"] === true;

    if (
      confirmBatch !== batchId ||
      confirmRisk !== REQUIRED_CONFIRM_RISK ||
      confirmNoConflicts !== true
    ) {
      console.error("Se solicito --execute, pero faltan confirmaciones explicitas requeridas. No se inserto nada.");
      process.exit(1);
    }

    if (!canExecute) {
      console.error("Se solicito --execute, pero el plan aun tiene blockers. No se inserto nada.");
      process.exit(1);
    }

    if (
      finalExecutionReview &&
      (
        normalizeString(finalExecutionReview.import_batch_id) !== batchId ||
        finalExecutionReview.execute_allowed_by_script !== true
      )
    ) {
      console.error(
        "Se solicito --execute, pero final_execution_review.json no habilita la ejecucion para este batch. No se inserto nada."
      );
      process.exit(1);
    }

    const executeClient = createSupabaseClient();
    const executeValidations = [];
    const executeBlockers = [];
    const executeRemoteContext = {
      mode: "unavailable",
      status: "skipped",
      checks: [],
      warnings: [],
      remote_errors_safe: [],
      remote_checked_counts: {},
      remote_conflicts_found: {},
      session_detected: false,
      authenticated_user: {
        id: "",
        email: "",
      },
    };

    await runSelectOnlyChecks({
      client: executeClient,
      batchId,
      plannedCotizaciones,
      plannedRequerimientos,
      validations: executeValidations,
      blockers: executeBlockers,
      remoteContext: executeRemoteContext,
    });

    const executePreflight = await runPreflightExecute({
      client: executeClient,
      batchId,
      plan: {
        ...plan,
        remote_validation_status: executeRemoteContext.status,
        can_execute: executeBlockers.length === 0,
      },
      plannedCotizaciones,
      plannedRequerimientos,
      plannedDetalleRq,
      plannedImportIssues,
      executionDir,
    });

    if (
      !ALLOWED_READINESS.has(normalizeString(summary.readiness_status)) ||
      Number(summary.total_conflicts ?? 0) !== 0 ||
      executeRemoteContext.status !== "passed" ||
      executeBlockers.length > 0 ||
      executePreflight.execute_branch_ready !== true
    ) {
      console.error(
        "Se solicito --execute, pero el preflight remoto/local no quedo listo para insertar. No se inserto nada."
      );
      process.exit(1);
    }

    const resultPathJson = path.join(executionDir, "import_execution_result.json");
    const resultPathMd = path.join(executionDir, "import_execution_result.md");
    const executionSummary = {
      import_batch_id: batchId,
      started_at: new Date().toISOString(),
      status: "started",
      error_table: "",
      error_message: "",
      inserted_counts: {
        cotizaciones: 0,
        requerimientos: 0,
        detalle_rq: 0,
        import_issues: 0,
      },
      inserted_batches: {
        cotizaciones: 0,
        requerimientos: 0,
        detalle_rq: 0,
        import_issues: 0,
      },
      next_steps: "Ninguno.",
    };

    let batchInserted = false;

    try {
      const batchPayload = {
        import_batch_id: batchId,
        source_file_name: normalizeString(plannedImportBatch.source_file_name),
        source_file_path: "",
        status: "importing",
        total_cotizaciones: Number(plannedImportBatch.total_cotizaciones ?? actualCounts.cotizaciones),
        total_requerimientos: Number(plannedImportBatch.total_requerimientos ?? actualCounts.requerimientos),
        total_detalle_rq: Number(plannedImportBatch.total_detalle_rq ?? actualCounts.detalle_rq),
        total_ok: Number(plannedImportBatch.total_ok ?? 0),
        total_observado: Number(plannedImportBatch.total_observado ?? 0),
        total_completar_datos: Number(plannedImportBatch.total_completar_datos ?? 0),
        total_critico_revisar: Number(plannedImportBatch.total_critico_revisar ?? 0),
        metadata: {
          ...parseJsonObject(plannedImportBatch.metadata, {}),
          historical_import: {
            ...parseJsonObject(plannedImportBatch.metadata?.historical_import, {}),
            execution_started_at: executionSummary.started_at,
            execution_mode: "execute",
            remote_validation_status: executeRemoteContext.status,
          },
        },
      };

      const { error: batchInsertError } = await executeClient
        .from("historical_import_batches")
        .insert(batchPayload)
        .select("id,import_batch_id")
        .single();

      if (batchInsertError) {
        throw enrichExecutionError(batchInsertError, "public.historical_import_batches");
      }

      if (batchInsertError) {
        throw enrichExecutionError(batchInsertError, "public.historical_import_batches");
      }

      batchInserted = true;

      const cotizacionInsert = await insertRowsInChunks({
        client: executeClient,
        table: "cotizaciones",
        rows: plannedCotizaciones,
        chunkSize: EXECUTION_CHUNK_SIZES.cotizaciones,
        buildPayload: buildCotizacionPayload,
        returningColumns: "id,codigo,metadata",
      });

      if (!cotizacionInsert.ok) {
        throw enrichExecutionError(cotizacionInsert.error, "public.cotizaciones");
      }

      executionSummary.inserted_counts.cotizaciones = cotizacionInsert.insertedCount;
      executionSummary.inserted_batches.cotizaciones = cotizacionInsert.insertedChunks;

      const cotizacionIdByHistoricalKey = new Map();
      for (const row of cotizacionInsert.insertedRows) {
        const historicalKey = normalizeString(row?.metadata?.historical_import?.historical_cotizacion_key);
        if (historicalKey && row?.id) {
          cotizacionIdByHistoricalKey.set(historicalKey, row.id);
        }
      }

      const requerimientoRows = plannedRequerimientos.filter(isAllowedAction);
      const requerimientoPayloadRows = requerimientoRows.map((row) => {
        const historicalKey = normalizeString(row.historical_cotizacion_key);
        const cotizacionId = cotizacionIdByHistoricalKey.get(historicalKey);
        if (!cotizacionId) {
          throw new Error(`No se pudo resolver cotizacion_id para historical_cotizacion_key=${historicalKey}.`);
        }
        return {
          row,
          payload: buildRequerimientoPayload(row, cotizacionId),
        };
      });

      const requerimientoChunks = chunkArray(requerimientoPayloadRows, EXECUTION_CHUNK_SIZES.requerimientos);
      const requerimientoInsertedRows = [];

      for (const chunk of requerimientoChunks) {
        const { data, error } = await executeClient
          .from("requerimientos")
          .insert(chunk.map((item) => item.payload))
          .select("id,codigo,metadata");

        if (error) {
          throw enrichExecutionError(error, "public.requerimientos");
        }

        executionSummary.inserted_counts.requerimientos += chunk.length;
        executionSummary.inserted_batches.requerimientos += 1;
        if (Array.isArray(data) && data.length > 0) {
          requerimientoInsertedRows.push(...data);
        }
      }

      const requerimientoIdByHistoricalKey = new Map();
      for (const row of requerimientoInsertedRows) {
        const historicalKey = normalizeString(row?.metadata?.historical_import?.historical_rq_key);
        if (historicalKey && row?.id) {
          requerimientoIdByHistoricalKey.set(historicalKey, row.id);
        }
      }

      const detalleRows = plannedDetalleRq.filter(isAllowedAction);
      const detallePayloadRows = detalleRows.map((row) => {
        const historicalRqKey = normalizeString(row.historical_rq_key);
        const requerimientoId = requerimientoIdByHistoricalKey.get(historicalRqKey);
        if (!requerimientoId) {
          throw new Error(`No se pudo resolver requerimiento_id para historical_rq_key=${historicalRqKey}.`);
        }
        return buildDetallePayload(row, requerimientoId);
      });

      const detalleChunks = chunkArray(detallePayloadRows, EXECUTION_CHUNK_SIZES.detalle_rq);
      for (const chunk of detalleChunks) {
        const { error } = await executeClient.from("requerimiento_items").insert(chunk).select("id");
        if (error) {
          throw enrichExecutionError(error, "public.requerimiento_items");
        }
        executionSummary.inserted_counts.detalle_rq += chunk.length;
        executionSummary.inserted_batches.detalle_rq += 1;
      }

      const issueRows = plannedImportIssues.filter((row) => normalizeString(row.import_batch_id) === batchId);
      const issuePayloads = issueRows.map(buildImportIssuePayload);
      const issueChunks = chunkArray(issuePayloads, EXECUTION_CHUNK_SIZES.import_issues);
      for (const chunk of issueChunks) {
        const { error } = await executeClient.from("historical_import_issues").insert(chunk).select("id");
        if (error) {
          throw enrichExecutionError(error, "public.historical_import_issues");
        }
        executionSummary.inserted_counts.import_issues += chunk.length;
        executionSummary.inserted_batches.import_issues += 1;
      }

      const finalStatus = computeFinalImportStatus(reviewSummary);
      const { error: batchUpdateError } = await updateBatchRecord(executeClient, batchId, {
        status: finalStatus,
        metadata: {
          ...parseJsonObject(plannedImportBatch.metadata, {}),
          historical_import: {
            ...parseJsonObject(plannedImportBatch.metadata?.historical_import, {}),
            execution_started_at: executionSummary.started_at,
            execution_finished_at: new Date().toISOString(),
            execution_mode: "execute",
            final_status: finalStatus,
            inserted_counts: executionSummary.inserted_counts,
          },
        },
        updated_at: new Date().toISOString(),
      });

      if (batchUpdateError) {
        throw enrichExecutionError(batchUpdateError, "public.historical_import_batches");
      }

      executionSummary.status = "success";
      executionSummary.finished_at = new Date().toISOString();
      executionSummary.next_steps =
        "Validar en Supabase los conteos insertados, revisar metadata.historical_import y confirmar trazabilidad por import_batch_id.";
      writeJson(resultPathJson, executionSummary);
      fs.writeFileSync(resultPathMd, buildExecutionResultMarkdown(executionSummary), "utf8");
      console.log(`\nEjecucion real completada. Resultado guardado en: ${executionDir}`);
      process.exit(0);
    } catch (error) {
      const safeError = enrichExecutionError(error);
      executionSummary.status = "failed_partial";
      executionSummary.finished_at = new Date().toISOString();
      executionSummary.error_table = normalizeString(safeError.table);
      executionSummary.error_column = normalizeString(safeError.probable_column);
      executionSummary.error_message = normalizeString(safeError.message);
      executionSummary.next_steps =
        "No reintentar automaticamente. Revisar la tabla indicada, columnas permitidas, permisos INSERT/UPDATE y el estado del batch antes de cualquier nueva ejecucion.";

      if (batchInserted && executeClient) {
        await updateBatchRecord(executeClient, batchId, {
          status: "failed_partial",
          metadata: {
            ...parseJsonObject(plannedImportBatch.metadata, {}),
            historical_import: {
              ...parseJsonObject(plannedImportBatch.metadata?.historical_import, {}),
              execution_started_at: executionSummary.started_at,
              execution_finished_at: executionSummary.finished_at,
              execution_mode: "execute",
              final_status: "failed_partial",
              execution_error: {
                table: executionSummary.error_table,
                column: executionSummary.error_column,
                message: executionSummary.error_message,
              },
              inserted_counts: executionSummary.inserted_counts,
            },
          },
          updated_at: new Date().toISOString(),
        }).catch(() => null);
      }

      writeJson(resultPathJson, executionSummary);
      fs.writeFileSync(resultPathMd, buildExecutionResultMarkdown(executionSummary), "utf8");
      console.error(
        `Se solicito --execute, pero la carga controlada fallo en ${executionSummary.error_table || "una tabla no identificada"}. No se reintento automaticamente.`
      );
      process.exit(1);
    }
  }

  console.log(`\nPlan de importacion generado en: ${executionDir}`);
  console.log(
    JSON.stringify(
      {
        import_batch_id: plan.import_batch_id,
        mode: plan.mode,
        remote_validation_mode: plan.remote_validation_mode,
        remote_validation_status: plan.remote_validation_status,
        can_execute: plan.can_execute,
        blockers: plan.blockers,
        warnings: plan.warnings,
        required_confirmations_for_execute: plan.required_confirmations_for_execute,
        recommendation: plan.recommendation,
      },
      null,
      2
    )
  );
  console.log("\nEste script no ejecuto inserciones. Solo genero validaciones y plan de ejecucion controlada.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Error desconocido en import-historical-observed-data.");
  process.exit(1);
});
