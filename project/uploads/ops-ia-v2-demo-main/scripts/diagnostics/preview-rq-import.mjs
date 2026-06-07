#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const DEFAULT_SHEET = "DETALLE DE REQUERIMIENTOS";
const DEFAULT_OUT_DIR = "tmp_imports";

const REQUIRED_COLUMNS = [
  "COTIZACIÓN",
  "N° RQ",
  "CLIENTE",
  "UNIDAD",
  "CENTRO COSTOS",
  "SOLICITANTE",
  "FECHA RQ",
  "TIPO DE SERVICIO",
  "AREA",
  "ITEM",
  "TIPO",
  "CODIGO",
  "DESCRIPCIÓN",
  "FICHA TECNICA",
  "OBSERVACIÓN",
  "FOTOS",
  "UND",
  "CANT RQ",
  "AJUSTE",
  "ATENCION REAL",
  "CANT. STOCK",
  "COMPRA",
  "COSTO UNITARIO DÓLAR",
  "COSTO UNITARIO SOLES",
  "TC",
  "MONEDA",
  "FECHA DE COTI__LIMPIO",
  "ESTADO",
  "A SUMINISTRAR",
  "FICHA TECNICA A SUMINISTRAR",
  "ESTADO // PROVEEDOR",
  "CON. PAGO",
  "TIEMPO DE ENTREGA",
  "E.Q.",
  "F.APROB. 01",
  "L.L.",
  "F.APROB. 02",
  "H.B.",
  "F.APROB. 03",
  "LOGISTICA COMPRA",
  "F. COMPRA.",
  "OC",
  "F. ENTREGA",
  "GUIA DE REMISIÓN",
  "ARCHIVO GUIA",
  "USUARIOS",
];

const PREVIEW_DETALLE_COLUMNS = [
  "source_row_number",
  "historical_cotizacion_key",
  "historical_rq_key",
  "cotizacion_codigo",
  "codigo_rq",
  "oc",
  "cliente",
  "unidad_trabajo",
  "solicitante_rq",
  "fecha_solicitud",
  "tipo_servicio_rq",
  "area_rq",
  "item_excel",
  "tipo_recurso",
  "codigo_fabricante",
  "descripcion",
  "ficha",
  "observaciones_item",
  "imagen",
  "unidad",
  "cantidad",
  "ajuste",
  "atencion_real",
  "cant_stock",
  "compra",
  "precio_unitario",
  "moneda",
  "tc",
  "costo_total_presupuestado",
  "costo_total_origen",
  "fecha_coti",
  "estado",
  "recurso_a_suministrar",
  "ficha_tecnica_a_suministrar",
  "proveedor",
  "condicion_pago",
  "tiempo_entrega",
  "eq",
  "eq_fecha_aprob",
  "ll",
  "ll_fecha_aprob",
  "hb",
  "hb_fecha_aprob",
  "logistica_compra",
  "fecha_compra",
  "oc_os_recurso",
  "fecha_entrega",
  "guia_remision",
  "archivo_guia",
  "usuarios",
  "warnings",
];

const PREVIEW_RQ_COLUMNS = [
  "historical_rq_key",
  "historical_cotizacion_key",
  "historical_rq_code_suggested",
  "cotizacion_codigo",
  "codigo",
  "oc",
  "cliente",
  "unidad_trabajo",
  "solicitante_rq",
  "fecha_solicitud",
  "tipo_servicio",
  "area",
  "items_totales",
  "pendientes",
  "atendidos",
  "en_proceso",
  "vb_completos",
  "con_recurso",
  "sin_recurso",
  "con_ficha_suministrar",
  "con_oc_os",
  "con_guia",
  "avance",
  "estado_rq",
  "warnings",
];

const PREVIEW_COT_COLUMNS = [
  "historical_cotizacion_key",
  "codigo",
  "cliente",
  "unidad_trabajo",
  "solicitante",
  "tipo_servicio",
  "oc",
  "fecha_registro",
  "total_rq",
  "total_items",
  "monedas_detectadas",
  "monto",
  "moneda_cotizacion",
  "estado",
  "estado_propuesta",
  "prioridad",
  "avance",
  "warnings",
];

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      continue;
    }

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
  npm run preview:rq-import -- --file "C:\\ruta\\archivo.xlsx"

Opciones:
  --file      Ruta completa del Excel a procesar. Requerido.
  --sheet     Hoja a leer. Default: "${DEFAULT_SHEET}".
  --out-dir   Carpeta local de salida. Default: "${DEFAULT_OUT_DIR}".
  --help      Muestra esta ayuda.
`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalizeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\u00a0/g, " ").trim();
}

function normalizeHeader(header) {
  return normalizeString(header)
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCurrency(value) {
  const raw = normalizeString(value);
  if (!raw) {
    return "";
  }

  const comparable = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  const usdValues = new Set(["USD", "US$", "DOLAR", "DOLARES", "$"]);
  const penValues = new Set(["PEN", "SOL", "SOLES", "S/"]);

  if (usdValues.has(comparable)) {
    return "USD";
  }

  if (penValues.has(comparable)) {
    return "PEN";
  }

  return "UNKNOWN";
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value)
    .trim()
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function parseExcelDate(value) {
  if (value === null || value === undefined || value === "") {
    return { kind: "empty", valid: false, normalized: "" };
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) {
      return { kind: "serial", valid: false, raw: value, normalized: "" };
    }

    return {
      kind: "serial",
      valid: true,
      raw: value,
      normalized: `${parsed.y.toString().padStart(4, "0")}-${parsed.m
        .toString()
        .padStart(2, "0")}-${parsed.d.toString().padStart(2, "0")}`,
    };
  }

  const text = normalizeString(value);
  if (!text) {
    return { kind: "empty", valid: false, normalized: "" };
  }

  const ddmmyyyy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]);
    const yearRaw = Number(ddmmyyyy[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return {
        kind: "text",
        valid: true,
        raw: text,
        normalized: `${year.toString().padStart(4, "0")}-${month
          .toString()
          .padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
      };
    }
  }

  const isoDate = new Date(text);
  if (!Number.isNaN(isoDate.getTime())) {
    return {
      kind: "text",
      valid: true,
      raw: text,
      normalized: isoDate.toISOString().slice(0, 10),
    };
  }

  return { kind: "text", valid: false, raw: text, normalized: "" };
}

function buildRowsFromSheet(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const originalHeaders = (matrix[0] ?? []).map((header) => normalizeString(header));
  const normalizedHeaders = originalHeaders.map((header) => normalizeHeader(header));
  const normalizedHeaderMap = new Map();

  normalizedHeaders.forEach((header, index) => {
    if (!header || normalizedHeaderMap.has(header)) {
      return;
    }
    normalizedHeaderMap.set(header, originalHeaders[index]);
  });

  const rows = matrix.slice(1).map((values) => {
    const row = {};
    originalHeaders.forEach((header, index) => {
      if (!header) {
        return;
      }
      row[header] = values[index] ?? null;
    });
    return row;
  });

  return {
    rows,
    originalHeaders,
    normalizedHeaders,
    normalizedHeaderMap,
  };
}

function resolveColumnName(columnName, normalizedHeaderMap) {
  return normalizedHeaderMap.get(normalizeHeader(columnName)) ?? null;
}

function resolveColumns(columnNames, normalizedHeaderMap) {
  return Object.fromEntries(
    columnNames.map((columnName) => [columnName, resolveColumnName(columnName, normalizedHeaderMap)])
  );
}

function getRowValue(row, resolvedColumns, columnName) {
  const originalColumnName = resolvedColumns[columnName];
  if (!originalColumnName) {
    return null;
  }
  return row[originalColumnName] ?? null;
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

function pushWarning(warnings, counter, warning) {
  if (!warning) {
    return;
  }
  warnings.push(warning);
  counter.set(warning, (counter.get(warning) ?? 0) + 1);
}

function normalizeForKey(value) {
  return normalizeString(value).toUpperCase();
}

function normalizeHistoricalKeyPart(value) {
  return normalizeString(value).replace(/\s+/g, " ");
}

function buildHistoricalRqKey(historicalCotizacionKey, codigoRq, sourceRowNumber) {
  const cotizacionKey = normalizeHistoricalKeyPart(historicalCotizacionKey);
  const rqCode = normalizeHistoricalKeyPart(codigoRq);

  if (cotizacionKey && rqCode) {
    return `${cotizacionKey}||${rqCode}`;
  }

  if (cotizacionKey) {
    return `${cotizacionKey}||SIN_RQ||ROW_${sourceRowNumber}`;
  }

  return `SIN_COTIZACION||SIN_RQ||ROW_${sourceRowNumber}`;
}

function makeHistoricalRqCodeSuggestion(index) {
  return `RQ-HIST-SIN-CODIGO-${String(index).padStart(4, "0")}`;
}

function getDominantValue(values) {
  const counts = new Map();
  for (const value of values) {
    const normalized = normalizeString(value);
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0], "es");
  });

  return {
    value: sorted[0]?.[0] ?? "",
    uniqueValues: sorted.map(([value]) => value),
  };
}

function countByPredicate(items, predicate) {
  return items.reduce((total, item) => total + (predicate(item) ? 1 : 0), 0);
}

function joinWarnings(warnings) {
  return [...new Set(warnings)].join("|");
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const filePath = typeof args.file === "string" ? args.file : process.env.RQ_IMPORT_FILE;
  const sheetName = typeof args.sheet === "string" ? args.sheet : DEFAULT_SHEET;
  const outDir = typeof args["out-dir"] === "string" ? args["out-dir"] : DEFAULT_OUT_DIR;

  if (!filePath) {
    console.error('Falta la ruta del Excel. Usa --file "C:\\ruta\\archivo.xlsx" o la variable RQ_IMPORT_FILE.');
    printUsage();
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`No existe el archivo: ${filePath}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: true });
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    console.error(`No existe la hoja "${sheetName}" en el archivo indicado.`);
    console.error(`Hojas disponibles: ${workbook.SheetNames.join(", ")}`);
    process.exit(1);
  }

  const { rows, originalHeaders, normalizedHeaders, normalizedHeaderMap } = buildRowsFromSheet(sheet);
  const resolvedColumns = resolveColumns(REQUIRED_COLUMNS, normalizedHeaderMap);
  const missingRequiredColumns = REQUIRED_COLUMNS.filter((column) => !resolvedColumns[column]);

  if (missingRequiredColumns.length > 0) {
    console.error("Faltan columnas requeridas después de normalizar headers.");
    console.error(JSON.stringify({ missingRequiredColumns, originalHeaders, normalizedHeaders }, null, 2));
    process.exit(1);
  }

  ensureDir(outDir);

  const warningCounter = new Map();
  const detalleRows = [];
  const rqGroups = new Map();
  const cotizacionGroups = new Map();
  const rqCodeToCotizaciones = new Map();
  const dateWarningRows = new Set();

  let rowsWithoutRq = 0;
  let rqWithoutOriginalCodeUsingFallbackKey = 0;
  let rowsWithoutDescription = 0;
  let rowsWithoutPrice = 0;
  let rowsWithBothPrices = 0;
  let rowsWithEmptyCurrencyButPrice = 0;

  for (const [index, row] of rows.entries()) {
    const sourceRowNumber = index + 2;
    const warnings = [];

    const cotizacionCodigo = normalizeString(getRowValue(row, resolvedColumns, "COTIZACIÓN"));
    const codigoRq = normalizeString(getRowValue(row, resolvedColumns, "N° RQ"));
    const historicalRqKey = buildHistoricalRqKey(cotizacionCodigo, codigoRq, sourceRowNumber);
    const cliente = normalizeString(getRowValue(row, resolvedColumns, "CLIENTE"));
    const unidadTrabajo = normalizeString(getRowValue(row, resolvedColumns, "UNIDAD"));
    const ocPrincipal = normalizeString(getRowValue(row, resolvedColumns, "CENTRO COSTOS"));
    const solicitanteRq = normalizeString(getRowValue(row, resolvedColumns, "SOLICITANTE"));
    const tipoServicioRq = normalizeString(getRowValue(row, resolvedColumns, "TIPO DE SERVICIO"));
    const areaRq = normalizeString(getRowValue(row, resolvedColumns, "AREA"));
    const descripcion = normalizeString(getRowValue(row, resolvedColumns, "DESCRIPCIÓN"));
    const monedaOriginal = normalizeString(getRowValue(row, resolvedColumns, "MONEDA"));
    const monedaNormalizada = normalizeCurrency(monedaOriginal);
    const usd = parseNumber(getRowValue(row, resolvedColumns, "COSTO UNITARIO DÓLAR"));
    const pen = parseNumber(getRowValue(row, resolvedColumns, "COSTO UNITARIO SOLES"));

    if (!codigoRq) {
      rowsWithoutRq += 1;
      rqWithoutOriginalCodeUsingFallbackKey += 1;
      pushWarning(warnings, warningCounter, "sin_codigo_rq");
    }

    if (!descripcion) {
      rowsWithoutDescription += 1;
      pushWarning(warnings, warningCounter, "sin_descripcion");
    }

    let precioUnitario = null;
    let moneda = "";
    if (isPositiveNumber(usd) && !isPositiveNumber(pen)) {
      precioUnitario = usd;
      moneda = "USD";
      if (!monedaNormalizada) {
        rowsWithEmptyCurrencyButPrice += 1;
        pushWarning(warnings, warningCounter, "moneda_vacia_con_precio");
      } else if (monedaNormalizada === "UNKNOWN") {
        pushWarning(warnings, warningCounter, "moneda_desconocida");
      } else if (monedaNormalizada !== "USD") {
        pushWarning(warnings, warningCounter, "moneda_no_coincide_con_precio");
      }
    } else if (isPositiveNumber(pen) && !isPositiveNumber(usd)) {
      precioUnitario = pen;
      moneda = "PEN";
      if (!monedaNormalizada) {
        rowsWithEmptyCurrencyButPrice += 1;
        pushWarning(warnings, warningCounter, "moneda_vacia_con_precio");
      } else if (monedaNormalizada === "UNKNOWN") {
        pushWarning(warnings, warningCounter, "moneda_desconocida");
      } else if (monedaNormalizada !== "PEN") {
        pushWarning(warnings, warningCounter, "moneda_no_coincide_con_precio");
      }
    } else if (isPositiveNumber(usd) && isPositiveNumber(pen)) {
      rowsWithBothPrices += 1;
      pushWarning(warnings, warningCounter, "precio_conflictivo");
    } else {
      rowsWithoutPrice += 1;
      pushWarning(warnings, warningCounter, "sin_precio_unitario");
    }

    const fechaSolicitudResult = parseExcelDate(getRowValue(row, resolvedColumns, "FECHA RQ"));
    const fechaCotiResult = parseExcelDate(getRowValue(row, resolvedColumns, "FECHA DE COTI__LIMPIO"));
    const eqFechaResult = parseExcelDate(getRowValue(row, resolvedColumns, "F.APROB. 01"));
    const llFechaResult = parseExcelDate(getRowValue(row, resolvedColumns, "F.APROB. 02"));
    const hbFechaResult = parseExcelDate(getRowValue(row, resolvedColumns, "F.APROB. 03"));
    const fechaCompraResult = parseExcelDate(getRowValue(row, resolvedColumns, "F. COMPRA."));
    const fechaEntregaResult = parseExcelDate(getRowValue(row, resolvedColumns, "F. ENTREGA"));

    const parsedDates = [
      ["fecha_solicitud_invalida", fechaSolicitudResult],
      ["fecha_coti_invalida", fechaCotiResult],
      ["eq_fecha_aprob_invalida", eqFechaResult],
      ["ll_fecha_aprob_invalida", llFechaResult],
      ["hb_fecha_aprob_invalida", hbFechaResult],
      ["fecha_compra_invalida", fechaCompraResult],
      ["fecha_entrega_invalida", fechaEntregaResult],
    ];

    for (const [warningCode, dateResult] of parsedDates) {
      if (dateResult.kind !== "empty" && !dateResult.valid) {
        dateWarningRows.add(sourceRowNumber);
        pushWarning(warnings, warningCounter, warningCode);
      }
    }

    const detalleRow = {
      source_row_number: sourceRowNumber,
      historical_cotizacion_key: cotizacionCodigo,
      historical_rq_key: historicalRqKey,
      cotizacion_codigo: cotizacionCodigo,
      codigo_rq: codigoRq,
      oc: ocPrincipal,
      cliente,
      unidad_trabajo: unidadTrabajo,
      solicitante_rq: solicitanteRq,
      fecha_solicitud: fechaSolicitudResult.normalized,
      tipo_servicio_rq: tipoServicioRq,
      area_rq: areaRq,
      item_excel: normalizeString(getRowValue(row, resolvedColumns, "ITEM")),
      tipo_recurso: normalizeString(getRowValue(row, resolvedColumns, "TIPO")),
      codigo_fabricante: normalizeString(getRowValue(row, resolvedColumns, "CODIGO")),
      descripcion,
      ficha: normalizeString(getRowValue(row, resolvedColumns, "FICHA TECNICA")),
      observaciones_item: normalizeString(getRowValue(row, resolvedColumns, "OBSERVACIÓN")),
      imagen: normalizeString(getRowValue(row, resolvedColumns, "FOTOS")),
      unidad: normalizeString(getRowValue(row, resolvedColumns, "UND")),
      cantidad: parseNumber(getRowValue(row, resolvedColumns, "CANT RQ")),
      ajuste: parseNumber(getRowValue(row, resolvedColumns, "AJUSTE")),
      atencion_real: parseNumber(getRowValue(row, resolvedColumns, "ATENCION REAL")),
      cant_stock: parseNumber(getRowValue(row, resolvedColumns, "CANT. STOCK")),
      compra: parseNumber(getRowValue(row, resolvedColumns, "COMPRA")),
      precio_unitario: precioUnitario,
      moneda,
      tc: parseNumber(getRowValue(row, resolvedColumns, "TC")),
      costo_total_presupuestado: "",
      costo_total_origen: "calculado_por_app",
      fecha_coti: fechaCotiResult.normalized,
      estado: normalizeString(getRowValue(row, resolvedColumns, "ESTADO")),
      recurso_a_suministrar: normalizeString(getRowValue(row, resolvedColumns, "A SUMINISTRAR")),
      ficha_tecnica_a_suministrar: normalizeString(
        getRowValue(row, resolvedColumns, "FICHA TECNICA A SUMINISTRAR")
      ),
      proveedor: normalizeString(getRowValue(row, resolvedColumns, "ESTADO // PROVEEDOR")),
      condicion_pago: normalizeString(getRowValue(row, resolvedColumns, "CON. PAGO")),
      tiempo_entrega: normalizeString(getRowValue(row, resolvedColumns, "TIEMPO DE ENTREGA")),
      eq: normalizeString(getRowValue(row, resolvedColumns, "E.Q.")),
      eq_fecha_aprob: eqFechaResult.normalized,
      ll: normalizeString(getRowValue(row, resolvedColumns, "L.L.")),
      ll_fecha_aprob: llFechaResult.normalized,
      hb: normalizeString(getRowValue(row, resolvedColumns, "H.B.")),
      hb_fecha_aprob: hbFechaResult.normalized,
      logistica_compra: normalizeString(getRowValue(row, resolvedColumns, "LOGISTICA COMPRA")),
      fecha_compra: fechaCompraResult.normalized,
      oc_os_recurso: normalizeString(getRowValue(row, resolvedColumns, "OC")),
      fecha_entrega: fechaEntregaResult.normalized,
      guia_remision: normalizeString(getRowValue(row, resolvedColumns, "GUIA DE REMISIÓN")),
      archivo_guia: normalizeString(getRowValue(row, resolvedColumns, "ARCHIVO GUIA")),
      usuarios: normalizeString(getRowValue(row, resolvedColumns, "USUARIOS")),
      warnings: "",
    };

    detalleRow.warnings = joinWarnings(warnings);
    detalleRows.push(detalleRow);

    if (historicalRqKey) {
      const rqGroup = rqGroups.get(historicalRqKey) ?? [];
      rqGroup.push(detalleRow);
      rqGroups.set(historicalRqKey, rqGroup);
    }

    if (cotizacionCodigo) {
      const cotGroup = cotizacionGroups.get(cotizacionCodigo) ?? [];
      cotGroup.push(detalleRow);
      cotizacionGroups.set(cotizacionCodigo, cotGroup);
    }

    if (codigoRq && cotizacionCodigo) {
      const linkedCotizaciones = rqCodeToCotizaciones.get(codigoRq) ?? new Set();
      linkedCotizaciones.add(cotizacionCodigo);
      rqCodeToCotizaciones.set(codigoRq, linkedCotizaciones);
    }
  }

  const previewRequerimientos = [];
  let historicalRqCodeSuggestionCounter = 0;
  for (const [historicalRqKey, items] of rqGroups.entries()) {
    const warnings = [];
    const first = items[0];
    const ocInfo = getDominantValue(items.map((item) => item.oc));
    const clienteInfo = getDominantValue(items.map((item) => item.cliente));
    const unidadInfo = getDominantValue(items.map((item) => item.unidad_trabajo));
    const solicitanteInfo = getDominantValue(items.map((item) => item.solicitante_rq));
    const tipoServicioInfo = getDominantValue(items.map((item) => item.tipo_servicio_rq));
    const areaInfo = getDominantValue(items.map((item) => item.area_rq));
    const validFechaSolicitud = items
      .map((item) => item.fecha_solicitud)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));

    if (ocInfo.uniqueValues.length > 1) pushWarning(warnings, warningCounter, "multiple_oc_en_rq");
    if (clienteInfo.uniqueValues.length > 1) pushWarning(warnings, warningCounter, "multiple_cliente_en_rq");
    if (unidadInfo.uniqueValues.length > 1) pushWarning(warnings, warningCounter, "multiple_unidad_en_rq");
    if (tipoServicioInfo.uniqueValues.length > 1) {
      pushWarning(warnings, warningCounter, "multiple_tipo_servicio_en_rq");
    }
    if (areaInfo.uniqueValues.length > 1) pushWarning(warnings, warningCounter, "multiple_area_en_rq");

    const itemsTotales = items.length;
    const atendidos = countByPredicate(items, (item) => normalizeForKey(item.estado) === "ATENCION COMPLETA");
    const pendientes = countByPredicate(
      items,
      (item) => !item.estado || normalizeForKey(item.estado) === "PENDIENTE"
    );
    const enProceso = itemsTotales - atendidos - pendientes;
    const vbCompletos = countByPredicate(
      items,
      (item) =>
        normalizeForKey(item.eq) === "APROBADO" &&
        normalizeForKey(item.ll) === "APROBADO" &&
        normalizeForKey(item.hb) === "APROBADO"
    );
    const conRecurso = countByPredicate(items, (item) => normalizeString(item.recurso_a_suministrar) !== "");
    const conFichaSuministrar = countByPredicate(
      items,
      (item) => normalizeString(item.ficha_tecnica_a_suministrar) !== ""
    );
    const conOcOs = countByPredicate(items, (item) => normalizeString(item.oc_os_recurso) !== "");
    const conGuia = countByPredicate(items, (item) => normalizeString(item.guia_remision) !== "");

    let estadoRq = "PENDIENTE";
    const uniqueEstados = [...new Set(items.map((item) => normalizeForKey(item.estado)).filter(Boolean))];
    if (itemsTotales > 0 && atendidos === itemsTotales) {
      estadoRq = "ATENDIDO";
    } else if (atendidos > 0 || enProceso > 0) {
      estadoRq = "PARCIAL";
    } else if (uniqueEstados.length > 0 && uniqueEstados.some((estado) => !["PENDIENTE", "ATENCION COMPLETA", "ATENCION PARCIAL"].includes(estado))) {
      estadoRq = "REVISAR";
      pushWarning(warnings, warningCounter, "estado_rq_revisar");
    }

    previewRequerimientos.push({
      historical_rq_key: historicalRqKey,
      historical_cotizacion_key: first.historical_cotizacion_key,
      historical_rq_code_suggested: first.codigo_rq
        ? ""
        : makeHistoricalRqCodeSuggestion(++historicalRqCodeSuggestionCounter),
      cotizacion_codigo: first.cotizacion_codigo,
      codigo: first.codigo_rq,
      oc: ocInfo.value,
      cliente: clienteInfo.value,
      unidad_trabajo: unidadInfo.value,
      solicitante_rq: solicitanteInfo.value,
      fecha_solicitud: validFechaSolicitud[0] ?? "",
      tipo_servicio: tipoServicioInfo.value,
      area: areaInfo.value,
      items_totales: itemsTotales,
      pendientes,
      atendidos,
      en_proceso: enProceso,
      vb_completos: vbCompletos,
      con_recurso: conRecurso,
      sin_recurso: itemsTotales - conRecurso,
      con_ficha_suministrar: conFichaSuministrar,
      con_oc_os: conOcOs,
      con_guia: conGuia,
      avance: itemsTotales > 0 ? Number(((atendidos / itemsTotales) * 100).toFixed(2)) : 0,
      estado_rq: estadoRq,
      warnings: joinWarnings([...warnings, ...items.flatMap((item) => (item.warnings ? item.warnings.split("|") : []))]),
    });
  }

  const previewCotizaciones = [];
  let cotizacionesWithMultipleOc = 0;

  for (const [historicalCotizacionKey, items] of cotizacionGroups.entries()) {
    const warnings = [];
    const clienteInfo = getDominantValue(items.map((item) => item.cliente));
    const unidadInfo = getDominantValue(items.map((item) => item.unidad_trabajo));
    const solicitanteInfo = getDominantValue(items.map((item) => item.solicitante_rq));
    const tipoServicioInfo = getDominantValue(items.map((item) => item.tipo_servicio_rq));
    const ocInfo = getDominantValue(items.map((item) => item.oc));
    const ocValues = ocInfo.uniqueValues;
    const rqKeys = [...new Set(items.map((item) => item.historical_rq_key).filter(Boolean))];
    const monedasDetectadas = [...new Set(items.map((item) => item.moneda).filter(Boolean))].sort();
    const fechaCotiValues = items.map((item) => item.fecha_coti).filter(Boolean).sort((left, right) => left.localeCompare(right));
    const fechaRqValues = items
      .map((item) => item.fecha_solicitud)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));

    let fechaRegistro = fechaCotiValues[0] ?? "";
    if (!fechaRegistro && fechaRqValues[0]) {
      fechaRegistro = fechaRqValues[0];
      pushWarning(warnings, warningCounter, "fecha_registro_desde_fecha_rq");
    }

    if (clienteInfo.uniqueValues.length > 1) {
      pushWarning(warnings, warningCounter, "multiple_cliente_en_cotizacion");
    }
    if (unidadInfo.uniqueValues.length > 1) {
      pushWarning(warnings, warningCounter, "multiple_unidad_en_cotizacion");
    }
    if (tipoServicioInfo.uniqueValues.length > 1) {
      pushWarning(warnings, warningCounter, "multiple_tipo_servicio_en_cotizacion");
    }
    if (ocValues.length > 1) {
      cotizacionesWithMultipleOc += 1;
      pushWarning(warnings, warningCounter, "multiple_oc_en_cotizacion");
    }
    if (monedasDetectadas.length > 1) {
      pushWarning(warnings, warningCounter, "mezcla_monedas_en_cotizacion");
    }

    const relatedRqRows = previewRequerimientos.filter(
      (requirement) => requirement.historical_cotizacion_key === historicalCotizacionKey
    );
    const avancePromedio =
      relatedRqRows.length > 0
        ? Number(
            (
              relatedRqRows.reduce((total, requirement) => total + Number(requirement.avance || 0), 0) /
              relatedRqRows.length
            ).toFixed(2)
          )
        : null;

    previewCotizaciones.push({
      historical_cotizacion_key: historicalCotizacionKey,
      codigo: historicalCotizacionKey,
      cliente: clienteInfo.value,
      unidad_trabajo: unidadInfo.value,
      solicitante: solicitanteInfo.value,
      tipo_servicio: tipoServicioInfo.value,
      oc: ocValues.length > 1 ? ocValues.join(" | ") : ocInfo.value,
      fecha_registro: fechaRegistro,
      total_rq: rqKeys.length,
      total_items: items.length,
      monedas_detectadas: monedasDetectadas.join("|"),
      monto: "",
      moneda_cotizacion: monedasDetectadas.length === 1 ? monedasDetectadas[0] : "",
      estado: "Histórico",
      estado_propuesta: "Histórico",
      prioridad: "",
      avance: avancePromedio ?? "",
      warnings: joinWarnings(warnings),
    });
  }

  const rqLinkedToMoreThanOneCotizacion = [...rqCodeToCotizaciones.entries()].filter(
    ([, cotizaciones]) => cotizaciones.size > 1
  );

  writeCsv(path.join(outDir, "preview_detalle_rq.csv"), PREVIEW_DETALLE_COLUMNS, detalleRows);
  writeCsv(path.join(outDir, "preview_requerimientos.csv"), PREVIEW_RQ_COLUMNS, previewRequerimientos);
  writeCsv(path.join(outDir, "preview_cotizaciones.csv"), PREVIEW_COT_COLUMNS, previewCotizaciones);

  const topWarnings = [...warningCounter.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([warning, count]) => ({ warning, count }));

  const summary = {
    totalRows: rows.length,
    previewCotizacionesCount: previewCotizaciones.length,
    previewRequerimientosCount: previewRequerimientos.length,
    previewDetalleRqCount: detalleRows.length,
    rowsWithoutRq,
    rqWithoutOriginalCodeUsingFallbackKey,
    rowsWithoutDescription,
    rowsWithoutPrice,
    rowsWithBothPrices,
    rowsWithEmptyCurrencyButPrice,
    rowsWithDateWarnings: dateWarningRows.size,
    cotizacionesWithMultipleOc,
    rqLinkedToMoreThanOneCotizacion: rqLinkedToMoreThanOneCotizacion.length,
    topWarnings,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(outDir, "preview_import_summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8"
  );

  console.log(`\nPreview local generado en: ${path.resolve(outDir)}`);
  console.log(
    JSON.stringify(
      {
        previewCotizacionesCount: previewCotizaciones.length,
        previewRequerimientosCount: previewRequerimientos.length,
        previewDetalleRqCount: detalleRows.length,
        topWarnings,
      },
      null,
      2
    )
  );
  console.log("\nEste script solo genera vista previa local. No inserta datos, no ejecuta SQL y no modifica Supabase.");
}

main();
