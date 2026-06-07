// ig-ingenieria.jsx — Módulo de Ingeniería Eléctrica
// Criterios normativos, checklists técnicos, referencia de cables/equipos, análisis IA.
// ============================================================================

// ─── Mock data normativo ──────────────────────────────────────────────────────
const NORMAS = [
  { id:"CNE-U", nombre:"CNE Utilización", org:"MINEM Perú", edicion:"2011", tema:"Instalaciones eléctricas hasta 1kV", aplicacion:"Baja tensión, instalaciones industriales" },
  { id:"CNE-S", nombre:"CNE Suministro",  org:"MINEM Perú", edicion:"2011", tema:"Redes eléctricas de distribución", aplicacion:"MT/AT, líneas de distribución" },
  { id:"IEC-61936", nombre:"IEC 61936-1",  org:"IEC", edicion:"2021", tema:"Instalaciones de potencia > 1kV", aplicacion:"Subestaciones de AT/MT" },
  { id:"IEC-60076", nombre:"IEC 60076",    org:"IEC", edicion:"2018", tema:"Transformadores de potencia", aplicacion:"Especificación y ensayo de transformadores" },
  { id:"IEC-60287", nombre:"IEC 60287",    org:"IEC", edicion:"2023", tema:"Capacidad de corriente en cables", aplicacion:"Cálculo de capacidad de cables enterrados o al aire" },
  { id:"IEEE-80",  nombre:"IEEE Std 80",   org:"IEEE", edicion:"2013", tema:"Puesta a tierra en subestaciones", aplicacion:"Diseño de malla de tierra" },
  { id:"IEEE-C37", nombre:"IEEE C37",       org:"IEEE", edicion:"2019", tema:"Protecciones y switchgear", aplicacion:"Coordinación de protecciones" },
  { id:"NFPA-70E", nombre:"NFPA 70E",      org:"NFPA", edicion:"2021", tema:"Seguridad eléctrica en trabajo", aplicacion:"EPP y distancias de arco" },
];

const CHECKLISTS = {
  "SET": {
    nombre:"Subestación de Transformación",
    fases:[
      { fase:"Ingeniería Básica", items:[
        { id:"s1",  texto:"Definir nivel de tensión primario y secundario",     norma:"CNE-S Art. 3.2",    status:"ok"      },
        { id:"s2",  texto:"Determinar potencia instalada y de reserva (kVA)",   norma:"IEC 60076",         status:"ok"      },
        { id:"s3",  texto:"Seleccionar configuración de barras (simple/doble)",  norma:"IEC 61936-1",       status:"ok"      },
        { id:"s4",  texto:"Definir esquema de protecciones (50/51, 87T, 67)",    norma:"IEEE C37",          status:"observe" },
        { id:"s5",  texto:"Calcular corriente de cortocircuito en HV y LV",     norma:"IEC 60909",         status:"pending" },
      ]},
      { fase:"Diseño de Detalle", items:[
        { id:"s6",  texto:"Dimensionar conductores de barra desnuda",            norma:"IEC 60287",         status:"pending" },
        { id:"s7",  texto:"Diseñar malla de puesta a tierra",                   norma:"IEEE Std 80",       status:"pending" },
        { id:"s8",  texto:"Definir distancias de aislamiento en AT",            norma:"IEC 61936-1 §6",    status:"pending" },
        { id:"s9",  texto:"Especificar celdas de media tensión (SF6 o vacío)",   norma:"IEC 62271-200",     status:"pending" },
        { id:"s10", texto:"Calcular alumbrado y servicios auxiliares CC/CA",    norma:"CNE-U Art. 150",    status:"pending" },
      ]},
      { fase:"Construcción y Ensayos", items:[
        { id:"s11", texto:"Protocolo de pruebas de transformador (FAT/SAT)",     norma:"IEC 60076-1",       status:"pending" },
        { id:"s12", texto:"Medición de resistencia de malla de tierra",          norma:"IEEE Std 80 §17",   status:"pending" },
        { id:"s13", texto:"Prueba de coordinación de protecciones",              norma:"IEEE C37.114",      status:"pending" },
        { id:"s14", texto:"Verificar rótulos, señalización y bloqueos LOTO",    norma:"NFPA 70E",          status:"pending" },
      ]},
    ],
  },
  "LT": {
    nombre:"Línea de Transmisión",
    fases:[
      { fase:"Ingeniería Básica", items:[
        { id:"l1", texto:"Definir tensión nominal y clase de aislamiento",       norma:"CNE-S Art. 4.1",    status:"ok"      },
        { id:"l2", texto:"Calcular potencia a transportar y factor de pérdidas", norma:"IEC 60826",         status:"ok"      },
        { id:"l3", texto:"Estudio de trazado y predios (faja de servidumbre)",   norma:"CNE-S Art. 219",    status:"observe" },
        { id:"l4", texto:"Determinar tipo y sección de conductor (ACSR/ACCC)",   norma:"IEC 60287 + CNE",   status:"pending" },
      ]},
      { fase:"Diseño Estructural", items:[
        { id:"l5", texto:"Selección de torres (celosía/tubular/composite)",      norma:"IEC 60826",         status:"pending" },
        { id:"l6", texto:"Cálculo de cadenas de aisladores",                     norma:"IEC 60305",         status:"pending" },
        { id:"l7", texto:"Verificación de distancias mínimas al terreno y cruce",norma:"CNE-S Art. 224",    status:"pending" },
        { id:"l8", texto:"Diseño de puesta a tierra en cada estructura",         norma:"IEEE Std 80",       status:"pending" },
      ]},
    ],
  },
  "SSEE-IND": {
    nombre:"SSEE Industrial (hasta 22.9kV)",
    fases:[
      { fase:"Concepción", items:[
        { id:"i1", texto:"Levantamiento de cargas (planilla de cargas)",         norma:"CNE-U Art. 50",     status:"ok"      },
        { id:"i2", texto:"Definir alimentación en MT o BT según demanda",        norma:"CNE-U / CNE-S",     status:"ok"      },
        { id:"i3", texto:"Seleccionar sistema de respaldo (UPS/grupo)",          norma:"IEC 62040",         status:"pending" },
      ]},
      { fase:"Diseño Eléctrico", items:[
        { id:"i4", texto:"Coordinar protecciones desde acometida hasta cargas",  norma:"IEEE C37.2",        status:"pending" },
        { id:"i5", texto:"Dimensionar transformador de distribución",            norma:"IEC 60076",         status:"pending" },
        { id:"i6", texto:"Diseñar tableros MT y BT con breakers calibrados",    norma:"IEC 60947 / NFPA",  status:"pending" },
        { id:"i7", texto:"Memoria de cálculo de caída de tensión",              norma:"CNE-U Art. 130",    status:"pending" },
      ]},
    ],
  },
};

const CABLES = [
  { tipo:"XLPE 138kV",  conductor:"ACSR 500kcmil",  Imax:760, R:"0.0366 Ω/km", X:"0.330 Ω/km", aplic:"Transmisión AT", norma:"IEC 60502-2", peso:"8.2 kg/m" },
  { tipo:"XLPE 60kV",   conductor:"ACSR 350kcmil",  Imax:580, R:"0.0520 Ω/km", X:"0.340 Ω/km", aplic:"Subtransmisión", norma:"IEC 60502-2", peso:"5.6 kg/m" },
  { tipo:"XLPE 22.9kV", conductor:"ACSR 240 mm²",   Imax:460, R:"0.0754 Ω/km", X:"0.370 Ω/km", aplic:"Distribución MT", norma:"IEC 60502-1", peso:"3.8 kg/m" },
  { tipo:"XLPE 10kV",   conductor:"ACSR 150 mm²",   Imax:340, R:"0.124 Ω/km",  X:"0.388 Ω/km", aplic:"Distribución MT", norma:"IEC 60502-1", peso:"2.4 kg/m" },
  { tipo:"THW 600V",    conductor:"Cu sólido 4 AWG", Imax:95,  R:"0.821 Ω/km",  X:"—",           aplic:"Instalaciones BT", norma:"NTP-IEC 60227", peso:"0.28 kg/m" },
  { tipo:"N2XSY 138kV", conductor:"Cu 630 mm²",     Imax:850, R:"0.0283 Ω/km", X:"0.282 Ω/km", aplic:"Cables subterráneos AT", norma:"IEC 60502-2", peso:"12.1 kg/m" },
];

// ─── Pie chart SVG ────────────────────────────────────────────────────────────
function PieChart({ data, size=80 }) {
  const total = data.reduce((s,d)=>s+d.value,0);
  let cumAngle = -Math.PI/2;
  const r = size/2 - 6; const cx = size/2; const cy = size/2;
  const slices = data.map(d => {
    const angle = (d.value/total)*Math.PI*2;
    const x1 = cx + r*Math.cos(cumAngle);
    const y1 = cy + r*Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r*Math.cos(cumAngle);
    const y2 = cy + r*Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { ...d, path:`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z` };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} opacity={.9}/>)}
      <circle cx={cx} cy={cy} r={r*0.42} fill="var(--bg-card)"/>
    </svg>
  );
}

// ─── Status chip ──────────────────────────────────────────────────────────────
const STATUS_CHK = {
  ok:      { label:"OK",      color:"var(--green)",  bg:"var(--green-bg)",  border:"var(--green-border)"  },
  observe: { label:"Observar",color:"var(--amber)",  bg:"var(--amber-bg)",  border:"var(--amber-border)"  },
  pending: { label:"Pendiente",color:"var(--t3)",    bg:"var(--bg-subtle)", border:"var(--border)"         },
};

function CheckItem({ item, onChange }) {
  const s = STATUS_CHK[item.status] || STATUS_CHK.pending;
  return (
    <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
      <select value={item.status} onChange={e=>onChange(item.id, e.target.value)}
        style={{flexShrink:0,fontSize:9.5,padding:"2px 4px",borderRadius:"var(--r-sm)",border:`1px solid ${s.border}`,background:s.bg,color:s.color,fontWeight:600,cursor:"pointer"}}>
        <option value="pending">Pendiente</option>
        <option value="ok">OK</option>
        <option value="observe">Observar</option>
      </select>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,color:"var(--t1)"}}>{item.texto}</div>
        <div style={{fontSize:10,color:"var(--t3)",fontFamily:"var(--mono)",marginTop:1}}>{item.norma}</div>
      </div>
    </div>
  );
}

// ─── IngenieriaView ───────────────────────────────────────────────────────────
function IngenieriaView() {
  const [tab, setTab] = React.useState("normas");
  const [checklistType, setChecklistType] = React.useState("SET");
  const [checkStates, setCheckStates] = React.useState({});
  const [aiQuery, setAiQuery] = React.useState("");
  const [aiResult, setAiResult] = React.useState(null);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [cableFilter, setCableFilter] = React.useState("");

  function updateCheck(id, status) {
    setCheckStates(prev=>({...prev,[id]:status}));
  }

  const cl = CHECKLISTS[checklistType];
  const totalItems = cl.fases.reduce((s,f)=>s+f.items.length,0);
  const doneItems  = cl.fases.reduce((s,f)=>s+f.items.filter(i=>(checkStates[i.id]||i.status)==="ok").length,0);
  const pctDone    = Math.round((doneItems/totalItems)*100);

  const filteredCables = CABLES.filter(c =>
    !cableFilter || c.tipo.toLowerCase().includes(cableFilter.toLowerCase()) ||
    c.aplic.toLowerCase().includes(cableFilter.toLowerCase()) ||
    c.norma.toLowerCase().includes(cableFilter.toLowerCase())
  );

  async function askIE() {
    if (!aiQuery.trim()) return;
    setAiBusy(true); setAiResult(null);
    const sys = buildSystemPrompt("ie", { knowledge: IGStore.get().knowledge.filter(k=>k.status==="validated") });
    const prompt = `Consulta de ingeniería eléctrica normativa:\n${aiQuery}\n\nResponde con: norma aplicable + artículo/cláusula específica + criterio técnico + cómo aplica al caso. Sé preciso y fundamentado.`;
    const res = await callClaude(sys, prompt);
    setAiResult(res.text);
    setAiBusy(false);
    IGActions.logTimeline({type:"knowledge",title:"Consulta normativa IE",detail:aiQuery.slice(0,60),result:"ok"});
  }

  const tabs = [
    {id:"normas",     label:"Normas"},
    {id:"checklist",  label:"Checklist técnico"},
    {id:"cables",     label:"Referencia cables"},
    {id:"consulta",   label:"Consulta IA (IE)"},
  ];

  return (
    <>
      <AIPageHeader
        eyebrow="Ingeniería Eléctrica"
        title="Normas técnicas, checklists y referencia de diseño"
        description="Criterios normativos CNE/IEC/IEEE, checklists por tipo de proyecto, referencia de cables y consultas al Ing. Eléctrico con IA. Datos mock — el agente IE está en desarrollo."
        actions={
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span className="badge badge--amber">Agente IE: futuro</span>
            <span className="badge badge--blue badge--dot">IA real en Consulta</span>
          </div>
        }
      />

      {/* Tabs */}
      <div style={{display:"flex",gap:2,marginBottom:10,background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--r)",padding:3,width:"fit-content"}}>
        {tabs.map(t=>(
          <button key={t.id} className={`mode-tab ${tab===t.id?"mode-tab--active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ── Normas ── */}
      {tab==="normas" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {NORMAS.map(n=>(
            <div key={n.id} className="card" style={{padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:5}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{n.nombre}</div>
                  <div style={{fontSize:10,color:"var(--t3)",fontFamily:"var(--mono)"}}>{n.id} · Ed. {n.edicion}</div>
                </div>
                <span className="badge badge--blue" style={{flexShrink:0}}>{n.org}</span>
              </div>
              <div style={{fontSize:11.5,color:"var(--t2)",marginBottom:5}}>{n.tema}</div>
              <div style={{fontSize:11,color:"var(--t3)",background:"var(--bg-subtle)",borderRadius:"var(--r-sm)",padding:"4px 7px"}}>
                <b style={{color:"var(--t2)"}}>Aplica en:</b> {n.aplicacion}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Checklist ── */}
      {tab==="checklist" && (
        <div>
          <div style={{display:"flex",gap:10,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
            <select className="select" style={{width:"auto",padding:"6px 10px"}} value={checklistType} onChange={e=>setChecklistType(e.target.value)}>
              {Object.entries(CHECKLISTS).map(([k,v])=><option key={k} value={k}>{v.nombre}</option>)}
            </select>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{height:6,width:120,borderRadius:99,background:"var(--bg-subtle)"}}>
                <div style={{height:"100%",borderRadius:99,background:pctDone===100?"var(--green)":"var(--blue)",width:`${pctDone}%`,transition:"width .3s"}}/>
              </div>
              <span style={{fontSize:12,fontWeight:700,color:"var(--t1)"}}>{doneItems}/{totalItems} <span style={{color:"var(--t3)",fontWeight:400}}>ítems OK</span></span>
            </div>
            <div style={{display:"flex",gap:5}}>
              {Object.entries(STATUS_CHK).map(([k,v])=>{
                const cnt = cl.fases.reduce((s,f)=>s+f.items.filter(i=>(checkStates[i.id]||i.status)===k).length,0);
                return cnt>0 ? <span key={k} className="badge" style={{background:v.bg,color:v.color,borderColor:v.border}}>{cnt} {v.label}</span> : null;
              })}
            </div>
          </div>

          <div className="space-y-3">
            {cl.fases.map(fase=>(
              <div key={fase.fase} className="card">
                <div className="card-header">
                  <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{fase.fase}</div>
                  <span style={{fontSize:11,color:"var(--t3)"}}>{fase.items.length} ítems</span>
                </div>
                <div style={{padding:"4px 14px 10px"}}>
                  {fase.items.map(item=>(
                    <CheckItem key={item.id} item={{...item, status:checkStates[item.id]||item.status}} onChange={updateCheck}/>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cables ── */}
      {tab==="cables" && (
        <div className="card">
          <div className="card-header">
            <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>Referencia de cables eléctricos</div>
            <input value={cableFilter} onChange={e=>setCableFilter(e.target.value)}
              placeholder="Filtrar por tipo, aplicación o norma…"
              style={{border:"1px solid var(--border)",borderRadius:"var(--r)",padding:"4px 8px",fontSize:11,outline:"none",background:"var(--bg-card)",width:200}}
            />
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
              <thead>
                <tr style={{background:"var(--bg-subtle)"}}>
                  {["Tipo cable","Conductor","I máx (A)","R (Ω/km)","X (Ω/km)","Norma","Aplicación","Peso"].map(h=>(
                    <th key={h} style={{padding:"7px 12px",textAlign:"left",fontWeight:600,color:"var(--t3)",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap",fontSize:11}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCables.map((c,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                    <td style={{padding:"7px 12px",fontWeight:700,color:"var(--t1)"}}>{c.tipo}</td>
                    <td style={{padding:"7px 12px",color:"var(--t2)",fontFamily:"var(--mono)",fontSize:11}}>{c.conductor}</td>
                    <td style={{padding:"7px 12px",color:"var(--blue-text)",fontWeight:700,fontFamily:"var(--mono)",textAlign:"right"}}>{c.Imax}</td>
                    <td style={{padding:"7px 12px",color:"var(--t2)",fontFamily:"var(--mono)",fontSize:11}}>{c.R}</td>
                    <td style={{padding:"7px 12px",color:"var(--t2)",fontFamily:"var(--mono)",fontSize:11}}>{c.X}</td>
                    <td style={{padding:"7px 12px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)"}}>{c.norma}</td>
                    <td style={{padding:"7px 12px",color:"var(--t2)"}}>{c.aplic}</td>
                    <td style={{padding:"7px 12px",color:"var(--t3)",fontFamily:"var(--mono)",fontSize:11}}>{c.peso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Consulta IA ── */}
      {tab==="consulta" && (
        <div className="space-y-3">
          <div className="card">
            <div className="card-header">
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <div className="agent-avatar agent-avatar--future" style={{width:30,height:30,fontSize:10}}>IE</div>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>Ing. Eléctrico — Consulta normativa</div>
                  <div style={{fontSize:11,color:"var(--t3)"}}>Responde con la norma exacta, artículo y criterio técnico aplicable</div>
                </div>
              </div>
              <span className="badge badge--blue badge--dot">IA real</span>
            </div>
            <div style={{padding:"12px 14px"}}>
              <div className="field">
                <label className="field-label">Tu consulta técnica</label>
                <textarea className="textarea" style={{minHeight:80}} value={aiQuery}
                  onChange={e=>setAiQuery(e.target.value)}
                  placeholder="Ej: ¿Cuál es la distancia mínima de aislamiento para barras desnudas a 138kV según IEC 61936?&#10;Ej: ¿Qué sección mínima de conductor se requiere para 15 MW a 60kV, factor de potencia 0.92?"/>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button className="btn btn--primary" onClick={askIE} disabled={aiBusy||!aiQuery.trim()}>
                  {aiBusy?<span className="spinner"/>:<Icons.sparkle width="13" height="13"/>} Consultar al IE
                </button>
                {["Distancia aislamiento 138kV (IEC 61936)","Sección cable 500 A a 22.9kV (IEC 60287)","Malla de tierra en subestación (IEEE 80)","Coordinación de protecciones 138/22kV"].map(s=>(
                  <button key={s} className="btn btn--ghost btn--sm" onClick={()=>setAiQuery(s)}>{s}</button>
                ))}
              </div>
            </div>
          </div>

          {aiBusy && (
            <div className="card" style={{padding:"24px",textAlign:"center",color:"var(--t3)"}}>
              <span className="spinner" style={{width:22,height:22,margin:"0 auto 10px",display:"block"}}/>
              <div style={{fontSize:12}}>El Ing. Eléctrico está buscando en la normativa…</div>
            </div>
          )}

          {aiResult && (
            <div className="card">
              <div className="card-header">
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div className="agent-avatar agent-avatar--future" style={{width:26,height:26,fontSize:9}}>IE</div>
                  <span style={{fontSize:12.5,fontWeight:600,color:"var(--t1)"}}>Respuesta normativa</span>
                </div>
                <span className="badge badge--green">Respondido</span>
              </div>
              <div style={{padding:"12px 14px",fontSize:13,color:"var(--t1)",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{aiResult}</div>
              <div style={{padding:"8px 14px",borderTop:"1px solid var(--border)",background:"var(--bg-subtle)",fontSize:10.5,color:"var(--t3)"}}>
                Respuesta generada por IA · No reemplaza criterio del ingeniero responsable de firma
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

Object.assign(window, { IngenieriaView, PieChart });
