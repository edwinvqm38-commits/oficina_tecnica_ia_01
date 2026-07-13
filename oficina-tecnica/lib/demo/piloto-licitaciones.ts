export type PilotoEstadoLicitacion =
  | "Nueva"
  | "En revisión"
  | "En preparación"
  | "Pendiente de información"
  | "Presentada"
  | "Cerrada";

export type PilotoPrioridad = "Alta" | "Media" | "Baja";
export type PilotoMoneda = "PEN" | "USD";

export type PilotoLicitacionDemo = {
  id: string;
  codigo: string;
  cliente: string;
  unidad: string;
  descripcion: string;
  fechaRecepcion: string;
  fechaLimite: string;
  estado: PilotoEstadoLicitacion;
  responsable: string;
  montoReferencial: number;
  moneda: PilotoMoneda;
  prioridad: PilotoPrioridad;
  cantidadRequerimientos: number;
  cantidadDocumentos: number;
};

export const PILOTO_DEMO_TODAY = "2026-07-10";

export const pilotoEstados: PilotoEstadoLicitacion[] = [
  "Nueva",
  "En revisión",
  "En preparación",
  "Pendiente de información",
  "Presentada",
  "Cerrada",
];

export const pilotoPrioridades: PilotoPrioridad[] = ["Alta", "Media", "Baja"];

export const pilotoLicitacionesDemo: PilotoLicitacionDemo[] = [
  {
    id: "qei-demo-001",
    codigo: "QEI-DEMO-2026-001",
    cliente: "Minera Aurora",
    unidad: "UM San Rafael Norte",
    descripcion: "Suministro e instalación de tablero de distribución para sala eléctrica.",
    fechaRecepcion: "2026-07-02",
    fechaLimite: "2026-07-12",
    estado: "En preparación",
    responsable: "Alexis Moreno",
    montoReferencial: 185000,
    moneda: "PEN",
    prioridad: "Alta",
    cantidadRequerimientos: 3,
    cantidadDocumentos: 18,
  },
  {
    id: "qei-demo-002",
    codigo: "QEI-DEMO-2026-002",
    cliente: "Nexa Andina",
    unidad: "Refinería Cajamarquilla",
    descripcion: "Mantenimiento preventivo de iluminación de emergencia en planta.",
    fechaRecepcion: "2026-07-03",
    fechaLimite: "2026-07-18",
    estado: "En revisión",
    responsable: "Edwin Quispe",
    montoReferencial: 42000,
    moneda: "PEN",
    prioridad: "Media",
    cantidadRequerimientos: 2,
    cantidadDocumentos: 9,
  },
  {
    id: "qei-demo-003",
    codigo: "QEI-DEMO-2026-003",
    cliente: "Energía del Sur",
    unidad: "SE Lomas 138 kV",
    descripcion: "Ingeniería de detalle para adecuación de celdas de media tensión.",
    fechaRecepcion: "2026-07-05",
    fechaLimite: "2026-07-14",
    estado: "Pendiente de información",
    responsable: "Rosa Fernández",
    montoReferencial: 96000,
    moneda: "USD",
    prioridad: "Alta",
    cantidadRequerimientos: 4,
    cantidadDocumentos: 27,
  },
  {
    id: "qei-demo-004",
    codigo: "QEI-DEMO-2026-004",
    cliente: "Consorcio Vial Pacifico",
    unidad: "Campamento Km 182",
    descripcion: "Provisión de materiales eléctricos para módulos temporales.",
    fechaRecepcion: "2026-07-06",
    fechaLimite: "2026-07-22",
    estado: "Nueva",
    responsable: "Luis Ramos",
    montoReferencial: 73500,
    moneda: "PEN",
    prioridad: "Media",
    cantidadRequerimientos: 1,
    cantidadDocumentos: 6,
  },
  {
    id: "qei-demo-005",
    codigo: "QEI-DEMO-2026-005",
    cliente: "Planta Alfa",
    unidad: "Línea de producción 2",
    descripcion: "Reemplazo de canalizaciones y bandejas portacables en zona húmeda.",
    fechaRecepcion: "2026-06-28",
    fechaLimite: "2026-07-09",
    estado: "Presentada",
    responsable: "María Salinas",
    montoReferencial: 214000,
    moneda: "PEN",
    prioridad: "Alta",
    cantidadRequerimientos: 5,
    cantidadDocumentos: 33,
  },
  {
    id: "qei-demo-006",
    codigo: "QEI-DEMO-2026-006",
    cliente: "Metalúrgica Central",
    unidad: "Área de molienda",
    descripcion: "Servicio de inspección termográfica y reporte de tableros críticos.",
    fechaRecepcion: "2026-07-08",
    fechaLimite: "2026-07-25",
    estado: "Nueva",
    responsable: "Carlos Medina",
    montoReferencial: 28500,
    moneda: "PEN",
    prioridad: "Baja",
    cantidadRequerimientos: 1,
    cantidadDocumentos: 4,
  },
  {
    id: "qei-demo-007",
    codigo: "QEI-DEMO-2026-007",
    cliente: "Operadora Andes",
    unidad: "PAD lixiviación 4",
    descripcion: "Montaje de postes, luminarias y puesta a tierra perimetral.",
    fechaRecepcion: "2026-07-01",
    fechaLimite: "2026-07-16",
    estado: "En preparación",
    responsable: "Andrea Paredes",
    montoReferencial: 158000,
    moneda: "USD",
    prioridad: "Media",
    cantidadRequerimientos: 6,
    cantidadDocumentos: 22,
  },
  {
    id: "qei-demo-008",
    codigo: "QEI-DEMO-2026-008",
    cliente: "Constructora Delta",
    unidad: "Túnel auxiliar",
    descripcion: "Habilitación eléctrica temporal para frente de obra subterránea.",
    fechaRecepcion: "2026-06-20",
    fechaLimite: "2026-07-04",
    estado: "Cerrada",
    responsable: "José Vargas",
    montoReferencial: 126000,
    moneda: "PEN",
    prioridad: "Baja",
    cantidadRequerimientos: 2,
    cantidadDocumentos: 14,
  },
  {
    id: "qei-demo-009",
    codigo: "QEI-DEMO-2026-009",
    cliente: "Minera Horizonte Azul",
    unidad: "Sala eléctrica 81",
    descripcion: "Actualización de tablero de instrumentación 115 Vac, 1F+N+T.",
    fechaRecepcion: "2026-07-09",
    fechaLimite: "2026-07-13",
    estado: "En revisión",
    responsable: "Edwin Torres",
    montoReferencial: 88000,
    moneda: "PEN",
    prioridad: "Alta",
    cantidadRequerimientos: 3,
    cantidadDocumentos: 19,
  },
  {
    id: "qei-demo-010",
    codigo: "QEI-DEMO-2026-010",
    cliente: "Terminal Norte",
    unidad: "Subestación Patio 2",
    descripcion: "Suministro de seccionadores portafusibles y accesorios de montaje.",
    fechaRecepcion: "2026-07-04",
    fechaLimite: "2026-07-28",
    estado: "En preparación",
    responsable: "Natalia Rojas",
    montoReferencial: 112500,
    moneda: "USD",
    prioridad: "Media",
    cantidadRequerimientos: 2,
    cantidadDocumentos: 11,
  },
];

export function getPilotoLicitacionById(id: string): PilotoLicitacionDemo | undefined {
  return pilotoLicitacionesDemo.find((item) => item.id === id);
}
