// ig-data.js — Mock data for IA Gerencial prototype
// All data is simulated. No real data from EKA MINING SAC.

const AGENTS = [
  { id:'gg',  name:'Gerente General',        initials:'GG', role:'Supervisión y decisión', type:'human',        status:'active',        skillCount:0, tasks:3, confidence:null, focus:'Autoridad de aprobación. Toda decisión crítica requiere su aprobación explícita.', currentTask:'Revisando SOL-2026-001 — Tintaya' },
  { id:'ic',  name:'Ing. de Costos',          initials:'IC', role:'Costos y Presupuestos',  type:'agent',        status:'active',        skillCount:1, tasks:2, confidence:87,   focus:'Análisis de desviaciones de costo, valorizaciones y adicionales de obra', currentTask:'Evaluando desviación +23% — SET Tintaya 138kV' },
  { id:'pm',  name:'Project Management',      initials:'PM', role:'Gestión de Proyectos',   type:'agent',        status:'needs-approval',skillCount:2, tasks:1, confidence:74,   focus:'Cronograma, riesgos y restricciones de proyectos de ingeniería', currentTask:'Análisis de riesgo de retraso — PRY-001 y PRY-003' },
  { id:'ie',  name:'Ing. Eléctrico',          initials:'IE', role:'Ingeniería Eléctrica',   type:'agent-future', status:'future',        skillCount:0, tasks:0, confidence:null, focus:'Criterios de diseño eléctrico normativo', currentTask:'—' },
  { id:'ic2', name:'Ing. Civil',              initials:'IC', role:'Ingeniería Civil',        type:'agent-future', status:'future',        skillCount:0, tasks:0, confidence:null, focus:'Diseño estructural y civil', currentTask:'—' },
  { id:'im',  name:'Ing. Mecánico',           initials:'IM', role:'Ingeniería Mecánica',    type:'agent-future', status:'future',        skillCount:0, tasks:0, confidence:null, focus:'Diseño mecánico y de instalaciones', currentTask:'—' },
];

const CONNECTIONS = [
  { id:'c1', from:'gg', to:'ic',  kind:'supervision',   label:'Supervisión directa y aprobación' },
  { id:'c2', from:'gg', to:'pm',  kind:'supervision',   label:'Supervisión directa y aprobación' },
  { id:'c3', from:'ic', to:'pm',  kind:'collaboration', label:'Colaboración activa — SOL-2026-001' },
];

const ALERTS = [
  { id:'a1', level:'high',   title:'Desviación de costo +23%',       message:'SET Tintaya supera curva S. IC propone adicional S/ 142K. Requiere decisión GG.',       route:'bandeja'     },
  { id:'a2', level:'medium', title:'Skill propuesta pendiente',       message:'PM propone skill Gestión de Restricciones v1.1. Pendiente aprobación del GG.',         route:'skills'      },
  { id:'a3', level:'low',    title:'Hito crítico: 23 Jun',            message:'Revisión diseño básico — SET Tintaya. 18 días para vencer. Avance actual: 58%.',        route:'proyectos'   },
];

const ACTIVITY = [
  { id:'ac1', agent:'IC',  action:'Envió respuesta a SOL-2026-001',         time:'Hace 2h',   type:'response'  },
  { id:'ac2', agent:'PM',  action:'Completó análisis de riesgo PRY-001',     time:'Hace 3h',   type:'analysis'  },
  { id:'ac3', agent:'IC',  action:'Propuso memoria técnica — cable 138kV',   time:'Hace 5h',   type:'memory'    },
  { id:'ac4', agent:'PM',  action:'Propuso skill Gestión Restricciones v1.1',time:'Ayer 16:30', type:'skill'    },
];

const PROJECTS = [
  { id:'PRY-001', name:'SET Tintaya 138kV',           client:'Antapaccay S.A.',  status:'at-risk',  risk:'high',     column:'Ejecucion',     progress:58, cost:'S/ 2.40 M', nextMilestone:'Revisión diseño básico', due:'23 Jun 2026', discipline:'Eléctrica', agents:['IC','PM'], summary:'Subestación de transformación 138/22kV con 3 celdas de línea y equipamiento de protección.' },
  { id:'PRY-002', name:'LT Socabaya–Repartición',     client:'Seal S.A.',        status:'on-track', risk:'medium',   column:'Ejecucion',     progress:72, cost:'S/ 1.80 M', nextMilestone:'Pruebas FAT equipos',    due:'14 Jul 2026', discipline:'Eléctrica', agents:['PM'],      summary:'Línea de transmisión 60kV doble circuito, 18.4 km de recorrido.' },
  { id:'PRY-003', name:'SSEE Industrial Minsur',      client:'Minsur S.A.',      status:'delayed',  risk:'critical', column:'Planificacion', progress:22, cost:'S/ 0.63 M', nextMilestone:'Memoria de cálculo',     due:'30 Jun 2026', discipline:'Eléctrica', agents:['IC'],      summary:'Sistema de distribución 22.9kV para planta industrial de concentración.' },
  { id:'PRY-004', name:'Ampliación SSEE Quellaveco',  client:'Anglo American',   status:'planning', risk:'low',      column:'Planificacion', progress:8,  cost:'Por definir', nextMilestone:'Kick-off técnico',      due:'Ago 2026',    discipline:'Eléctrica', agents:['PM'],      summary:'Ampliación de capacidad instalada de 4 a 6 MVA en subestación existente.' },
];

const APPROVALS = [
  { id:'APR-001', category:'critical-decision', risk:'critical', status:'pending',  title:'Aprobar adicional de obra — Cable 138kV Tintaya',         summary:'IC recomienda aprobar adicional de S/ 142,000 por cambio de ruta de tendido. Respaldado por acta de campo N° 14.',    agent:'Ing. Costos',        project:'PRY-001', decisionType:'Adicional presupuestal', created:'04 Jun 2026' },
  { id:'APR-002', category:'skill',            risk:'medium',   status:'pending',  title:'Activar skill — Gestión de Restricciones v1.1',            summary:'PM propone mejora al workflow de identificación de restricciones. Incorpora priorización por impacto en ruta crítica.', agent:'Project Management', project:'PRY-002', decisionType:'Activación de skill',    created:'03 Jun 2026' },
  { id:'APR-003', category:'memory',           risk:'low',      status:'pending',  title:'Guardar nota — Criterio de cableado en terreno rocoso',     summary:'IC propone guardar criterio técnico aplicado en PRY-001 como memoria operativa permanente del sistema.',               agent:'Ing. Costos',        project:'PRY-001', decisionType:'Memoria operativa',      created:'03 Jun 2026' },
  { id:'APR-004', category:'recommendation',   risk:'high',     status:'observed', title:'Acelerar entrega de equipos — Minsur PRY-003',             summary:'PM recomienda gestionar penalidad con proveedor para evitar retraso crítico. Impacto estimado: 22 días.',               agent:'Project Management', project:'PRY-003', decisionType:'Acción contractual',     created:'02 Jun 2026' },
  { id:'APR-005', category:'recommendation',   risk:'medium',   status:'pending',  title:'Actualizar cronograma maestro — SET Tintaya',              summary:'IC y PM proponen ajustar línea base por 12 días de retraso en fabricación. Impacto en hito de entrega FAT.',            agent:'IC + PM',            project:'PRY-001', decisionType:'Mod. cronograma',        created:'01 Jun 2026' },
];

const SKILLS = [
  {
    id:'SK-IC-001', name:'Revisión de Desviación de Presupuesto', status:'active',   version:'v1.3', agent:'Ing. Costos',           discipline:'Costos',     risk:'medium', approvalRequired:true,  type:'analysis-workflow',
    trigger:'Solicitud GG de análisis de desviación costo-plazo',
    inputs:['Presupuesto base aprobado','Valorización mensual actualizada','Actas de campo firmadas'],
    steps:['Calcular variación % sobre curva S','Identificar causas de desviación','Evaluar impacto proyectado al cierre','Proponer acción correctiva con evidencia'],
    safety:['No proponer adicionales > S/50K sin evidencia documental','Indicar fuente de cada supuesto','Distinguir costo incurrido de costo comprometido'],
    improvement:'Clasificar causas por tipo: diseño, campo, proveedor o fuerza mayor.',
    crossAgents:['IC + PM'], crossPurpose:'Coherencia entre desviación económica y retraso cronológico',
    ggApproval:{ label:'Aprobada', scope:'Alcance: proyectos eléctricos. Aprobada el 15 May 2026' }, date:'15 May 2026',
  },
  {
    id:'SK-PM-001', name:'Gestión de Restricciones de Proyecto', status:'proposed',  version:'v1.1', agent:'Project Management',    discipline:'PMO',        risk:'low',    approvalRequired:true,  type:'review-protocol',
    trigger:'Revisión mensual de restricciones activas por GG o PM',
    inputs:['Lista de restricciones vigentes','Cronograma actualizado','Registro de riesgos'],
    steps:['Identificar restricción por categoría','Clasificar impacto en ruta crítica','Proponer resolución con responsable','Elevar al GG para aprobación si es contractual'],
    safety:['No resolver restricciones contractuales sin aprobación GG','Documentar en acta antes de registrar como resuelta'],
    improvement:'Añadir priorización por impacto en hito crítico vs. actividad flotante.',
    crossAgents:['PM + IC'], crossPurpose:'Contrastar restricción con posible impacto económico',
    ggApproval:{ label:'Pendiente GG', scope:'Propuesta el 03 Jun 2026. Requiere revisión y aprobación.' }, date:'03 Jun 2026',
  },
  {
    id:'SK-PM-002', name:'Análisis de Riesgos de Retraso',      status:'observed',  version:'v1.0', agent:'Project Management',    discipline:'PMO',        risk:'high',   approvalRequired:true,  type:'coordination-rule',
    trigger:'Retraso detectado > 7 días en actividad de ruta crítica',
    inputs:['Línea base del cronograma','Avance real registrado','Registro de causas de retraso'],
    steps:['Detectar retraso sobre línea base','Evaluar impacto en ruta crítica','Modelar escenarios de recuperación','Recomendar acción al GG con probabilidad estimada'],
    safety:['No comprometer fechas contractuales sin aprobación GG','Indicar probabilidad de ocurrencia de cada escenario'],
    improvement:'Separar análisis cualitativo de cuantitativo para mejorar trazabilidad.',
    crossAgents:['PM + IC'], crossPurpose:'Verificar si retraso genera impacto en costos o penalidades',
    ggApproval:{ label:'Observada', scope:'GG solicitó clarificar criterio de identificación de ruta crítica.' }, date:'28 May 2026',
  },
  {
    id:'SK-IE-001', name:'Revisión de Criterios de Diseño Eléctrico', status:'proposed', version:'v0.1', agent:'Ing. Eléctrico (futuro)', discipline:'Eléctrica', risk:'high', approvalRequired:true, type:'knowledge-method',
    trigger:'Solicitud de revisión normativa de diseño eléctrico',
    inputs:['Normas aplicables (CNE, IEC, IEEE)','Especificaciones técnicas del cliente','Memoria de cálculo del proyecto'],
    steps:['Revisar norma aplicable al caso','Verificar criterio de diseño adoptado','Documentar observación técnica','Proponer corrección con referencia normativa'],
    safety:['Solo aplica cuando LLM real + RAG estén activos','No reemplaza criterio del ingeniero responsable de firma'],
    improvement:'Definir alcance normativo con el GG antes de activar.',
    crossAgents:['IE + IC + PM'], crossPurpose:'Coherencia entre criterio técnico, costo y cronograma',
    ggApproval:{ label:'En definición', scope:'Skill futura. Pendiente agente real, LLM y aprobación de alcance normativo.' }, date:'—',
  },
];

const MVP_REQUEST = {
  id:'SOL-2026-001', priority:'alta', status:'in-review', created:'04 Jun 2026',
  title:'Evaluar desviación costo-plazo — SET Tintaya 138kV',
  description:'Presupuesto aprobado: S/ 2.40 M. A junio 2026 se registra avance del 58% con costo incurrido de S/ 1.51 M vs. esperado de S/ 1.39 M según curva S. El PM reporta además 12 días de retraso acumulado sobre línea base.',
  agents:['IC','PM'],
};

const MVP_RESPONSES = [
  {
    id:'RSP-IC-001', agentId:'ic', agentName:'Ing. de Costos', initials:'IC',
    summary:'Confirma desviación de +8.7% sobre curva S. Causa: cambio de ruta de tendido por condición de terreno no prevista en estudio topográfico original.',
    findings:[
      { label:'Costo incurrido',             value:'S/ 1,513,000', type:'number'  },
      { label:'Costo esperado (curva S)',     value:'S/ 1,392,000', type:'number'  },
      { label:'Desviación actual',            value:'+S/ 121,000 (+8.7%)', type:'risk' },
      { label:'Desviación proyectada cierre', value:'+S/ 210,000 (+8.75%)', type:'risk' },
    ],
    recommendations:[
      'Aprobar adicional S/ 142,000 — cambio de ruta justificado técnicamente con acta N° 14.',
      'Emitir acta de campo N° 14 antes del 10 Jun 2026.',
      'Revisar contingencia remanente del presupuesto.',
    ],
    confidence:87, sources:2,
  },
  {
    id:'RSP-PM-001', agentId:'pm', agentName:'Project Management', initials:'PM',
    summary:'Retraso acumulado de 12 días sobre línea base. Ruta crítica afectada: tendido de cable + pruebas FAT. Sin acción correctiva, cierre proyectado al 15 Ago 2026.',
    findings:[
      { label:'Avance real',              value:'58%',           type:'number'  },
      { label:'Avance planificado',       value:'67%',           type:'warning' },
      { label:'Retraso acumulado',        value:'12 días',       type:'risk'    },
      { label:'Fecha cierre proyectada',  value:'15 Ago 2026',   type:'risk'    },
    ],
    recommendations:[
      'Actualizar cronograma maestro con nueva línea base ajustada.',
      'Gestionar penalidad con proveedor de cable (entrega FAT: 14 Jul).',
      'Evaluar reducción de plazo de montaje en 5 días con turno adicional.',
    ],
    confidence:74, sources:1,
  },
];

const MILESTONES = [
  { project:'PRY-001', label:'Revisión diseño básico',   date:'23 Jun 2026', days:18, status:'at-risk'  },
  { project:'PRY-001', label:'Entrega FAT equipos',       date:'14 Jul 2026', days:39, status:'on-track' },
  { project:'PRY-003', label:'Memoria de cálculo',        date:'30 Jun 2026', days:25, status:'delayed'  },
];

Object.assign(window, {
  AGENTS, CONNECTIONS, ALERTS, ACTIVITY, PROJECTS, APPROVALS, SKILLS,
  MVP_REQUEST, MVP_RESPONSES, MILESTONES,
});
