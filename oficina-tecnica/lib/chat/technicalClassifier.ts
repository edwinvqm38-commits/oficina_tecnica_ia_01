// ── Clasificador técnico multi-disciplina (determinístico) ───────────────────
//
// Extiende el clasificador eléctrico a varias disciplinas para clasificar tanto
// recursos del catálogo como ítems de requerimiento: eléctrico, mecánico, civil,
// instrumentación, seguridad u otros. Como el clasificador eléctrico, es una
// INFERENCIA técnica a partir de la descripción (no un campo formal de Supabase);
// quien renderiza debe decir que la clasificación es inferida.

import { clasificarRecursoElectrico, type RecursoClassifiable } from "./resourceClassifier";
import type { TechnicalClass } from "./crossIntentRegistry";

export interface TechItemClassifiable {
  codigo: string;
  descripcion: string;
  tipo?: string | null;
  marca?: string | null;
}

export interface ClassifiedTechItem extends TechItemClassifiable {
  disciplina: TechnicalClass;
  /** Subclase legible (p. ej. "Equipo eléctrico", "Tubería/accesorio mecánico"). */
  subclase: string;
  motivo: string;
  /** Siempre true: la disciplina es una inferencia, no un campo formal. */
  inferida: true;
}

function norm(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Instrumentación de proceso ESPECÍFICA: tiene prioridad sobre el clasificador
// eléctrico (que captura "transmisor"/"sensor" genéricos como equipo eléctrico).
const PROCESS_INSTRUMENT_TERMS = [
  "manometro", "caudalimetro", "flujometro", "termocupla", "presostato",
  "sensor de nivel", "sensor de presion", "valvula de control", "posicionador",
  "transmisor de presion", "transmisor de nivel", "transmisor de temperatura",
  "transmisor de flujo", "transmisor de caudal", "indicador de presion",
  "instrumento de proceso", "instrumentacion de proceso",
];
// Instrumentación secundaria (se evalúa DESPUÉS de la eléctrica).
const INSTRUMENTACION_TERMS = [
  "transmisor", "rtd", "plc", "scada", "controlador", "instrumentacion",
];
const SEGURIDAD_TERMS = [
  "epp", "casco", "guante", "botin", "arnes", "lente de seguridad", "lentes",
  "chaleco", "tafilete", "barbiquejo", "respirador", "mascarilla", "sctr",
  "extintor", "senalizacion", "cono de seguridad", "proteccion personal",
];
const CIVIL_TERMS = [
  "concreto", "cemento", "agregado", "arena", "piedra", "ladrillo", "encofrado",
  "acero corrugado", "fierro", "varilla de construccion", "zapata", "losa",
  "vaciado", "fundacion", "geotextil", "asfalto", "pavimento", "excavacion",
  "relleno", "mortero", "hormigon",
];
const MECANICO_TERMS = [
  "bomba", "motor", "valvula", "tuberia", "tuberería", "brida", "codo", "tee",
  "reductor", "rodamiento", "faja", "polea", "compresor", "ventilador",
  "intercambiador", "perno", "tornillo", "tuerca", "soldadura", "plancha de acero",
  "estructura metalica", "viga", "perfil metalico", "niple", "acople", "fitting",
];

function firstMatch(haystack: string, terms: string[]): string | null {
  for (const term of terms) if (haystack.includes(term)) return term;
  return null;
}

/**
 * Clasifica un único ítem/recurso por disciplina. Prioridad: eléctrico (vía el
 * clasificador eléctrico ya probado) > instrumentación > seguridad > civil >
 * mecánico > otros.
 */
export function classifyTechnicalItem(r: TechItemClassifiable): ClassifiedTechItem {
  const hay = `${norm(r.descripcion)} ${norm(r.tipo)} ${norm(r.marca)}`;

  // Instrumentación de proceso específica gana sobre el clasificador eléctrico.
  const procInst = firstMatch(hay, PROCESS_INSTRUMENT_TERMS);
  if (procInst) return mk(r, "instrumentacion", "Instrumentación de proceso", procInst);

  const base: RecursoClassifiable = { codigo: r.codigo, descripcion: r.descripcion, tipo: r.tipo ?? null, marca: r.marca ?? null };
  const elec = clasificarRecursoElectrico(base);
  if (elec.electrico) {
    return { ...r, disciplina: "electrico", subclase: elec.clasificacion, motivo: elec.motivo, inferida: true };
  }

  const inst = firstMatch(hay, INSTRUMENTACION_TERMS);
  if (inst) return mk(r, "instrumentacion", "Instrumentación de proceso", inst);
  const seg = firstMatch(hay, SEGURIDAD_TERMS);
  if (seg) return mk(r, "seguridad", "Seguridad / EPP", seg);
  const civ = firstMatch(hay, CIVIL_TERMS);
  if (civ) return mk(r, "civil", "Material/obra civil", civ);
  const mec = firstMatch(hay, MECANICO_TERMS);
  if (mec) return mk(r, "mecanico", "Equipo/material mecánico", mec);

  return { ...r, disciplina: "otros", subclase: "Sin disciplina técnica clara", motivo: "Sin términos técnicos reconocidos en la descripción.", inferida: true };
}

function mk(r: TechItemClassifiable, disciplina: TechnicalClass, subclase: string, term: string): ClassifiedTechItem {
  return { ...r, disciplina, subclase, motivo: `Coincide con "${term}" en la descripción.`, inferida: true };
}

/** Clasifica un lote; si `target` se indica, filtra solo esa disciplina. */
export function classifyTechnicalItems(records: TechItemClassifiable[], target?: TechnicalClass): ClassifiedTechItem[] {
  const all = records.map(classifyTechnicalItem);
  return target ? all.filter((c) => c.disciplina === target) : all;
}

/** Conteo por disciplina (para encabezados determinísticos). */
export function resumenDisciplinas(classified: ClassifiedTechItem[]): Record<TechnicalClass, number> {
  const out = { electrico: 0, mecanico: 0, civil: 0, instrumentacion: 0, seguridad: 0, otros: 0 } as Record<TechnicalClass, number>;
  for (const c of classified) out[c.disciplina]++;
  return out;
}
