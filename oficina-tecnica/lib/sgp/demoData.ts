export type EstadoCotizacion =
  | "Borrador"
  | "En revisión"
  | "No participa"
  | "Elaboración de cotización"
  | "VB Gerencia"
  | "Aprobada para envío"
  | "Enviada"
  | "Ganada"
  | "Perdida / No adjudicada"
  | "Pendiente"
  | "Adjudicado"
  | "Cancelado"
  | "No adjudicado";
export type EstadoRequerimiento = "Pendiente" | "En proceso" | "Atendido";
export type EstadoRecurso = "Activo" | "Inactivo" | "Por revisar";
export type PrioridadCotizacion = "Alta" | "Media" | "Baja";

export type CotizacionEconomicRow = {
  tipo_recurso: string;
  base: number;
  oferta: number;
  margen_ofertado_manual?: number | null;
};

export type Cotizacion = {
  id: string;
  codigo: string;
  oc: string;
  cliente: string;
  proyecto: string;
  unidad_trabajo: string;
  moneda_cotizacion: "PEN" | "USD";
  estado: EstadoCotizacion;
  estado_propuesta: string;
  solicitante: string;
  responsable_tecnico: string;
  responsable_economico: string;
  fecha_registro: string;
  fecha_presentacion: string;
  fecha_invitacion: string;
  fecha_confirmacion: string;
  fecha_visita_tecnica: string;
  fecha_consultas: string;
  fecha_abs_consultas: string;
  fecha_entrega: string;
  fecha_entregada: string;
  fecha_oc: string;
  tipo_servicio: string;
  prioridad: PrioridadCotizacion;
  avance: number;
  observaciones: string;
  resumen_economico: CotizacionEconomicRow[];
  monto: number;
  flat_mensual?: boolean;
  fecha_inicio_analisis?: string;
  fecha_fin_analisis?: string;
  meses_analisis?: number | null;
};

export type Requerimiento = {
  id: string;
  codigo: string;
  cotizacion_id: string;
  cotizacion_codigo?: string;
  codigo_cliente?: string;
  codigo_unidad?: string;
  proyecto_servicio?: string;
  oc?: string;
  codigo_proyecto_adjudicado?: string;
  anio?: number;
  solicitante_rq: string;
  tipo_servicio: string;
  area: string;
  estado: EstadoRequerimiento;
  fecha_solicitud: string;
  fecha_requerida: string;
  responsable: string;
  avance?: number;
  total_rq?: number;
  observaciones: string;
};

export type DetalleRequerimientoItem = {
  id: string;
  requerimiento_id: string;
  recurso_id: string;
  historical_item_source?: {
    tipo_recurso?: string;
    codigo_fabricante?: string;
    descripcion?: string;
    a_suministrar?: string;
    unidad?: string;
    cantidad?: number;
    ajuste?: number;
    atencion_real?: number;
    cant_stock?: number;
    compra?: number;
    precio_unitario?: number;
    costo_unitario_dolar?: number;
    costo_unitario_soles?: number;
    tipo_cambio?: number;
    costo_total_presupuestado?: number;
    costo_total_presupuestado_usd?: number;
    moneda?: "PEN" | "USD";
    observaciones_item?: string;
  };
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  ajuste: number;
  atencion_real: number;
  cant_stock: number;
  compra: number;
  costo_unitario: number;
  moneda: "PEN" | "USD";
  tc: number;
  factor_eq_herr: number;
  costo_total_presupuestado: number;
  fecha_coti: string;
  estado: string;
  informacion_adicional: string;
  observaciones_item: string;
  recurso_a_suministrar: string;
  recurso_ficha_tecnica_files?: ResourceFileMeta[];
  recurso_imagen_files?: ResourceFileMeta[];
  recurso_archivos?: ResourceFileMeta[];
  ficha_tecnica_a_suministrar: ResourceFileMeta | null;
  ficha_tecnica_a_suministrar_files?: ResourceFileMeta[];
  a_suministrar?: string;
  ficha_tecnica_suministrar?: ResourceFileMeta | null;
  proveedor: string;
  condicion_pago: string;
  tiempo_entrega: string;
  eq: string;
  eq_fecha_aprob: string;
  ll: string;
  ll_fecha_aprob: string;
  hb: string;
  hb_fecha_aprob: string;
  logistica_compra: string;
  fecha_compra: string;
  oc_os_recurso: string;
  fecha_entrega: string;
  guia_remision: string;
  archivo_guia: ResourceFileMeta | null;
  archivo_guia_files?: ResourceFileMeta[];
};

export type ResourceFileMeta = {
  name: string;
  size: number;
  type: string;
  localPreviewUrl: string;
  futureDriveFileId: string;
  futureDriveUrl: string;
  bucket_id?: string;
  storage_path?: string;
  file_name?: string;
  file_type?: "image" | "datasheet" | "attachment" | string;
  mime_type?: string;
  uploaded_at?: string;
};

export type ResourceFiles = {
  fichaTecnica: ResourceFileMeta | null;
  imagen: ResourceFileMeta | null;
  fichasTecnicas?: ResourceFileMeta[];
  imagenes?: ResourceFileMeta[];
  archivos: ResourceFileMeta[];
};

export type Recurso = {
  id: string;
  codigo_recurso: string;
  codigo_eka: string;
  codigo_fabricante: string;
  tipo_recurso: string;
  descripcion: string;
  unidad: string;
  precio_unitario_ref: number;
  moneda: "PEN" | "USD";
  proveedor: string;
  marca: string;
  modelo: string;
  tiempo_entrega_ref: string;
  ficha_tecnica: string;
  imagen: string;
  archivos: string;
  estado: EstadoRecurso;
  fecha_actualizacion: string;
  observaciones: string;
  resourceFiles: ResourceFiles;
};

export type CatalogTipoRecurso = {
  id: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  orden: number;
  observaciones: string;
};

export type CatalogUnidad = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

export type CatalogMarca = {
  id: string;
  nombre: string;
  activo: boolean;
  observaciones: string;
};

export type CatalogProveedor = {
  id: string;
  nombre: string;
  ruc: string;
  contacto: string;
  telefono: string;
  email: string;
  tiempo_entrega_ref: string;
  activo: boolean;
  observaciones: string;
};

export type CatalogMoneda = {
  id: string;
  codigo: string;
  simbolo: string;
  nombre: string;
  activo: boolean;
};

export type CatalogEstadoRecurso = {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

export type CatalogEstadoDetalleRq = {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

export type CatalogAprobacionItem = {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

export type CatalogLogisticaCompraItem = {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

export type CatalogSolicitanteRq = {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

export type CatalogSolicitanteCotizacion = {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

export type CatalogEstadoCotizacion = {
  id: string;
  nombre: EstadoCotizacion;
  activo: boolean;
  orden: number;
};

export type CatalogCodigoCliente = {
  id: string;
  cliente: string;
  codigo_cliente: string;
  estado: string;
  observaciones: string;
  activo: boolean;
};

export type CatalogCodigoUnidadTrabajo = {
  id: string;
  unidad_trabajo: string;
  codigo_unidad: string;
  estado: string;
  observaciones: string;
  activo: boolean;
};

export type ProyectoAdjudicado = {
  id: string;
  anio: number;
  codigo_proyecto: string;
  cotizacion: string;
  oc: string;
  cliente: string;
  codigo_cliente: string;
  unidad_trabajo: string;
  codigo_unidad: string;
  fecha_adjudicacion: string;
  estado: string;
  activo: boolean;
};

export type CatalogTipoServicio = {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

export type CatalogArea = {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

const clientes = [
  "NEXA RESOURCES",
  "MINERA HORIZONTE",
  "PLANTA ALFA",
  "CONSTRUCTORA DELTA",
  "METALMECANICA SUR",
  "ENERGIA NORTE",
  "INGENIERIA ATLAS",
  "SERVICIOS INDUSTRIALES K2",
];

const proyectos = [
  "Mantenimiento eléctrico",
  "Tablero principal BT",
  "Automatización de bombeo",
  "Modernización subestación",
  "Control de motores",
  "Canalización de fuerza",
  "Upgrade sala MCC",
  "Integración de PLC",
];

const unidadesTrabajo = [
  "Planta concentradora",
  "Mina subterránea",
  "Taller eléctrico",
  "Subestación",
  "Línea de transmisión",
  "Área de mantenimiento",
  "Poza 5",
  "Chancado",
  "Molienda",
];

const responsables = [
  "Edwin Quispe",
  "Carmen Diaz",
  "Luis Ramos",
  "Jorge Ruiz",
  "Ana Paredes",
  "Marco Salas",
  "Patricia Leon",
  "Diego Flores",
];

const solicitantesRq = [
  "Luis Ramos",
  "Edwin Quispe",
  "Saul Sayas",
  "Henry Bonifacio",
  "Oficina técnica",
  "Gerencia",
  "Logística",
];

const statesCotizacion: EstadoCotizacion[] = [
  "Borrador",
  "En revisión",
  "No participa",
  "Elaboración de cotización",
  "VB Gerencia",
  "Aprobada para envío",
  "Enviada",
  "Ganada",
  "Perdida / No adjudicada",
];
const statesRequerimiento: EstadoRequerimiento[] = ["Pendiente", "En proceso", "Atendido"];
const statesRecurso: EstadoRecurso[] = ["Activo", "Inactivo", "Por revisar"];

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextNumericId(items: { id: string }[], prefix: string): string {
  const raw = items
    .map((it) => Number(it.id.replace(/^\D+/g, "").replace("-", "")))
    .filter((n) => !Number.isNaN(n));
  const max = raw.length > 0 ? Math.max(...raw) : 0;
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function nextLocalUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function fileMeta(name: string, type = "application/octet-stream", size = 0): ResourceFileMeta {
  return {
    name,
    size,
    type,
    localPreviewUrl: "",
    futureDriveFileId: "",
    futureDriveUrl: "",
  };
}

const catalogTipoRecurso: CatalogTipoRecurso[] = [
  { id: "tr-001", nombre: "Mano de obra directa", codigo: "MOD", activo: true, orden: 1, observaciones: "" },
  { id: "tr-002", nombre: "Mano de obra indirecta", codigo: "MOI", activo: true, orden: 2, observaciones: "" },
  { id: "tr-003", nombre: "EPPs", codigo: "EPP", activo: true, orden: 3, observaciones: "" },
  { id: "tr-004", nombre: "Examen médico", codigo: "EXM", activo: true, orden: 4, observaciones: "" },
  { id: "tr-005", nombre: "Capacitaciones", codigo: "CAP", activo: true, orden: 5, observaciones: "" },
  { id: "tr-006", nombre: "Cursos de inducción", codigo: "CIN", activo: true, orden: 6, observaciones: "" },
  { id: "tr-007", nombre: "Cursos EKA", codigo: "CEK", activo: true, orden: 7, observaciones: "" },
  { id: "tr-008", nombre: "Lavado de uniforme", codigo: "LAV", activo: true, orden: 8, observaciones: "" },
  { id: "tr-009", nombre: "Alimentación", codigo: "ALI", activo: true, orden: 9, observaciones: "" },
  { id: "tr-010", nombre: "Reglamento de ingreso", codigo: "REG", activo: true, orden: 10, observaciones: "" },
  { id: "tr-011", nombre: "Antecedentes policiales", codigo: "ANT", activo: true, orden: 11, observaciones: "" },
  { id: "tr-012", nombre: "Materiales", codigo: "MAT", activo: true, orden: 12, observaciones: "" },
  { id: "tr-013", nombre: "Consumibles", codigo: "CON", activo: true, orden: 13, observaciones: "" },
  { id: "tr-014", nombre: "Herramientas", codigo: "HER", activo: true, orden: 14, observaciones: "" },
  { id: "tr-015", nombre: "Equipos", codigo: "EQP", activo: true, orden: 15, observaciones: "" },
  { id: "tr-016", nombre: "Vehículos", codigo: "VEH", activo: true, orden: 16, observaciones: "" },
  { id: "tr-017", nombre: "Transporte", codigo: "TRA", activo: true, orden: 17, observaciones: "" },
  { id: "tr-018", nombre: "Sub contratos", codigo: "SUB", activo: true, orden: 18, observaciones: "" },
  { id: "tr-019", nombre: "Gastos generales", codigo: "GGA", activo: true, orden: 19, observaciones: "" },
];

const catalogUnidades: CatalogUnidad[] = [
  { id: "un-001", codigo: "und", nombre: "Unidad", activo: true, orden: 1 },
  { id: "un-002", codigo: "m", nombre: "Metro", activo: true, orden: 2 },
  { id: "un-003", codigo: "m2", nombre: "Metro cuadrado", activo: true, orden: 3 },
  { id: "un-004", codigo: "m3", nombre: "Metro cúbico", activo: true, orden: 4 },
  { id: "un-005", codigo: "kg", nombre: "Kilogramo", activo: true, orden: 5 },
  { id: "un-006", codigo: "glb", nombre: "Global", activo: true, orden: 6 },
  { id: "un-007", codigo: "día", nombre: "Día", activo: true, orden: 7 },
  { id: "un-008", codigo: "mes", nombre: "Mes", activo: true, orden: 8 },
  { id: "un-009", codigo: "h", nombre: "Hora", activo: true, orden: 9 },
  { id: "un-010", codigo: "juego", nombre: "Juego", activo: true, orden: 10 },
  { id: "un-011", codigo: "lote", nombre: "Lote", activo: true, orden: 11 },
];

const catalogMarcas: CatalogMarca[] = [
  { id: "mk-001", nombre: "Schneider", activo: true, observaciones: "" },
  { id: "mk-002", nombre: "Indeco", activo: true, observaciones: "" },
  { id: "mk-003", nombre: "3M", activo: true, observaciones: "" },
  { id: "mk-004", nombre: "Fluke", activo: true, observaciones: "" },
  { id: "mk-005", nombre: "Siemens", activo: true, observaciones: "" },
  { id: "mk-006", nombre: "ABB", activo: true, observaciones: "" },
  { id: "mk-007", nombre: "Genérico", activo: true, observaciones: "" },
  { id: "mk-008", nombre: "Sin marca", activo: true, observaciones: "" },
];

const catalogProveedores: CatalogProveedor[] = [
  {
    id: "pv-001",
    nombre: "Suministros Lima",
    ruc: "20490011111",
    contacto: "Paula Torres",
    telefono: "999111222",
    email: "ventas@suministroslima.pe",
    tiempo_entrega_ref: "3 días",
    activo: true,
    observaciones: "",
  },
  {
    id: "pv-002",
    nombre: "ElectroSur",
    ruc: "20510022222",
    contacto: "Carlos Vega",
    telefono: "988222333",
    email: "contacto@electrosur.pe",
    tiempo_entrega_ref: "7 días",
    activo: true,
    observaciones: "",
  },
  {
    id: "pv-003",
    nombre: "Proveedor Industrial",
    ruc: "20630033333",
    contacto: "Daniel Flores",
    telefono: "977333444",
    email: "logistica@proveedorindustrial.pe",
    tiempo_entrega_ref: "5 días",
    activo: true,
    observaciones: "",
  },
  {
    id: "pv-004",
    nombre: "Servicios Técnicos",
    ruc: "20480044444",
    contacto: "Luz Perez",
    telefono: "966444555",
    email: "operaciones@servtecnicos.pe",
    tiempo_entrega_ref: "10 días",
    activo: true,
    observaciones: "",
  },
  {
    id: "pv-005",
    nombre: "Ferretería Central",
    ruc: "20470055555",
    contacto: "Mario Reyes",
    telefono: "955555666",
    email: "compras@ferreteriacentral.pe",
    tiempo_entrega_ref: "4 días",
    activo: true,
    observaciones: "",
  },
];

const catalogMonedas: CatalogMoneda[] = [
  { id: "mo-001", codigo: "PEN", simbolo: "S/", nombre: "Sol peruano", activo: true },
  { id: "mo-002", codigo: "USD", simbolo: "US$", nombre: "Dólar americano", activo: true },
];

const catalogEstadosRecurso: CatalogEstadoRecurso[] = [
  { id: "er-001", nombre: "Activo", activo: true, orden: 1 },
  { id: "er-002", nombre: "Inactivo", activo: true, orden: 2 },
  { id: "er-003", nombre: "Por revisar", activo: true, orden: 3 },
];

const catalogEstadoDetalleRq: CatalogEstadoDetalleRq[] = [
  { id: "ed-001", nombre: "Pendiente", activo: true, orden: 1 },
  { id: "ed-002", nombre: "En proceso", activo: true, orden: 2 },
  { id: "ed-003", nombre: "Atendido", activo: true, orden: 3 },
];

const catalogEq: CatalogAprobacionItem[] = [
  { id: "eq-001", nombre: "Pendiente", activo: true, orden: 1 },
  { id: "eq-002", nombre: "Aprobado", activo: true, orden: 2 },
  { id: "eq-003", nombre: "Observado", activo: true, orden: 3 },
];

const catalogLl: CatalogAprobacionItem[] = [
  { id: "ll-001", nombre: "Pendiente", activo: true, orden: 1 },
  { id: "ll-002", nombre: "Aprobado", activo: true, orden: 2 },
  { id: "ll-003", nombre: "Observado", activo: true, orden: 3 },
];

const catalogHb: CatalogAprobacionItem[] = [
  { id: "hb-001", nombre: "Pendiente", activo: true, orden: 1 },
  { id: "hb-002", nombre: "Aprobado", activo: true, orden: 2 },
  { id: "hb-003", nombre: "Observado", activo: true, orden: 3 },
];

const catalogLogisticaCompra: CatalogLogisticaCompraItem[] = [
  { id: "lg-001", nombre: "Pendiente compra", activo: true, orden: 1 },
  { id: "lg-002", nombre: "Comprado", activo: true, orden: 2 },
  { id: "lg-003", nombre: "En tránsito", activo: true, orden: 3 },
  { id: "lg-004", nombre: "Entregado", activo: true, orden: 4 },
];

const catalogTipoServicio: CatalogTipoServicio[] = [
  { id: "ts-001", nombre: "Mantenimiento eléctrico", activo: true, orden: 1 },
  { id: "ts-002", nombre: "Montaje electromecánico", activo: true, orden: 2 },
  { id: "ts-003", nombre: "Ingeniería", activo: true, orden: 3 },
  { id: "ts-004", nombre: "Suministro", activo: true, orden: 4 },
  { id: "ts-005", nombre: "Servicio especializado", activo: true, orden: 5 },
  { id: "ts-006", nombre: "Construcción", activo: true, orden: 6 },
  { id: "ts-007", nombre: "Pruebas y comisionamiento", activo: true, orden: 7 },
  { id: "ts-008", nombre: "Otro", activo: true, orden: 8 },
];

const catalogArea: CatalogArea[] = [
  { id: "ar-001", nombre: "Operaciones", activo: true, orden: 1 },
  { id: "ar-002", nombre: "Mantenimiento", activo: true, orden: 2 },
  { id: "ar-003", nombre: "Logística", activo: true, orden: 3 },
  { id: "ar-004", nombre: "Oficina técnica", activo: true, orden: 4 },
  { id: "ar-005", nombre: "Seguridad", activo: true, orden: 5 },
  { id: "ar-006", nombre: "Calidad", activo: true, orden: 6 },
  { id: "ar-007", nombre: "Administración", activo: true, orden: 7 },
  { id: "ar-008", nombre: "Gerencia", activo: true, orden: 8 },
  { id: "ar-009", nombre: "Campo", activo: true, orden: 9 },
  { id: "ar-010", nombre: "Almacén", activo: true, orden: 10 },
];

const catalogSolicitanteRq: CatalogSolicitanteRq[] = [
  { id: "srq-001", nombre: "Luis Ramos", activo: true, orden: 1 },
  { id: "srq-002", nombre: "Edwin Quispe", activo: true, orden: 2 },
  { id: "srq-003", nombre: "Saul Sayas", activo: true, orden: 3 },
  { id: "srq-004", nombre: "Henry Bonifacio", activo: true, orden: 4 },
  { id: "srq-005", nombre: "Oficina técnica", activo: true, orden: 5 },
  { id: "srq-006", nombre: "Gerencia", activo: true, orden: 6 },
  { id: "srq-007", nombre: "Logística", activo: true, orden: 7 },
];

const catalogSolicitanteCotizacion: CatalogSolicitanteCotizacion[] = [
  { id: "scot-001", nombre: "Luis Ramos", activo: true, orden: 1 },
  { id: "scot-002", nombre: "Edwin Quispe", activo: true, orden: 2 },
  { id: "scot-003", nombre: "Saul Sayas", activo: true, orden: 3 },
  { id: "scot-004", nombre: "Henry Bonifacio", activo: true, orden: 4 },
  { id: "scot-005", nombre: "Oficina técnica", activo: true, orden: 5 },
  { id: "scot-006", nombre: "Gerencia", activo: true, orden: 6 },
  { id: "scot-007", nombre: "Logística", activo: true, orden: 7 },
];

const catalogEstadoCotizacion: CatalogEstadoCotizacion[] = [
  { id: "ecot-001", nombre: "Borrador", activo: true, orden: 1 },
  { id: "ecot-002", nombre: "En revisión", activo: true, orden: 2 },
  { id: "ecot-003", nombre: "No participa", activo: true, orden: 3 },
  { id: "ecot-004", nombre: "Elaboración de cotización", activo: true, orden: 4 },
  { id: "ecot-005", nombre: "VB Gerencia", activo: true, orden: 5 },
  { id: "ecot-006", nombre: "Aprobada para envío", activo: true, orden: 6 },
  { id: "ecot-007", nombre: "Enviada", activo: true, orden: 7 },
  { id: "ecot-008", nombre: "Ganada", activo: true, orden: 8 },
  { id: "ecot-009", nombre: "Perdida / No adjudicada", activo: true, orden: 9 },

  // Estados históricos: se conservan para visualizar registros antiguos, pero no habilitan RQ.
  { id: "ecot-090", nombre: "Pendiente", activo: false, orden: 90 },
  { id: "ecot-091", nombre: "Adjudicado", activo: false, orden: 91 },
  { id: "ecot-092", nombre: "Cancelado", activo: false, orden: 92 },
  { id: "ecot-093", nombre: "No adjudicado", activo: false, orden: 93 },
];
const catalogCodigoClientes: CatalogCodigoCliente[] = [
  { id: "cc-001", cliente: "NEXA RESOURCES", codigo_cliente: "NEXA", estado: "Activo", observaciones: "", activo: true },
  {
    id: "cc-002",
    cliente: "MINERA HORIZONTE",
    codigo_cliente: "MHOR",
    estado: "Activo",
    observaciones: "",
    activo: true,
  },
  { id: "cc-003", cliente: "PLANTA ALFA", codigo_cliente: "PALF", estado: "Activo", observaciones: "", activo: true },
  {
    id: "cc-004",
    cliente: "CONSTRUCTORA DELTA",
    codigo_cliente: "CDELTA",
    estado: "Activo",
    observaciones: "",
    activo: true,
  },
  {
    id: "cc-005",
    cliente: "METALMECANICA SUR",
    codigo_cliente: "MSUR",
    estado: "Activo",
    observaciones: "",
    activo: true,
  },
  { id: "cc-006", cliente: "ENERGIA NORTE", codigo_cliente: "ENORTE", estado: "Activo", observaciones: "", activo: true },
];

const catalogCodigoUnidadesTrabajo: CatalogCodigoUnidadTrabajo[] = [
  {
    id: "cu-001",
    unidad_trabajo: "Planta concentradora",
    codigo_unidad: "PCON",
    estado: "Activo",
    observaciones: "",
    activo: true,
  },
  {
    id: "cu-002",
    unidad_trabajo: "Mina subterránea",
    codigo_unidad: "MSUB",
    estado: "Activo",
    observaciones: "",
    activo: true,
  },
  {
    id: "cu-003",
    unidad_trabajo: "Taller eléctrico",
    codigo_unidad: "TELE",
    estado: "Activo",
    observaciones: "",
    activo: true,
  },
  { id: "cu-004", unidad_trabajo: "Subestación", codigo_unidad: "SSEE", estado: "Activo", observaciones: "", activo: true },
  {
    id: "cu-005",
    unidad_trabajo: "Línea de transmisión",
    codigo_unidad: "LTRA",
    estado: "Activo",
    observaciones: "",
    activo: true,
  },
  {
    id: "cu-006",
    unidad_trabajo: "Área de mantenimiento",
    codigo_unidad: "AMANT",
    estado: "Activo",
    observaciones: "",
    activo: true,
  },
  { id: "cu-007", unidad_trabajo: "Poza 5", codigo_unidad: "PZ5", estado: "Activo", observaciones: "", activo: true },
  { id: "cu-008", unidad_trabajo: "Chancado", codigo_unidad: "CHAN", estado: "Activo", observaciones: "", activo: true },
  { id: "cu-009", unidad_trabajo: "Molienda", codigo_unidad: "MOLI", estado: "Activo", observaciones: "", activo: true },
];

const proyectosAdjudicados: ProyectoAdjudicado[] = [
  {
    id: "pa-001",
    anio: 2026,
    codigo_proyecto: "P001",
    cotizacion: "COT-2026-0001",
    oc: "OC-2026-0001",
    cliente: "NEXA RESOURCES",
    codigo_cliente: "NEXA",
    unidad_trabajo: "Planta concentradora",
    codigo_unidad: "PCON",
    fecha_adjudicacion: "2026-05-10",
    estado: "Activo",
    activo: true,
  },
  {
    id: "pa-002",
    anio: 2026,
    codigo_proyecto: "P002",
    cotizacion: "COT-2026-0002",
    oc: "OC-2026-0002",
    cliente: "MINERA HORIZONTE",
    codigo_cliente: "MHOR",
    unidad_trabajo: "Mina subterránea",
    codigo_unidad: "MSUB",
    fecha_adjudicacion: "2026-05-11",
    estado: "Activo",
    activo: true,
  },
];

const recursosBase: Recurso[] = [
  {
    id: "rec-001",
    codigo_recurso: "REC-2026-0001",
    codigo_eka: "EKA-MAT-001",
    codigo_fabricante: "IND-N2XOH-316",
    tipo_recurso: "Materiales",
    descripcion: "Cable N2XOH 3x16 mm2",
    unidad: "m",
    precio_unitario_ref: 19.8,
    moneda: "PEN",
    proveedor: "Suministros Lima",
    marca: "Indeco",
    modelo: "N2XOH-316",
    tiempo_entrega_ref: "3 días",
    ficha_tecnica: "Ficha_Cable_N2XOH.pdf",
    imagen: "img_cable_n2xoh.jpg",
    archivos: "Certificado_calidad.pdf",
    estado: "Activo",
    fecha_actualizacion: "2026-05-14",
    observaciones: "Uso en circuitos de potencia.",
    resourceFiles: {
      fichaTecnica: fileMeta("Ficha_Cable_N2XOH.pdf", "application/pdf", 125000),
      imagen: fileMeta("img_cable_n2xoh.jpg", "image/jpeg", 88000),
      archivos: [fileMeta("Certificado_calidad.pdf", "application/pdf", 92000)],
    },
  },
  {
    id: "rec-002",
    codigo_recurso: "REC-2026-0002",
    codigo_eka: "EKA-EQP-014",
    codigo_fabricante: "SCH-TAB-24P",
    tipo_recurso: "Equipos",
    descripcion: "Tablero eléctrico adosado 24 polos",
    unidad: "und",
    precio_unitario_ref: 1280,
    moneda: "PEN",
    proveedor: "ElectroSur",
    marca: "Schneider",
    modelo: "Prisma 24P",
    tiempo_entrega_ref: "7 días",
    ficha_tecnica: "Ficha_Tablero_24P.pdf",
    imagen: "img_tablero_24p.jpg",
    archivos: "Plano_tablero.dwg",
    estado: "Activo",
    fecha_actualizacion: "2026-05-14",
    observaciones: "Incluye riel DIN y borneras.",
    resourceFiles: {
      fichaTecnica: fileMeta("Ficha_Tablero_24P.pdf", "application/pdf", 99000),
      imagen: fileMeta("img_tablero_24p.jpg", "image/jpeg", 110000),
      archivos: [fileMeta("Plano_tablero.dwg", "application/acad", 200000)],
    },
  },
  {
    id: "rec-003",
    codigo_recurso: "REC-2026-0003",
    codigo_eka: "EKA-HER-003",
    codigo_fabricante: "FLK-17BMAX",
    tipo_recurso: "Herramientas",
    descripcion: "Multímetro digital",
    unidad: "und",
    precio_unitario_ref: 185,
    moneda: "USD",
    proveedor: "Proveedor Industrial",
    marca: "Fluke",
    modelo: "17B Max",
    tiempo_entrega_ref: "5 días",
    ficha_tecnica: "Ficha_Fluke_17B.pdf",
    imagen: "img_fluke_17b.jpg",
    archivos: "Manual_uso_fluke.pdf",
    estado: "Por revisar",
    fecha_actualizacion: "2026-05-13",
    observaciones: "Validar calibración anual.",
    resourceFiles: {
      fichaTecnica: fileMeta("Ficha_Fluke_17B.pdf", "application/pdf", 101000),
      imagen: fileMeta("img_fluke_17b.jpg", "image/jpeg", 98000),
      archivos: [fileMeta("Manual_uso_fluke.pdf", "application/pdf", 64000)],
    },
  },
  {
    id: "rec-004",
    codigo_recurso: "REC-2026-0004",
    codigo_eka: "EKA-CON-022",
    codigo_fabricante: "3M-TA-18",
    tipo_recurso: "Consumibles",
    descripcion: "Cinta aislante 3M",
    unidad: "und",
    precio_unitario_ref: 8.7,
    moneda: "PEN",
    proveedor: "Suministros Lima",
    marca: "3M",
    modelo: "Temflex 1700",
    tiempo_entrega_ref: "2 días",
    ficha_tecnica: "Ficha_Cinta_3M.pdf",
    imagen: "img_cinta_3m.jpg",
    archivos: "",
    estado: "Activo",
    fecha_actualizacion: "2026-05-12",
    observaciones: "",
    resourceFiles: {
      fichaTecnica: fileMeta("Ficha_Cinta_3M.pdf", "application/pdf", 40000),
      imagen: fileMeta("img_cinta_3m.jpg", "image/jpeg", 50000),
      archivos: [],
    },
  },
  {
    id: "rec-005",
    codigo_recurso: "REC-2026-0005",
    codigo_eka: "EKA-SRV-008",
    codigo_fabricante: "SRV-MANT-ELEC",
    tipo_recurso: "Sub contratos",
    descripcion: "Servicio de mantenimiento eléctrico",
    unidad: "glb",
    precio_unitario_ref: 4200,
    moneda: "PEN",
    proveedor: "Servicios Técnicos",
    marca: "Sin marca",
    modelo: "N/A",
    tiempo_entrega_ref: "10 días",
    ficha_tecnica: "Alcance_mantenimiento.docx",
    imagen: "",
    archivos: "SLA_servicio.pdf",
    estado: "Activo",
    fecha_actualizacion: "2026-05-14",
    observaciones: "Incluye inspección y reporte.",
    resourceFiles: {
      fichaTecnica: fileMeta("Alcance_mantenimiento.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 51000),
      imagen: null,
      archivos: [fileMeta("SLA_servicio.pdf", "application/pdf", 79000)],
    },
  },
];

const recursosGenerados: Recurso[] = Array.from({ length: 25 }, (_, i) => {
  const idx = i + 6;
  const tipo = catalogTipoRecurso[i % catalogTipoRecurso.length].nombre;
  const unidad = catalogUnidades[i % catalogUnidades.length].codigo;
  const proveedor = catalogProveedores[i % catalogProveedores.length];
  const marca = catalogMarcas[i % catalogMarcas.length].nombre;
  const moneda: "PEN" | "USD" = i % 5 === 0 ? "USD" : "PEN";
  const withDocs = i % 3 === 0;
  return {
    id: `rec-${String(idx).padStart(3, "0")}`,
    codigo_recurso: `REC-2026-${String(idx).padStart(4, "0")}`,
    codigo_eka: `EKA-${tipo.slice(0, 3).toUpperCase()}-${String(idx).padStart(3, "0")}`,
    codigo_fabricante: `FAB-${String(idx).padStart(4, "0")}`,
    tipo_recurso: tipo,
    descripcion: `${tipo} demo ${idx}`,
    unidad,
    precio_unitario_ref: Number((25 + idx * 6.2).toFixed(2)),
    moneda,
    proveedor: proveedor.nombre,
    marca,
    modelo: `M-${String(idx).padStart(3, "0")}`,
    tiempo_entrega_ref: `${(idx % 12) + 1} días`,
    ficha_tecnica: withDocs ? `Ficha_${idx}.pdf` : "",
    imagen: withDocs ? `img_${idx}.jpg` : "",
    archivos: withDocs ? `adjunto_${idx}.pdf` : "",
    estado: statesRecurso[i % statesRecurso.length],
    fecha_actualizacion: addDays(new Date("2026-05-01"), i),
    observaciones: i % 2 === 0 ? "Demo catálogo local." : "",
    resourceFiles: {
      fichaTecnica: withDocs ? fileMeta(`Ficha_${idx}.pdf`, "application/pdf", 45000) : null,
      imagen: withDocs ? fileMeta(`img_${idx}.jpg`, "image/jpeg", 60000) : null,
      archivos: withDocs ? [fileMeta(`adjunto_${idx}.pdf`, "application/pdf", 70000)] : [],
    },
  };
});

const recursos: Recurso[] = [...recursosBase, ...recursosGenerados];

const prioridadesCotizacion: PrioridadCotizacion[] = ["Alta", "Media", "Baja"];
const tiposResumenEconomico = [
  "Mano de obra directa",
  "Mano de obra indirecta",
  "EPPs",
  "Examen médico",
  "Capacitaciones",
  "Cursos de inducción",
  "Cursos EKA",
  "Lavado de uniforme",
  "Alimentación",
  "Reglamento de ingreso",
  "Antecedentes policiales",
  "Materiales",
  "Consumibles",
  "Herramientas",
  "Equipos",
  "Vehículos",
  "Transporte",
  "Sub contratos",
  "Gastos generales",
  "Utilidades",
] as const;

function buildDefaultEconomicSummary(): CotizacionEconomicRow[] {
  return tiposResumenEconomico.map((tipo) => ({
    tipo_recurso: tipo,
    base: 0,
    oferta: 0,
    margen_ofertado_manual: null,
  }));
}

const cotizaciones: Cotizacion[] = Array.from({ length: 50 }, (_, i) => {
  const idx = i + 1;
  return {
    id: `cot-${String(idx).padStart(3, "0")}`,
    codigo: `COT-2026-${String(idx).padStart(4, "0")}`,
    oc: `OC-2026-${String(idx).padStart(4, "0")}`,
    cliente: clientes[i % clientes.length],
    proyecto: proyectos[i % proyectos.length],
    unidad_trabajo: unidadesTrabajo[i % unidadesTrabajo.length],
    moneda_cotizacion: i % 4 === 0 ? "USD" : "PEN",
    estado: i === 0 ? "Adjudicado" : statesCotizacion[i % statesCotizacion.length],
    estado_propuesta: i % 2 === 0 ? "Rev. Bases" : "Visita Técnica",
    solicitante: catalogSolicitanteCotizacion[i % catalogSolicitanteCotizacion.length].nombre,
    responsable_tecnico: responsables[i % responsables.length],
    responsable_economico: responsables[(i + 3) % responsables.length],
    tipo_servicio: catalogTipoServicio[i % catalogTipoServicio.length].nombre,
    prioridad: prioridadesCotizacion[i % prioridadesCotizacion.length],
    fecha_registro: addDays(new Date("2026-04-15"), i),
    fecha_confirmacion: addDays(new Date("2026-04-24"), i),
    fecha_visita_tecnica: addDays(new Date("2026-04-27"), i),
    fecha_consultas: addDays(new Date("2026-04-29"), i),
    fecha_abs_consultas: addDays(new Date("2026-04-30"), i),
    fecha_invitacion: addDays(new Date("2026-04-20"), i),
    fecha_presentacion: addDays(new Date("2026-05-01"), i),
    fecha_entrega: addDays(new Date("2026-05-08"), i),
    fecha_entregada: addDays(new Date("2026-05-09"), i),
    fecha_oc: addDays(new Date("2026-05-10"), i),
    observaciones: `Cotización demo ${idx}.`,
    avance: (i * 7) % 100,
    resumen_economico: buildDefaultEconomicSummary(),
    monto: Number((18000 + (i % 10) * 6400 + idx * 175).toFixed(2)),
    flat_mensual: idx === 1,
    fecha_inicio_analisis: idx === 1 ? "2026-04-01" : "",
    fecha_fin_analisis: idx === 1 ? "2026-12-31" : "",
    meses_analisis: idx === 1 ? 9 : null,
  };
});

const seedRqCorrelativosByProject = new Map<string, number>();

const requerimientos: Requerimiento[] = Array.from({ length: 50 }, (_, i) => {
  const idx = i + 1;
  const cotIdx = (i % 25) + 1;
  const cotizacion = cotizaciones[cotIdx - 1];
  const codigoCliente =
    catalogCodigoClientes.find((item) => sameText(item.cliente, cotizacion.cliente))?.codigo_cliente ?? "DEMO";
  const codigoUnidad =
    catalogCodigoUnidadesTrabajo.find((item) => sameText(item.unidad_trabajo, cotizacion.unidad_trabajo))?.codigo_unidad ??
    "DEMO";
  const projectCode = `P${String(cotIdx).padStart(3, "0")}`;
  const correlativoActual = seedRqCorrelativosByProject.get(projectCode) ?? 0;
  const correlativo = String(correlativoActual + 1).padStart(4, "0");
  seedRqCorrelativosByProject.set(projectCode, correlativoActual + 1);
  const codigoRq = `RQ-2026-${normalizeToken(codigoCliente)}-${normalizeToken(codigoUnidad)}-${projectCode}-${correlativo}`;

  return {
    id: `rq-${String(idx).padStart(3, "0")}`,
    codigo: codigoRq,
    cotizacion_id: `cot-${String(cotIdx).padStart(3, "0")}`,
    solicitante_rq: solicitantesRq[i % solicitantesRq.length],
    tipo_servicio: catalogTipoServicio[i % catalogTipoServicio.length].nombre,
    area: catalogArea[i % catalogArea.length].nombre,
    estado: statesRequerimiento[i % statesRequerimiento.length],
    fecha_solicitud: addDays(new Date("2026-05-01"), i),
    fecha_requerida: addDays(new Date("2026-05-10"), i + 2),
    responsable: responsables[(i + 2) % responsables.length],
    observaciones: `Gestionar prioridad ${((i % 3) + 1).toString()}.`,
    cotizacion_codigo: `COT-2026-${String(cotIdx).padStart(4, "0")}`,
    proyecto_servicio: proyectos[(cotIdx - 1) % proyectos.length],
    oc: `OC-2026-${String(cotIdx).padStart(4, "0")}`,
    avance: 0,
    total_rq: 0,
  };
});

const detalleItems: DetalleRequerimientoItem[] = requerimientos.flatMap((rq, i) => {
  const rows = (i % 3) + 2;
  return Array.from({ length: rows }, (_, row) => {
    const recurso = recursos[(i * 3 + row) % recursos.length];
    const cantidad = ((i + row) % 7) + 1;
    const precio = recurso.precio_unitario_ref + row * 1.5;
    const subtotal = Number((cantidad * precio).toFixed(2));
    const proveedorInfo = catalogProveedores.find((item) => item.nombre === recurso.proveedor);
    return {
      id: `dtrq-${String(i * 3 + row + 1).padStart(4, "0")}`,
      requerimiento_id: rq.id,
      recurso_id: recurso.id,
      cantidad,
      precio_unitario: Number(precio.toFixed(2)),
      subtotal,
      ajuste: 0,
      atencion_real: cantidad,
      cant_stock: row % 2 === 0 ? Math.max(0, cantidad - 1) : 0,
      compra: Math.max(0, cantidad - (row % 2 === 0 ? cantidad - 1 : 0)),
      costo_unitario: Number(precio.toFixed(2)),
      moneda: recurso.moneda,
      tc: 1,
      factor_eq_herr: 1,
      costo_total_presupuestado: subtotal,
      fecha_coti: addDays(new Date("2026-05-03"), i + row),
      estado: row % 3 === 0 ? "Pendiente" : row % 3 === 1 ? "En proceso" : "Atendido",
      informacion_adicional: `${recurso.marca} ${recurso.modelo}`.trim(),
      observaciones_item: recurso.observaciones,
      recurso_a_suministrar: recurso.descripcion,
      ficha_tecnica_a_suministrar: recurso.resourceFiles.fichaTecnica,
      proveedor: proveedorInfo?.nombre ?? recurso.proveedor,
      condicion_pago: "30 días",
      tiempo_entrega: proveedorInfo?.tiempo_entrega_ref ?? recurso.tiempo_entrega_ref,
      eq: row % 2 === 0 ? "Aprobado" : "Pendiente",
      eq_fecha_aprob: row % 2 === 0 ? addDays(new Date("2026-05-06"), i + row) : "",
      ll: row % 3 === 0 ? "Aprobado" : "Pendiente",
      ll_fecha_aprob: row % 3 === 0 ? addDays(new Date("2026-05-08"), i + row) : "",
      hb: row % 4 === 0 ? "Aprobado" : "Pendiente",
      hb_fecha_aprob: row % 4 === 0 ? addDays(new Date("2026-05-09"), i + row) : "",
      logistica_compra: row % 2 === 0 ? "Comprado" : "Pendiente compra",
      fecha_compra: row % 2 === 0 ? addDays(new Date("2026-05-10"), i + row) : "",
      oc_os_recurso: row % 2 === 0 ? `OC-${String(i * 3 + row + 1).padStart(5, "0")}` : "",
      fecha_entrega: addDays(new Date("2026-05-15"), i + row),
      guia_remision: row % 2 === 0 ? `GR-${String(i * 3 + row + 1).padStart(5, "0")}` : "",
      archivo_guia:
        row % 2 === 0
          ? fileMeta(`Guia_${String(i * 3 + row + 1).padStart(4, "0")}.pdf`, "application/pdf", 42000)
          : null,
    };
  });
});

const demoStore: {
  cotizaciones: Cotizacion[];
  requerimientos: Requerimiento[];
  detalleItems: DetalleRequerimientoItem[];
  recursos: Recurso[];
  catalogTipoRecurso: CatalogTipoRecurso[];
  catalogUnidades: CatalogUnidad[];
  catalogMarcas: CatalogMarca[];
  catalogProveedores: CatalogProveedor[];
  catalogMonedas: CatalogMoneda[];
  catalogEstadosRecurso: CatalogEstadoRecurso[];
  catalogEstadoDetalleRq: CatalogEstadoDetalleRq[];
  catalogEq: CatalogAprobacionItem[];
  catalogLl: CatalogAprobacionItem[];
  catalogHb: CatalogAprobacionItem[];
  catalogLogisticaCompra: CatalogLogisticaCompraItem[];
  catalogTipoServicio: CatalogTipoServicio[];
  catalogArea: CatalogArea[];
  catalogSolicitanteRq: CatalogSolicitanteRq[];
  catalogSolicitanteCotizacion: CatalogSolicitanteCotizacion[];
  catalogEstadoCotizacion: CatalogEstadoCotizacion[];
  catalogCodigoClientes: CatalogCodigoCliente[];
  catalogCodigoUnidadesTrabajo: CatalogCodigoUnidadTrabajo[];
  proyectosAdjudicados: ProyectoAdjudicado[];
} = {
  cotizaciones,
  requerimientos,
  detalleItems,
  recursos,
  catalogTipoRecurso,
  catalogUnidades,
  catalogMarcas,
  catalogProveedores,
  catalogMonedas,
  catalogEstadosRecurso,
  catalogEstadoDetalleRq,
  catalogEq,
  catalogLl,
  catalogHb,
  catalogLogisticaCompra,
  catalogTipoServicio,
  catalogArea,
  catalogSolicitanteRq,
  catalogSolicitanteCotizacion,
  catalogEstadoCotizacion,
  catalogCodigoClientes,
  catalogCodigoUnidadesTrabajo,
  proyectosAdjudicados,
};

function nextResourceCode(): string {
  const codes = demoStore.recursos
    .map((item) => Number(item.codigo_recurso.split("-").at(-1)))
    .filter((n) => Number.isFinite(n)) as number[];
  const max = codes.length > 0 ? Math.max(...codes) : 0;
  return `REC-2026-${String(max + 1).padStart(4, "0")}`;
}

function nextCotizacionCode(): string {
  const codes = demoStore.cotizaciones
    .map((item) => Number(item.codigo.split("-").at(-1)))
    .filter((n) => Number.isFinite(n)) as number[];
  const max = codes.length > 0 ? Math.max(...codes) : 0;
  return `COT-2026-${String(max + 1).padStart(4, "0")}`;
}

function nextCotizacionOc(): string {
  const codes = demoStore.cotizaciones
    .map((item) => Number(item.oc.split("-").at(-1)))
    .filter((n) => Number.isFinite(n)) as number[];
  const max = codes.length > 0 ? Math.max(...codes) : 0;
  return `OC-2026-${String(max + 1).padStart(4, "0")}`;
}

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function sameText(left: string, right: string): boolean {
  return left.localeCompare(right, "es", { sensitivity: "base" }) === 0;
}

function getYearFromDate(value: string | undefined): number | null {
  if (!value) return null;
  const year = Number(value.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function getRqCreationYear(cotizacion: Cotizacion): number {
  return (
    getYearFromDate(cotizacion.fecha_oc) ??
    getYearFromDate(cotizacion.fecha_entregada) ??
    getYearFromDate(cotizacion.fecha_entrega) ??
    new Date().getFullYear()
  );
}

function nextProjectCodeForYear(anio: number): string {
  const values = demoStore.proyectosAdjudicados
    .filter((item) => item.anio === anio)
    .map((item) => Number(item.codigo_proyecto.replace(/^P/i, "")))
    .filter((item) => Number.isFinite(item));
  const next = (values.length ? Math.max(...values) : 0) + 1;
  return `P${String(next).padStart(3, "0")}`;
}

function nextRqCorrelativo(anio: number, codigoCliente: string, codigoUnidad: string, codigoProyecto: string): string {
  const projectTag = codigoProyecto.toUpperCase();
  const expression = /^RQ-(\d{4})-([A-Z0-9]+)-([A-Z0-9]+)-P(\d{3})-(\d{3})$/;
  const correlativos = demoStore.requerimientos
    .map((item) => expression.exec(item.codigo))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .filter((match) => {
      const year = Number(match[1]);
      const cliente = match[2];
      const unidad = match[3];
      const proyecto = `P${match[4]}`;
      return year === anio && cliente === codigoCliente && unidad === codigoUnidad && proyecto === projectTag;
    })
    .map((match) => Number(match[5]));
  const next = (correlativos.length ? Math.max(...correlativos) : 0) + 1;
  return String(next).padStart(3, "0");
}

function isStandardRqCode(value: string): boolean {
  return /^RQ-\d{4}-[A-Z0-9]+-[A-Z0-9]+-P\d{3}-\d{4}$/.test(value);
}

export const demoData = {
  listCotizaciones(): Cotizacion[] {
    return [...demoStore.cotizaciones];
  },
  listRequerimientos(): Requerimiento[] {
    return [...demoStore.requerimientos];
  },
  listDetalleItems(): DetalleRequerimientoItem[] {
    return [...demoStore.detalleItems];
  },
  listRecursos(): Recurso[] {
    return [...demoStore.recursos];
  },
  listCatalogTipoRecurso(): CatalogTipoRecurso[] {
    return [...demoStore.catalogTipoRecurso];
  },
  listCatalogUnidades(): CatalogUnidad[] {
    return [...demoStore.catalogUnidades];
  },
  listCatalogMarcas(): CatalogMarca[] {
    return [...demoStore.catalogMarcas];
  },
  listCatalogProveedores(): CatalogProveedor[] {
    return [...demoStore.catalogProveedores];
  },
  listCatalogMonedas(): CatalogMoneda[] {
    return [...demoStore.catalogMonedas];
  },
  listCatalogEstadosRecurso(): CatalogEstadoRecurso[] {
    return [...demoStore.catalogEstadosRecurso];
  },
  listCatalogEstadoDetalleRq(): CatalogEstadoDetalleRq[] {
    return [...demoStore.catalogEstadoDetalleRq];
  },
  listCatalogEq(): CatalogAprobacionItem[] {
    return [...demoStore.catalogEq];
  },
  listCatalogLl(): CatalogAprobacionItem[] {
    return [...demoStore.catalogLl];
  },
  listCatalogHb(): CatalogAprobacionItem[] {
    return [...demoStore.catalogHb];
  },
  listCatalogLogisticaCompra(): CatalogLogisticaCompraItem[] {
    return [...demoStore.catalogLogisticaCompra];
  },
  listCatalogTipoServicio(): CatalogTipoServicio[] {
    return [...demoStore.catalogTipoServicio];
  },
  listCatalogArea(): CatalogArea[] {
    return [...demoStore.catalogArea];
  },
  listCatalogSolicitanteRq(): CatalogSolicitanteRq[] {
    return [...demoStore.catalogSolicitanteRq];
  },
  listCatalogSolicitanteCotizacion(): CatalogSolicitanteCotizacion[] {
    return [...demoStore.catalogSolicitanteCotizacion];
  },
  listCatalogEstadoCotizacion(): CatalogEstadoCotizacion[] {
    return [...demoStore.catalogEstadoCotizacion];
  },
  listCatalogCodigoClientes(): CatalogCodigoCliente[] {
    return [...demoStore.catalogCodigoClientes];
  },
  listCatalogCodigoUnidadesTrabajo(): CatalogCodigoUnidadTrabajo[] {
    return [...demoStore.catalogCodigoUnidadesTrabajo];
  },
  listProyectosAdjudicados(): ProyectoAdjudicado[] {
    return [...demoStore.proyectosAdjudicados];
  },
  listCatalogSummary() {
    return {
      tipoRecurso: this.listCatalogTipoRecurso(),
      unidades: this.listCatalogUnidades(),
      marcas: this.listCatalogMarcas(),
      proveedores: this.listCatalogProveedores(),
      monedas: this.listCatalogMonedas(),
      estadosRecurso: this.listCatalogEstadosRecurso(),
      estadosDetalleRq: this.listCatalogEstadoDetalleRq(),
      eq: this.listCatalogEq(),
      ll: this.listCatalogLl(),
      hb: this.listCatalogHb(),
      logisticaCompra: this.listCatalogLogisticaCompra(),
      tipoServicio: this.listCatalogTipoServicio(),
      areas: this.listCatalogArea(),
      solicitantesRq: this.listCatalogSolicitanteRq(),
      solicitantesCotizacion: this.listCatalogSolicitanteCotizacion(),
      estadosCotizacion: this.listCatalogEstadoCotizacion(),
      codigosCliente: this.listCatalogCodigoClientes(),
      codigosUnidadTrabajo: this.listCatalogCodigoUnidadesTrabajo(),
      proyectosAdjudicados: this.listProyectosAdjudicados(),
    };
  },
  getCotizacionById(id: string): Cotizacion | undefined {
    return demoStore.cotizaciones.find((cot) => cot.id === id);
  },
  getRequerimientosByCotizacionId(cotizacionId: string): Requerimiento[] {
    return demoStore.requerimientos.filter((rq) => rq.cotizacion_id === cotizacionId);
  },
  getDetalleByRequerimientoId(requerimientoId: string): DetalleRequerimientoItem[] {
    return demoStore.detalleItems.filter((item) => item.requerimiento_id === requerimientoId);
  },
  updateCotizacion(id: string, patch: Partial<Cotizacion>): Cotizacion | null {
    const idx = demoStore.cotizaciones.findIndex((cot) => cot.id === id);
    if (idx < 0) return null;
    demoStore.cotizaciones[idx] = { ...demoStore.cotizaciones[idx], ...patch };
    return demoStore.cotizaciones[idx];
  },
  createCotizacion(payload: Cotizacion): Cotizacion {
    demoStore.cotizaciones = [{ ...payload }, ...demoStore.cotizaciones];
    return payload;
  },
  nextCotizacionDraft(): Cotizacion {
    const today = new Date();
    const nextCode = nextCotizacionCode();
    return {
      id: `cot-${nextLocalUuid()}`,
      codigo: nextCode,
      oc: nextCotizacionOc(),
      cliente: clientes[0],
      proyecto: proyectos[0],
      unidad_trabajo: unidadesTrabajo[0],
      moneda_cotizacion: "PEN",
      estado: "Pendiente",
      estado_propuesta: "Rev. Bases",
      solicitante: catalogSolicitanteCotizacion[0]?.nombre ?? "Luis Ramos",
      responsable_tecnico: responsables[0],
      responsable_economico: responsables[1] ?? responsables[0],
      fecha_registro: today.toISOString().slice(0, 10),
      fecha_presentacion: today.toISOString().slice(0, 10),
      fecha_invitacion: today.toISOString().slice(0, 10),
      fecha_confirmacion: addDays(today, 2),
      fecha_visita_tecnica: addDays(today, 3),
      fecha_consultas: addDays(today, 4),
      fecha_abs_consultas: addDays(today, 5),
      fecha_entrega: addDays(today, 7),
      fecha_entregada: addDays(today, 8),
      fecha_oc: addDays(today, 9),
      tipo_servicio: catalogTipoServicio[0]?.nombre ?? "Mantenimiento eléctrico",
      prioridad: "Media",
      avance: 0,
      observaciones: "",
      resumen_economico: buildDefaultEconomicSummary(),
      monto: 0,
      flat_mensual: false,
      fecha_inicio_analisis: "",
      fecha_fin_analisis: "",
      meses_analisis: null,
    };
  },
  updateRequerimiento(id: string, patch: Partial<Requerimiento>): Requerimiento | null {
    const idx = demoStore.requerimientos.findIndex((rq) => rq.id === id);
    if (idx < 0) return null;
    demoStore.requerimientos[idx] = { ...demoStore.requerimientos[idx], ...patch };
    return demoStore.requerimientos[idx];
  },
  deleteRequerimiento(id: string): boolean {
    const exists = demoStore.requerimientos.some((rq) => rq.id === id);
    if (!exists) return false;
    demoStore.requerimientos = demoStore.requerimientos.filter((rq) => rq.id !== id);
    demoStore.detalleItems = demoStore.detalleItems.filter((item) => item.requerimiento_id !== id);
    return true;
  },
  /**
   * @deprecated Usa createRequerimientoFromCotizacion(...) para asegurar
   * formato estándar de código RQ y validación de cotización elegible.
   */
  createRequerimiento(cotizacionId: string): Requerimiento {
    const created = this.createRequerimientoFromCotizacion(cotizacionId);
    if (!created.ok) {
      throw new Error(created.message);
    }
    return created.requerimiento;
  },
  createRequerimientoFromCotizacion(cotizacionId: string):
    | { ok: true; requerimiento: Requerimiento }
    | { ok: false; message: string } {
    const cotizacion = demoStore.cotizaciones.find((item) => item.id === cotizacionId);
    if (!cotizacion) {
      return { ok: false, message: "No se pudo generar el código RQ. Revisa la leyenda de códigos." };
    }

    const estado = cotizacion.estado.toLowerCase();
    const isAllowed =
      estado.includes("adjudic") || estado.includes("ganad") || estado.includes("proyecto activo");
    if (!isAllowed) {
      return { ok: false, message: "Solo se puede crear un RQ desde una cotización adjudicada o ganada." };
    }

    const codeCliente = demoStore.catalogCodigoClientes.find((item) => sameText(item.cliente, cotizacion.cliente));
    if (!codeCliente?.codigo_cliente) {
      return { ok: false, message: "Falta configurar el código del cliente en Datos > Leyenda de códigos." };
    }

    const codeUnidad = demoStore.catalogCodigoUnidadesTrabajo.find((item) =>
      sameText(item.unidad_trabajo, cotizacion.unidad_trabajo),
    );
    if (!codeUnidad?.codigo_unidad) {
      return { ok: false, message: "Falta configurar el código de unidad de trabajo en Datos > Leyenda de códigos." };
    }

    const anio = getRqCreationYear(cotizacion);
    const codigoCliente = normalizeToken(codeCliente.codigo_cliente);
    const codigoUnidad = normalizeToken(codeUnidad.codigo_unidad);
    if (!codigoCliente || !codigoUnidad) {
      return { ok: false, message: "No se pudo generar el código RQ. Revisa la leyenda de códigos." };
    }

    let proyecto = demoStore.proyectosAdjudicados.find(
      (item) => item.anio === anio && sameText(item.cotizacion, cotizacion.codigo),
    );
    if (!proyecto) {
      const generatedProjectCode = nextProjectCodeForYear(anio);
      proyecto = {
        id: nextNumericId(demoStore.proyectosAdjudicados, "pa"),
        anio,
        codigo_proyecto: generatedProjectCode,
        cotizacion: cotizacion.codigo,
        oc: cotizacion.oc,
        cliente: cotizacion.cliente,
        codigo_cliente: codigoCliente,
        unidad_trabajo: cotizacion.unidad_trabajo,
        codigo_unidad: codigoUnidad,
        fecha_adjudicacion: cotizacion.fecha_oc || cotizacion.fecha_entregada || cotizacion.fecha_entrega || new Date().toISOString().slice(0, 10),
        estado: "Activo",
        activo: true,
      };
      demoStore.proyectosAdjudicados = [proyecto, ...demoStore.proyectosAdjudicados];
    }

    const correlativo = nextRqCorrelativo(anio, codigoCliente, codigoUnidad, proyecto.codigo_proyecto);
    if (!correlativo) {
      return { ok: false, message: "No se pudo generar el código RQ. Revisa la leyenda de códigos." };
    }

    const codigoRq = `RQ-${anio}-${codigoCliente}-${codigoUnidad}-${proyecto.codigo_proyecto}-${correlativo}`;
    const now = new Date().toISOString().slice(0, 10);
    const nuevo: Requerimiento = {
      id: nextNumericId(demoStore.requerimientos, "rq"),
      codigo: codigoRq,
      cotizacion_id: cotizacion.id,
      cotizacion_codigo: cotizacion.codigo,
      codigo_cliente: codigoCliente,
      codigo_unidad: codigoUnidad,
      proyecto_servicio: cotizacion.proyecto,
      oc: cotizacion.oc,
      codigo_proyecto_adjudicado: proyecto.codigo_proyecto,
      anio,
      solicitante_rq: demoStore.catalogSolicitanteRq[0]?.nombre ?? "Oficina técnica",
      tipo_servicio: cotizacion.tipo_servicio || demoStore.catalogTipoServicio[0]?.nombre || "",
      area: demoStore.catalogArea[0]?.nombre ?? "",
      estado: "Pendiente",
      fecha_solicitud: now,
      fecha_requerida: cotizacion.fecha_entrega || now,
      responsable: cotizacion.responsable_tecnico || cotizacion.responsable_economico || "Por asignar",
      avance: 0,
      total_rq: 0,
      observaciones: "",
    };

    demoStore.requerimientos = [nuevo, ...demoStore.requerimientos];
    return { ok: true, requerimiento: nuevo };
  },
  createRequerimientoWithData(payload: Requerimiento): Requerimiento {
    if (!isStandardRqCode(payload.codigo)) {
      throw new Error(
        "Código RQ inválido. Debe cumplir el formato estándar: RQ-{AÑO}-{CLIENTE}-{UNIDAD}-P{PROYECTO}-{CORRELATIVO}.",
      );
    }
    demoStore.requerimientos = [{ ...payload }, ...demoStore.requerimientos];
    return payload;
  },
  createResource(payload: Recurso): Recurso {
    demoStore.recursos = [{ ...payload }, ...demoStore.recursos];
    return payload;
  },
  updateResource(id: string, patch: Partial<Recurso>): Recurso | null {
    const idx = demoStore.recursos.findIndex((item) => item.id === id);
    if (idx < 0) return null;
    demoStore.recursos[idx] = { ...demoStore.recursos[idx], ...patch };
    return demoStore.recursos[idx];
  },
  deactivateResource(id: string): Recurso | null {
    return this.updateResource(id, { estado: "Inactivo" });
  },
  removeResource(id: string): void {
    demoStore.recursos = demoStore.recursos.filter((item) => item.id !== id);
  },
  nextResourceDraftCode(): string {
    return nextResourceCode();
  },
  addDetalleItem(params: {
    requerimiento_id: string;
    recurso_id: string;
    cantidad: number;
    precio_unitario?: number;
    moneda?: "PEN" | "USD";
  }): DetalleRequerimientoItem | null {
    const recurso = demoStore.recursos.find((item) => item.id === params.recurso_id);
    if (!recurso) return null;
    const precio = params.precio_unitario ?? recurso.precio_unitario_ref;
    const subtotal = Number((params.cantidad * precio).toFixed(2));
    const proveedorInfo = demoStore.catalogProveedores.find((item) => item.nombre === recurso.proveedor);
    const nuevo: DetalleRequerimientoItem = {
      id: nextNumericId(demoStore.detalleItems, "dtrq"),
      requerimiento_id: params.requerimiento_id,
      recurso_id: params.recurso_id,
      cantidad: params.cantidad,
      precio_unitario: Number(precio.toFixed(2)),
      subtotal,
      ajuste: 0,
      atencion_real: params.cantidad,
      cant_stock: 0,
      compra: params.cantidad,
      costo_unitario: Number(precio.toFixed(2)),
      moneda: params.moneda ?? recurso.moneda,
      tc: 1,
      factor_eq_herr: 1,
      costo_total_presupuestado: subtotal,
      fecha_coti: new Date().toISOString().slice(0, 10),
      estado: "Pendiente",
      informacion_adicional: `${recurso.marca} ${recurso.modelo}`.trim(),
      observaciones_item: recurso.observaciones,
      recurso_a_suministrar: recurso.descripcion,
      ficha_tecnica_a_suministrar: recurso.resourceFiles.fichaTecnica,
      proveedor: proveedorInfo?.nombre ?? recurso.proveedor,
      condicion_pago: "30 días",
      tiempo_entrega: proveedorInfo?.tiempo_entrega_ref ?? recurso.tiempo_entrega_ref,
      eq: "Pendiente",
      eq_fecha_aprob: "",
      ll: "Pendiente",
      ll_fecha_aprob: "",
      hb: "Pendiente",
      hb_fecha_aprob: "",
      logistica_compra: "Pendiente compra",
      fecha_compra: "",
      oc_os_recurso: "",
      fecha_entrega: "",
      guia_remision: "",
      archivo_guia: null,
    };
    demoStore.detalleItems = [nuevo, ...demoStore.detalleItems];
    return nuevo;
  },
  replaceDetalleItems(requerimientoId: string, items: DetalleRequerimientoItem[]) {
    demoStore.detalleItems = [
      ...items,
      ...demoStore.detalleItems.filter((item) => item.requerimiento_id !== requerimientoId),
    ];
  },
  saveCatalog(
    catalogKey:
      | "catalogTipoRecurso"
      | "catalogUnidades"
      | "catalogMarcas"
      | "catalogProveedores"
      | "catalogMonedas"
      | "catalogEstadosRecurso"
      | "catalogEstadoDetalleRq"
      | "catalogEq"
      | "catalogLl"
      | "catalogHb"
      | "catalogLogisticaCompra"
      | "catalogTipoServicio"
      | "catalogArea"
      | "catalogSolicitanteRq"
      | "catalogSolicitanteCotizacion"
      | "catalogEstadoCotizacion"
      | "catalogCodigoClientes"
      | "catalogCodigoUnidadesTrabajo"
      | "proyectosAdjudicados",
    value:
      | CatalogTipoRecurso
      | CatalogUnidad
      | CatalogMarca
      | CatalogProveedor
      | CatalogMoneda
      | CatalogEstadoRecurso
      | CatalogEstadoDetalleRq
      | CatalogAprobacionItem
      | CatalogLogisticaCompraItem
      | CatalogTipoServicio
      | CatalogArea
      | CatalogSolicitanteRq
      | CatalogSolicitanteCotizacion
      | CatalogEstadoCotizacion
      | CatalogCodigoCliente
      | CatalogCodigoUnidadTrabajo
      | ProyectoAdjudicado,
  ) {
    const upsert = <T extends { id: string }>(list: T[], next: T) => {
      const idx = list.findIndex((item) => item.id === next.id);
      if (idx >= 0) list[idx] = next;
      else list.unshift(next);
    };

    if (catalogKey === "catalogTipoRecurso") {
      upsert(demoStore.catalogTipoRecurso, value as CatalogTipoRecurso);
      return;
    }
    if (catalogKey === "catalogUnidades") {
      upsert(demoStore.catalogUnidades, value as CatalogUnidad);
      return;
    }
    if (catalogKey === "catalogMarcas") {
      upsert(demoStore.catalogMarcas, value as CatalogMarca);
      return;
    }
    if (catalogKey === "catalogProveedores") {
      upsert(demoStore.catalogProveedores, value as CatalogProveedor);
      return;
    }
    if (catalogKey === "catalogMonedas") {
      upsert(demoStore.catalogMonedas, value as CatalogMoneda);
      return;
    }
    if (catalogKey === "catalogEstadosRecurso") {
      upsert(demoStore.catalogEstadosRecurso, value as CatalogEstadoRecurso);
      return;
    }
    if (catalogKey === "catalogEstadoDetalleRq") {
      upsert(demoStore.catalogEstadoDetalleRq, value as CatalogEstadoDetalleRq);
      return;
    }
    if (catalogKey === "catalogEq") {
      upsert(demoStore.catalogEq, value as CatalogAprobacionItem);
      return;
    }
    if (catalogKey === "catalogLl") {
      upsert(demoStore.catalogLl, value as CatalogAprobacionItem);
      return;
    }
    if (catalogKey === "catalogHb") {
      upsert(demoStore.catalogHb, value as CatalogAprobacionItem);
      return;
    }
    if (catalogKey === "catalogLogisticaCompra") {
      upsert(demoStore.catalogLogisticaCompra, value as CatalogLogisticaCompraItem);
      return;
    }
    if (catalogKey === "catalogTipoServicio") {
      upsert(demoStore.catalogTipoServicio, value as CatalogTipoServicio);
      return;
    }
    if (catalogKey === "catalogArea") {
      upsert(demoStore.catalogArea, value as CatalogArea);
      return;
    }
    if (catalogKey === "catalogSolicitanteCotizacion") {
      upsert(demoStore.catalogSolicitanteCotizacion, value as CatalogSolicitanteCotizacion);
      return;
    }
    if (catalogKey === "catalogEstadoCotizacion") {
      upsert(demoStore.catalogEstadoCotizacion, value as CatalogEstadoCotizacion);
      return;
    }
    if (catalogKey === "catalogCodigoClientes") {
      upsert(demoStore.catalogCodigoClientes, value as CatalogCodigoCliente);
      return;
    }
    if (catalogKey === "catalogCodigoUnidadesTrabajo") {
      upsert(demoStore.catalogCodigoUnidadesTrabajo, value as CatalogCodigoUnidadTrabajo);
      return;
    }
    if (catalogKey === "proyectosAdjudicados") {
      upsert(demoStore.proyectosAdjudicados, value as ProyectoAdjudicado);
      return;
    }
    upsert(demoStore.catalogSolicitanteRq, value as CatalogSolicitanteRq);
  },
  removeCatalog(
    catalogKey:
      | "catalogTipoRecurso"
      | "catalogUnidades"
      | "catalogMarcas"
      | "catalogProveedores"
      | "catalogMonedas"
      | "catalogEstadosRecurso"
      | "catalogEstadoDetalleRq"
      | "catalogEq"
      | "catalogLl"
      | "catalogHb"
      | "catalogLogisticaCompra"
      | "catalogTipoServicio"
      | "catalogArea"
      | "catalogSolicitanteRq"
      | "catalogSolicitanteCotizacion"
      | "catalogEstadoCotizacion"
      | "catalogCodigoClientes"
      | "catalogCodigoUnidadesTrabajo"
      | "proyectosAdjudicados",
    id: string,
  ) {
    if (catalogKey === "catalogTipoRecurso") {
      demoStore.catalogTipoRecurso = demoStore.catalogTipoRecurso.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogUnidades") {
      demoStore.catalogUnidades = demoStore.catalogUnidades.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogMarcas") {
      demoStore.catalogMarcas = demoStore.catalogMarcas.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogProveedores") {
      demoStore.catalogProveedores = demoStore.catalogProveedores.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogMonedas") {
      demoStore.catalogMonedas = demoStore.catalogMonedas.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogEstadosRecurso") {
      demoStore.catalogEstadosRecurso = demoStore.catalogEstadosRecurso.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogEstadoDetalleRq") {
      demoStore.catalogEstadoDetalleRq = demoStore.catalogEstadoDetalleRq.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogEq") {
      demoStore.catalogEq = demoStore.catalogEq.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogLl") {
      demoStore.catalogLl = demoStore.catalogLl.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogHb") {
      demoStore.catalogHb = demoStore.catalogHb.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogLogisticaCompra") {
      demoStore.catalogLogisticaCompra = demoStore.catalogLogisticaCompra.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogTipoServicio") {
      demoStore.catalogTipoServicio = demoStore.catalogTipoServicio.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogArea") {
      demoStore.catalogArea = demoStore.catalogArea.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogSolicitanteCotizacion") {
      demoStore.catalogSolicitanteCotizacion = demoStore.catalogSolicitanteCotizacion.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogEstadoCotizacion") {
      demoStore.catalogEstadoCotizacion = demoStore.catalogEstadoCotizacion.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogCodigoClientes") {
      demoStore.catalogCodigoClientes = demoStore.catalogCodigoClientes.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "catalogCodigoUnidadesTrabajo") {
      demoStore.catalogCodigoUnidadesTrabajo = demoStore.catalogCodigoUnidadesTrabajo.filter((item) => item.id !== id);
      return;
    }
    if (catalogKey === "proyectosAdjudicados") {
      demoStore.proyectosAdjudicados = demoStore.proyectosAdjudicados.filter((item) => item.id !== id);
      return;
    }
    demoStore.catalogSolicitanteRq = demoStore.catalogSolicitanteRq.filter((item) => item.id !== id);
  },
};
