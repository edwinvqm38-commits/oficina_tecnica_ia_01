#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const DEFAULT_DIR = "tmp_imports";
const ALLOWED_QUALITY_STATUS = new Set(["OK", "OBSERVADO", "COMPLETAR_DATOS", "CRITICO_REVISAR"]);

const REQUIRED_FILES = {
  cotizaciones: "enriched_preview_cotizaciones.csv",
  requerimientos: "enriched_preview_requerimientos.csv",
  detalleRq: "enriched_preview_detalle_rq.csv",
};

const REQUIRED_COLUMNS = {
  cotizaciones: [
    "import_batch_id",
    "import_source",
    "data_quality_status",
    "historical_cotizacion_key",
    "source_row_number",
    "codigo",
  ],
  requerimientos: [
    "import_batch_id",
    "import_source",
    "data_quality_status",
    "historical_cotizacion_key",
    "historical_rq_key",
    "source_row_number",
    "codigo",
  ],
  detalleRq: [
    "import_batch_id",
    "import_source",
    "data_quality_status",
    "historical_cotizacion_key",
    "historical_rq_key",
    "source_row_number",
    "cotizacion_codigo",
  ],
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

    if (inlineValue === undefined && value !== true) index += 1;
  }
  return args;
}

function printUsage() {
  console.log(`
Uso:
  npm run check:historical-import-compatibility -- --dir "tmp_imports"

Opciones:
  --dir     Carpeta local con enriched previews. Default: "${DEFAULT_DIR}".
  --help    Muestra esta ayuda.
`);
}

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u00a0/g, " ").trim();
}

function readCsvRows(filePath) {
  const workbook = XLSX.readFile(filePath, { raw: true });
  const sheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: true,
  });
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

function addIssue(issues, issue) {
  issues.push(issue);
}

function validateRows(entityType, rows, requiredColumns, issues) {
  const counts = {
    totalRows: rows.length,
    rowsWithoutImportBatchId: 0,
    rowsWithoutSourceRow: 0,
    rowsWithoutHistoricalCotizacionKey: 0,
    rowsWithoutHistoricalRqKey: 0,
    rowsWithInvalidQualityStatus: 0,
  };

  const headers = Object.keys(rows[0] ?? {});
  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));

  for (const missingColumn of missingColumns) {
    addIssue(issues, {
      severity: "critical",
      entity_type: entityType,
      entity_key: entityType,
      issue_type: "missing_required_column",
      message: `Falta la columna requerida ${missingColumn}.`,
      source_row_number: "",
      field_name: missingColumn,
      raw_value: "",
      suggested_action: "revisar",
    });
  }

  for (const row of rows) {
    const entityKey =
      normalizeString(row.historical_rq_key) ||
      normalizeString(row.historical_cotizacion_key) ||
      normalizeString(row.codigo) ||
      normalizeString(row.cotizacion_codigo);
    const sourceRowNumber = normalizeString(row.source_row_number);
    const qualityStatus = normalizeString(row.data_quality_status);

    if (!normalizeString(row.import_batch_id)) {
      counts.rowsWithoutImportBatchId += 1;
      addIssue(issues, {
        severity: "critical",
        entity_type: entityType,
        entity_key: entityKey,
        issue_type: "missing_import_batch_id",
        message: "La fila no tiene import_batch_id.",
        source_row_number: sourceRowNumber,
        field_name: "import_batch_id",
        raw_value: row.import_batch_id,
        suggested_action: "revisar",
      });
    }

    if (!sourceRowNumber) {
      counts.rowsWithoutSourceRow += 1;
      addIssue(issues, {
        severity: "critical",
        entity_type: entityType,
        entity_key: entityKey,
        issue_type: "missing_source_row_number",
        message: "La fila no tiene source_row_number.",
        source_row_number: "",
        field_name: "source_row_number",
        raw_value: row.source_row_number,
        suggested_action: "revisar",
      });
    }

    if (!normalizeString(row.historical_cotizacion_key)) {
      counts.rowsWithoutHistoricalCotizacionKey += 1;
      addIssue(issues, {
        severity: "critical",
        entity_type: entityType,
        entity_key: entityKey,
        issue_type: "missing_historical_cotizacion_key",
        message: "La fila no tiene historical_cotizacion_key.",
        source_row_number: sourceRowNumber,
        field_name: "historical_cotizacion_key",
        raw_value: row.historical_cotizacion_key,
        suggested_action: "revisar",
      });
    }

    if (entityType !== "cotizaciones" && !normalizeString(row.historical_rq_key)) {
      counts.rowsWithoutHistoricalRqKey += 1;
      addIssue(issues, {
        severity: "critical",
        entity_type: entityType,
        entity_key: entityKey,
        issue_type: "missing_historical_rq_key",
        message: "La fila no tiene historical_rq_key.",
        source_row_number: sourceRowNumber,
        field_name: "historical_rq_key",
        raw_value: row.historical_rq_key,
        suggested_action: "revisar",
      });
    }

    if (!ALLOWED_QUALITY_STATUS.has(qualityStatus)) {
      counts.rowsWithInvalidQualityStatus += 1;
      addIssue(issues, {
        severity: "critical",
        entity_type: entityType,
        entity_key: entityKey,
        issue_type: "invalid_data_quality_status",
        message: `data_quality_status no permitido: ${qualityStatus || "(vacío)"}.`,
        source_row_number: sourceRowNumber,
        field_name: "data_quality_status",
        raw_value: row.data_quality_status,
        suggested_action: "revisar",
      });
    }

    if (
      entityType === "requerimientos" &&
      !normalizeString(row.codigo) &&
      !normalizeString(row.historical_rq_code_suggested)
    ) {
      addIssue(issues, {
        severity: "critical",
        entity_type: entityType,
        entity_key: entityKey,
        issue_type: "missing_rq_code_and_suggestion",
        message: "El requerimiento no tiene código ni historical_rq_code_suggested.",
        source_row_number: sourceRowNumber,
        field_name: "historical_rq_code_suggested",
        raw_value: row.historical_rq_code_suggested,
        suggested_action: "revisar",
      });
    }
  }

  return {
    headers,
    missingColumns,
    counts,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const dir = typeof args.dir === "string" ? args.dir : DEFAULT_DIR;
  const baseDir = path.resolve(dir);

  for (const fileName of Object.values(REQUIRED_FILES)) {
    const fullPath = path.join(baseDir, fileName);
    if (!fs.existsSync(fullPath)) {
      console.error(`Falta archivo requerido: ${fullPath}`);
      process.exit(1);
    }
  }

  const cotizaciones = readCsvRows(path.join(baseDir, REQUIRED_FILES.cotizaciones));
  const requerimientos = readCsvRows(path.join(baseDir, REQUIRED_FILES.requerimientos));
  const detalleRq = readCsvRows(path.join(baseDir, REQUIRED_FILES.detalleRq));

  const issues = [];

  const cotizacionesCheck = validateRows("cotizaciones", cotizaciones, REQUIRED_COLUMNS.cotizaciones, issues);
  const requerimientosCheck = validateRows(
    "requerimientos",
    requerimientos,
    REQUIRED_COLUMNS.requerimientos,
    issues
  );
  const detalleRqCheck = validateRows("detalle_rq", detalleRq, REQUIRED_COLUMNS.detalleRq, issues);

  const issuesByType = {};
  const issuesBySeverity = {};
  for (const issue of issues) {
    issuesByType[issue.issue_type] = (issuesByType[issue.issue_type] ?? 0) + 1;
    issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] ?? 0) + 1;
  }

  const topIssues = Object.entries(issuesByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([issueType, count]) => ({ issueType, count }));

  const report = {
    generatedAt: new Date().toISOString(),
    baseDir,
    filesChecked: REQUIRED_FILES,
    totals: {
      cotizaciones: cotizaciones.length,
      requerimientos: requerimientos.length,
      detalle_rq: detalleRq.length,
    },
    compatibility: {
      cotizaciones: cotizacionesCheck,
      requerimientos: requerimientosCheck,
      detalle_rq: detalleRqCheck,
    },
    totalIssues: issues.length,
    issuesByType,
    issuesBySeverity,
    topIssues,
    recommendation:
      issues.length === 0
        ? "Los archivos enriquecidos cumplen las condiciones mínimas para preparar una carga observada."
        : "Existen incompatibilidades mínimas de trazabilidad o estructura. Corregir antes de preparar una carga observada.",
  };

  writeCsv(
    path.join(baseDir, "historical_import_compatibility_issues.csv"),
    [
      "severity",
      "entity_type",
      "entity_key",
      "issue_type",
      "message",
      "source_row_number",
      "field_name",
      "raw_value",
      "suggested_action",
    ],
    issues
  );
  fs.writeFileSync(
    path.join(baseDir, "historical_import_compatibility_report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  console.log(`\nChequeo de compatibilidad completado en: ${baseDir}`);
  console.log(
    JSON.stringify(
      {
        totals: report.totals,
        totalIssues: report.totalIssues,
        issuesBySeverity: report.issuesBySeverity,
        topIssues: report.topIssues,
        recommendation: report.recommendation,
      },
      null,
      2
    )
  );
  console.log("\nEste script solo verifica compatibilidad local. No inserta datos, no ejecuta SQL y no modifica Supabase.");
}

main();
