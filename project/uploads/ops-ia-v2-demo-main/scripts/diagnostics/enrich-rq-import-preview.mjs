#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const DEFAULT_DIR = "tmp_imports";
const DEFAULT_BATCH_ID = "IMPORT-2026-001";
const IMPORT_SOURCE = "historical_excel_preview";

const REQUIRED_FILES = {
  cotizaciones: "preview_cotizaciones.csv",
  requerimientos: "preview_requerimientos.csv",
  detalleRq: "preview_detalle_rq.csv",
  validationIssues: "validation_issues.csv",
  validationSummary: "validation_summary.json",
};

const QUALITY_META = {
  OK: { label: "OK", color: "green" },
  OBSERVADO: { label: "Observado", color: "amber" },
  COMPLETAR_DATOS: { label: "Completar datos", color: "orange" },
  CRITICO_REVISAR: { label: "Crítico - revisar", color: "red" },
};

const COMPLETAR_DATOS_ISSUES = new Set([
  "rq_sin_fecha",
  "rq_fecha_invalida",
  "rq_sin_oc",
  "item_sin_descripcion",
  "item_sin_unidad",
  "item_sin_precio_unitario",
  "item_moneda_vacia_con_precio",
]);

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
  npm run enrich:rq-import-preview -- --dir "tmp_imports" --batch-id "IMPORT-2026-001"

Opciones:
  --dir        Carpeta local con previews y validaciones. Default: "${DEFAULT_DIR}".
  --batch-id   Identificador del lote de importación. Default: "${DEFAULT_BATCH_ID}".
  --help       Muestra esta ayuda.
`);
}

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u00a0/g, " ").trim();
}

function normalizeHistoricalKeyPart(value) {
  return normalizeString(value).replace(/\s+/g, " ");
}

function buildHistoricalRqKey(historicalCotizacionKey, codigoRq, sourceRowNumber) {
  const cotizacionKey = normalizeHistoricalKeyPart(historicalCotizacionKey);
  const rqCode = normalizeHistoricalKeyPart(codigoRq);
  const safeSourceRowNumber = normalizeString(sourceRowNumber) || "0";

  if (cotizacionKey && rqCode) {
    return `${cotizacionKey}||${rqCode}`;
  }

  if (cotizacionKey) {
    return `${cotizacionKey}||SIN_RQ||ROW_${safeSourceRowNumber}`;
  }

  return `SIN_COTIZACION||SIN_RQ||ROW_${safeSourceRowNumber}`;
}

function readCsvRows(filePath) {
  const workbook = XLSX.readFile(filePath, { raw: true });
  const sheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: true,
  });
}

function writeCsv(filePath, columns, rows) {
  const escape = (value) => {
    const stringValue = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const lines = [
    columns.map(escape).join(","),
    ...rows.map((row) => columns.map((column) => escape(row[column] ?? "")).join(",")),
  ];

  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildIssueMaps(issues) {
  const byEntity = new Map();
  const byDetalleSource = new Map();

  for (const issue of issues) {
    const entityType = normalizeString(issue.entity_type);
    const entityKey = normalizeString(issue.entity_key);
    const sourceRow = normalizeString(issue.source_row_number);

    if (entityType && entityKey) {
      const key = `${entityType}::${entityKey}`;
      const list = byEntity.get(key) ?? [];
      list.push(issue);
      byEntity.set(key, list);
    }

    if (entityType === "detalle_rq" && sourceRow) {
      const list = byDetalleSource.get(sourceRow) ?? [];
      list.push(issue);
      byDetalleSource.set(sourceRow, list);
    }
  }

  return { byEntity, byDetalleSource };
}

function getQualityStatus(issues) {
  const relevantIssues = issues.filter((issue) => normalizeString(issue.severity) !== "info");
  const hasCritical = relevantIssues.some((issue) => normalizeString(issue.severity) === "critical");
  const issueTypes = new Set(relevantIssues.map((issue) => normalizeString(issue.issue_type)));
  const hasCompletarDatos = [...issueTypes].some((issueType) => COMPLETAR_DATOS_ISSUES.has(issueType));
  const hasWarning = relevantIssues.some((issue) => normalizeString(issue.severity) === "warning");

  if (hasCritical) return "CRITICO_REVISAR";
  if (hasCompletarDatos) return "COMPLETAR_DATOS";
  if (hasWarning) return "OBSERVADO";
  return "OK";
}

function buildQualityPayload(issues) {
  const relevantIssues = issues.filter((issue) => normalizeString(issue.severity) !== "info");
  const status = getQualityStatus(issues);
  const metadata = QUALITY_META[status];
  const uniqueIssueTypes = unique(relevantIssues.map((issue) => normalizeString(issue.issue_type)));

  return {
    data_quality_status: status,
    data_quality_label: metadata.label,
    data_quality_color: metadata.color,
    data_quality_notes: uniqueIssueTypes.slice(0, 6).join("; "),
    data_quality_issues_count: relevantIssues.length,
    data_quality_has_critical: relevantIssues.some((issue) => normalizeString(issue.severity) === "critical")
      ? "true"
      : "false",
    data_quality_has_warning: relevantIssues.some((issue) => normalizeString(issue.severity) === "warning")
      ? "true"
      : "false",
  };
}

function makeHistoricalRqCodeSuggestion(index) {
  return `RQ-HIST-SIN-CODIGO-${String(index).padStart(4, "0")}`;
}

function countBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = normalizeString(row[key]) || "UNKNOWN";
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")));
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const dir = typeof args.dir === "string" ? args.dir : DEFAULT_DIR;
  const batchId = typeof args["batch-id"] === "string" ? args["batch-id"] : DEFAULT_BATCH_ID;
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
  const validationIssues = readCsvRows(path.join(baseDir, REQUIRED_FILES.validationIssues));
  const validationSummary = JSON.parse(
    fs.readFileSync(path.join(baseDir, REQUIRED_FILES.validationSummary), "utf8")
  );

  const { byEntity, byDetalleSource } = buildIssueMaps(validationIssues);

  const detailRowsByRqKey = new Map();
  const detailRowsByCotKey = new Map();
  for (const row of detalleRq) {
    const rqKey =
      normalizeString(row.historical_rq_key) ||
      buildHistoricalRqKey(row.historical_cotizacion_key || row.cotizacion_codigo, row.codigo_rq, row.source_row_number);
    const cotKey = normalizeString(row.historical_cotizacion_key);

    if (rqKey) {
      const list = detailRowsByRqKey.get(rqKey) ?? [];
      list.push(row);
      detailRowsByRqKey.set(rqKey, list);
    }

    if (cotKey) {
      const list = detailRowsByCotKey.get(cotKey) ?? [];
      list.push(row);
      detailRowsByCotKey.set(cotKey, list);
    }
  }

  let missingRqCodeCounter = 0;

  const enrichedDetalleRows = detalleRq.map((row) => {
    const sourceRowNumber = normalizeString(row.source_row_number);
    const historicalCotizacionKey = normalizeString(row.historical_cotizacion_key || row.cotizacion_codigo);
    const historicalRqKey =
      normalizeString(row.historical_rq_key) ||
      buildHistoricalRqKey(historicalCotizacionKey, row.codigo_rq, sourceRowNumber);
    const detailIssues = byDetalleSource.get(sourceRowNumber) ?? [];
    const quality = buildQualityPayload(detailIssues);

    return {
      ...row,
      import_batch_id: batchId,
      import_source: IMPORT_SOURCE,
      ...quality,
      source_row_number: sourceRowNumber,
      historical_cotizacion_key: historicalCotizacionKey,
      historical_rq_key: historicalRqKey,
      historical_rq_code_suggested: "",
    };
  });

  const enrichedRqRows = requerimientos.map((row) => {
    const sourceRowNumber = normalizeString(row.source_row_number);
    const historicalCotizacionKey = normalizeString(row.historical_cotizacion_key || row.cotizacion_codigo);
    const historicalRqKey =
      normalizeString(row.historical_rq_key) ||
      buildHistoricalRqKey(historicalCotizacionKey, row.codigo, sourceRowNumber);
    const entityKey = historicalRqKey || normalizeString(row.codigo);
    const entityIssues = byEntity.get(`requerimiento::${entityKey}`) ?? [];
    const relatedDetailRows = detailRowsByRqKey.get(historicalRqKey) ?? [];
    const relatedDetailIssues = relatedDetailRows.flatMap((detailRow) => {
      const sourceRow = normalizeString(detailRow.source_row_number);
      return byDetalleSource.get(sourceRow) ?? [];
    });
    const allIssues = [...entityIssues, ...relatedDetailIssues];
    const quality = buildQualityPayload(allIssues);
    const resolvedSourceRowNumber = sourceRowNumber || normalizeString(relatedDetailRows[0]?.source_row_number);

    let historicalRqCodeSuggested = normalizeString(row.historical_rq_code_suggested);
    if (!normalizeString(row.codigo) && !historicalRqCodeSuggested) {
      missingRqCodeCounter += 1;
      historicalRqCodeSuggested = makeHistoricalRqCodeSuggestion(missingRqCodeCounter);
    }

    return {
      ...row,
      import_batch_id: batchId,
      import_source: IMPORT_SOURCE,
      ...quality,
      source_row_number: resolvedSourceRowNumber,
      historical_cotizacion_key: historicalCotizacionKey,
      historical_rq_key: historicalRqKey,
      historical_rq_code_suggested: historicalRqCodeSuggested,
    };
  });

  const enrichedCotRows = cotizaciones.map((row) => {
    const entityKey = normalizeString(row.historical_cotizacion_key) || normalizeString(row.codigo);
    const entityIssues = byEntity.get(`cotizacion::${entityKey}`) ?? [];
    const relatedDetailRows = detailRowsByCotKey.get(normalizeString(row.historical_cotizacion_key)) ?? [];
    const relatedRqRows = enrichedRqRows.filter(
      (rqRow) => normalizeString(rqRow.historical_cotizacion_key) === normalizeString(row.historical_cotizacion_key)
    );
    const relatedRqIssues = relatedRqRows.flatMap((rqRow) => {
      const rqEntityKey = normalizeString(rqRow.historical_rq_key) || normalizeString(rqRow.codigo);
      return byEntity.get(`requerimiento::${rqEntityKey}`) ?? [];
    });
    const allIssues = [...entityIssues, ...relatedRqIssues];
    const quality = buildQualityPayload(allIssues);
    const sourceRowNumber = normalizeString(relatedDetailRows[0]?.source_row_number);

    return {
      ...row,
      import_batch_id: batchId,
      import_source: IMPORT_SOURCE,
      ...quality,
      source_row_number: sourceRowNumber,
      historical_cotizacion_key: normalizeString(row.historical_cotizacion_key),
      historical_rq_key: "",
    };
  });

  const enrichedSummary = {
    total_cotizaciones: enrichedCotRows.length,
    total_requerimientos: enrichedRqRows.length,
    total_detalle_rq: enrichedDetalleRows.length,
    count_by_data_quality_status: {
      cotizaciones: countBy(enrichedCotRows, "data_quality_status"),
      requerimientos: countBy(enrichedRqRows, "data_quality_status"),
      detalle_rq: countBy(enrichedDetalleRows, "data_quality_status"),
    },
    count_by_entity_and_quality_status: {
      cotizaciones: countBy(enrichedCotRows, "data_quality_status"),
      requerimientos: countBy(enrichedRqRows, "data_quality_status"),
      detalle_rq: countBy(enrichedDetalleRows, "data_quality_status"),
    },
    total_critical: validationIssues.filter((issue) => normalizeString(issue.severity) === "critical").length,
    total_warning: validationIssues.filter((issue) => normalizeString(issue.severity) === "warning").length,
    recommendation:
      validationIssues.some((issue) => normalizeString(issue.severity) === "critical")
        ? "No importar todavía a Supabase sin una estrategia de carga observada y revisión humana posterior."
        : validationIssues.some((issue) => normalizeString(issue.severity) === "warning")
          ? "Puede prepararse importación controlada con etiquetas de calidad."
          : "Listo para preparar importación controlada.",
    validation_summary_reference: validationSummary,
    generatedAt: new Date().toISOString(),
    import_batch_id: batchId,
    import_source: IMPORT_SOURCE,
  };

  const detailColumns = [
    "import_batch_id",
    "import_source",
    "data_quality_status",
    "data_quality_label",
    "data_quality_color",
    "data_quality_notes",
    "data_quality_issues_count",
    "data_quality_has_critical",
    "data_quality_has_warning",
    "source_row_number",
    "historical_cotizacion_key",
    "historical_rq_key",
    "historical_rq_code_suggested",
    ...Object.keys(enrichedDetalleRows[0] ?? {}).filter(
      (column) =>
        ![
          "import_batch_id",
          "import_source",
          "data_quality_status",
          "data_quality_label",
          "data_quality_color",
          "data_quality_notes",
          "data_quality_issues_count",
          "data_quality_has_critical",
          "data_quality_has_warning",
          "source_row_number",
          "historical_cotizacion_key",
          "historical_rq_key",
          "historical_rq_code_suggested",
        ].includes(column)
    ),
  ];

  const rqColumns = [
    "import_batch_id",
    "import_source",
    "data_quality_status",
    "data_quality_label",
    "data_quality_color",
    "data_quality_notes",
    "data_quality_issues_count",
    "data_quality_has_critical",
    "data_quality_has_warning",
    "source_row_number",
    "historical_cotizacion_key",
    "historical_rq_key",
    "historical_rq_code_suggested",
    ...Object.keys(enrichedRqRows[0] ?? {}).filter(
      (column) =>
        ![
          "import_batch_id",
          "import_source",
          "data_quality_status",
          "data_quality_label",
          "data_quality_color",
          "data_quality_notes",
          "data_quality_issues_count",
          "data_quality_has_critical",
          "data_quality_has_warning",
          "source_row_number",
          "historical_cotizacion_key",
          "historical_rq_key",
          "historical_rq_code_suggested",
        ].includes(column)
    ),
  ];

  const cotColumns = [
    "import_batch_id",
    "import_source",
    "data_quality_status",
    "data_quality_label",
    "data_quality_color",
    "data_quality_notes",
    "data_quality_issues_count",
    "data_quality_has_critical",
    "data_quality_has_warning",
    "source_row_number",
    "historical_cotizacion_key",
    "historical_rq_key",
    ...Object.keys(enrichedCotRows[0] ?? {}).filter(
      (column) =>
        ![
          "import_batch_id",
          "import_source",
          "data_quality_status",
          "data_quality_label",
          "data_quality_color",
          "data_quality_notes",
          "data_quality_issues_count",
          "data_quality_has_critical",
          "data_quality_has_warning",
          "source_row_number",
          "historical_cotizacion_key",
          "historical_rq_key",
        ].includes(column)
    ),
  ];

  writeCsv(path.join(baseDir, "enriched_preview_detalle_rq.csv"), detailColumns, enrichedDetalleRows);
  writeCsv(path.join(baseDir, "enriched_preview_requerimientos.csv"), rqColumns, enrichedRqRows);
  writeCsv(path.join(baseDir, "enriched_preview_cotizaciones.csv"), cotColumns, enrichedCotRows);
  fs.writeFileSync(
    path.join(baseDir, "enriched_import_summary.json"),
    `${JSON.stringify(enrichedSummary, null, 2)}\n`,
    "utf8"
  );

  console.log(`\nPreview enriquecido generado en: ${baseDir}`);
  console.log(
    JSON.stringify(
      {
        import_batch_id: batchId,
        count_by_data_quality_status: enrichedSummary.count_by_data_quality_status,
        total_critical: enrichedSummary.total_critical,
        total_warning: enrichedSummary.total_warning,
        recommendation: enrichedSummary.recommendation,
      },
      null,
      2
    )
  );
  console.log("\nEste script solo enriquece previews locales. No inserta datos, no ejecuta SQL y no modifica Supabase.");
}

main();
