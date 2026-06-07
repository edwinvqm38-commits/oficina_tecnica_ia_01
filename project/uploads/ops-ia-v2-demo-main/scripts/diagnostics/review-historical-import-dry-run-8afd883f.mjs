#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const DEFAULT_DIR = "tmp_imports/dry_run";
const MAX_SAMPLE_ROWS = 20;

const REQUIRED_FILES = {
  summary: "historical_import_dry_run_summary.json",
  cotizaciones: "planned_cotizaciones.csv",
  requerimientos: "planned_requerimientos.csv",
  detalleRq: "planned_detalle_rq.csv",
  importIssues: "planned_import_issues.csv",
  conflicts: "conflict_report.csv",
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
  npm run review:historical-import-dry-run -- --dir "tmp_imports/dry_run"

Opciones:
  --dir      Carpeta local con salidas del dry-run. Default: "${DEFAULT_DIR}".
  --help     Muestra esta ayuda.
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

function readJson(filePath) {
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

function countBy(rows, key) {
  const counts = new Map();

  for (const row of rows) {
    const value = normalizeString(row[key]) || "UNKNOWN";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")));
}

function topEntries(countMap, limit = 10) {
  return Object.entries(countMap)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function buildSampleRow(entityType, sourceFile, row) {
  const codigo =
    normalizeString(row.codigo) ||
    normalizeString(row.codigo_original) ||
    normalizeString(row.codigo_para_importacion_simulado) ||
    normalizeString(row.cotizacion_codigo);
  const descripcionOProyecto =
    normalizeString(row.descripcion) ||
    normalizeString(row.descripcion_o_proyecto) ||
    normalizeString(row.proyecto) ||
    normalizeString(row.proyecto_servicio) ||
    normalizeString(row.recurso_a_suministrar);

  return {
    entity_type: entityType,
    source_file: sourceFile,
    source_row_number: normalizeString(row.source_row_number),
    historical_cotizacion_key: normalizeString(row.historical_cotizacion_key),
    historical_rq_key: normalizeString(row.historical_rq_key),
    codigo,
    descripcion_o_proyecto: descripcionOProyecto,
    data_quality_status: normalizeString(row.data_quality_status),
    data_quality_notes: normalizeString(row.data_quality_notes),
    action_planned: normalizeString(row.action_planned),
    conflict_status: normalizeString(row.conflict_status),
    conflict_notes: normalizeString(row.conflict_notes),
  };
}

function buildSamples({ cotizaciones, requerimientos, detalleRq }, status) {
  const rows = [];

  const sources = [
    {
      entityType: "cotizaciones",
      sourceFile: "planned_cotizaciones.csv",
      rows: cotizaciones,
    },
    {
      entityType: "requerimientos",
      sourceFile: "planned_requerimientos.csv",
      rows: requerimientos,
    },
    {
      entityType: "detalle_rq",
      sourceFile: "planned_detalle_rq.csv",
      rows: detalleRq,
    },
  ];

  for (const source of sources) {
    for (const row of source.rows) {
      if (normalizeString(row.data_quality_status) !== status) continue;
      rows.push(buildSampleRow(source.entityType, source.sourceFile, row));
      if (rows.length >= MAX_SAMPLE_ROWS) return rows;
    }
  }

  return rows;
}

function buildNextStepRecommended(summary) {
  if (summary.readiness_status === "BLOCKED_BY_COMPATIBILITY") {
    return "Detener Fase 7 y corregir compatibilidad estructural antes de cualquier carga observada.";
  }
  if (summary.readiness_status === "BLOCKED_BY_CONFLICTS") {
    return "Detener Fase 7 y resolver conflictos detectados en dry-run.";
  }
  if (summary.readiness_status === "READY_WITH_OBSERVATIONS") {
    return "Pasar a revision funcional del lote, priorizando CRITICO_REVISAR y COMPLETAR_DATOS antes de autorizar Fase 7.";
  }
  return "Puede pasar a preparacion final de Fase 7 con validacion funcional breve.";
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

  const summary = readJson(path.join(baseDir, REQUIRED_FILES.summary));
  const plannedCotizaciones = readCsvRows(path.join(baseDir, REQUIRED_FILES.cotizaciones));
  const plannedRequerimientos = readCsvRows(path.join(baseDir, REQUIRED_FILES.requerimientos));
  const plannedDetalleRq = readCsvRows(path.join(baseDir, REQUIRED_FILES.detalleRq));
  const plannedImportIssues = readCsvRows(path.join(baseDir, REQUIRED_FILES.importIssues));
  readCsvRows(path.join(baseDir, REQUIRED_FILES.conflicts));
  const readinessReportExists = fs.existsSync(path.join(baseDir, "import_readiness_report.md"));

  const issueTypeCounts = countBy(plannedImportIssues, "issue_type");
  const criticalIssueTypeCounts = countBy(
    plannedImportIssues.filter((row) => normalizeString(row.severity) === "critical"),
    "issue_type"
  );

  const reviewSummary = {
    import_batch_id: normalizeString(summary.import_batch_id),
    readiness_status: normalizeString(summary.readiness_status),
    total_conflicts: Number(summary.total_conflicts ?? 0),
    total_cotizaciones: Number(summary.total_cotizaciones ?? plannedCotizaciones.length),
    total_requerimientos: Number(summary.total_requerimientos ?? plannedRequerimientos.length),
    total_detalle_rq: Number(summary.total_detalle_rq ?? plannedDetalleRq.length),
    total_planned_import_issues: Number(summary.total_planned_import_issues ?? plannedImportIssues.length),
    count_by_data_quality_status: summary.count_by_data_quality_status ?? {},
    count_by_entity_and_quality_status: summary.count_by_entity_and_quality_status ?? {},
    top_issue_types: topEntries(issueTypeCounts, 10),
    top_critical_issue_types: topEntries(criticalIssueTypeCounts, 10),
    recommendation: normalizeString(summary.recommendation),
    next_step_recommended: buildNextStepRecommended(summary),
  };

  const criticalSamples = buildSamples(
    {
      cotizaciones: plannedCotizaciones,
      requerimientos: plannedRequerimientos,
      detalleRq: plannedDetalleRq,
    },
    "CRITICO_REVISAR"
  );

  const completarDatosSamples = buildSamples(
    {
      cotizaciones: plannedCotizaciones,
      requerimientos: plannedRequerimientos,
      detalleRq: plannedDetalleRq,
    },
    "COMPLETAR_DATOS"
  );

  const observadoSamples = buildSamples(
    {
      cotizaciones: plannedCotizaciones,
      requerimientos: plannedRequerimientos,
      detalleRq: plannedDetalleRq,
    },
    "OBSERVADO"
  );

  const reportLines = [
    "# Revision funcional del dry-run de importacion historica observada",
    "",
    "## Resumen ejecutivo",
    `- Lote: \`${reviewSummary.import_batch_id}\``,
    `- readiness_status: \`${reviewSummary.readiness_status}\``,
    `- Conflictos detectados: ${reviewSummary.total_conflicts}`,
    `- Planned import issues: ${reviewSummary.total_planned_import_issues}`,
    `- Reporte de readiness previo presente: ${readinessReportExists ? "si" : "no"}`,
    "",
    "## Confirmacion de conflictos",
    reviewSummary.total_conflicts === 0
      ? "- No hubo conflictos en el dry-run. El lote no esta bloqueado por colisiones estructurales."
      : `- Se detectaron ${reviewSummary.total_conflicts} conflictos y deben resolverse antes de Fase 7.`,
    "",
    "## Resumen por calidad de dato",
    `- OK: ${reviewSummary.count_by_data_quality_status?.OK ?? 0}`,
    `- OBSERVADO: ${reviewSummary.count_by_data_quality_status?.OBSERVADO ?? 0}`,
    `- COMPLETAR_DATOS: ${reviewSummary.count_by_data_quality_status?.COMPLETAR_DATOS ?? 0}`,
    `- CRITICO_REVISAR: ${reviewSummary.count_by_data_quality_status?.CRITICO_REVISAR ?? 0}`,
    "",
    "## Resumen por entidad",
    `- Cotizaciones: ${reviewSummary.total_cotizaciones}`,
    `- Requerimientos: ${reviewSummary.total_requerimientos}`,
    `- Detalle RQ: ${reviewSummary.total_detalle_rq}`,
    "",
    "## Principales issues",
  ];

  if (reviewSummary.top_issue_types.length === 0) {
    reportLines.push("- No se registraron issue types en planned_import_issues.csv.");
  } else {
    for (const item of reviewSummary.top_issue_types) {
      reportLines.push(`- ${item.key}: ${item.count}`);
    }
  }

  reportLines.push("", "## Principales criticos");
  if (reviewSummary.top_critical_issue_types.length === 0) {
    reportLines.push("- No se registraron issue types criticos.");
  } else {
    for (const item of reviewSummary.top_critical_issue_types) {
      reportLines.push(`- ${item.key}: ${item.count}`);
    }
  }

  reportLines.push(
    "",
    "## Interpretacion de estados",
    "- `OK`: el registro puede pasar a carga observada sin alerta funcional relevante.",
    "- `OBSERVADO`: el registro se conserva, pero requiere revision funcional por consistencia o contexto.",
    "- `COMPLETAR_DATOS`: faltan datos relevantes, pero el registro se mantiene para trazabilidad y completado posterior.",
    "- `CRITICO_REVISAR`: el registro se mantiene en el plan, pero no deberia entrar sin revision humana posterior.",
    "",
    "## Riesgos antes de carga real",
    "- Persisten registros `CRITICO_REVISAR` en requerimientos y detalle RQ.",
    "- Persisten registros `COMPLETAR_DATOS` con vacios relevantes.",
    "- planned_import_issues.csv sigue siendo alto y requiere priorizacion funcional.",
    "- La ausencia de conflictos no reemplaza la revision de calidad historica.",
    "",
    "## Checklist antes de Fase 7",
    "- [ ] Revisar review_critical_samples.csv",
    "- [ ] Revisar review_completar_datos_samples.csv",
    "- [ ] Revisar review_observado_samples.csv",
    "- [ ] Confirmar tratamiento funcional de CRITICO_REVISAR",
    "- [ ] Confirmar tratamiento funcional de COMPLETAR_DATOS",
    "- [ ] Confirmar que planned_import_issues.csv tiene clasificacion suficiente",
    "- [ ] Validar que el lote mantiene trazabilidad por historical keys y source_row_number",
    "",
    "## Recomendacion final",
    `- ${reviewSummary.recommendation}`,
    `- Siguiente paso recomendado: ${reviewSummary.next_step_recommended}`,
    "",
    "Este reporte es solo de revision funcional.",
    "- No inserta datos.",
    "- No ejecuta SQL.",
    "- No modifica Supabase."
  );

  const sampleColumns = [
    "entity_type",
    "source_file",
    "source_row_number",
    "historical_cotizacion_key",
    "historical_rq_key",
    "codigo",
    "descripcion_o_proyecto",
    "data_quality_status",
    "data_quality_notes",
    "action_planned",
    "conflict_status",
    "conflict_notes",
  ];

  writeJson(path.join(baseDir, "review_summary.json"), reviewSummary);
  writeCsv(path.join(baseDir, "review_critical_samples.csv"), sampleColumns, criticalSamples);
  writeCsv(
    path.join(baseDir, "review_completar_datos_samples.csv"),
    sampleColumns,
    completarDatosSamples
  );
  writeCsv(path.join(baseDir, "review_observado_samples.csv"), sampleColumns, observadoSamples);
  fs.writeFileSync(path.join(baseDir, "review_report.md"), `${reportLines.join("\n")}\n`, "utf8");

  console.log(`\nRevision funcional generada en: ${baseDir}`);
  console.log(
    JSON.stringify(
      {
        import_batch_id: reviewSummary.import_batch_id,
        readiness_status: reviewSummary.readiness_status,
        total_conflicts: reviewSummary.total_conflicts,
        total_planned_import_issues: reviewSummary.total_planned_import_issues,
        next_step_recommended: reviewSummary.next_step_recommended,
      },
      null,
      2
    )
  );
  console.log("\nEste script solo genera reportes locales de revision. No inserta datos, no ejecuta SQL y no modifica Supabase.");
}

main();
