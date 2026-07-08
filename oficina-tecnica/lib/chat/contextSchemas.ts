// ── Registro formal de fuentes de contexto IA ────────────────────────────────
//
// Describe, de forma declarativa, las tablas/fuentes de Supabase que el
// contexto IA puede consultar. NO ejecuta consultas — solo documenta qué
// existe, qué campos son consultables/visibles para la IA y en qué estado de
// implementación está cada fuente. Las herramientas reales viven en
// `contextTools.ts` y deben mantenerse consistentes con este registro.
//
// Objetivo: que router, herramientas y guardrails compartan una única fuente
// de verdad sobre "qué puede ver la IA", evitando que un agente diga "no tengo
// acceso" cuando sí existe, o que invente datos de una fuente aún no conectada.

export type ContextSourceStatus = "implemented" | "pending";

export interface ContextSourceRelation {
  /** Clave lógica de la fuente relacionada (otra entrada de CONTEXT_SOURCES). */
  source: string;
  /** Campo/columna que materializa la relación. */
  via: string;
  /** Descripción breve de la relación. */
  description: string;
}

export interface ContextSource {
  /** Nombre lógico estable usado por router/herramientas (no es la tabla). */
  key: string;
  /** Nombre de la tabla real en Supabase. */
  table: string;
  /** Etiqueta legible para humanos (logs/depuración). */
  label: string;
  /** Descripción breve de qué contiene la fuente. */
  description: string;
  /** Columnas por las que se puede filtrar/consultar. */
  queryableFields: string[];
  /** Columnas que la IA puede mostrar/usar (excluye campos sensibles/internos). */
  aiVisibleFields: string[];
  /** Columnas usadas para búsqueda de texto libre (ilike). */
  searchFields: string[];
  /** Relaciones con otras fuentes. */
  relations: ContextSourceRelation[];
  /** Estado de implementación en el contexto IA. */
  status: ContextSourceStatus;
}

// Campos deliberadamente NO expuestos a la IA (auditoría/infra): created_by,
// updated_by, deleted_at, metadata cruda, ids internos de catálogos, etc.
export const CONTEXT_SOURCES: Record<string, ContextSource> = {
  cotizaciones: {
    key: "cotizaciones",
    table: "cotizaciones",
    label: "Cotizaciones",
    description: "Cotizaciones/proyectos: cliente, estado, avance, monto y responsables.",
    queryableFields: ["codigo", "estado", "cliente_nombre", "proyecto", "responsable_tecnico", "prioridad"],
    aiVisibleFields: [
      "codigo", "oc", "cliente_nombre", "proyecto", "estado", "avance", "monto",
      "responsable_tecnico", "tipo_servicio_nombre", "prioridad", "created_at",
    ],
    searchFields: ["codigo", "proyecto", "cliente_nombre", "responsable_tecnico"],
    relations: [
      { source: "requerimientos", via: "requerimientos.cotizacion_codigo", description: "Una cotización tiene N requerimientos." },
      { source: "technical_proposals", via: "technical_proposals.cotizacion_codigo", description: "Una cotización puede tener propuestas técnicas." },
      { source: "quotation_documents", via: "quotation_documents.quotation_code", description: "Una cotización tiene N documentos auditados en Drive." },
    ],
    status: "implemented",
  },

  requerimientos: {
    key: "requerimientos",
    table: "requerimientos",
    label: "Requerimientos",
    description: "Requerimientos (RQ): estado, responsable, avance, solicitante y cotización asociada.",
    queryableFields: ["codigo", "estado", "responsable", "solicitante_rq", "cotizacion_codigo"],
    aiVisibleFields: [
      "codigo", "estado", "responsable", "avance", "solicitante_rq",
      "tipo_servicio_nombre", "fecha_requerida", "cotizacion_codigo", "observaciones", "created_at",
    ],
    searchFields: ["codigo", "cotizacion_codigo", "responsable", "solicitante_rq", "observaciones"],
    relations: [
      { source: "cotizaciones", via: "requerimientos.cotizacion_codigo", description: "Cada RQ pertenece a una cotización." },
      { source: "requerimiento_items", via: "requerimiento_items.requerimiento_id", description: "Un RQ tiene N ítems/materiales." },
    ],
    status: "implemented",
  },

  requerimiento_items: {
    key: "requerimiento_items",
    table: "requerimiento_items",
    label: "Ítems de requerimiento",
    description: "Ítems/materiales de un requerimiento: descripción, cantidad, precio, proveedor y costo.",
    queryableFields: ["requerimiento_id", "estado", "proveedor_nombre"],
    aiVisibleFields: [
      "descripcion", "unidad", "cantidad", "precio_unitario", "moneda",
      "estado", "proveedor_nombre", "costo_total_presupuestado",
    ],
    searchFields: ["recurso_a_suministrar", "proveedor_nombre"],
    relations: [
      { source: "requerimientos", via: "requerimiento_items.requerimiento_id", description: "Cada ítem pertenece a un RQ." },
      { source: "recursos", via: "requerimiento_items.recurso_id", description: "Un ítem puede referenciar un recurso del catálogo." },
    ],
    status: "implemented",
  },

  technical_proposals: {
    key: "technical_proposals",
    table: "technical_proposals",
    label: "Propuestas técnicas",
    description: "Propuestas técnicas (PT) asociadas a una cotización: código, revisión y estado.",
    queryableFields: ["code", "cotizacion_codigo", "status", "revision"],
    aiVisibleFields: ["code", "cotizacion_codigo", "revision", "status", "work_status", "document_date", "created_at"],
    searchFields: ["code", "cotizacion_codigo"],
    relations: [
      { source: "cotizaciones", via: "technical_proposals.cotizacion_codigo", description: "Cada PT pertenece a una cotización." },
    ],
    status: "implemented",
  },

  recursos: {
    key: "recursos",
    table: "recursos",
    label: "Recursos (catálogo)",
    description: "Catálogo de recursos: código, descripción, tipo, precio referencial, proveedor y marca.",
    queryableFields: ["codigo_recurso", "tipo_recurso_nombre", "estado", "proveedor_nombre", "marca_nombre"],
    aiVisibleFields: [
      "codigo_recurso", "descripcion", "tipo_recurso_nombre", "precio_unitario_ref",
      "moneda_codigo", "proveedor_nombre", "marca_nombre", "estado",
    ],
    searchFields: ["codigo_recurso", "descripcion", "codigo_eka", "codigo_fabricante"],
    relations: [
      { source: "requerimiento_items", via: "requerimiento_items.recurso_id", description: "Un recurso puede usarse en ítems de RQ." },
    ],
    status: "implemented",
  },

  quotation_documents: {
    key: "quotation_documents",
    table: "quotation_documents",
    label: "Documentos de cotización",
    description: "Archivos de cotizaciones y requerimientos guardados en Google Drive con auditoría en Supabase.",
    queryableFields: ["quotation_code", "requirement_code", "folder_key", "original_name"],
    aiVisibleFields: [
      "quotation_code", "requirement_code", "folder_name", "original_name",
      "mime_type", "file_size", "drive_file_url", "uploaded_at", "uploaded_by_email",
    ],
    searchFields: ["quotation_code", "requirement_code", "original_name", "folder_name"],
    relations: [
      { source: "cotizaciones", via: "quotation_documents.quotation_code", description: "Cada documento pertenece a una cotización." },
      { source: "requerimientos", via: "quotation_documents.requirement_code", description: "Un documento puede estar asociado a un RQ." },
    ],
    status: "implemented",
  },

  // ── Fuentes existentes en la app pero aún NO conectadas al contexto IA ──────
  // El router puede detectar la intención, pero las herramientas devuelven
  // status "not_implemented" y los guardrails responden con la frase exacta
  // "La fuente existe en la app, pero aún no está implementada en el contexto IA."
  clientes: {
    key: "clientes",
    table: "clientes",
    label: "Clientes",
    description: "Directorio de clientes. Hoy el cliente se lee denormalizado desde cotizaciones.cliente_nombre.",
    queryableFields: ["nombre"],
    aiVisibleFields: ["nombre"],
    searchFields: ["nombre"],
    relations: [
      { source: "cotizaciones", via: "cotizaciones.cliente_nombre", description: "Un cliente tiene N cotizaciones (hoy por nombre)." },
    ],
    status: "pending",
  },

  proveedores: {
    key: "proveedores",
    table: "proveedores",
    label: "Proveedores",
    description: "Directorio de proveedores. Hoy se lee denormalizado desde requerimiento_items/recursos.proveedor_nombre.",
    queryableFields: ["nombre"],
    aiVisibleFields: ["nombre"],
    searchFields: ["nombre"],
    relations: [
      { source: "recursos", via: "recursos.proveedor_nombre", description: "Un proveedor abastece N recursos (hoy por nombre)." },
    ],
    status: "pending",
  },

  resource_files: {
    key: "resource_files",
    table: "recursos.metadata.resource_files",
    label: "Archivos de recurso",
    description: "Fichas técnicas/imágenes de recursos (almacenadas en metadata + Storage). Aún no expuestas al contexto IA.",
    queryableFields: [],
    aiVisibleFields: ["file_name", "file_type"],
    searchFields: [],
    relations: [
      { source: "recursos", via: "recursos.metadata.resource_files", description: "Archivos adjuntos a un recurso." },
    ],
    status: "pending",
  },

  // ── Base documental (Fase 4 / RAG) — solo declarada, sin implementación ─────
  // TODO(Fase 4): conectar embeddings/recuperación documental. Por ahora es
  // únicamente metadata para que el router pueda responder con honestidad que
  // la búsqueda documental todavía no está disponible.
  document_sources: {
    key: "document_sources",
    table: "document_sources",
    label: "Documentos (RAG)",
    description: "Búsqueda semántica sobre documentos del proyecto. Pendiente (Fase 4, RAG).",
    queryableFields: [],
    aiVisibleFields: [],
    searchFields: [],
    relations: [],
    status: "pending",
  },
};

export function getContextSource(key: string): ContextSource | null {
  return CONTEXT_SOURCES[key] ?? null;
}

export function isSourceImplemented(key: string): boolean {
  return CONTEXT_SOURCES[key]?.status === "implemented";
}

export function listImplementedSources(): ContextSource[] {
  return Object.values(CONTEXT_SOURCES).filter((s) => s.status === "implemented");
}
