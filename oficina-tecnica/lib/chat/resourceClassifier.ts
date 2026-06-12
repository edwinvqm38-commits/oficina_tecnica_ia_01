// ── Clasificador determinístico de recursos eléctricos ───────────────────────
//
// Cuando el usuario pide "cuáles de estos recursos son eléctricos",
// "diferéncialos" o "solo los eléctricos", NO confiamos en que el LLM separe
// bien (en las pruebas reales se saltó el cable N2XOH y el multímetro). Esta
// función infiere una clasificación técnica a partir de descripción + tipo +
// marca usando listas de términos, y es 100% determinística y testeable.
//
// IMPORTANTE: la clasificación es una INFERENCIA técnica, no un campo formal de
// Supabase (la tabla `recursos` no tiene `es_electrico`). Quien renderiza debe
// dejarlo explícito. No se inventan normas técnicas.

export type ElectricalClass =
  | "Equipo eléctrico"
  | "Material eléctrico"
  | "Instrumento de medición eléctrica"
  | "Consumible eléctrico"
  | "No eléctrico"
  | "Dudoso / requiere revisión";

export interface RecursoClassifiable {
  codigo: string;
  descripcion: string;
  tipo: string | null;
  marca: string | null;
}

export interface ClassifiedRecurso extends RecursoClassifiable {
  clasificacion: ElectricalClass;
  /** Razón legible (qué término disparó la clasificación). */
  motivo: string;
  /** True si es eléctrico o dudoso (lo que el usuario querría ver al filtrar). */
  electrico: boolean;
}

// Normaliza acentos y mayúsculas para comparar términos de forma robusta.
function norm(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Términos por categoría. Se evalúan sobre descripción + tipo + marca.
const INSTRUMENT_TERMS = [
  "multimetro", "pinza amperimetrica", "amperimetrica", "amperimetro", "voltimetro",
  "vatimetro", "megohmetro", "megometro", "telurometro", "teluro", "osciloscopio",
  "analizador de redes", "secuencimetro", "comprobador de tension", "pinza de corriente",
];
const EQUIPO_TERMS = [
  "tablero", "transformador", "variador", "breaker", "interruptor termomagnetico",
  "termomagnetico", "contactor", "guardamotor", "arrancador", "seccionador", "celda",
  "rele", "relé", "ups", "banco de condensadores", "rectificador", "cargador de bateria",
  "fuente de poder", "fuente de alimentacion", "plc", "transmisor", "sensor",
  "motor electrico", "electrobomba", "grupo electrogeno", "generador electrico", "tomacorriente",
];
const CONSUMIBLE_TERMS = [
  "cinta aislante", "termocontraible", "termocontraill", "prensaestopa", "fusible",
  "portafusible", "conector electrico", "jumper", "amarre", "espiral",
];
const MATERIAL_TERMS = [
  "cable", "conductor", "n2xoh", "nyy", "thw", "nh-80", "nh80", "bornera", "terminal",
  "canaleta", "conduit", "ducto electrico", "barra de cobre", "pletina", "aislador",
  "pararrayo", "puesta a tierra", "varilla copperweld", "dielectric", "interruptor",
];
// Marcas eléctricas reconocidas (señal débil: por sí sola → "Dudoso").
const BRAND_TERMS = [
  "schneider", "abb", "siemens", "indeco", "fluke", "weidmuller", "phoenix contact",
  "legrand", "bticino", "chint", "ls electric", "weg", "hager", "celsa",
];
// Señal genérica eléctrica que confirma una marca dudosa.
const GENERIC_ELECTRIC_TERMS = ["electric", "electrico", "kv", "amperio", "voltaje", "tension electrica", "corriente"];
// No eléctrico (fuerte): cursos, EPP, logística, administrativos.
const HARD_NON_ELECTRIC_TERMS = [
  "curso", "induccion", "capacitacion", "antecedente", "examen medico", "medico ocupacional",
  "lavado", "alimentacion", "hospedaje", "transporte", "vehiculo", "viatico",
  "gasto general", "gastos generales", "reglamento", "subcontrato", "mano de obra",
  "hidratacion", "movilidad", "peaje", "combustible", "gasolina", "petroleo", "diesel",
  "seguro", "poliza", "sctr", "casco", "botin", "lente de seguridad", "chaleco",
  "uniforme", "tafilete", "barbiquejo",
];

function firstMatch(haystack: string, terms: string[]): string | null {
  for (const term of terms) {
    if (haystack.includes(term)) return term;
  }
  return null;
}

/** Clasifica un único recurso. Pura y determinística. */
export function clasificarRecursoElectrico(r: RecursoClassifiable): ClassifiedRecurso {
  const hay = `${norm(r.descripcion)} ${norm(r.tipo)} ${norm(r.marca)}`;

  // 1) Coincidencia eléctrica explícita (tiene prioridad sobre EPP/no-eléctrico:
  //    p. ej. "guante dieléctrico" es EPP pero también material eléctrico).
  const inst = firstMatch(hay, INSTRUMENT_TERMS);
  if (inst) return mk(r, "Instrumento de medición eléctrica", inst, true);
  const equip = firstMatch(hay, EQUIPO_TERMS);
  if (equip) return mk(r, "Equipo eléctrico", equip, true);
  const cons = firstMatch(hay, CONSUMIBLE_TERMS);
  if (cons) return mk(r, "Consumible eléctrico", cons, true);
  const mat = firstMatch(hay, MATERIAL_TERMS);
  if (mat) return mk(r, "Material eléctrico", mat, true);

  // 2) No eléctrico fuerte (cursos, EPP genérico, logística, administrativos).
  const non = firstMatch(hay, HARD_NON_ELECTRIC_TERMS);
  if (non) return mk(r, "No eléctrico", non, false);

  // 3) Marca eléctrica reconocida sin sustantivo claro → dudoso (revisar).
  const brand = firstMatch(hay, BRAND_TERMS);
  if (brand) {
    const generic = firstMatch(hay, GENERIC_ELECTRIC_TERMS);
    if (generic) return mk(r, "Material eléctrico", `${brand} + ${generic}`, true);
    return mk(r, "Dudoso / requiere revisión", `marca ${brand} sin sustantivo técnico claro`, true);
  }

  // 4) Mención genérica "eléctrico" sin categoría específica → dudoso.
  const generic = firstMatch(hay, GENERIC_ELECTRIC_TERMS);
  if (generic) return mk(r, "Dudoso / requiere revisión", generic, true);

  // 5) Sin señal eléctrica → no eléctrico.
  return mk(r, "No eléctrico", "sin términos eléctricos en descripción/tipo/marca", false);
}

function mk(r: RecursoClassifiable, clasificacion: ElectricalClass, term: string, electrico: boolean): ClassifiedRecurso {
  const motivo = electrico
    ? `Coincide con "${term}" en descripción/tipo/marca.`
    : clasificacion === "No eléctrico" && term.startsWith("sin ")
      ? term
      : `Coincide con "${term}" (no eléctrico).`;
  return { ...r, clasificacion, motivo, electrico };
}

/** Clasifica un lote de recursos. */
export function clasificarRecursosElectricos(records: RecursoClassifiable[]): ClassifiedRecurso[] {
  return records.map(clasificarRecursoElectrico);
}

/** Resumen de conteos por categoría (para encabezados determinísticos). */
export function resumenClasificacion(classified: ClassifiedRecurso[]): {
  total: number;
  electricos: number;
  byClass: Record<ElectricalClass, number>;
} {
  const byClass = {
    "Equipo eléctrico": 0,
    "Material eléctrico": 0,
    "Instrumento de medición eléctrica": 0,
    "Consumible eléctrico": 0,
    "No eléctrico": 0,
    "Dudoso / requiere revisión": 0,
  } as Record<ElectricalClass, number>;
  let electricos = 0;
  for (const c of classified) {
    byClass[c.clasificacion]++;
    if (c.electrico) electricos++;
  }
  return { total: classified.length, electricos, byClass };
}
