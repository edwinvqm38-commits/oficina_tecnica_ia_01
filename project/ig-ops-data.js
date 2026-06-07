// ig-ops-data.js — SGP-LITE operational data (EKA Mining)
// Extracted from ops-ia-v2-demo-main/lib/demoData.ts
// Plain JS — no TypeScript, no imports needed.
// ============================================================================

const OPS_CLIENTES = ["NEXA RESOURCES","MINERA HORIZONTE","PLANTA ALFA","CONSTRUCTORA DELTA","METALMECANICA SUR","ENERGIA NORTE","INGENIERIA ATLAS","SERVICIOS INDUSTRIALES K2"];
const OPS_PROYECTOS = ["Mantenimiento eléctrico","Tablero principal BT","Automatización de bombeo","Modernización subestación","Control de motores","Canalización de fuerza","Upgrade sala MCC","Integración de PLC"];
const OPS_UNIDADES  = ["Planta concentradora","Mina subterránea","Taller eléctrico","Subestación","Línea de transmisión","Área de mantenimiento","Poza 5","Chancado","Molienda"];
const OPS_RESPONSABLES = ["Edwin Quispe","Carmen Diaz","Luis Ramos","Jorge Ruiz","Ana Paredes","Marco Salas","Patricia Leon","Diego Flores"];
const OPS_ESTADOS_COT = ["Borrador","En revisión","No participa","Elaboración de cotización","VB Gerencia","Aprobada para envío","Enviada","Ganada","Perdida / No adjudicada"];
const OPS_ESTADOS_RQ  = ["Pendiente","En proceso","Atendido"];
const OPS_TIPOS_SERVICIO = ["Mantenimiento eléctrico","Montaje electromecánico","Ingeniería","Suministro","Servicio especializado","Construcción","Pruebas y comisionamiento","Otro"];
const OPS_AREAS = ["Operaciones","Mantenimiento","Logística","Oficina técnica","Seguridad","Calidad","Administración","Gerencia","Campo","Almacén"];
const OPS_PROVEEDORES = ["Suministros Lima","ElectroSur","Proveedor Industrial","Servicios Técnicos","Ferretería Central"];
const OPS_MARCAS = ["Schneider","Indeco","3M","Fluke","Siemens","ABB","Genérico","Sin marca"];
const OPS_TIPOS_RECURSO = ["Mano de obra directa","Materiales","Consumibles","Herramientas","Equipos","Vehículos","Transporte","Sub contratos","Gastos generales","EPPs"];

function _opsDate(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

// ─── Recursos (30) ────────────────────────────────────────────────────────────
const OPS_RECURSOS_BASE = [
  { id:"rec-001", codigo_recurso:"REC-2026-0001", codigo_eka:"EKA-MAT-001", codigo_fabricante:"IND-N2XOH-316", tipo_recurso:"Materiales", descripcion:"Cable N2XOH 3x16 mm2", unidad:"m", precio_unitario_ref:19.8, moneda:"PEN", proveedor:"Suministros Lima", marca:"Indeco", modelo:"N2XOH-316", tiempo_entrega_ref:"3 días", estado:"Activo", fecha_actualizacion:"2026-05-14", observaciones:"Uso en circuitos de potencia." },
  { id:"rec-002", codigo_recurso:"REC-2026-0002", codigo_eka:"EKA-EQP-014", codigo_fabricante:"SCH-TAB-24P",  tipo_recurso:"Equipos",     descripcion:"Tablero eléctrico adosado 24 polos", unidad:"und", precio_unitario_ref:1280, moneda:"PEN", proveedor:"ElectroSur", marca:"Schneider", modelo:"Prisma 24P", tiempo_entrega_ref:"7 días", estado:"Activo", fecha_actualizacion:"2026-05-14", observaciones:"Incluye riel DIN y borneras." },
  { id:"rec-003", codigo_recurso:"REC-2026-0003", codigo_eka:"EKA-HER-003", codigo_fabricante:"FLK-17BMAX",   tipo_recurso:"Herramientas", descripcion:"Multímetro digital Fluke 17B", unidad:"und", precio_unitario_ref:185, moneda:"USD", proveedor:"Proveedor Industrial", marca:"Fluke", modelo:"17B Max", tiempo_entrega_ref:"5 días", estado:"Por revisar", fecha_actualizacion:"2026-05-13", observaciones:"Validar calibración anual." },
  { id:"rec-004", codigo_recurso:"REC-2026-0004", codigo_eka:"EKA-CON-022", codigo_fabricante:"3M-TA-18",     tipo_recurso:"Consumibles",  descripcion:"Cinta aislante 3M Temflex 1700", unidad:"und", precio_unitario_ref:8.7, moneda:"PEN", proveedor:"Suministros Lima", marca:"3M", modelo:"Temflex 1700", tiempo_entrega_ref:"2 días", estado:"Activo", fecha_actualizacion:"2026-05-12", observaciones:"" },
  { id:"rec-005", codigo_recurso:"REC-2026-0005", codigo_eka:"EKA-SRV-008", codigo_fabricante:"SRV-MANT-ELEC",tipo_recurso:"Sub contratos",descripcion:"Servicio de mantenimiento eléctrico", unidad:"glb", precio_unitario_ref:4200, moneda:"PEN", proveedor:"Servicios Técnicos", marca:"Sin marca", modelo:"N/A", tiempo_entrega_ref:"10 días", estado:"Activo", fecha_actualizacion:"2026-05-14", observaciones:"Incluye inspección y reporte." },
];

const OPS_RECURSOS_GEN = Array.from({length:25}, (_,i) => {
  const idx = i+6;
  const tipo = OPS_TIPOS_RECURSO[i % OPS_TIPOS_RECURSO.length];
  return {
    id:`rec-${String(idx).padStart(3,"0")}`,
    codigo_recurso:`REC-2026-${String(idx).padStart(4,"0")}`,
    codigo_eka:`EKA-${tipo.slice(0,3).toUpperCase()}-${String(idx).padStart(3,"0")}`,
    codigo_fabricante:`FAB-${String(idx).padStart(4,"0")}`,
    tipo_recurso:tipo, descripcion:`${tipo} demo ${idx}`,
    unidad:["und","m","glb","kg","h"][i%5],
    precio_unitario_ref:Number((25+idx*6.2).toFixed(2)),
    moneda: i%5===0?"USD":"PEN",
    proveedor:OPS_PROVEEDORES[i%OPS_PROVEEDORES.length],
    marca:OPS_MARCAS[i%OPS_MARCAS.length],
    modelo:`M-${String(idx).padStart(3,"0")}`,
    tiempo_entrega_ref:`${(idx%12)+1} días`,
    estado:["Activo","Inactivo","Por revisar"][i%3],
    fecha_actualizacion:_opsDate(new Date("2026-05-01"),i),
    observaciones: i%2===0?"Demo catálogo local.":"",
  };
});

const OPS_RECURSOS = [...OPS_RECURSOS_BASE, ...OPS_RECURSOS_GEN];

// ─── Cotizaciones (50) ────────────────────────────────────────────────────────
const OPS_COTIZACIONES = Array.from({length:50}, (_,i) => {
  const idx = i+1;
  const base = new Date("2026-04-15");
  return {
    id:`cot-${String(idx).padStart(3,"0")}`,
    codigo:`COT-2026-${String(idx).padStart(4,"0")}`,
    oc:`OC-2026-${String(idx).padStart(4,"0")}`,
    cliente:OPS_CLIENTES[i%OPS_CLIENTES.length],
    proyecto:OPS_PROYECTOS[i%OPS_PROYECTOS.length],
    unidad_trabajo:OPS_UNIDADES[i%OPS_UNIDADES.length],
    moneda: i%4===0?"USD":"PEN",
    estado: i===0?"Adjudicado":OPS_ESTADOS_COT[i%OPS_ESTADOS_COT.length],
    estado_propuesta: ["Rev. Bases","Visita Técnica","Elaboración","Abs. Consultas","Lista para envío"][i%5],
    moneda_cotizacion: i%4===0?"USD":"PEN",
    flat_mensual: i%6===0,
    meses_analisis: i%6===0 ? (i%4)+2 : null,
    fecha_confirmacion:_opsDate(new Date("2026-04-22"),i),
    fecha_visita_tecnica:_opsDate(new Date("2026-04-25"),i),
    fecha_consultas:_opsDate(new Date("2026-04-28"),i),
    fecha_abs_consultas:_opsDate(new Date("2026-04-30"),i),
    fecha_entregada:_opsDate(new Date("2026-05-12"),i),
    fecha_inicio_analisis:i%6===0?_opsDate(new Date("2026-05-15"),i):"",
    fecha_fin_analisis:i%6===0?_opsDate(new Date("2026-06-15"),i):"",
    solicitante:OPS_RESPONSABLES[i%OPS_RESPONSABLES.length],
    responsable_tecnico:OPS_RESPONSABLES[i%OPS_RESPONSABLES.length],
    responsable_economico:OPS_RESPONSABLES[(i+3)%OPS_RESPONSABLES.length],
    tipo_servicio:OPS_TIPOS_SERVICIO[i%OPS_TIPOS_SERVICIO.length],
    prioridad:["Alta","Media","Baja"][i%3],
    fecha_registro:_opsDate(base,i),
    fecha_invitacion:_opsDate(new Date("2026-04-20"),i),
    fecha_presentacion:_opsDate(new Date("2026-05-01"),i),
    fecha_entrega:_opsDate(new Date("2026-05-08"),i),
    fecha_oc:_opsDate(new Date("2026-05-10"),i),
    avance:(i*7)%100,
    monto:Number((18000+(i%10)*6400+idx*175).toFixed(2)),
    observaciones:`Cotización demo ${idx}.`,
  };
});

// ─── Requerimientos (50) ──────────────────────────────────────────────────────
const OPS_SOLICITANTES_RQ = ["Luis Ramos","Edwin Quispe","Saul Sayas","Henry Bonifacio","Oficina técnica","Gerencia","Logística"];

const OPS_REQUERIMIENTOS = Array.from({length:50}, (_,i) => {
  const idx  = i+1;
  const cotIdx = (i%25)+1;
  const cot  = OPS_COTIZACIONES[cotIdx-1];
  const codCli  = cot.cliente.slice(0,4).replace(/\s/g,"").toUpperCase();
  const codUnit = cot.unidad_trabajo.slice(0,4).replace(/\s/g,"").toUpperCase();
  const codRq   = `RQ-2026-${codCli}-${codUnit}-P${String(cotIdx).padStart(3,"0")}-${String(i+1).padStart(4,"0")}`;
  return {
    id:`rq-${String(idx).padStart(3,"0")}`,
    codigo:codRq,
    cotizacion_id:`cot-${String(cotIdx).padStart(3,"0")}`,
    cotizacion_codigo:`COT-2026-${String(cotIdx).padStart(4,"0")}`,
    proyecto_servicio:cot.proyecto,
    cliente:cot.cliente,
    unidad_trabajo:cot.unidad_trabajo,
    oc:`OC-2026-${String(cotIdx).padStart(4,"0")}`,
    solicitante_rq:OPS_SOLICITANTES_RQ[i%OPS_SOLICITANTES_RQ.length],
    tipo_servicio:OPS_TIPOS_SERVICIO[i%OPS_TIPOS_SERVICIO.length],
    area:OPS_AREAS[i%OPS_AREAS.length],
    estado:OPS_ESTADOS_RQ[i%OPS_ESTADOS_RQ.length],
    fecha_solicitud:_opsDate(new Date("2026-05-01"),i),
    fecha_requerida:_opsDate(new Date("2026-05-10"),i+2),
    responsable:OPS_RESPONSABLES[(i+2)%OPS_RESPONSABLES.length],
    avance: Math.round((i*7)%100),
    total_items:(i%3)+2,
    items_totales:(i%3)+2,
    pendientes: Math.max(0, ((i%3)+2) - Math.floor((i*7)%100/50)),
    en_proceso: i%2,
    atendidos: Math.min((i%3)+2, Math.floor((i*7)%100/30)),
    vb_completos: Math.min((i%3)+2, Math.floor((i*7)%100/40)),
    con_recurso: Math.min((i%3)+2, Math.floor((i*7)%100/25)),
    sin_recurso: Math.max(0, ((i%3)+2) - Math.min((i%3)+2, Math.floor((i*7)%100/25))),
    con_ficha_suministrar: i%3,
    con_oc_os: i%2===0 ? 1 : 0,
    con_guia: i%4===0 ? 1 : 0,
    estado_rq: OPS_ESTADOS_RQ[i%OPS_ESTADOS_RQ.length],
    observaciones:`Gestionar prioridad ${(i%3)+1}.`,
  };
});

// ─── Detalle items (simplified) ───────────────────────────────────────────────
const OPS_DETALLE = OPS_REQUERIMIENTOS.flatMap((rq,i) => {
  const rows = (i%3)+2;
  return Array.from({length:rows}, (_,row) => {
    const rec = OPS_RECURSOS[(i*3+row)%OPS_RECURSOS.length];
    const cant = ((i+row)%7)+1;
    const precio = rec.precio_unitario_ref + row*1.5;
    return {
      id:`dtrq-${String(i*3+row+1).padStart(4,"0")}`,
      requerimiento_id:rq.id,
      recurso_id:rec.id,
      descripcion:rec.descripcion,
      tipo_recurso:rec.tipo_recurso,
      unidad:rec.unidad,
      cantidad:cant,
      precio_unitario:Number(precio.toFixed(2)),
      costo_total:Number((cant*precio).toFixed(2)),
      moneda:rec.moneda,
      proveedor:rec.proveedor,
      estado:["Pendiente","En proceso","Atendido"][row%3],
      logistica_compra:row%2===0?"Comprado":"Pendiente compra",
      eq:row%2===0?"Aprobado":"Pendiente",
      ll:row%3===0?"Aprobado":"Pendiente",
      hb:row%4===0?"Aprobado":"Pendiente",
      tiempo_entrega:rec.tiempo_entrega_ref,
      fecha_entrega:_opsDate(new Date("2026-05-15"),i+row),
    };
  });
});

// ─── Propuestas técnicas (demo) ───────────────────────────────────────────────
const _PROP_DISC = ["Eléctrica","Mecánica","Civil","Electromecánica","Instrumentación","Automatización"];
const _PROP_ESTADO = ["En elaboración","En revisión","Aprobada","Enviada","Observada"];
const _PROP_TITULOS = [
  "Tendido de cable 138kV en subestación","Montaje electromecánico de celdas MT",
  "Sistema de puesta a tierra y SPDA","Memoria de cálculo de cargas eléctricas",
  "Diseño de banco de condensadores","Protección y coordinación de relés",
  "Instalación de transformador de potencia","Tablero de control y fuerza",
  "Canalización y bandejas portacables","Sistema SCADA para subestación",
  "Estudio de cortocircuito y flujo de carga","Iluminación industrial LED",
];
const OPS_PROPUESTAS = Array.from({length:18}, (_,i)=>{
  const cot = OPS_COTIZACIONES[i % OPS_COTIZACIONES.length];
  return {
    id: `PROP-${String(i+1).padStart(3,"0")}`,
    codigo: `PT-2026-${String(i+1).padStart(4,"0")}`,
    titulo: _PROP_TITULOS[i % _PROP_TITULOS.length],
    cliente: cot.cliente,
    cotizacion_codigo: cot.codigo,
    disciplina: _PROP_DISC[i % _PROP_DISC.length],
    responsable: OPS_RESPONSABLES[i % OPS_RESPONSABLES.length],
    revision: `R${i % 3}`,
    paginas: 12 + (i*7) % 80,
    fecha_emision: _opsDate(new Date("2026-04-10"), i*2),
    estado: _PROP_ESTADO[i % _PROP_ESTADO.length],
  };
});

// ─── Summary stats for agents ─────────────────────────────────────────────────
const OPS_SUMMARY = {
  totalCotizaciones: OPS_COTIZACIONES.length,
  totalRequerimientos: OPS_REQUERIMIENTOS.length,
  totalRecursos: OPS_RECURSOS.length,
  totalDetalleItems: OPS_DETALLE.length,
  cotizacionesPorEstado: OPS_ESTADOS_COT.reduce((acc,e) => {
    acc[e] = OPS_COTIZACIONES.filter(c=>c.estado===e).length;
    return acc;
  }, {}),
  requerimientosPorEstado: OPS_ESTADOS_RQ.reduce((acc,e) => {
    acc[e] = OPS_REQUERIMIENTOS.filter(r=>r.estado===e).length;
    return acc;
  }, {}),
  montoTotalPEN: OPS_COTIZACIONES.filter(c=>c.moneda==="PEN").reduce((s,c)=>s+c.monto,0),
  montoTotalUSD: OPS_COTIZACIONES.filter(c=>c.moneda==="USD").reduce((s,c)=>s+c.monto,0),
  clientes: [...new Set(OPS_COTIZACIONES.map(c=>c.cliente))],
  topCliente: OPS_CLIENTES[0],
};

// ─── Agent context builder ────────────────────────────────────────────────────
function opsAgentContext(query) {
  const q = (query||"").toLowerCase();
  const lines = [];
  
  lines.push("=== DATOS OPERATIVOS EKA (SGP-LITE) ===");
  lines.push(`Total cotizaciones: ${OPS_SUMMARY.totalCotizaciones} | Requerimientos: ${OPS_SUMMARY.totalRequerimientos} | Recursos: ${OPS_SUMMARY.totalRecursos}`);
  
  // Estados cotizaciones
  lines.push("\nEstados de cotizaciones:");
  Object.entries(OPS_SUMMARY.cotizacionesPorEstado).filter(([,v])=>v>0).forEach(([k,v]) => {
    lines.push(`  - ${k}: ${v}`);
  });
  
  // Montos
  lines.push(`\nMonto total PEN: S/ ${OPS_SUMMARY.montoTotalPEN.toLocaleString("es-PE",{minimumFractionDigits:0,maximumFractionDigits:0})}`);
  lines.push(`Monto total USD: US$ ${OPS_SUMMARY.montoTotalUSD.toLocaleString("es-PE",{minimumFractionDigits:0,maximumFractionDigits:0})}`);
  
  // Si pregunta por un cliente específico
  OPS_CLIENTES.forEach(cli => {
    if (q.includes(cli.toLowerCase().split(" ")[0].toLowerCase())) {
      const cots = OPS_COTIZACIONES.filter(c=>c.cliente===cli);
      lines.push(`\nCotizaciones ${cli}: ${cots.length}`);
      cots.slice(0,3).forEach(c => lines.push(`  ${c.codigo} — ${c.proyecto} — ${c.estado} — ${c.moneda} ${c.monto.toLocaleString()}`));
    }
  });
  
  // Si pregunta por cotizaciones o estados
  if (q.includes("cotizaci") || q.includes("ganada") || q.includes("adjudic")) {
    const ganadas = OPS_COTIZACIONES.filter(c=>c.estado==="Ganada"||c.estado==="Adjudicado");
    lines.push(`\nCotizaciones ganadas/adjudicadas: ${ganadas.length}`);
    ganadas.slice(0,5).forEach(c=>lines.push(`  ${c.codigo} — ${c.cliente} — ${c.moneda} ${c.monto.toLocaleString()}`));
  }
  
  // Si pregunta por requerimientos
  if (q.includes("requerimient") || q.includes("rq-")) {
    lines.push(`\nRequerimientos pendientes: ${OPS_SUMMARY.requerimientosPorEstado["Pendiente"]||0}`);
    lines.push(`Requerimientos en proceso: ${OPS_SUMMARY.requerimientosPorEstado["En proceso"]||0}`);
    lines.push(`Requerimientos atendidos: ${OPS_SUMMARY.requerimientosPorEstado["Atendido"]||0}`);
    OPS_REQUERIMIENTOS.slice(0,5).forEach(r=>lines.push(`  ${r.codigo} — ${r.cliente} — ${r.estado} — ${r.area}`));
  }
  
  // Si pregunta por recursos/materiales
  if (q.includes("recurs") || q.includes("material") || q.includes("equipo") || q.includes("cable")) {
    lines.push("\nRecursos principales:");
    OPS_RECURSOS.slice(0,8).forEach(r=>lines.push(`  ${r.codigo_recurso} — ${r.descripcion} — ${r.moneda} ${r.precio_unitario_ref} / ${r.unidad}`));
  }

  // Si pregunta por propuestas técnicas
  if (q.includes("propuesta") || q.includes("técnic") || q.includes("tecnic") || q.includes("ingenier")) {
    lines.push(`\nPropuestas técnicas: ${OPS_PROPUESTAS.length}`);
    const porEstado = OPS_PROPUESTAS.reduce((a,p)=>({...a,[p.estado]:(a[p.estado]||0)+1}),{});
    Object.entries(porEstado).forEach(([k,v])=>lines.push(`  - ${k}: ${v}`));
    OPS_PROPUESTAS.slice(0,5).forEach(p=>lines.push(`  ${p.codigo} — ${p.titulo} — ${p.disciplina} — ${p.estado}`));
  }

  // Pendientes y alertas (siempre útiles para el GG)
  if (q.includes("resumen") || q.includes("ejecutiv") || q.includes("riesgo") || q.includes("pendiente") || q.includes("alerta")) {
    lines.push("\n=== PENDIENTES Y ALERTAS ===");
    lines.push(`RQ pendientes: ${OPS_SUMMARY.requerimientosPorEstado["Pendiente"]||0}`);
    lines.push(`Recursos por revisar: ${OPS_RECURSOS.filter(r=>r.estado==="Por revisar").length}`);
    lines.push(`Propuestas en elaboración: ${OPS_PROPUESTAS.filter(p=>p.estado==="En elaboración").length}`);
    const sinResp = OPS_REQUERIMIENTOS.filter(r=>!r.responsable||r.responsable==="—").length;
    if(sinResp>0) lines.push(`⚠ RQ sin responsable: ${sinResp}`);
  }

  return lines.join("\n");
}

Object.assign(window, {
  OPS_COTIZACIONES, OPS_REQUERIMIENTOS, OPS_RECURSOS, OPS_DETALLE, OPS_PROPUESTAS,
  OPS_SUMMARY, opsAgentContext,
  OPS_CLIENTES, OPS_TIPOS_SERVICIO, OPS_ESTADOS_COT, OPS_ESTADOS_RQ,
  OPS_RESPONSABLES, OPS_PROVEEDORES,
});
