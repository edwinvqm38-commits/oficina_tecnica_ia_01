export type PermissionModuleKey = "recursos" | "cotizaciones" | "requerimientos" | "detalle_rq" | "datos";

export type StandardPermissionKey =
  | "can_view"
  | "can_create"
  | "can_edit"
  | "can_change_status"
  | "can_upload_files";

export type PersistedSensitivePermissionKey = "can_view_prices" | "can_view_supplier";

export type SensitivePermissionKey =
  | PersistedSensitivePermissionKey
  | "can_view_margin"
  | "can_view_economic_support"
  | "can_delete_associated_requirements"
  | "can_view_oc"
  | "can_view_variance"
  | "can_edit_catalogs"
  | "can_import_export";

export type ModulePermissionColumn = {
  key: string;
  label: string;
};

export type ModuleViewGroup = {
  key: string;
  label: string;
  description?: string;
};

export type SensitivePermissionDefinition = {
  key: SensitivePermissionKey;
  label: string;
  persistedColumn?: PersistedSensitivePermissionKey;
};

export type ModulePermissionCatalogItem = {
  module_key: PermissionModuleKey;
  label: string;
  description: string;
  enabled: boolean;
  columns: ModulePermissionColumn[];
  viewGroups?: ModuleViewGroup[];
  sensitivePermissions: SensitivePermissionDefinition[];
  standardPermissions: StandardPermissionKey[];
};

export const STANDARD_PERMISSIONS: StandardPermissionKey[] = [
  "can_view",
  "can_create",
  "can_edit",
  "can_change_status",
  "can_upload_files",
];

export const MODULE_PERMISSIONS_CATALOG: ModulePermissionCatalogItem[] = [
  {
    module_key: "cotizaciones",
    label: "Log de cotizaciones",
    description: "Permisos base para visualización y operación del log de cotizaciones.",
    enabled: true,
    standardPermissions: STANDARD_PERMISSIONS,
    sensitivePermissions: [
      { key: "can_view_prices", label: "Ver montos", persistedColumn: "can_view_prices" },
      { key: "can_view_supplier", label: "Ver proveedor", persistedColumn: "can_view_supplier" },
      { key: "can_view_margin", label: "Ver margen" },
      { key: "can_view_economic_support", label: "Ver sustento económico" },
      { key: "can_delete_associated_requirements", label: "Eliminar RQ asociados" },
    ],
    viewGroups: [
      {
        key: "quotation_main_table",
        label: "Tabla principal",
        description: "Controla la tabla principal del Log de cotizaciones.",
      },
      {
        key: "quotation_general_data",
        label: "Datos de la cotización",
        description: "Controla el bloque superior del detalle de cotización.",
      },
      {
        key: "quotation_economic_summary",
        label: "Resumen económico",
        description: "Controla resumen económico, flujo mensual, márgenes, montos y moneda.",
      },
      {
        key: "quotation_related_requirements",
        label: "Requerimientos asociados",
        description: "Controla el panel de RQ asociados y el acceso a RQ desde cotización.",
      },
      {
        key: "quotation_documents",
        label: "Evidencias / documentos",
        description: "Controla evidencias, archivos, Drive o sustento documental.",
      },
      {
        key: "quotation_traceability",
        label: "Trazabilidad / eventos",
        description: "Controla timeline, historial, eventos, comentarios o trazabilidad.",
      },
      {
        key: "quotation_actions",
        label: "Acciones / botones",
        description: "Controla botones operativos del detalle de cotización.",
      },
    ],
    columns: [
      { key: "codigo", label: "Código" },
      { key: "proyecto", label: "Proyecto" },
      { key: "tipo_servicio", label: "Tipo servicio" },
      { key: "estado_propuesta", label: "Estado propuesta" },
      { key: "cliente", label: "Cliente" },
      { key: "unidad_trabajo", label: "Unidad trabajo" },
      { key: "solicitante", label: "Solicitante" },
      { key: "prioridad", label: "Prioridad" },
      { key: "responsable_tecnico", label: "Responsable técnico" },
      { key: "responsable_economico", label: "Responsable económico" },
      { key: "avance", label: "Avance" },
      { key: "fecha_registro", label: "Fecha registro" },
      { key: "fecha_invitacion", label: "Fecha invitación" },
      { key: "fecha_confirmacion", label: "Fecha confirmación" },
      { key: "fecha_visita_tecnica", label: "Fecha visita técnica" },
      { key: "fecha_consultas", label: "Fecha consultas" },
      { key: "fecha_abs_consultas", label: "Fecha absolución consultas" },
      { key: "fecha_entrega", label: "Fecha entrega" },
      { key: "fecha_entregada", label: "Fecha entregada" },
      { key: "monto", label: "Monto" },
      { key: "moneda_cotizacion", label: "Moneda" },
      { key: "estado", label: "Estado" },
      { key: "oc", label: "OC" },
    ],
  },
  {
    module_key: "requerimientos",
    label: "Log de requerimientos",
    description: "Permisos base para visualización y operación del log de requerimientos.",
    enabled: true,
    standardPermissions: STANDARD_PERMISSIONS,
    sensitivePermissions: [
      { key: "can_view_prices", label: "Ver costos", persistedColumn: "can_view_prices" },
      { key: "can_view_supplier", label: "Ver proveedor", persistedColumn: "can_view_supplier" },
      { key: "can_view_oc", label: "Ver OC / centro de costo" },
    ],
    viewGroups: [
      {
        key: "requirement_main_table",
        label: "Tabla principal",
        description: "Controla la tabla principal del Log de requerimientos.",
      },
      {
        key: "requirement_general_data",
        label: "Datos del requerimiento",
        description: "Controla cliente, proyecto, unidad, OC, cotización relacionada, responsables, fechas y estado.",
      },
      {
        key: "requirement_indicators",
        label: "Indicadores del requerimiento",
        description: "Controla ítems, atendidos, pendientes, avance, VB y OC/OS.",
      },
      {
        key: "requirement_economic_summary",
        label: "Resumen económico",
        description: "Controla costos, totales, moneda, resumen por tipo de recurso y montos asociados.",
      },
      {
        key: "requirement_items",
        label: "Detalle del requerimiento",
        description: "Controla la tabla de ítems del requerimiento.",
      },
      {
        key: "requirement_documents",
        label: "Documentos / archivos",
        description: "Controla ficha técnica, imagen referencial, archivos y documentos asociados.",
      },
      {
        key: "requirement_actions",
        label: "Acciones / botones",
        description: "Controla editar datos, editar tabla, limpiar filtros, guardar, cancelar y botones operativos.",
      },
      {
        key: "requirement_item_detail",
        label: "Detalle de ítem de RQ",
        description: "Controla el modal de detalle de cada ítem de requerimiento.",
      },
    ],
    columns: [
      { key: "proyecto", label: "Proyecto" },
      { key: "codigo", label: "Código RQ" },
      { key: "cotizacion_codigo", label: "Cotización relacionada" },
      { key: "oc", label: "OC" },
      { key: "cliente", label: "Cliente" },
      { key: "unidad_trabajo", label: "Unidad trabajo" },
      { key: "solicitante_rq", label: "Solicitante RQ" },
      { key: "estado", label: "Estado" },
      { key: "fecha_solicitud", label: "Fecha solicitud" },
      { key: "responsable", label: "Responsable" },
      { key: "fecha_requerida", label: "Fecha requerida" },
      { key: "tipo_servicio", label: "Tipo servicio" },
      { key: "area", label: "Área" },
      { key: "items_totales", label: "Ítems totales" },
      { key: "estado_rq", label: "Estado RQ" },
      { key: "pendientes", label: "Pendientes" },
      { key: "en_proceso", label: "En proceso" },
      { key: "atendidos", label: "Atendidos" },
      { key: "vb_completos", label: "VB completos" },
      { key: "con_recurso", label: "Con recurso" },
      { key: "sin_recurso", label: "Sin recurso" },
      { key: "con_ficha_suministrar", label: "Con ficha suministrar" },
      { key: "con_oc_os", label: "Con OC/OS" },
      { key: "con_guia", label: "Con guía" },
      { key: "avance", label: "Avance" },
    ],
  },
  {
    module_key: "detalle_rq",
    label: "Detalle de requerimientos",
    description: "Permisos base para visualización del detalle de RQ e ítems.",
    enabled: true,
    standardPermissions: STANDARD_PERMISSIONS,
    sensitivePermissions: [
      { key: "can_view_prices", label: "Ver precios/costos", persistedColumn: "can_view_prices" },
      { key: "can_view_supplier", label: "Ver proveedor", persistedColumn: "can_view_supplier" },
      { key: "can_view_oc", label: "Ver OC/OS" },
      { key: "can_view_variance", label: "Ver desviaciones" },
    ],
    viewGroups: [
      {
        key: "detail_rq_general_data",
        label: "Datos generales",
        description: "Controla bloque superior de datos generales del requerimiento.",
      },
      {
        key: "detail_rq_indicators",
        label: "Indicadores del requerimiento",
        description: "Controla indicadores del requerimiento.",
      },
      {
        key: "detail_rq_resource_summary",
        label: "Resumen por tipo de recurso",
        description: "Controla resumen por tipo de recurso y total RQ.",
      },
      {
        key: "detail_rq_items_table",
        label: "Detalle de requerimiento",
        description: "Controla tabla principal de ítems.",
      },
      {
        key: "detail_rq_item_context",
        label: "Contexto del ítem",
        description: "Controla contexto del requerimiento dentro del modal Detalle de ítem de RQ.",
      },
      {
        key: "detail_rq_item_data",
        label: "Datos del ítem",
        description: "Controla descripción, tipo recurso, unidad, cantidad, estado, información adicional y observaciones.",
      },
      {
        key: "detail_rq_item_economic_data",
        label: "Datos económicos del ítem",
        description: "Controla precio unitario, moneda, compra, ajuste, cantidades valorizadas, totales y costos.",
      },
      {
        key: "detail_rq_item_supplier_data",
        label: "Proveedor / compra",
        description: "Controla proveedor, estado de compra y datos comerciales relacionados.",
      },
      {
        key: "detail_rq_documents",
        label: "Documentos / archivos",
        description: "Controla ficha técnica, imagen referencial, archivos y documentos del ítem.",
      },
      {
        key: "detail_rq_actions",
        label: "Acciones / botones",
        description: "Controla editar datos, editar ítem, editar tabla, guardar, cancelar y acciones operativas.",
      },
    ],
    columns: [
      { key: "proyecto", label: "Proyecto" },
      { key: "codigo_rq", label: "Código RQ" },
      { key: "cotizacion_codigo", label: "Cotización relacionada" },
      { key: "oc", label: "OC" },
      { key: "cliente", label: "Cliente" },
      { key: "unidad_trabajo", label: "Unidad trabajo" },
      { key: "estado_rq", label: "Estado RQ" },
      { key: "avance_rq", label: "Avance RQ" },
      { key: "codigo_fabricante", label: "Código fabricante" },
      { key: "tipo_recurso", label: "Tipo recurso" },
      { key: "descripcion", label: "Descripción" },
      { key: "informacion_adicional", label: "Información adicional" },
      { key: "observaciones_item", label: "Observaciones ítem" },
      { key: "unidad", label: "Unidad" },
      { key: "cantidad", label: "Cantidad" },
      { key: "precio_unitario", label: "Precio unitario" },
      { key: "moneda", label: "Moneda" },
      { key: "tc", label: "TC" },
      { key: "costo_total_presupuestado", label: "Costo total presupuestado" },
      { key: "estado", label: "Estado ítem" },
      { key: "proveedor", label: "Proveedor" },
      { key: "logistica_compra", label: "Logística compra" },
      { key: "fecha_compra", label: "Fecha compra" },
      { key: "oc_os_recurso", label: "OC/OS recurso" },
      { key: "fecha_entrega", label: "Fecha entrega" },
      { key: "guia_remision", label: "Guía remisión" },
      { key: "archivo_guia", label: "Archivo guía" },
      { key: "acciones", label: "Acciones" },
    ],
  },
  {
    module_key: "recursos",
    label: "Recursos",
    description: "Permisos base para visualización del maestro de recursos.",
    enabled: true,
    standardPermissions: STANDARD_PERMISSIONS,
    sensitivePermissions: [
      { key: "can_view_prices", label: "Ver precios", persistedColumn: "can_view_prices" },
      { key: "can_view_supplier", label: "Ver proveedor/marca", persistedColumn: "can_view_supplier" },
    ],
    viewGroups: [
      {
        key: "resources_main_table",
        label: "Tabla principal",
        description: "Controla tabla principal de recursos.",
      },
      {
        key: "resources_identification",
        label: "Identificación del recurso",
        description: "Controla código recurso, código EKA, código fabricante, descripción, tipo, unidad y modelo.",
      },
      {
        key: "resources_economic_data",
        label: "Datos económicos",
        description: "Controla precio unitario referencial, moneda y costos.",
      },
      {
        key: "resources_supplier_data",
        label: "Proveedor / marca",
        description: "Controla proveedor, marca, fabricante y datos comerciales.",
      },
      {
        key: "resources_documents",
        label: "Documentos / fichas",
        description: "Controla ficha técnica, imágenes, documentos y archivos asociados.",
      },
      {
        key: "resources_actions",
        label: "Acciones / botones",
        description: "Controla botones operativos.",
      },
    ],
    columns: [
      { key: "codigo_recurso", label: "Código recurso" },
      { key: "codigo_eka", label: "Código EKA" },
      { key: "codigo_fabricante", label: "Código fabricante" },
      { key: "tipo_recurso", label: "Tipo recurso" },
      { key: "descripcion", label: "Descripción" },
      { key: "unidad", label: "Unidad" },
      { key: "precio_unitario_ref", label: "P.U. ref." },
      { key: "moneda", label: "Moneda" },
      { key: "proveedor", label: "Proveedor" },
      { key: "marca", label: "Marca" },
      { key: "modelo", label: "Modelo" },
      { key: "tiempo_entrega_ref", label: "Tiempo entrega" },
      { key: "fecha_actualizacion", label: "Fecha actualización" },
      { key: "estado", label: "Estado" },
      { key: "docs", label: "Documentos" },
      { key: "acciones", label: "Acciones" },
    ],
  },
  {
    module_key: "datos",
    label: "Datos",
    description: "Permisos base para catálogos y datos maestros.",
    enabled: true,
    standardPermissions: STANDARD_PERMISSIONS,
    sensitivePermissions: [
      { key: "can_view_supplier", label: "Ver proveedores", persistedColumn: "can_view_supplier" },
      { key: "can_edit_catalogs", label: "Editar catálogos" },
      { key: "can_import_export", label: "Importar/exportar" },
    ],
    viewGroups: [
      {
        key: "data_catalog_tables",
        label: "Tablas catálogo",
        description: "Controla catálogos visibles.",
      },
      {
        key: "data_clients_projects",
        label: "Clientes / proyectos / unidades",
        description: "Controla datos de clientes, proyectos, unidades, OC y centros de costo.",
      },
      {
        key: "data_resource_catalogs",
        label: "Catálogos de recursos",
        description: "Controla tipos de recurso, unidades, marcas, proveedores y similares.",
      },
      {
        key: "data_code_legends",
        label: "Leyendas / códigos",
        description: "Controla leyendas y códigos abreviados usados en RQ y cotizaciones.",
      },
      {
        key: "data_actions",
        label: "Acciones / botones",
        description: "Controla botones operativos.",
      },
    ],
    columns: [
      { key: "clientes", label: "Clientes" },
      { key: "unidades", label: "Unidades mineras / sedes" },
      { key: "proyectos", label: "Proyectos" },
      { key: "proveedores", label: "Proveedores" },
      { key: "marcas", label: "Marcas" },
      { key: "tipos_recurso", label: "Tipos de recurso" },
      { key: "unidades_medida", label: "Unidades de medida" },
      { key: "leyenda_codigos", label: "Leyenda de códigos" },
      { key: "acciones", label: "Acciones" },
    ],
  },
];

export const MODULE_PERMISSION_OPTIONS = MODULE_PERMISSIONS_CATALOG.map((item) => ({
  key: item.module_key,
  label: item.label,
  enabled: item.enabled,
}));

export const MODULE_PERMISSION_CATALOG_BY_KEY: Record<PermissionModuleKey, ModulePermissionCatalogItem> =
  MODULE_PERMISSIONS_CATALOG.reduce(
    (acc, item) => {
      acc[item.module_key] = item;
      return acc;
    },
    {} as Record<PermissionModuleKey, ModulePermissionCatalogItem>,
  );
