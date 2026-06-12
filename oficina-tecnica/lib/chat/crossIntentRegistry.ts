// Registry declarativo de capacidades cruzadas del chat.
//
// Las entradas "supported" delegan al pipeline real existente. Las entradas
// "pending" bloquean el LLM y devuelven una respuesta honesta: no existe una
// tool global implementada para producir ese resultado.

export type CrossIntentFamily =
  | "project_requirements"
  | "requirement_items"
  | "resources_catalog"
  | "technical_proposals"
  | "global_analysis"
  | "supplier_rankings"
  | "items_without_price"
  | "cross_project_analysis"
  | "technical_discipline"
  | "capability_question"
  | "feedback_correction";

export type CrossIntentStatus = "supported" | "pending";
export type ScopeRequirement = "project_or_quotation" | "requirement";

export interface CrossIntentDefinition {
  family: CrossIntentFamily;
  label: string;
  status: CrossIntentStatus;
  patterns: RegExp[];
  requiredScope?: ScopeRequirement;
  implementedBy?: string[];
  honestResponse?: string;
}

const PROJECT_OR_QUOTATION = /\b(proyectos?|cotizaciones?|ocs?|[oó]rdenes?\s+de\s+compra)\b/i;
const REQUIREMENTS = /\b(requerimientos?|rqs?)\b/i;
const ITEMS = /\b([íi]tems?|partidas?|materiales?)\b/i;
const GLOBAL_SCOPE = /\b(global(?:es)?|todos?|todas?|complet[oa]s?|del\s+sistema|de\s+toda\s+la\s+base|entre\s+proyectos?)\b/i;

export const CROSS_INTENT_REGISTRY: CrossIntentDefinition[] = [
  // Pendientes primero: son subconjuntos peligrosos de familias soportadas.
  {
    family: "supplier_rankings",
    label: "Rankings o análisis global de proveedores",
    status: "pending",
    patterns: [
      /\b(top\s*\d*|ranking|mejores?|peores?|principales?|m[aá]s\s+(?:usad[oa]s?|car[oa]s?|barat[oa]s?|frecuentes?))\b.*\bproveedor(?:es)?\b/i,
      /\bproveedor(?:es)?\b.*\b(top\s*\d*|ranking|mejores?|peores?|m[aá]s\s+(?:usad[oa]s?|car[oa]s?|barat[oa]s?|frecuentes?|aparecen?|participan?))\b/i,
      /\b(an[aá]lisis|analiza|comparaci[oó]n|compara)\b.*\bproveedores\b/i,
      /\b(an[aá]lisis|comparaci[oó]n|concentraci[oó]n)\b.*\bproveedor(?:es)?\b.*\b(global|todos?|sistema)\b/i,
    ],
    honestResponse:
      "El análisis global y los rankings de proveedores aún no tienen una herramienta implementada. No ejecuté una consulta ni voy a estimar un resultado. Sí puedo revisar el proveedor registrado en los ítems de un RQ específico si indicas su código.",
  },
  {
    family: "items_without_price",
    label: "Búsqueda global de ítems sin precio",
    status: "pending",
    patterns: [
      /\b([íi]tems?|partidas?|materiales?)\b.*\b(sin\s+precio|precio\s+(?:faltante|vac[ií]o|cero)|no\s+(?:tienen|tenga|tengan)\s+precio)\b/i,
      /\b(global|todos?|sistema|base)\b.*\b([íi]tems?|partidas?|materiales?)\b.*\b(sin\s+precio|precio\s+(?:faltante|vac[ií]o|cero))\b/i,
    ],
    honestResponse:
      "La búsqueda global de ítems sin precio aún no tiene una herramienta implementada. No ejecuté una consulta global. Sí puedo consultar los ítems de un requerimiento concreto y mostrar los precios realmente recuperados si indicas el código RQ.",
  },
  {
    family: "cross_project_analysis",
    label: "Cruces o comparaciones globales entre proyectos",
    status: "pending",
    patterns: [
      /\b(compara|comparar|comparaci[oó]n|cruza|cruzar|cruce|contrasta|consolida)\b.*\b(proyectos?|cotizaciones?)\b/i,
      /\b(proyectos?|cotizaciones?)\b.*\b(compara|comparar|comparaci[oó]n|cruza|cruzar|cruce|ranking)\b/i,
    ],
    honestResponse:
      "Los cruces y comparaciones globales entre proyectos/cotizaciones aún no tienen una herramienta implementada. No ejecuté ese análisis. Sí puedo consultar una cotización o proyecto por código y listar sus requerimientos reales.",
  },
  {
    family: "global_analysis",
    label: "Rankings y top-N globales",
    status: "pending",
    patterns: [
      /\b(top\s*\d+|ranking|mayores?|menores?|m[aá]s\s+car[oa]s?|m[aá]s\s+barat[oa]s?|mejores?|peores?)\b.*\b(requerimientos?|cotizaciones?|proyectos?|recursos?|[íi]tems?)\b/i,
      /\b(requerimientos?|cotizaciones?|proyectos?|recursos?|[íi]tems?)\b.*\b(top\s*\d+|ranking|mayores?|menores?|m[aá]s\s+car[oa]s?|m[aá]s\s+barat[oa]s?|mejores?|peores?)\b/i,
    ],
    honestResponse:
      "Los rankings y top-N globales aún no tienen una herramienta implementada que garantice revisar el universo completo. No ejecuté una consulta global ni voy a completar posiciones con estimaciones. Puedo hacer búsquedas acotadas por código, estado, responsable o texto.",
  },
  {
    family: "technical_discipline",
    label: "Clasificación técnica por disciplina",
    status: "pending",
    patterns: [
      /\b(clasifica|clasificar|separa|separar|disciplina)\b.*\b([íi]tems?|materiales?|requerimientos?)\b.*\b(el[eé]ctric[oa]|mec[aá]nic[oa]|civil(?:es)?|instrumentaci[oó]n)\b/i,
      /\b([íi]tems?|materiales?|requerimientos?)\b.*\b(el[eé]ctric[oa]s?|mec[aá]nic[oa]s?|civiles?|instrumentaci[oó]n)\b.*\b(clasifica|separa|disciplina)\b/i,
      /\brecursos?\b.*\b(mec[aá]nic[oa]s?|civiles?|instrumentaci[oó]n)\b/i,
    ],
    honestResponse:
      "La clasificación determinística completa por disciplina (eléctrica, mecánica, civil e instrumentación) aún no está implementada para esos datos. No ejecuté una clasificación ni voy a inferirla con el modelo. Hoy sí está soportada la clasificación eléctrica del catálogo de recursos.",
  },
  {
    family: "capability_question",
    label: "Consulta sobre capacidades de datos",
    status: "supported",
    patterns: [
      /\b(tienes?|tienen|puedes|pueden)\b.*\b(acceso|consultar|revisar)\b.*\b(supabase|base\s+de\s+datos|tablas?|requerimientos?|cotizaciones?|recursos?)\b/i,
      /\bqu[eé]\s+(?:datos|tablas?|fuentes)\b.*\b(puedes|pueden|consultas?|revisas?)\b/i,
    ],
    implementedBy: ["respuesta de capacidades del sistema"],
  },
  {
    family: "feedback_correction",
    label: "Corrección del usuario en memoria de sesión",
    status: "supported",
    patterns: [
      /\b(no\s+era|eso\s+no\s+era|me\s+refer[ií]a|quise\s+decir)\b/i,
    ],
    implementedBy: ["queryFeedback"],
  },
  {
    family: "project_requirements",
    label: "Proyecto/cotización/OC a requerimientos",
    status: "supported",
    patterns: [
      /\b(requerimientos?|rqs?)\b.*\b(proyecto|cotizaci[oó]n|oc|orden\s+de\s+compra)\b/i,
      /\b(proyecto|cotizaci[oó]n|oc|orden\s+de\s+compra)\b.*\b(requerimientos?|rqs?)\b/i,
    ],
    requiredScope: "project_or_quotation",
    implementedBy: ["buscarRequerimientosPorProyecto"],
  },
  {
    family: "requirement_items",
    label: "Requerimiento a ítems",
    status: "supported",
    patterns: [
      /\b([íi]tems?|partidas?|materiales?)\b.*\b(requerimiento|rq)\b/i,
      /\b(requerimiento|rq)\b.*\b([íi]tems?|partidas?|materiales?)\b/i,
    ],
    requiredScope: "requirement",
    implementedBy: ["buscarRequerimientoPorCodigo", "buscarItemsDeRequerimiento"],
  },
  {
    family: "resources_catalog",
    label: "Recursos y catálogo",
    status: "supported",
    patterns: [/\brecursos?\b|\bcat[aá]logo\b/i],
    implementedBy: ["buscarRecursos", "clasificarRecursosElectricos"],
  },
  {
    family: "technical_proposals",
    label: "Propuestas técnicas",
    status: "supported",
    patterns: [/\bpropuestas?\s+t[eé]cnicas?\b|\btechnical[_\s-]?proposals?\b/i],
    implementedBy: ["buscarPropuestaTecnicaPorCodigo"],
  },
];

function matchesDefinition(text: string, definition: CrossIntentDefinition): boolean {
  return definition.patterns.some((pattern) => pattern.test(text));
}

export function findCrossIntent(text: string): CrossIntentDefinition | null {
  const normalized = text.trim();
  if (!normalized) return null;
  return CROSS_INTENT_REGISTRY.find((definition) => matchesDefinition(normalized, definition)) ?? null;
}

export function looksLikeUnsupportedGlobalQuery(text: string): boolean {
  const t = text.trim();
  if (!GLOBAL_SCOPE.test(t)) return false;
  return (PROJECT_OR_QUOTATION.test(t) || REQUIREMENTS.test(t) || ITEMS.test(t))
    && /\b(an[aá]lisis|analiza|resume|consolida|compara|ranking|top)\b/i.test(t);
}
