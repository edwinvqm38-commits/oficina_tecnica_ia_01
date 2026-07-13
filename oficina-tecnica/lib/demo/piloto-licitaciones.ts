export type PilotoEstadoLicitacion =
  | "Nueva"
  | "En revisión"
  | "En preparación"
  | "Pendiente de información"
  | "Presentada"
  | "Cerrada";

export type PilotoPrioridad = "Alta" | "Media" | "Baja";
export type PilotoMoneda = "PEN" | "USD";

export type PilotoResumenEconomicoDemo = {
  costoEstimado: number;
  utilidadEstimada: number;
  margenEstimado: number;
  montoOferta: number;
};

export type PilotoLicitacionDemo = {
  id: string;
  codigo: string;
  cliente: string;
  unidad: string;
  descripcion: string;
  tipoProceso: string;
  ubicacionTrabajo: string;
  fechaRecepcion: string;
  fechaLimite: string;
  estado: PilotoEstadoLicitacion;
  responsable: string;
  montoReferencial: number;
  moneda: PilotoMoneda;
  prioridad: PilotoPrioridad;
  cantidadRequerimientos: number;
  cantidadRecursos: number;
  cantidadDocumentos: number;
  siguienteAccionDemo: string;
  resumenEconomico: PilotoResumenEconomicoDemo;
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
    tipoProceso: "Invitación privada",
    ubicacionTrabajo: "Puno · sala eléctrica principal",
    fechaRecepcion: "2026-07-02",
    fechaLimite: "2026-07-12",
    estado: "En preparación",
    responsable: "Alexis Moreno",
    montoReferencial: 185000,
    moneda: "PEN",
    prioridad: "Alta",
    cantidadRequerimientos: 3,
    cantidadRecursos: 24,
    cantidadDocumentos: 18,
    siguienteAccionDemo: "Cerrar metrados eléctricos y validar oferta económica demo.",
    resumenEconomico: {
      costoEstimado: 151700,
      utilidadEstimada: 27800,
      margenEstimado: 15.5,
      montoOferta: 179500,
    },
  },
  {
    id: "qei-demo-002",
    codigo: "QEI-DEMO-2026-002",
    cliente: "Nexa Andina",
    unidad: "Refinería Cajamarquilla",
    descripcion: "Mantenimiento preventivo de iluminación de emergencia en planta.",
    tipoProceso: "Solicitud de cotización",
    ubicacionTrabajo: "Lima · zona de refinería",
    fechaRecepcion: "2026-07-03",
    fechaLimite: "2026-07-18",
    estado: "En revisión",
    responsable: "Edwin Quispe",
    montoReferencial: 42000,
    moneda: "PEN",
    prioridad: "Media",
    cantidadRequerimientos: 2,
    cantidadRecursos: 11,
    cantidadDocumentos: 9,
    siguienteAccionDemo: "Revisar alcance de mantenimiento y confirmar ventanas de intervención.",
    resumenEconomico: {
      costoEstimado: 34440,
      utilidadEstimada: 5460,
      margenEstimado: 13.7,
      montoOferta: 39900,
    },
  },
  {
    id: "qei-demo-003",
    codigo: "QEI-DEMO-2026-003",
    cliente: "Energía del Sur",
    unidad: "SE Lomas 138 kV",
    descripcion: "Ingeniería de detalle para adecuación de celdas de media tensión.",
    tipoProceso: "Concurso técnico económico",
    ubicacionTrabajo: "Arequipa · subestación Lomas",
    fechaRecepcion: "2026-07-05",
    fechaLimite: "2026-07-14",
    estado: "Pendiente de información",
    responsable: "Rosa Fernández",
    montoReferencial: 96000,
    moneda: "USD",
    prioridad: "Alta",
    cantidadRequerimientos: 4,
    cantidadRecursos: 18,
    cantidadDocumentos: 27,
    siguienteAccionDemo: "Solicitar planos unifilares actualizados antes de cerrar la propuesta.",
    resumenEconomico: {
      costoEstimado: 80640,
      utilidadEstimada: 12960,
      margenEstimado: 13.8,
      montoOferta: 93600,
    },
  },
  {
    id: "qei-demo-004",
    codigo: "QEI-DEMO-2026-004",
    cliente: "Consorcio Vial Pacifico",
    unidad: "Campamento Km 182",
    descripcion: "Provisión de materiales eléctricos para módulos temporales.",
    tipoProceso: "Compra comparativa",
    ubicacionTrabajo: "Ica · campamento vial Km 182",
    fechaRecepcion: "2026-07-06",
    fechaLimite: "2026-07-22",
    estado: "Nueva",
    responsable: "Luis Ramos",
    montoReferencial: 73500,
    moneda: "PEN",
    prioridad: "Media",
    cantidadRequerimientos: 1,
    cantidadRecursos: 16,
    cantidadDocumentos: 6,
    siguienteAccionDemo: "Clasificar materiales críticos y asignar revisión técnica inicial.",
    resumenEconomico: {
      costoEstimado: 61740,
      utilidadEstimada: 9560,
      margenEstimado: 13.4,
      montoOferta: 71300,
    },
  },
  {
    id: "qei-demo-005",
    codigo: "QEI-DEMO-2026-005",
    cliente: "Planta Alfa",
    unidad: "Línea de producción 2",
    descripcion: "Reemplazo de canalizaciones y bandejas portacables en zona húmeda.",
    tipoProceso: "Licitación cerrada",
    ubicacionTrabajo: "Callao · nave industrial 2",
    fechaRecepcion: "2026-06-28",
    fechaLimite: "2026-07-09",
    estado: "Presentada",
    responsable: "María Salinas",
    montoReferencial: 214000,
    moneda: "PEN",
    prioridad: "Alta",
    cantidadRequerimientos: 5,
    cantidadRecursos: 31,
    cantidadDocumentos: 33,
    siguienteAccionDemo: "Esperar confirmación del comité y preparar sustento de alcance.",
    resumenEconomico: {
      costoEstimado: 180760,
      utilidadEstimada: 26740,
      margenEstimado: 12.9,
      montoOferta: 207500,
    },
  },
  {
    id: "qei-demo-006",
    codigo: "QEI-DEMO-2026-006",
    cliente: "Metalúrgica Central",
    unidad: "Área de molienda",
    descripcion: "Servicio de inspección termográfica y reporte de tableros críticos.",
    tipoProceso: "Servicio menor",
    ubicacionTrabajo: "Junín · planta de molienda",
    fechaRecepcion: "2026-07-08",
    fechaLimite: "2026-07-25",
    estado: "Nueva",
    responsable: "Carlos Medina",
    montoReferencial: 28500,
    moneda: "PEN",
    prioridad: "Baja",
    cantidadRequerimientos: 1,
    cantidadRecursos: 7,
    cantidadDocumentos: 4,
    siguienteAccionDemo: "Confirmar disponibilidad de técnico termografista y equipos de medición.",
    resumenEconomico: {
      costoEstimado: 23800,
      utilidadEstimada: 3700,
      margenEstimado: 13.5,
      montoOferta: 27500,
    },
  },
  {
    id: "qei-demo-007",
    codigo: "QEI-DEMO-2026-007",
    cliente: "Operadora Andes",
    unidad: "PAD lixiviación 4",
    descripcion: "Montaje de postes, luminarias y puesta a tierra perimetral.",
    tipoProceso: "Invitación privada",
    ubicacionTrabajo: "Moquegua · PAD lixiviación 4",
    fechaRecepcion: "2026-07-01",
    fechaLimite: "2026-07-16",
    estado: "En preparación",
    responsable: "Andrea Paredes",
    montoReferencial: 158000,
    moneda: "USD",
    prioridad: "Media",
    cantidadRequerimientos: 6,
    cantidadRecursos: 29,
    cantidadDocumentos: 22,
    siguienteAccionDemo: "Revisar disponibilidad de postes y cerrar cronograma de montaje.",
    resumenEconomico: {
      costoEstimado: 132720,
      utilidadEstimada: 20580,
      margenEstimado: 13.4,
      montoOferta: 153300,
    },
  },
  {
    id: "qei-demo-008",
    codigo: "QEI-DEMO-2026-008",
    cliente: "Constructora Delta",
    unidad: "Túnel auxiliar",
    descripcion: "Habilitación eléctrica temporal para frente de obra subterránea.",
    tipoProceso: "Adjudicación directa demo",
    ubicacionTrabajo: "Áncash · túnel auxiliar norte",
    fechaRecepcion: "2026-06-20",
    fechaLimite: "2026-07-04",
    estado: "Cerrada",
    responsable: "José Vargas",
    montoReferencial: 126000,
    moneda: "PEN",
    prioridad: "Baja",
    cantidadRequerimientos: 2,
    cantidadRecursos: 19,
    cantidadDocumentos: 14,
    siguienteAccionDemo: "Registrar lecciones aprendidas y archivar expediente demo.",
    resumenEconomico: {
      costoEstimado: 108360,
      utilidadEstimada: 12640,
      margenEstimado: 10.4,
      montoOferta: 121000,
    },
  },
  {
    id: "qei-demo-009",
    codigo: "QEI-DEMO-2026-009",
    cliente: "Minera Horizonte Azul",
    unidad: "Sala eléctrica 81",
    descripcion: "Actualización de tablero de instrumentación 115 Vac, 1F+N+T.",
    tipoProceso: "Solicitud urgente",
    ubicacionTrabajo: "Cajamarca · sala eléctrica 81",
    fechaRecepcion: "2026-07-09",
    fechaLimite: "2026-07-13",
    estado: "En revisión",
    responsable: "Edwin Torres",
    montoReferencial: 88000,
    moneda: "PEN",
    prioridad: "Alta",
    cantidadRequerimientos: 3,
    cantidadRecursos: 21,
    cantidadDocumentos: 19,
    siguienteAccionDemo: "Validar compatibilidad de componentes y cerrar consultas técnicas.",
    resumenEconomico: {
      costoEstimado: 73040,
      utilidadEstimada: 11560,
      margenEstimado: 13.7,
      montoOferta: 84600,
    },
  },
  {
    id: "qei-demo-010",
    codigo: "QEI-DEMO-2026-010",
    cliente: "Terminal Norte",
    unidad: "Subestación Patio 2",
    descripcion: "Suministro de seccionadores portafusibles y accesorios de montaje.",
    tipoProceso: "Concurso de suministro",
    ubicacionTrabajo: "La Libertad · subestación Patio 2",
    fechaRecepcion: "2026-07-04",
    fechaLimite: "2026-07-28",
    estado: "En preparación",
    responsable: "Natalia Rojas",
    montoReferencial: 112500,
    moneda: "USD",
    prioridad: "Media",
    cantidadRequerimientos: 2,
    cantidadRecursos: 13,
    cantidadDocumentos: 11,
    siguienteAccionDemo: "Confirmar stock de seccionadores y condiciones de entrega.",
    resumenEconomico: {
      costoEstimado: 94500,
      utilidadEstimada: 14625,
      margenEstimado: 13.4,
      montoOferta: 109125,
    },
  },
];

export function getPilotoLicitacionById(id: string): PilotoLicitacionDemo | undefined {
  return pilotoLicitacionesDemo.find((item) => item.id === id);
}
