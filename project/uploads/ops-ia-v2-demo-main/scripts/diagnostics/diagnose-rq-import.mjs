#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const DEFAULT_SHEET = "DETALLE DE REQUERIMIENTOS";
const DATE_COLUMNS = [
  "FECHA RQ",
  "FECHA DE COTI__LIMPIO",
  "F.APROB. 01",
  "F.APROB. 02",
  "F.APROB. 03",
  "F. COMPRA.",
  "F. ENTREGA",
];

const DOCUMENT_COLUMNS = [
  "FICHA TECNICA",
  "FOTOS",
  "FICHA TECNICA A SUMINISTRAR",
  "GUIA DE REMISIÓN",
  "ARCHIVO GUIA",
];

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
];

const TRACKED_OPTIONAL_COLUMNS = [
  "COSTO TOTAL PRESUPUESTADO [S/]",
  "COSTO TOTAL PRESUPUESTADO [USD]",
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
  npm run diagnose:rq-import -- --file "C:\\ruta\\archivo.xlsx"

Opciones:
  --file       Ruta completa del Excel a diagnosticar. Requerido.
  --sheet      Hoja a leer. Default: "${DEFAULT_SHEET}".
  --out-json   Ruta local opcional para guardar el reporte en JSON.
  --out-csv    Ruta local opcional para guardar inconsistencias en CSV.
  --help       Muestra esta ayuda.
`);
}

function ensureParentDir(filePath) {
  const dirName = path.dirname(filePath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
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

function hasValue(value) {
  return normalizeString(value) !== "";
}

function normalizeKeyPart(value) {
  return normalizeString(value).toUpperCase();
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
    return { kind: "empty", valid: false };
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) {
      return { kind: "serial", valid: false, raw: value };
    }

    const iso = `${parsed.y.toString().padStart(4, "0")}-${parsed.m
      .toString()
      .padStart(2, "0")}-${parsed.d.toString().padStart(2, "0")}`;

    return { kind: "serial", valid: true, raw: value, normalized: iso };
  }

  const text = normalizeString(value);
  if (!text) {
    return { kind: "empty", valid: false };
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

  return { kind: "text", valid: false, raw: text };
}

function incrementCounter(map, key) {
  if (!key) {
    return;
  }

  map.set(key, (map.get(key) ?? 0) + 1);
}

function topEntries(map, limit = 20) {
  return [...map.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0], "es");
    })
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function uniqueSortedValues(valuesSet) {
  return [...valuesSet].sort((left, right) => left.localeCompare(right, "es"));
}

function csvEscape(value) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function renderSection(title, value) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(value, null, 2));
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

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const filePath = typeof args.file === "string" ? args.file : process.env.RQ_IMPORT_FILE;
  const sheetName = typeof args.sheet === "string" ? args.sheet : DEFAULT_SHEET;
  const outJson = typeof args["out-json"] === "string" ? args["out-json"] : null;
  const outCsv = typeof args["out-csv"] === "string" ? args["out-csv"] : null;

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
  const resolvedRequiredColumns = resolveColumns(REQUIRED_COLUMNS, normalizedHeaderMap);
  const resolvedOptionalColumns = resolveColumns(TRACKED_OPTIONAL_COLUMNS, normalizedHeaderMap);
  const missingRequiredColumns = REQUIRED_COLUMNS.filter((column) => !resolvedRequiredColumns[column]);

  const cotizacionSet = new Set();
  const rqSet = new Set();
  const cotizacionRqSet = new Set();
  const clientes = new Set();
  const unidades = new Set();
  const tipos = new Set();
  const unds = new Set();
  const estados = new Set();
  const monedas = new Set();
  const eqValues = new Set();
  const llValues = new Set();
  const hbValues = new Set();

  const providersCounter = new Map();
  const rqCounter = new Map();
  const cotizacionRqCounter = new Map();
  const cotizacionToRqSet = new Map();
  const rqToCotizacionSet = new Map();

  const dateDiagnostics = Object.fromEntries(
    DATE_COLUMNS.map((column) => [
      column,
      { valid: 0, empty: 0, invalid: 0, serial: 0, text: 0, invalidExamples: [] },
    ])
  );

  const inconsistencyExamples = [];
  const currencyMismatchExamples = [];
  const emptyCurrencyButPriceExamples = [];
  const unknownCurrencyExamples = [];

  let rowsWithoutCotizacion = 0;
  let rowsWithoutRq = 0;
  let rowsWithoutDescription = 0;
  let usdPriceRows = 0;
  let penPriceRows = 0;
  let bothPricesRows = 0;
  let noPriceRows = 0;
  let currencyMismatchRows = 0;
  let rowsWithEmptyCurrencyButPrice = 0;
  let rowsWithUnknownCurrency = 0;
  let rowsWithFichaTecnica = 0;
  let rowsWithFotos = 0;
  let rowsWithFichaTecnicaASuministrar = 0;
  let rowsWithGuiaRemision = 0;
  let rowsWithArchivoGuia = 0;
  let vbCompleteRows = 0;
  let vbPartialRows = 0;
  let vbEmptyRows = 0;

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const cotizacion = normalizeString(getRowValue(row, resolvedRequiredColumns, "COTIZACIÓN"));
    const rq = normalizeString(getRowValue(row, resolvedRequiredColumns, "N° RQ"));
    const descripcion = normalizeString(getRowValue(row, resolvedRequiredColumns, "DESCRIPCIÓN"));
    const cliente = normalizeString(getRowValue(row, resolvedRequiredColumns, "CLIENTE"));
    const unidad = normalizeString(getRowValue(row, resolvedRequiredColumns, "UNIDAD"));
    const tipo = normalizeString(getRowValue(row, resolvedRequiredColumns, "TIPO"));
    const und = normalizeString(getRowValue(row, resolvedRequiredColumns, "UND"));
    const estado = normalizeString(getRowValue(row, resolvedRequiredColumns, "ESTADO"));
    const monedaOriginal = normalizeString(getRowValue(row, resolvedRequiredColumns, "MONEDA"));
    const moneda = normalizeCurrency(monedaOriginal);
    const proveedor = normalizeString(getRowValue(row, resolvedRequiredColumns, "ESTADO // PROVEEDOR"));
    const usd = parseNumber(getRowValue(row, resolvedRequiredColumns, "COSTO UNITARIO DÓLAR"));
    const pen = parseNumber(getRowValue(row, resolvedRequiredColumns, "COSTO UNITARIO SOLES"));
    const eq = normalizeString(getRowValue(row, resolvedRequiredColumns, "E.Q."));
    const ll = normalizeString(getRowValue(row, resolvedRequiredColumns, "L.L."));
    const hb = normalizeString(getRowValue(row, resolvedRequiredColumns, "H.B."));

    if (!cotizacion) {
      rowsWithoutCotizacion += 1;
    } else {
      cotizacionSet.add(cotizacion);
    }

    if (!rq) {
      rowsWithoutRq += 1;
    } else {
      rqSet.add(rq);
    }

    if (!descripcion) {
      rowsWithoutDescription += 1;
    }

    if (cotizacion && rq) {
      const pairKey = `${normalizeKeyPart(cotizacion)}__${normalizeKeyPart(rq)}`;
      cotizacionRqSet.add(pairKey);
      incrementCounter(cotizacionRqCounter, pairKey);

      const rqValues = cotizacionToRqSet.get(cotizacion) ?? new Set();
      rqValues.add(rq);
      cotizacionToRqSet.set(cotizacion, rqValues);

      const cotizacionesByRq = rqToCotizacionSet.get(rq) ?? new Set();
      cotizacionesByRq.add(cotizacion);
      rqToCotizacionSet.set(rq, cotizacionesByRq);
    }

    if (rq) {
      incrementCounter(rqCounter, rq);
    }

    if (cliente) clientes.add(cliente);
    if (unidad) unidades.add(unidad);
    if (tipo) tipos.add(tipo);
    if (und) unds.add(und);
    if (estado) estados.add(estado);
    if (monedaOriginal) monedas.add(moneda);
    if (proveedor) incrementCounter(providersCounter, proveedor);
    if (eq) eqValues.add(eq);
    if (ll) llValues.add(ll);
    if (hb) hbValues.add(hb);

    const hasUsd = isPositiveNumber(usd);
    const hasPen = isPositiveNumber(pen);

    if (hasUsd && !hasPen) {
      usdPriceRows += 1;
      if (!moneda) {
        rowsWithEmptyCurrencyButPrice += 1;
        if (emptyCurrencyButPriceExamples.length < 25) {
          emptyCurrencyButPriceExamples.push({
            rowNumber,
            type: "moneda_vacia_con_precio_usd",
            cotizacion,
            rq,
            moneda_excel: monedaOriginal,
            moneda_normalizada: moneda,
            precio_usd: usd,
            precio_pen: pen,
          });
        }
      } else if (moneda === "UNKNOWN") {
        rowsWithUnknownCurrency += 1;
        if (unknownCurrencyExamples.length < 25) {
          unknownCurrencyExamples.push({
            rowNumber,
            type: "moneda_desconocida_con_precio_usd",
            cotizacion,
            rq,
            moneda_excel: monedaOriginal,
            moneda_normalizada: moneda,
            precio_usd: usd,
            precio_pen: pen,
          });
        }
      } else if (moneda !== "USD") {
        currencyMismatchRows += 1;
        const example = {
            rowNumber,
            type: "moneda_no_coincide_usd",
            cotizacion,
            rq,
            moneda_excel: monedaOriginal,
            moneda_normalizada: moneda,
            precio_usd: usd,
            precio_pen: pen,
        };
        if (currencyMismatchExamples.length < 25) currencyMismatchExamples.push(example);
        if (inconsistencyExamples.length < 25) inconsistencyExamples.push(example);
      }
    } else if (hasPen && !hasUsd) {
      penPriceRows += 1;
      if (!moneda) {
        rowsWithEmptyCurrencyButPrice += 1;
        if (emptyCurrencyButPriceExamples.length < 25) {
          emptyCurrencyButPriceExamples.push({
            rowNumber,
            type: "moneda_vacia_con_precio_pen",
            cotizacion,
            rq,
            moneda_excel: monedaOriginal,
            moneda_normalizada: moneda,
            precio_usd: usd,
            precio_pen: pen,
          });
        }
      } else if (moneda === "UNKNOWN") {
        rowsWithUnknownCurrency += 1;
        if (unknownCurrencyExamples.length < 25) {
          unknownCurrencyExamples.push({
            rowNumber,
            type: "moneda_desconocida_con_precio_pen",
            cotizacion,
            rq,
            moneda_excel: monedaOriginal,
            moneda_normalizada: moneda,
            precio_usd: usd,
            precio_pen: pen,
          });
        }
      } else if (moneda !== "PEN") {
        currencyMismatchRows += 1;
        const example = {
            rowNumber,
            type: "moneda_no_coincide_pen",
            cotizacion,
            rq,
            moneda_excel: monedaOriginal,
            moneda_normalizada: moneda,
            precio_usd: usd,
            precio_pen: pen,
        };
        if (currencyMismatchExamples.length < 25) currencyMismatchExamples.push(example);
        if (inconsistencyExamples.length < 25) inconsistencyExamples.push(example);
      }
    } else if (hasUsd && hasPen) {
      bothPricesRows += 1;
      if (inconsistencyExamples.length < 25) {
        inconsistencyExamples.push({
          rowNumber,
          type: "caso_conflictivo_precio",
          cotizacion,
          rq,
          moneda_excel: monedaOriginal,
          moneda_normalizada: moneda,
          precio_usd: usd,
          precio_pen: pen,
        });
      }
    } else {
      noPriceRows += 1;
      if (inconsistencyExamples.length < 25) {
        inconsistencyExamples.push({
          rowNumber,
          type: "sin_precio_unitario",
          cotizacion,
          rq,
          moneda_excel: monedaOriginal,
          moneda_normalizada: moneda,
        });
      }
    }

    for (const dateColumn of DATE_COLUMNS) {
      const dateValue = getRowValue(row, resolvedRequiredColumns, dateColumn);
      const result = parseExcelDate(dateValue);
      const bucket = dateDiagnostics[dateColumn];

      if (result.kind === "empty") {
        bucket.empty += 1;
        continue;
      }

      if (result.kind === "serial") bucket.serial += 1;
      if (result.kind === "text") bucket.text += 1;

      if (result.valid) {
        bucket.valid += 1;
      } else {
        bucket.invalid += 1;
        if (bucket.invalidExamples.length < 10) {
          bucket.invalidExamples.push({
            rowNumber,
            raw: result.raw ?? dateValue,
          });
        }
      }
    }

    if (hasValue(getRowValue(row, resolvedRequiredColumns, "FICHA TECNICA"))) rowsWithFichaTecnica += 1;
    if (hasValue(getRowValue(row, resolvedRequiredColumns, "FOTOS"))) rowsWithFotos += 1;
    if (hasValue(getRowValue(row, resolvedRequiredColumns, "FICHA TECNICA A SUMINISTRAR"))) rowsWithFichaTecnicaASuministrar += 1;
    if (hasValue(getRowValue(row, resolvedRequiredColumns, "GUIA DE REMISIÓN"))) rowsWithGuiaRemision += 1;
    if (hasValue(getRowValue(row, resolvedRequiredColumns, "ARCHIVO GUIA"))) rowsWithArchivoGuia += 1;

    const vbFilledCount = [eq, ll, hb].filter(Boolean).length;
    if (vbFilledCount === 3) {
      vbCompleteRows += 1;
    } else if (vbFilledCount > 0) {
      vbPartialRows += 1;
    } else {
      vbEmptyRows += 1;
    }
  }

  const rqRepeatedByCode = [...rqCounter.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 50)
    .map(([rq, count]) => ({ rq, count }));

  const rqLinkedToMoreThanOneCotizacion = [...rqToCotizacionSet.entries()]
    .filter(([, values]) => values.size > 1)
    .sort((left, right) => right[1].size - left[1].size)
    .slice(0, 50)
    .map(([rq, values]) => ({ rq, cotizaciones: [...values].sort() }));

  const duplicatedPairRows = [...cotizacionRqCounter.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 50)
    .map(([pair, count]) => {
      const [cotizacion, rq] = pair.split("__");
      return { cotizacion, rq, count };
    });

  const cotizacionesWithManyRq = [...cotizacionToRqSet.entries()]
    .filter(([, values]) => values.size > 1)
    .sort((left, right) => right[1].size - left[1].size)
    .slice(0, 50)
    .map(([cotizacion, values]) => ({ cotizacion, totalRq: values.size }));

  const report = {
    input: {
      filePath,
      sheetName,
    },
    schema: {
      totalRows: rows.length,
      totalColumns: originalHeaders.length,
      headersOriginal: originalHeaders,
      headersNormalized: normalizedHeaders,
      resolvedColumns: {
        ...resolvedRequiredColumns,
        ...resolvedOptionalColumns,
      },
      priceColumnResolution: {
        costoUnitarioDolar: resolvedRequiredColumns["COSTO UNITARIO DÓLAR"],
        costoUnitarioSoles: resolvedRequiredColumns["COSTO UNITARIO SOLES"],
        costoTotalPresupuestadoPen: resolvedOptionalColumns["COSTO TOTAL PRESUPUESTADO [S/]"],
        costoTotalPresupuestadoUsd: resolvedOptionalColumns["COSTO TOTAL PRESUPUESTADO [USD]"],
      },
      missingRequiredColumns,
    },
    general: {
      totalRows: rows.length,
      totalColumns: originalHeaders.length,
      uniqueCotizaciones: cotizacionSet.size,
      uniqueRqByCode: rqSet.size,
      uniqueRqByCotizacionAndRq: cotizacionRqSet.size,
      rowsWithoutCotizacion,
      rowsWithoutRq,
      rowsWithoutDescription,
    },
    prices: {
      rowsUsingUsd: usdPriceRows,
      rowsUsingPen: penPriceRows,
      rowsWithBothPrices: bothPricesRows,
      rowsWithoutPrice: noPriceRows,
      rowsWithCurrencyMismatch: currencyMismatchRows,
      rowsWithEmptyCurrencyButPrice,
      rowsWithUnknownCurrency,
      currencyMismatchExamples,
      emptyCurrencyButPriceExamples,
      unknownCurrencyExamples,
      inconsistencyExamples,
    },
    dates: dateDiagnostics,
    duplicates: {
      repeatedRqByCode: rqRepeatedByCode,
      rqLinkedToMoreThanOneCotizacion,
      duplicatedCotizacionRqPairsExpectedByItems: duplicatedPairRows,
      cotizacionesWithManyRq,
    },
    catalogs: {
      clientes: uniqueSortedValues(clientes),
      unidades: uniqueSortedValues(unidades),
      tipos: uniqueSortedValues(tipos),
      unds: uniqueSortedValues(unds),
      estados: uniqueSortedValues(estados),
      monedas: uniqueSortedValues(monedas),
      top50Proveedores: topEntries(providersCounter, 50),
    },
    documents: {
      rowsWithFichaTecnica,
      rowsWithFotos,
      rowsWithFichaTecnicaASuministrar,
      rowsWithGuiaRemision,
      rowsWithArchivoGuia,
      trackedColumns: DOCUMENT_COLUMNS,
    },
    vb: {
      uniqueEqValues: uniqueSortedValues(eqValues),
      uniqueLlValues: uniqueSortedValues(llValues),
      uniqueHbValues: uniqueSortedValues(hbValues),
      rowsWithAllApprovals: vbCompleteRows,
      rowsWithPartialApprovals: vbPartialRows,
      rowsWithoutApprovals: vbEmptyRows,
    },
    mappingNotes: {
      rqNaturalKey: "COTIZACIÓN + N° RQ",
      centroCostosToOc: "CENTRO COSTOS -> OC principal",
      excelOcToOcOsRecurso: "OC -> OC/OS del recurso",
      proveedorSource: "ESTADO // PROVEEDOR -> Proveedor",
      vbEconomico: "E.Q. -> VB Económico",
      vbTecnico: "L.L. -> VB Técnico",
      vbAtencion: "H.B. -> VB Atención",
      importedCostTotal: "No importar costo total presupuestado; mantener cálculo actual de la app",
    },
  };

  console.log(`\nDiagnóstico local completado para: ${filePath}`);
  console.log(`Hoja analizada: ${sheetName}`);
  renderSection("Conteo general", report.general);
  renderSection("Resolución de headers", report.schema);
  renderSection("Diagnóstico de precios", report.prices);
  renderSection("Diagnóstico de fechas", report.dates);
  renderSection("Diagnóstico de duplicados", report.duplicates);
  renderSection("Diagnóstico de catálogos", {
    totalClientes: report.catalogs.clientes.length,
    totalUnidades: report.catalogs.unidades.length,
    totalTipos: report.catalogs.tipos.length,
    totalUnds: report.catalogs.unds.length,
    totalEstados: report.catalogs.estados.length,
    totalMonedas: report.catalogs.monedas.length,
    top50Proveedores: report.catalogs.top50Proveedores,
  });
  renderSection("Diagnóstico documental", report.documents);
  renderSection("Diagnóstico de VB", report.vb);

  if (outJson) {
    ensureParentDir(outJson);
    fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`\nReporte JSON guardado en: ${outJson}`);
  }

  if (outCsv) {
    ensureParentDir(outCsv);
    const rowsForCsv = [
      ["rowNumber", "type", "cotizacion", "rq", "moneda_excel", "precio_usd", "precio_pen"],
      ...inconsistencyExamples.map((example) => [
        example.rowNumber ?? "",
        example.type ?? "",
        example.cotizacion ?? "",
        example.rq ?? "",
        example.moneda_excel ?? "",
        example.precio_usd ?? "",
        example.precio_pen ?? "",
      ]),
    ];
    const csvContent = rowsForCsv.map((row) => row.map(csvEscape).join(",")).join("\n");
    fs.writeFileSync(outCsv, `${csvContent}\n`, "utf8");
    console.log(`Reporte CSV guardado en: ${outCsv}`);
  }

  console.log("\nEste script solo genera diagnóstico. No inserta datos, no ejecuta SQL y no modifica Supabase.");
}

main();
