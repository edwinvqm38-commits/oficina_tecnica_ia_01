#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const DEFAULT_DIR = "tmp_imports";
const REQUIRED_FILES = {
  cotizaciones: "preview_cotizaciones.csv",
  requerimientos: "preview_requerimientos.csv",
  detalleRq: "preview_detalle_rq.csv",
  summary: "preview_import_summary.json",
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
  npm run validate:rq-import-preview -- --dir "tmp_imports"

Opciones:
  --dir     Carpeta local que contiene los archivos preview. Default: "${DEFAULT_DIR}".
  --help    Muestra esta ayuda.
`);
}

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u00a0/g, " ").trim();
}

function normalizeValue(value) {
  return normalizeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const normalized = String(value)
    .trim()
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizeString(value));
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

function addIssue(issues, issueCounts, severityCounts, issue) {
  issues.push(issue);
  issueCounts.set(issue.issue_type, (issueCounts.get(issue.issue_type) ?? 0) + 1);
  severityCounts.set(issue.severity, (severityCounts.get(issue.severity) ?? 0) + 1);
}

function createCatalogAccumulator() {
  return new Map();
}

function addCatalogValue(accumulator, rawValue, sourceRowNumber) {
  const raw = normalizeString(rawValue);
  if (!raw) return;

  const normalized = normalizeValue(raw);
  const entry = accumulator.get(raw) ?? {
    raw_value: raw,
    normalized_value: normalized,
    count: 0,
    sample_rows: [],
  };

  entry.count += 1;
  if (entry.sample_rows.length < 5 && sourceRowNumber !== undefined && sourceRowNumber !== "") {
    entry.sample_rows.push(sourceRowNumber);
  }

  accumulator.set(raw, entry);
}

function catalogEntries(accumulator) {
  return [...accumulator.values()]
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.raw_value.localeCompare(right.raw_value, "es");
    })
    .map((entry) => ({
      ...entry,
      suggested_action:
        entry.normalized_value === ""
          ? "revisar"
          : entry.count === 1
            ? "revisar"
            : entry.normalized_value === normalizeValue(entry.raw_value)
              ? "ok"
              : "mapear",
    }));
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
  const previewSummary = JSON.parse(fs.readFileSync(path.join(baseDir, REQUIRED_FILES.summary), "utf8"));

  const issues = [];
  const issueCounts = new Map();
  const severityCounts = new Map();

  const catalogAccumulators = {
    clientes: createCatalogAccumulator(),
    unidades: createCatalogAccumulator(),
    monedas: createCatalogAccumulator(),
    oc: createCatalogAccumulator(),
    tipos_servicio: createCatalogAccumulator(),
    responsables: createCatalogAccumulator(),
    unidades_medida: createCatalogAccumulator(),
    tipos_recurso: createCatalogAccumulator(),
    proveedores: createCatalogAccumulator(),
  };

  for (const row of cotizaciones) {
    const entityKey = normalizeString(row.historical_cotizacion_key) || normalizeString(row.codigo);

    addCatalogValue(catalogAccumulators.clientes, row.cliente, "");
    addCatalogValue(catalogAccumulators.unidades, row.unidad_trabajo, "");
    addCatalogValue(catalogAccumulators.monedas, row.monedas_detectadas, "");
    addCatalogValue(catalogAccumulators.oc, row.oc, "");
    addCatalogValue(catalogAccumulators.tipos_servicio, row.tipo_servicio, "");
    addCatalogValue(catalogAccumulators.responsables, row.solicitante, "");

    if (!normalizeString(row.historical_cotizacion_key)) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "critical",
        entity_type: "cotizacion",
        entity_key: entityKey,
        issue_type: "cotizacion_sin_codigo_historico",
        message: "La cotización no tiene historical_cotizacion_key.",
        source_row_number: "",
        field_name: "historical_cotizacion_key",
        raw_value: row.historical_cotizacion_key,
        suggested_action: "revisar",
      });
    }

    if (!normalizeString(row.cliente)) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "critical",
        entity_type: "cotizacion",
        entity_key: entityKey,
        issue_type: "cotizacion_sin_cliente",
        message: "La cotización no tiene cliente.",
        source_row_number: "",
        field_name: "cliente",
        raw_value: row.cliente,
        suggested_action: "mapear",
      });
    }

    if (!normalizeString(row.unidad_trabajo)) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "critical",
        entity_type: "cotizacion",
        entity_key: entityKey,
        issue_type: "cotizacion_sin_unidad",
        message: "La cotización no tiene unidad de trabajo.",
        source_row_number: "",
        field_name: "unidad_trabajo",
        raw_value: row.unidad_trabajo,
        suggested_action: "mapear",
      });
    }

    const monedas = normalizeString(row.monedas_detectadas)
      .split("|")
      .map((value) => normalizeString(value))
      .filter(Boolean);
    if (monedas.length > 1) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "warning",
        entity_type: "cotizacion",
        entity_key: entityKey,
        issue_type: "cotizacion_con_multiples_monedas",
        message: `La cotización tiene múltiples monedas: ${monedas.join(", ")}.`,
        source_row_number: "",
        field_name: "monedas_detectadas",
        raw_value: row.monedas_detectadas,
        suggested_action: "revisar",
      });
    }

    if (normalizeString(row.oc).includes("|")) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "warning",
        entity_type: "cotizacion",
        entity_key: entityKey,
        issue_type: "cotizacion_con_multiples_oc",
        message: "La cotización tiene múltiples OC.",
        source_row_number: "",
        field_name: "oc",
        raw_value: row.oc,
        suggested_action: "revisar",
      });
    }

    if (normalizeString(row.warnings).includes("multiple_tipo_servicio_en_cotizacion")) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "warning",
        entity_type: "cotizacion",
        entity_key: entityKey,
        issue_type: "cotizacion_con_multiples_tipos_servicio",
        message: "La cotización tiene más de un tipo de servicio en el preview.",
        source_row_number: "",
        field_name: "tipo_servicio",
        raw_value: row.tipo_servicio,
        suggested_action: "revisar",
      });
    }

    addIssue(issues, issueCounts, severityCounts, {
      severity: "info",
      entity_type: "cotizacion",
      entity_key: entityKey,
      issue_type: "cotizacion_total_rq",
      message: `La cotización tiene ${normalizeString(row.total_rq) || "0"} requerimientos asociados.`,
      source_row_number: "",
      field_name: "total_rq",
      raw_value: row.total_rq,
      suggested_action: "ok",
    });
  }

  const rqDuplicateMap = new Map();
  for (const row of requerimientos) {
    const entityKey = normalizeString(row.historical_rq_key) || normalizeString(row.codigo);
    const duplicateKey = `${normalizeString(row.cotizacion_codigo)}||${normalizeString(row.codigo)}`;
    rqDuplicateMap.set(duplicateKey, (rqDuplicateMap.get(duplicateKey) ?? 0) + 1);

    addCatalogValue(catalogAccumulators.clientes, row.cliente, "");
    addCatalogValue(catalogAccumulators.unidades, row.unidad_trabajo, "");
    addCatalogValue(catalogAccumulators.oc, row.oc, "");
    addCatalogValue(catalogAccumulators.tipos_servicio, row.tipo_servicio, "");
    addCatalogValue(catalogAccumulators.responsables, row.solicitante_rq, "");

    if (!normalizeString(row.codigo)) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "critical",
        entity_type: "requerimiento",
        entity_key: entityKey,
        issue_type: "rq_sin_codigo",
        message: "El requerimiento no tiene código.",
        source_row_number: "",
        field_name: "codigo",
        raw_value: row.codigo,
        suggested_action: "revisar",
      });
    }

    if (!normalizeString(row.historical_cotizacion_key) || !normalizeString(row.cotizacion_codigo)) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "critical",
        entity_type: "requerimiento",
        entity_key: entityKey,
        issue_type: "rq_sin_cotizacion_relacionada",
        message: "El requerimiento no tiene cotización relacionada.",
        source_row_number: "",
        field_name: "cotizacion_codigo",
        raw_value: row.cotizacion_codigo,
        suggested_action: "revisar",
      });
    }

    if (!normalizeString(row.fecha_solicitud)) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "warning",
        entity_type: "requerimiento",
        entity_key: entityKey,
        issue_type: "rq_sin_fecha",
        message: "El requerimiento no tiene fecha de solicitud.",
        source_row_number: "",
        field_name: "fecha_solicitud",
        raw_value: row.fecha_solicitud,
        suggested_action: "revisar",
      });
    } else if (!isIsoDate(row.fecha_solicitud)) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "warning",
        entity_type: "requerimiento",
        entity_key: entityKey,
        issue_type: "rq_fecha_invalida",
        message: "La fecha de solicitud del requerimiento no tiene formato ISO.",
        source_row_number: "",
        field_name: "fecha_solicitud",
        raw_value: row.fecha_solicitud,
        suggested_action: "revisar",
      });
    }

    if ("responsable" in row && !normalizeString(row.responsable)) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "warning",
        entity_type: "requerimiento",
        entity_key: entityKey,
        issue_type: "rq_sin_responsable",
        message: "El requerimiento no tiene responsable.",
        source_row_number: "",
        field_name: "responsable",
        raw_value: row.responsable,
        suggested_action: "revisar",
      });
    }

    if (!normalizeString(row.oc)) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "warning",
        entity_type: "requerimiento",
        entity_key: entityKey,
        issue_type: "rq_sin_oc",
        message: "El requerimiento no tiene OC principal.",
        source_row_number: "",
        field_name: "oc",
        raw_value: row.oc,
        suggested_action: "revisar",
      });
    }
  }

  for (const [duplicateKey, count] of rqDuplicateMap.entries()) {
    if (count > 1) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "critical",
        entity_type: "requerimiento",
        entity_key: duplicateKey,
        issue_type: "rq_duplicado_en_cotizacion",
        message: `Se detectaron ${count} filas preview con la misma cotización y código RQ.`,
        source_row_number: "",
        field_name: "historical_rq_key",
        raw_value: duplicateKey,
        suggested_action: "revisar",
      });
    }
  }

  for (const row of detalleRq) {
    const entityKey =
      normalizeString(row.historical_rq_key) || `${normalizeString(row.cotizacion_codigo)}||${normalizeString(row.codigo_rq)}`;
    const sourceRowNumber = normalizeString(row.source_row_number);

    addCatalogValue(catalogAccumulators.clientes, row.cliente, sourceRowNumber);
    addCatalogValue(catalogAccumulators.unidades, row.unidad_trabajo, sourceRowNumber);
    addCatalogValue(catalogAccumulators.monedas, row.moneda, sourceRowNumber);
    addCatalogValue(catalogAccumulators.oc, row.oc, sourceRowNumber);
    addCatalogValue(catalogAccumulators.tipos_servicio, row.tipo_servicio_rq, sourceRowNumber);
    addCatalogValue(catalogAccumulators.responsables, row.solicitante_rq, sourceRowNumber);
    addCatalogValue(catalogAccumulators.unidades_medida, row.unidad, sourceRowNumber);
    addCatalogValue(catalogAccumulators.tipos_recurso, row.tipo_recurso, sourceRowNumber);
    addCatalogValue(catalogAccumulators.proveedores, row.proveedor, sourceRowNumber);

    if (!normalizeString(row.descripcion)) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "critical",
        entity_type: "detalle_rq",
        entity_key: entityKey,
        issue_type: "item_sin_descripcion",
        message: "El ítem no tiene descripción.",
        source_row_number: sourceRowNumber,
        field_name: "descripcion",
        raw_value: row.descripcion,
        suggested_action: "revisar",
      });
    }

    if (!normalizeString(row.unidad)) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "warning",
        entity_type: "detalle_rq",
        entity_key: entityKey,
        issue_type: "item_sin_unidad",
        message: "El ítem no tiene unidad.",
        source_row_number: sourceRowNumber,
        field_name: "unidad",
        raw_value: row.unidad,
        suggested_action: "mapear",
      });
    }

    const cantidad = parseNumber(row.cantidad);
    if (cantidad === null) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "critical",
        entity_type: "detalle_rq",
        entity_key: entityKey,
        issue_type: "item_sin_cantidad",
        message: "El ítem no tiene cantidad.",
        source_row_number: sourceRowNumber,
        field_name: "cantidad",
        raw_value: row.cantidad,
        suggested_action: "revisar",
      });
    } else if (cantidad <= 0) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "critical",
        entity_type: "detalle_rq",
        entity_key: entityKey,
        issue_type: "item_cantidad_no_valida",
        message: "El ítem tiene cantidad cero o negativa.",
        source_row_number: sourceRowNumber,
        field_name: "cantidad",
        raw_value: row.cantidad,
        suggested_action: "revisar",
      });
    }

    const precioUnitario = parseNumber(row.precio_unitario);
    if (precioUnitario === null) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "warning",
        entity_type: "detalle_rq",
        entity_key: entityKey,
        issue_type: "item_sin_precio_unitario",
        message: "El ítem no tiene precio unitario.",
        source_row_number: sourceRowNumber,
        field_name: "precio_unitario",
        raw_value: row.precio_unitario,
        suggested_action: "revisar",
      });
    }

    const moneda = normalizeString(row.moneda);
    if (!moneda && typeof precioUnitario === "number" && precioUnitario > 0) {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "warning",
        entity_type: "detalle_rq",
        entity_key: entityKey,
        issue_type: "item_moneda_vacia_con_precio",
        message: "El ítem tiene precio pero moneda vacía.",
        source_row_number: sourceRowNumber,
        field_name: "moneda",
        raw_value: row.moneda,
        suggested_action: "revisar",
      });
    }

    if (normalizeValue(moneda) === "UNKNOWN") {
      addIssue(issues, issueCounts, severityCounts, {
        severity: "warning",
        entity_type: "detalle_rq",
        entity_key: entityKey,
        issue_type: "item_moneda_unknown",
        message: "El ítem tiene una moneda no reconocida.",
        source_row_number: sourceRowNumber,
        field_name: "moneda",
        raw_value: row.moneda,
        suggested_action: "mapear",
      });
    }

    if (normalizeString(row.costo_total_presupuestado) && normalizeString(row.costo_total_origen) !== "calculado_por_app") {
      const totalOrigen = parseNumber(row.costo_total_presupuestado);
      if (typeof cantidad === "number" && typeof precioUnitario === "number" && totalOrigen !== null) {
        const calculatedTotal = Number((cantidad * precioUnitario).toFixed(4));
        if (Math.abs(calculatedTotal - totalOrigen) > 0.01) {
          addIssue(issues, issueCounts, severityCounts, {
            severity: "warning",
            entity_type: "detalle_rq",
            entity_key: entityKey,
            issue_type: "item_total_no_coincide",
            message: "El total calculado no coincide con el total de origen.",
            source_row_number: sourceRowNumber,
            field_name: "costo_total_presupuestado",
            raw_value: row.costo_total_presupuestado,
            suggested_action: "revisar",
          });
        }
      }
    }
  }

  const catalogEquivalence = {
    clientes: catalogEntries(catalogAccumulators.clientes),
    unidades: catalogEntries(catalogAccumulators.unidades),
    monedas: catalogEntries(catalogAccumulators.monedas),
    oc: catalogEntries(catalogAccumulators.oc),
    tipos_servicio: catalogEntries(catalogAccumulators.tipos_servicio),
    responsables: catalogEntries(catalogAccumulators.responsables),
    unidades_medida: catalogEntries(catalogAccumulators.unidades_medida),
    tipos_recurso: catalogEntries(catalogAccumulators.tipos_recurso),
    proveedores: catalogEntries(catalogAccumulators.proveedores),
  };

  const issuesByType = Object.fromEntries(
    [...issueCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "es"))
  );
  const issuesBySeverity = Object.fromEntries(
    [...severityCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "es"))
  );
  const topIssues = [...issueCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 15)
    .map(([issueType, count]) => ({ issueType, count }));

  let recommendation = "Preview consistente para seguir con limpieza previa a importación controlada.";
  if ((issuesBySeverity.critical ?? 0) > 0) {
    recommendation =
      "Existen issues críticos. No conviene preparar importación controlada hasta limpiar claves, cantidades y campos obligatorios.";
  } else if ((issuesBySeverity.warning ?? 0) > 0) {
    recommendation =
      "No hay bloqueos críticos, pero conviene limpiar catálogos, monedas y fechas antes de una importación controlada.";
  }

  const validationSummary = {
    total_cotizaciones: cotizaciones.length,
    total_requerimientos: requerimientos.length,
    total_detalle_rq: detalleRq.length,
    total_issues: issues.length,
    issues_by_type: issuesByType,
    issues_by_severity: issuesBySeverity,
    top_issues: topIssues,
    recommendation,
    preview_summary_reference: previewSummary,
    generatedAt: new Date().toISOString(),
  };

  const issuesCsvColumns = [
    "severity",
    "entity_type",
    "entity_key",
    "issue_type",
    "message",
    "source_row_number",
    "field_name",
    "raw_value",
    "suggested_action",
  ];

  fs.writeFileSync(
    path.join(baseDir, "validation_summary.json"),
    `${JSON.stringify(validationSummary, null, 2)}\n`,
    "utf8"
  );
  writeCsv(path.join(baseDir, "validation_issues.csv"), issuesCsvColumns, issues);
  fs.writeFileSync(
    path.join(baseDir, "catalog_equivalence_candidates.json"),
    `${JSON.stringify(catalogEquivalence, null, 2)}\n`,
    "utf8"
  );

  console.log(`\nValidación local completada en: ${baseDir}`);
  console.log(
    JSON.stringify(
      {
        total_cotizaciones: validationSummary.total_cotizaciones,
        total_requerimientos: validationSummary.total_requerimientos,
        total_detalle_rq: validationSummary.total_detalle_rq,
        total_issues: validationSummary.total_issues,
        issues_by_severity: validationSummary.issues_by_severity,
        top_issues: validationSummary.top_issues,
        recommendation: validationSummary.recommendation,
      },
      null,
      2
    )
  );
  console.log("\nEste script solo valida previews locales. No inserta datos, no ejecuta SQL y no modifica Supabase.");
}

main();
