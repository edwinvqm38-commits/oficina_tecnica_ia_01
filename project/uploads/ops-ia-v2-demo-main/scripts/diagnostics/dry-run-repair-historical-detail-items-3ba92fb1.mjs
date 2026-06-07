#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_BATCH_ID = "IMPORT-2026-003";
const DEFAULT_RQ_CODE = "RQ-CJM075-001_2025";
const DEFAULT_SOURCE = "tmp_imports/enriched_preview_detalle_rq.csv";
const DEFAULT_OUT_DIR = "tmp_imports/import_execution";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return false;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
  return true;
}

function loadLocalEnv() {
  return [".env.local", ".env"].filter(loadEnvFile);
}

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeKey(value) {
  return normalizeString(value).toLowerCase();
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrency(value) {
  const normalized = normalizeString(value).toUpperCase();
  if (["USD", "DOLAR", "DOLARES", "DOLARES", "US$"].includes(normalized)) return "USD";
  if (["PEN", "SOLES", "SOL", "S/"].includes(normalized)) return "PEN";
  return normalized || "";
}

function toObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
}

function valuesEqual(currentValue, sourceValue) {
  if (sourceValue === null || sourceValue === undefined || sourceValue === "") return true;
  if (typeof sourceValue === "number") return Number(currentValue ?? 0) === sourceValue;
  return normalizeString(currentValue) === normalizeString(sourceValue);
}

function readSourceRows(sourcePath, batchId, rqCode) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`No existe fuente local: ${sourcePath}`);
  }
  const workbook = XLSX.readFile(sourcePath, { raw: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  const normalizedRqCode = normalizeKey(rqCode);
  const normalizedBatchId = normalizeKey(batchId);

  return rows.filter((row) => {
    const rowBatch = normalizeKey(row.import_batch_id);
    const rowRqCode = normalizeKey(row.codigo_rq);
    const rowRqKey = normalizeKey(row.historical_rq_key);
    const batchMatches = !rowBatch || rowBatch === normalizedBatchId;
    return batchMatches && (rowRqCode === normalizedRqCode || rowRqKey.endsWith(normalizedRqCode));
  });
}

async function createAuthenticatedClient({ requireCredentials = false } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const client = createClient(url, anonKey);
  const email = process.env.HISTORICAL_IMPORT_ADMIN_EMAIL;
  const password = process.env.HISTORICAL_IMPORT_ADMIN_PASSWORD;
  if (!email || !password) {
    if (requireCredentials) {
      throw new Error("Faltan HISTORICAL_IMPORT_ADMIN_EMAIL o HISTORICAL_IMPORT_ADMIN_PASSWORD para ejecutar reparacion.");
    }
    return client;
  }
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function readRemoteItems(client, batchId, rqCode) {
  const { data: requirementRows, error: rqError } = await client
    .from("requerimientos")
    .select("id,codigo,cotizacion_codigo,metadata")
    .eq("codigo", rqCode);
  if (rqError) throw rqError;
  if (!requirementRows?.length) {
    throw new Error(`No se encontro el requerimiento ${rqCode} en Supabase.`);
  }

  const requirement = requirementRows[0];
  const { data: itemRows, error: itemError } = await client
    .from("requerimiento_items")
    .select(
      "id,requerimiento_id,cantidad,precio_unitario,subtotal,ajuste,atencion_real,cant_stock,compra,costo_unitario,moneda_codigo,tc,factor_eq_herr,costo_total_presupuestado,estado,informacion_adicional,observaciones_item,recurso_a_suministrar,proveedor_nombre,metadata"
    )
    .eq("requerimiento_id", requirement.id);
  if (itemError) throw itemError;

  const rows = (itemRows ?? [])
    .filter((row) => normalizeString(toObject(toObject(row.metadata).historical_import).import_batch_id) === batchId)
    .sort((a, b) => {
      const left = Number(toObject(toObject(a.metadata).historical_import).source_row_number ?? 0);
      const right = Number(toObject(toObject(b.metadata).historical_import).source_row_number ?? 0);
      return left - right;
    });

  return { requirement, rows };
}

function sourceValue(row, key) {
  return normalizeString(row[key]);
}

function sourceNumber(row, key) {
  return parseNumber(row[key]);
}

function buildSourceItem(row) {
  const cantidad = sourceNumber(row, "cantidad");
  const precioUnitario = sourceNumber(row, "precio_unitario");
  const costoTotalPresupuestado =
    sourceNumber(row, "costo_total_presupuestado") ??
    (cantidad !== null && precioUnitario !== null ? Number((cantidad * precioUnitario).toFixed(2)) : null);
  return {
    source_row_number: sourceValue(row, "source_row_number"),
    tipo_recurso: sourceValue(row, "tipo_recurso"),
    codigo_fabricante: sourceValue(row, "codigo_fabricante"),
    descripcion: sourceValue(row, "descripcion"),
    informacion_adicional: sourceValue(row, "informacion_adicional"),
    a_suministrar: sourceValue(row, "recurso_a_suministrar"),
    unidad: sourceValue(row, "unidad"),
    cantidad,
    ajuste: sourceNumber(row, "ajuste"),
    atencion_real: sourceNumber(row, "atencion_real"),
    cant_stock: sourceNumber(row, "cant_stock"),
    compra: sourceNumber(row, "compra"),
    precio_unitario: precioUnitario,
    costo_unitario_dolar: sourceNumber(row, "costo_unitario_dolar"),
    costo_unitario_soles: sourceNumber(row, "precio_unitario"),
    tipo_cambio: sourceNumber(row, "tc"),
    costo_total_presupuestado: costoTotalPresupuestado,
    costo_total_presupuestado_usd: sourceNumber(row, "costo_total_presupuestado_usd"),
    moneda: normalizeCurrency(row.moneda),
    observaciones_item: sourceValue(row, "observaciones_item"),
  };
}

function buildRepairedMetadata(currentMetadata, sourceItem) {
  const metadata = toObject(currentMetadata);
  const historicalImport = toObject(metadata.historical_import);
  return {
    ...metadata,
    historical_import: {
      ...historicalImport,
      source_item: {
        ...toObject(historicalImport.source_item),
        ...sourceItem,
      },
      detail_repair: {
        repaired_from: "enriched_preview_detalle_rq.csv",
        repaired_at: new Date().toISOString(),
        repaired_fields: [
          "metadata.historical_import.source_item",
          "compra",
          "ajuste",
          "atencion_real",
          "cant_stock",
          "informacion_adicional",
          "observaciones_item",
          "recurso_a_suministrar",
        ],
      },
    },
  };
}

function setIfNumber(payload, key, value) {
  if (value !== null && value !== undefined) {
    payload[key] = value;
  }
}

function setIfString(payload, key, value) {
  const normalized = normalizeString(value);
  if (normalized) {
    payload[key] = normalized;
  }
}

function buildRepairPayload(remote, sourceItem) {
  const payload = {
    metadata: buildRepairedMetadata(remote.metadata, sourceItem),
  };

  setIfNumber(payload, "compra", sourceItem.compra);
  setIfNumber(payload, "ajuste", sourceItem.ajuste);
  setIfNumber(payload, "atencion_real", sourceItem.atencion_real);
  setIfNumber(payload, "cant_stock", sourceItem.cant_stock);
  setIfString(payload, "informacion_adicional", sourceItem.informacion_adicional);
  setIfString(payload, "observaciones_item", sourceItem.observaciones_item);
  setIfString(payload, "recurso_a_suministrar", sourceItem.a_suministrar);

  return payload;
}

function compareRows(remoteRows, sourceRows, rqCode) {
  const sourceByRowNumber = new Map(sourceRows.map((row) => [normalizeString(row.source_row_number), row]));
  const comparisons = [];

  for (const remote of remoteRows) {
    const historicalImport = toObject(toObject(remote.metadata).historical_import);
    const sourceRowNumber = normalizeString(historicalImport.source_row_number);
    const source = sourceByRowNumber.get(sourceRowNumber);
    if (!source) {
      comparisons.push({
        source_row_number: sourceRowNumber,
        codigo_rq: rqCode,
        status: "source_missing",
        fields_to_repair: "source_missing",
      });
      continue;
    }

    const existingSourceItem = toObject(historicalImport.source_item);
    const sourceItem = buildSourceItem(source);
    const updatePayload = buildRepairPayload(remote, sourceItem);
    const fieldChecks = {
      descripcion: [existingSourceItem.descripcion, sourceItem.descripcion],
      a_suministrar: [remote.recurso_a_suministrar, sourceItem.a_suministrar],
      unidad: [existingSourceItem.unidad, sourceItem.unidad],
      ajuste: [remote.ajuste, sourceItem.ajuste],
      atencion_real: [remote.atencion_real, sourceItem.atencion_real],
      cant_stock: [remote.cant_stock, sourceItem.cant_stock],
      compra: [remote.compra, sourceItem.compra],
      precio_unitario: [remote.precio_unitario, sourceItem.precio_unitario],
      costo_total_presupuestado: [remote.costo_total_presupuestado, sourceItem.costo_total_presupuestado],
      observaciones_item: [remote.observaciones_item, sourceItem.observaciones_item],
      source_item_metadata: [existingSourceItem.descripcion, sourceItem.descripcion],
    };
    const fieldsToRepair = Object.entries(fieldChecks)
      .filter(([, [currentValue, expectedValue]]) => !valuesEqual(currentValue, expectedValue))
      .map(([field]) => field);

    comparisons.push({
      remote_item_id: remote.id,
      source_row_number: sourceRowNumber,
      codigo_rq: rqCode,
      item_excel: sourceValue(source, "item_excel"),
      status: fieldsToRepair.length > 0 ? "repair_needed" : "ok",
      fields_to_repair: fieldsToRepair.join("; "),
      descripcion_actual: normalizeString(existingSourceItem.descripcion),
      descripcion_excel: sourceItem.descripcion,
      a_suministrar_actual: normalizeString(remote.recurso_a_suministrar),
      a_suministrar_excel: sourceItem.a_suministrar,
      compra_actual: normalizeString(remote.compra),
      compra_excel: sourceItem.compra ?? "",
      unidad_actual: normalizeString(existingSourceItem.unidad),
      unidad_excel: sourceItem.unidad,
      ajuste_actual: normalizeString(remote.ajuste),
      ajuste_excel: sourceItem.ajuste ?? "",
      observacion_actual: normalizeString(remote.observaciones_item),
      observacion_excel: sourceItem.observaciones_item,
      precio_unitario_actual: normalizeString(remote.precio_unitario),
      precio_unitario_excel: sourceItem.precio_unitario ?? "",
      costo_total_actual: normalizeString(remote.costo_total_presupuestado),
      costo_total_excel: sourceItem.costo_total_presupuestado ?? "",
      update_payload: updatePayload,
    });
  }

  return comparisons;
}

function csvEscape(value) {
  const text = normalizeString(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(filePath, columns, rows) {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function writeMarkdown(filePath, summary, sampleRows) {
  const lines = [
    `# ${summary.mode === "execute" ? "Ejecucion" : "Dry-run"} reparacion detalle historico ${summary.import_batch_id}`,
    "",
    summary.mode === "execute"
      ? "Este reporte documenta una reparacion controlada aplicada por RQ y lote historico."
      : "Este reporte no modifica Supabase. Solo compara los items insertados contra la fuente enriquecida local.",
    "",
    `- RQ: ${summary.rq_code}`,
    `- Items revisados: ${summary.total_items_reviewed}`,
    `- Items que se repararian: ${summary.total_items_to_repair}`,
    `- Fuente local: ${summary.source_file}`,
    "",
    "## Muestra antes/despues",
    "",
    "| source_row_number | descripcion actual | descripcion Excel | a suministrar actual | a suministrar Excel | compra actual | compra Excel |",
    "| --- | --- | --- | --- | --- | ---: | ---: |",
  ];

  for (const row of sampleRows) {
    lines.push(
      `| ${row.source_row_number} | ${row.descripcion_actual || "-"} | ${row.descripcion_excel || "-"} | ${row.a_suministrar_actual || "-"} | ${row.a_suministrar_excel || "-"} | ${row.compra_actual || "-"} | ${row.compra_excel || "-"} |`
    );
  }

  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function executeRepair(client, repairRows) {
  const results = [];

  for (const row of repairRows) {
    if (!row.remote_item_id || row.status !== "repair_needed") continue;
    const { data, error } = await client
      .from("requerimiento_items")
      .update(row.update_payload)
      .eq("id", row.remote_item_id)
      .select(
        "id,compra,ajuste,atencion_real,cant_stock,informacion_adicional,observaciones_item,recurso_a_suministrar,metadata"
      )
      .single();

    if (error) {
      throw new Error(
        `Fallo reparando source_row_number ${row.source_row_number} (${row.remote_item_id}): ${error.message || error.code || "sin detalle"}`
      );
    }

    results.push({
      remote_item_id: row.remote_item_id,
      source_row_number: row.source_row_number,
      status: "updated",
      compra: data?.compra ?? null,
      ajuste: data?.ajuste ?? null,
      descripcion_metadata: toObject(toObject(data?.metadata).historical_import).source_item?.descripcion ?? null,
    });
  }

  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const batchId = normalizeString(args["batch-id"]) || DEFAULT_BATCH_ID;
  const rqCode = normalizeString(args["rq-code"]) || DEFAULT_RQ_CODE;
  const sourcePath = normalizeString(args.source) || DEFAULT_SOURCE;
  const outDir = normalizeString(args["out-dir"]) || DEFAULT_OUT_DIR;
  const execute = args.execute === true;

  loadLocalEnv();
  fs.mkdirSync(outDir, { recursive: true });

  const sourceRows = readSourceRows(sourcePath, batchId, rqCode);
  const client = await createAuthenticatedClient({ requireCredentials: execute });
  const { rows: remoteRows } = await readRemoteItems(client, batchId, rqCode);
  const comparisons = compareRows(remoteRows, sourceRows, rqCode);
  const repairRows = comparisons.filter((row) => row.status === "repair_needed");
  const sampleRows = comparisons.slice(0, 5);
  const executionResults = execute ? await executeRepair(client, repairRows) : [];
  const postRead = execute ? await readRemoteItems(client, batchId, rqCode) : null;
  const postComparisons = postRead ? compareRows(postRead.rows, sourceRows, rqCode) : [];
  const postRepairRows = postComparisons.filter((row) => row.status === "repair_needed");

  const summary = {
    import_batch_id: batchId,
    rq_code: rqCode,
    generated_at: new Date().toISOString(),
    mode: execute ? "execute" : "dry_run",
    source_file: sourcePath,
    total_source_items: sourceRows.length,
    total_items_reviewed: comparisons.length,
    total_items_to_repair: repairRows.length,
    total_items_repaired: executionResults.length,
    post_execution_items_still_repairable: execute ? postRepairRows.length : null,
    expected_target_items_for_rq: 23,
    target_item_count_matches_expected: comparisons.length === 23,
    scope: {
      import_batch_id: batchId,
      rq_code: rqCode,
      update_table: "public.requerimiento_items",
      key: "metadata.historical_import.source_row_number",
    },
    fields_to_repair: [...new Set(repairRows.flatMap((row) => row.fields_to_repair.split("; ").filter(Boolean)))],
    sample_before_after: sampleRows,
    execution_results: executionResults,
    no_data_modified: !execute,
  };

  const filePrefix = execute ? "historical_detail_repair_execution_result" : "historical_detail_repair_dry_run";
  const jsonPath = path.join(outDir, `${filePrefix}.json`);
  const csvPath = path.join(outDir, `${filePrefix}.csv`);
  const mdPath = path.join(outDir, `${filePrefix}.md`);

  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  writeCsv(
    csvPath,
    [
      "source_row_number",
      "remote_item_id",
      "codigo_rq",
      "item_excel",
      "status",
      "fields_to_repair",
      "descripcion_actual",
      "descripcion_excel",
      "a_suministrar_actual",
      "a_suministrar_excel",
      "compra_actual",
      "compra_excel",
      "unidad_actual",
      "unidad_excel",
      "ajuste_actual",
      "ajuste_excel",
      "observacion_actual",
      "observacion_excel",
      "precio_unitario_actual",
      "precio_unitario_excel",
      "costo_total_actual",
      "costo_total_excel",
    ],
    comparisons
  );
  writeMarkdown(mdPath, summary, sampleRows);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
