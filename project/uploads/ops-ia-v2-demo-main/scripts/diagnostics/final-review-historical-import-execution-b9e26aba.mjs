#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const DEFAULT_DIR = "tmp_imports/import_execution";
const DEFAULT_BATCH_ID = "IMPORT-2026-001";

const REQUIRED_FILES = {
  importExecutionPlan: "import_execution_plan.json",
  importExecutionValidation: "import_execution_validation.csv",
};

const DRY_RUN_REQUIRED_FILES = {
  reviewSummary: "review_summary.json",
  reviewReport: "review_report.md",
  plannedImportBatch: "planned_import_batch.json",
  plannedImportIssues: "planned_import_issues.csv",
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
  npm run final-review:historical-import -- --dir "tmp_imports/import_execution" --batch-id "IMPORT-2026-001"

Opciones:
  --dir        Carpeta con archivos de import_execution. Default: "${DEFAULT_DIR}".
  --batch-id   Batch esperado. Default: "${DEFAULT_BATCH_ID}".
  --help       Muestra esta ayuda.
`);
}

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u00a0/g, " ").trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readCsvRows(filePath) {
  const workbook = XLSX.readFile(filePath, { raw: true });
  const sheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: true,
  });
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function buildChecklistMarkdown({
  batchId,
  executeAllowedByScript,
  plan,
  reviewSummary,
  reviewReport,
  plannedImportBatch,
  plannedImportIssues,
}) {
  const lines = [
    "# Revision final previa a ejecucion controlada",
    "",
    "## Resumen ejecutivo",
    `- Batch: \`${batchId}\``,
    `- execute_allowed_by_script: ${executeAllowedByScript ? "true" : "false"}`,
    `- human_approval_required: true`,
    "",
    "## Confirmaciones tecnicas",
    `- remote_validation_status: \`${normalizeString(plan.remote_validation_status)}\``,
    `- blockers vacios: ${Array.isArray(plan.blockers) && plan.blockers.length === 0 ? "si" : "no"}`,
    `- warnings vacios: ${Array.isArray(plan.warnings) && plan.warnings.length === 0 ? "si" : "no"}`,
    `- can_execute_from_plan: ${plan.can_execute === true ? "true" : "false"}`,
    "",
    "## Totales a importar",
    `- Cotizaciones: ${Number(plan.total_cotizaciones ?? 0)}`,
    `- Requerimientos: ${Number(plan.total_requerimientos ?? 0)}`,
    `- Detalle RQ: ${Number(plan.total_detalle_rq ?? 0)}`,
    `- Import issues: ${plannedImportIssues.length}`,
    "",
    "## Resumen de calidad de datos",
  ];

  for (const [status, count] of Object.entries(reviewSummary.count_by_data_quality_status ?? {})) {
    lines.push(`- ${status}: ${count}`);
  }

  lines.push("", "## Resumen por entidad");
  for (const [entityType, counts] of Object.entries(reviewSummary.count_by_entity_and_quality_status ?? {})) {
    const parts = Object.entries(counts)
      .filter(([, count]) => Number(count) > 0)
      .map(([status, count]) => `${status} ${count}`);
    lines.push(`- ${entityType}: ${parts.join(", ") || "sin datos"}`);
  }

  lines.push("", "## Riesgos pendientes");
  for (const item of reviewSummary.top_critical_issue_types ?? []) {
    lines.push(`- ${item.key}: ${item.count}`);
  }

  if ((reviewSummary.top_critical_issue_types ?? []).length === 0) {
    lines.push("- No se registraron issues criticos en la revision funcional.");
  }

  lines.push(
    "",
    "## Confirmaciones requeridas",
    ...((plan.required_confirmations_for_execute ?? []).map((flag) => `- ${flag}`)),
    "",
    "## Plantilla de ejecucion real",
    "- NO EJECUTAR AUN sin aprobacion humana explicita.",
    "```powershell",
    `npm run import:historical-observed -- --dir "tmp_imports/dry_run" --batch-id "${batchId}" --execute --confirm-batch "${batchId}" --confirm-risk "OBSERVED_IMPORT_APPROVED" --confirm-no-conflicts`,
    "```",
    "",
    "## Checklist final",
    "- [ ] Revision funcional aprobada.",
    "- [ ] Riesgos CRITICO_REVISAR aceptados o documentados.",
    "- [ ] Riesgos COMPLETAR_DATOS aceptados o documentados.",
    "- [ ] Batch final confirmado.",
    "- [ ] Confirmaciones requeridas listas.",
    "- [ ] Aprobacion humana explicita antes de cualquier `--execute`.",
    "",
    "## Nota",
    `- planned_import_batch.status actual: \`${normalizeString(plannedImportBatch.status)}\``,
    `- review_report presente: ${normalizeString(reviewReport).length > 0 ? "si" : "no"}`,
    `- Este artefacto es solo de revision local. No inserta datos ni ejecuta SQL.`,
  );

  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const baseDir = path.resolve(typeof args.dir === "string" ? args.dir : DEFAULT_DIR);
  const batchId = typeof args["batch-id"] === "string" ? args["batch-id"] : DEFAULT_BATCH_ID;
  const dryRunDir = path.join(path.dirname(baseDir), "dry_run");

  for (const fileName of Object.values(REQUIRED_FILES)) {
    const filePath = path.join(baseDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.error(`Falta archivo requerido: ${filePath}`);
      process.exit(1);
    }
  }

  for (const fileName of Object.values(DRY_RUN_REQUIRED_FILES)) {
    const filePath = path.join(dryRunDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.error(`Falta archivo requerido: ${filePath}`);
      process.exit(1);
    }
  }

  const plan = readJson(path.join(baseDir, REQUIRED_FILES.importExecutionPlan));
  const validationRows = readCsvRows(path.join(baseDir, REQUIRED_FILES.importExecutionValidation));
  const reviewSummary = readJson(path.join(dryRunDir, DRY_RUN_REQUIRED_FILES.reviewSummary));
  const reviewReport = readText(path.join(dryRunDir, DRY_RUN_REQUIRED_FILES.reviewReport));
  const plannedImportBatch = readJson(path.join(dryRunDir, DRY_RUN_REQUIRED_FILES.plannedImportBatch));
  const plannedImportIssues = readCsvRows(path.join(dryRunDir, DRY_RUN_REQUIRED_FILES.plannedImportIssues));

  const blockers = Array.isArray(plan.blockers) ? plan.blockers : [];
  const warnings = Array.isArray(plan.warnings) ? plan.warnings : [];
  const requiredConfirmations = Array.isArray(plan.required_confirmations_for_execute)
    ? plan.required_confirmations_for_execute
    : [];

  if (normalizeString(plan.import_batch_id) !== batchId) {
    console.error(
      `El batch-id solicitado (${batchId}) no coincide con import_execution_plan (${normalizeString(plan.import_batch_id)}).`
    );
    process.exit(1);
  }

  if (normalizeString(reviewSummary.import_batch_id) !== batchId) {
    console.error(
      `El batch-id solicitado (${batchId}) no coincide con review_summary (${normalizeString(reviewSummary.import_batch_id)}).`
    );
    process.exit(1);
  }

  if (normalizeString(plannedImportBatch.import_batch_id) !== batchId) {
    console.error(
      `El batch-id solicitado (${batchId}) no coincide con planned_import_batch (${normalizeString(plannedImportBatch.import_batch_id)}).`
    );
    process.exit(1);
  }

  const failedCriticalValidations = validationRows.filter(
    (row) =>
      normalizeString(row.status).toLowerCase() === "fail" &&
      normalizeString(row.severity).toLowerCase() === "critical"
  );

  const executeAllowedByScript =
    plan.can_execute === true &&
    normalizeString(plan.remote_validation_status) === "passed" &&
    blockers.length === 0 &&
    failedCriticalValidations.length === 0;

  const executeCommandTemplate =
    `npm run import:historical-observed -- --dir "tmp_imports/dry_run" --batch-id "${batchId}" ` +
    `--execute --confirm-batch "${batchId}" --confirm-risk "OBSERVED_IMPORT_APPROVED" --confirm-no-conflicts`;

  const finalRecommendation = executeAllowedByScript
    ? "El lote queda tecnicamente habilitado por script, pero sigue requiriendo aprobacion humana explicita antes de cualquier --execute."
    : "El lote aun no debe pasar a --execute. Revisar blockers, validaciones criticas o inconsistencias previas.";

  const finalReview = {
    import_batch_id: batchId,
    can_execute_from_plan: plan.can_execute === true,
    remote_validation_status: normalizeString(plan.remote_validation_status),
    blockers,
    warnings,
    total_cotizaciones: Number(plan.total_cotizaciones ?? 0),
    total_requerimientos: Number(plan.total_requerimientos ?? 0),
    total_detalle_rq: Number(plan.total_detalle_rq ?? 0),
    total_import_issues: plannedImportIssues.length,
    quality_summary: {
      count_by_data_quality_status: reviewSummary.count_by_data_quality_status ?? {},
      count_by_entity_and_quality_status: reviewSummary.count_by_entity_and_quality_status ?? {},
      top_critical_issue_types: reviewSummary.top_critical_issue_types ?? [],
      top_issue_types: reviewSummary.top_issue_types ?? [],
    },
    required_confirmations: requiredConfirmations,
    final_recommendation: finalRecommendation,
    execute_command_template: executeCommandTemplate,
    execute_allowed_by_script: executeAllowedByScript,
    human_approval_required: true,
  };

  writeJson(path.join(baseDir, "final_execution_review.json"), finalReview);
  fs.writeFileSync(
    path.join(baseDir, "final_execution_checklist.md"),
    buildChecklistMarkdown({
      batchId,
      executeAllowedByScript,
      plan,
      reviewSummary,
      reviewReport,
      plannedImportBatch,
      plannedImportIssues,
    }),
    "utf8"
  );

  console.log(`\nRevision final generada en: ${baseDir}`);
  console.log(
    JSON.stringify(
      {
        import_batch_id: finalReview.import_batch_id,
        execute_allowed_by_script: finalReview.execute_allowed_by_script,
        human_approval_required: finalReview.human_approval_required,
        remote_validation_status: finalReview.remote_validation_status,
        blockers: finalReview.blockers,
        warnings: finalReview.warnings,
        final_recommendation: finalReview.final_recommendation,
      },
      null,
      2
    )
  );
  console.log("\nEste script no ejecuto inserciones ni consultas remotas. Solo genero una revision final local.");
}

main();
