// ig-costos.jsx — Módulo de Costos y Presupuestos
// APU, valorizaciones, curva S, desviaciones, adicionales.
// ============================================================================

// ─── Mock data local ──────────────────────────────────────────────────────────
const COST_DATA = {
  "PRY-001": {
    presupuesto: 2400000,
    incurrido:   1513000,
    comprometido: 680000,
    curvaS: [0,5,12,22,35,48,58,67,75,83,90,95,100],          // % mensual planificado
    real:   [0,4,11,19,30,41,52,58,0,0,0,0,0],                 // % mensual real
    meses:  ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Set","Oct","Nov","Dic","Ene27"],
    adicionales: [
      { id:"AD-001", desc:"Cambio ruta tendido cable — terreno rocoso", monto:142000, status:"pendiente", agente:"IC" },
      { id:"AD-002", desc:"Incremento costo acero por alza mercado",    monto:28500,  status:"observado", agente:"IC" },
    ],
    apus: [
      { id:"APU-001", partida:"Tendido cable 138kV (por ml)",    unidad:"ml",  cant:1840, pu:210, total:386400 },
      { id:"APU-002", partida:"Montaje celda de línea 138kV",    unidad:"und", cant:3,    pu:48500, total:145500 },
      { id:"APU-003", partida:"Obras civiles SET (cimentación)", unidad:"m²",  cant:320,  pu:680, total:217600 },
      { id:"APU-004", partida:"Equipamiento protecciones",        unidad:"und", cant:6,    pu:22400, total:134400 },
      { id:"APU-005", partida:"Instalaciones eléctricas internas",unidad:"glb", cant:1,   pu:185000, total:185000 },
    ],
    valorizaciones: [
      { n:1, mes:"Abr 2026", avance:19, monto:415000, status:"aprobada"  },
      { n:2, mes:"May 2026", avance:30, monto:287000, status:"aprobada"  },
      { n:3, mes:"Jun 2026", avance:52, monto:401000, status:"pendiente" },
    ],
  },
  "PRY-002": {
    presupuesto: 1800000, incurrido: 1296000, comprometido: 360000,
    curvaS: [0,6,14,25,38,52,64,72,79,86,92,97,100],
    real:   [0,6,15,27,40,54,66,72,0,0,0,0,0],
    meses:  ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Set","Oct","Nov","Dic","Ene27"],
    adicionales: [],
    apus: [
      { id:"APU-010", partida:"Línea 60kV (por km)",             unidad:"km",  cant:18.4, pu:62000, total:1140800 },
      { id:"APU-011", partida:"Torres de alta tensión",          unidad:"und", cant:92,   pu:4800,  total:441600 },
    ],
    valorizaciones: [
      { n:1, mes:"Mar 2026", avance:27, monto:486000, status:"aprobada"  },
      { n:2, mes:"Abr 2026", avance:54, monto:497000, status:"aprobada"  },
      { n:3, mes:"May 2026", avance:72, monto:313000, status:"pendiente" },
    ],
  },
  "PRY-003": {
    presupuesto: 630000, incurrido: 138600, comprometido: 95000,
    curvaS: [0,8,18,30,44,56,68,78,86,92,97,100,100],
    real:   [0,5,11,22,0,0,0,0,0,0,0,0,0],
    meses:  ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Set","Oct","Nov","Dic","Ene27"],
    adicionales: [
      { id:"AD-010", desc:"Retraso proveedor equipos MT — penalidad", monto:18000, status:"pendiente", agente:"IC" },
    ],
    apus: [
      { id:"APU-020", partida:"SSEE 22.9kV instalación completa", unidad:"glb", cant:1, pu:420000, total:420000 },
      { id:"APU-021", partida:"Canalización y tendido MT",         unidad:"ml",  cant:480, pu:285, total:136800 },
    ],
    valorizaciones: [
      { n:1, mes:"Feb 2026", avance:11, monto:69300,  status:"aprobada" },
      { n:2, mes:"Mar 2026", avance:22, monto:69300,  status:"aprobada" },
    ],
  },
};

// ─── Mini SVG curva S ─────────────────────────────────────────────────────────
function CurvaS({ planned, real, width=220, height=60 }) {
  const n = planned.length;
  const pts = (arr) => arr.map((v,i) => `${(i/(n-1))*width},${height - (v/100)*height}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{width:"100%", height, display:"block"}}>
      {/* grid lines */}
      {[25,50,75].map(y => (
        <line key={y} x1={0} y1={height-(y/100)*height} x2={width} y2={height-(y/100)*height}
          stroke="var(--border)" strokeWidth={0.5}/>
      ))}
      {/* planned */}
      <polyline points={pts(planned)} fill="none" stroke="var(--blue)" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.7}/>
      {/* real (up to last nonzero) */}
      <polyline points={pts(real.map((v,i)=>real[i]===0&&i>2?null:v).filter(v=>v!==null))}
        fill="none" stroke="var(--green)" strokeWidth={2}/>
      {/* legend */}
      <rect x={2} y={2} width={6} height={2} fill="var(--blue)" opacity={0.7}/>
      <text x={10} y={6} fontSize={5} fill="var(--t3)">Planificado</text>
      <rect x={2} y={10} width={6} height={2} fill="var(--green)"/>
      <text x={10} y={14} fontSize={5} fill="var(--t3)">Real</text>
    </svg>
  );
}

// ─── Progress ring ────────────────────────────────────────────────────────────
function ProgressRing({ pct, color, size=52 }) {
  const r = (size-6)/2; const circ = 2*Math.PI*r;
  const dash = (pct/100)*circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-subtle)" strokeWidth={5}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round"
        style={{transition:"stroke-dasharray .4s ease"}}/>
    </svg>
  );
}

// ─── CostosView ───────────────────────────────────────────────────────────────
function CostosView() {
  const [state] = useStore();
  const [activeProject, setActiveProject] = React.useState("PRY-001");
  const [tab, setTab] = React.useState("resumen"); // resumen | curva | apu | valorizaciones | adicionales
  const allProjects = [...(window.PROJECTS||[]), ...state.customProjects];
  const d = COST_DATA[activeProject];
  const proj = allProjects.find(p=>p.id===activeProject);

  if (!d) return <div style={{padding:20,color:"var(--t3)"}}>Sin datos de costos para este proyecto.</div>;

  const libre = d.presupuesto - d.incurrido - d.comprometido;
  const pctIncurrido = Math.round((d.incurrido/d.presupuesto)*100);
  const pctComprometido = Math.round((d.comprometido/d.presupuesto)*100);
  const desviacion = d.incurrido - (d.presupuesto * (proj?.progress||0)/100);
  const desviacionPct = ((desviacion / d.presupuesto)*100).toFixed(1);
  const desviacionColor = desviacion > 0 ? "var(--red-text)" : "var(--green-text)";

  const tabs = [
    {id:"resumen",       label:"Resumen"},
    {id:"curva",         label:"Curva S"},
    {id:"apu",           label:"APU"},
    {id:"valorizaciones",label:"Valorizaciones"},
    {id:"adicionales",   label:"Adicionales"},
  ];

  const fmt = (n) => `S/ ${n.toLocaleString("es-PE")}`;

  return (
    <>
      <AIPageHeader
        eyebrow="Costos y Presupuestos"
        title="Control económico de proyectos"
        description="APU, curva S, valorizaciones y adicionales. Datos simulados — el Ing. de Costos (IC) analiza desviaciones y propone acciones."
        actions={
          <div style={{display:"flex", gap:6, alignItems:"center"}}>
            <select className="select" style={{padding:"5px 10px"}} value={activeProject} onChange={e=>setActiveProject(e.target.value)}>
              {allProjects.map(p=><option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
            </select>
            <span className="badge badge--mock">Datos mock</span>
          </div>
        }
      />

      {/* Project cost header */}
      <div className="card" style={{marginBottom:10}}>
        <div style={{padding:"12px 16px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap"}}>
          <div style={{display:"flex", alignItems:"center", gap:12}}>
            <ProgressRing pct={pctIncurrido} color="var(--blue)" size={56}/>
            <div>
              <div style={{fontSize:10, textTransform:"uppercase", letterSpacing:".1em", color:"var(--t3)", fontWeight:600}}>Presupuesto aprobado</div>
              <div style={{fontSize:20, fontWeight:800, color:"var(--t1)", fontFamily:"var(--mono)"}}>{fmt(d.presupuesto)}</div>
            </div>
          </div>
          <div style={{flex:1, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, minWidth:0}}>
            {[
              {label:"Incurrido",     value:fmt(d.incurrido),   pct:pctIncurrido,    color:"var(--blue)"  },
              {label:"Comprometido",  value:fmt(d.comprometido),pct:pctComprometido, color:"var(--amber)" },
              {label:"Libre",         value:fmt(libre),          pct:Math.round((libre/d.presupuesto)*100), color:"var(--green)" },
              {label:"Desviación",    value:`${desviacion>0?"+":""}${fmt(desviacion)} (${desviacion>0?"+":""}${desviacionPct}%)`, pct:null, color:desviacionColor },
            ].map(c=>(
              <div key={c.label} className="ig-tile">
                <div className="ig-tile-label">{c.label}</div>
                <div className="ig-tile-value" style={{fontSize:13, color:c.color, fontFamily:"var(--mono)"}}>{c.value}</div>
                {c.pct!==null && (
                  <div style={{marginTop:5}}>
                    <div style={{height:3, borderRadius:99, background:"var(--bg-subtle)"}}>
                      <div style={{height:"100%", borderRadius:99, background:c.color, width:`${Math.min(c.pct,100)}%`, transition:"width .3s"}}/>
                    </div>
                    <div style={{fontSize:9, color:"var(--t3)", marginTop:2}}>{c.pct}%</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex", gap:2, marginBottom:10, background:"var(--bg-subtle)", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:3, width:"fit-content"}}>
        {tabs.map(t=>(
          <button key={t.id} className={`mode-tab ${tab===t.id?"mode-tab--active":""}`} onClick={()=>setTab(t.id)}>
            {t.label}
            {t.id==="adicionales" && d.adicionales.length>0 && (
              <span className="sb-badge" style={{marginLeft:5, height:14, minWidth:14, fontSize:9}}>{d.adicionales.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Resumen ── */}
      {tab==="resumen" && (
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
          <div className="card">
            <div className="card-header"><div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>Distribución presupuestaria</div></div>
            <div style={{padding:"14px 16px", display:"flex", flexDirection:"column", gap:10}}>
              {[
                {label:"Incurrido",     val:d.incurrido,    color:"var(--blue)",  pct:pctIncurrido},
                {label:"Comprometido",  val:d.comprometido, color:"var(--amber)", pct:pctComprometido},
                {label:"Libre",         val:libre,           color:"var(--green)", pct:Math.round((libre/d.presupuesto)*100)},
              ].map(r=>(
                <div key={r.label}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:11,color:"var(--t2)",fontWeight:600}}>{r.label}</span>
                    <div style={{display:"flex",gap:8}}>
                      <span style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--t1)"}}>{fmt(r.val)}</span>
                      <span style={{fontSize:11,fontWeight:700,color:r.color}}>{r.pct}%</span>
                    </div>
                  </div>
                  <div style={{height:6,borderRadius:99,background:"var(--bg-subtle)"}}>
                    <div style={{height:"100%",borderRadius:99,background:r.color,width:`${Math.min(r.pct,100)}%`,transition:"width .4s"}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>Indicadores clave</div></div>
            <div style={{padding:"8px 0"}}>
              {[
                {label:"CPI (Cost Performance Index)",    value: (pctIncurrido/(proj?.progress||1)).toFixed(2), note:"< 1 = sobre costo"},
                {label:"SPI (Schedule Performance Index)",value: ((proj?.progress||0)/58).toFixed(2), note:"avance vs planificado"},
                {label:"EAC (Estimated at Completion)",   value: fmt(Math.round(d.incurrido/(Math.max(proj?.progress||1,1)/100))), note:"proyección al cierre"},
                {label:"Adicionales pendientes",           value: d.adicionales.filter(a=>a.status==="pendiente").length + " pend.", note:"requieren aprobación GG"},
              ].map((r,i)=>(
                <div key={i} style={{padding:"8px 16px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                  <div style={{fontSize:11,color:"var(--t2)"}}>{r.label}<br/><span style={{fontSize:10,color:"var(--t3)"}}>{r.note}</span></div>
                  <span style={{fontSize:13,fontWeight:700,color:"var(--t1)",fontFamily:"var(--mono)",flexShrink:0}}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Curva S ── */}
      {tab==="curva" && (
        <div className="card">
          <div className="card-header">
            <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>Curva S — Planificado vs Real</div>
            <span className="badge badge--mock">Simulado</span>
          </div>
          <div style={{padding:"16px"}}>
            <div style={{display:"flex",gap:16,marginBottom:12,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--t2)"}}>
                <div style={{width:18,height:2,background:"var(--blue)",opacity:.7}}/>
                <span>Planificado (curva S base)</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--t2)"}}>
                <div style={{width:18,height:2,background:"var(--green)"}}/>
                <span>Avance real</span>
              </div>
            </div>
            {/* Full-width curva S */}
            <svg viewBox={`0 0 700 120`} style={{width:"100%",height:120,display:"block"}}>
              {[25,50,75,100].map(y=>(
                <line key={y} x1={0} y1={120-(y/100)*100+10} x2={700} y2={120-(y/100)*100+10}
                  stroke="var(--border)" strokeWidth={0.5}/>
              ))}
              {d.meses.map((m,i)=>(
                <text key={i} x={(i/(d.meses.length-1))*680+10} y={118} fontSize={7} fill="var(--t3)" textAnchor="middle">{m}</text>
              ))}
              <polyline
                points={d.curvaS.map((v,i)=>`${(i/(d.curvaS.length-1))*680+10},${110-(v/100)*100}`).join(" ")}
                fill="none" stroke="var(--blue)" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.7}/>
              <polyline
                points={d.real.filter((v,i)=>!(v===0&&i>2)).map((v,i)=>`${(i/(d.curvaS.length-1))*680+10},${110-(v/100)*100}`).join(" ")}
                fill="none" stroke="var(--green)" strokeWidth={2.5}/>
            </svg>
            <div style={{marginTop:12,padding:"8px 10px",background:"var(--bg-subtle)",borderRadius:"var(--r)",fontSize:11,color:"var(--t2)"}}>
              Avance real vs curva S — Mes 7 (Ago): planificado {d.curvaS[7]}% · real {d.real[7]}% →
              {" "}<b style={{color:d.real[7]<d.curvaS[7]?"var(--red-text)":"var(--green-text)"}}>
                {d.real[7]<d.curvaS[7]?"Retraso":"Adelanto"} {Math.abs(d.curvaS[7]-d.real[7])} pp
              </b>
            </div>
          </div>
        </div>
      )}

      {/* ── APU ── */}
      {tab==="apu" && (
        <div className="card">
          <div className="card-header">
            <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>Análisis de Precios Unitarios</div>
            <span style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--t2)"}}>Total: {fmt(d.apus.reduce((s,a)=>s+a.total,0))}</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
              <thead>
                <tr style={{background:"var(--bg-subtle)"}}>
                  {["ID","Partida","Unid.","Cant.","P.U.","Total","% ppto"].map(h=>(
                    <th key={h} style={{padding:"7px 12px",textAlign:"left",fontWeight:600,color:"var(--t3)",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.apus.map((a,i)=>{
                  const pct = ((a.total/d.presupuesto)*100).toFixed(1);
                  return (
                    <tr key={a.id} style={{borderBottom:"1px solid var(--border)"}}>
                      <td style={{padding:"7px 12px",fontFamily:"var(--mono)",color:"var(--t3)",fontSize:10}}>{a.id}</td>
                      <td style={{padding:"7px 12px",color:"var(--t1)",fontWeight:500}}>{a.partida}</td>
                      <td style={{padding:"7px 12px",color:"var(--t2)"}}>{a.unidad}</td>
                      <td style={{padding:"7px 12px",color:"var(--t2)",textAlign:"right",fontFamily:"var(--mono)"}}>{a.cant.toLocaleString()}</td>
                      <td style={{padding:"7px 12px",color:"var(--t2)",textAlign:"right",fontFamily:"var(--mono)"}}>{fmt(a.pu)}</td>
                      <td style={{padding:"7px 12px",color:"var(--t1)",fontWeight:700,textAlign:"right",fontFamily:"var(--mono)"}}>{fmt(a.total)}</td>
                      <td style={{padding:"7px 12px",minWidth:70}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <div style={{flex:1,height:4,borderRadius:99,background:"var(--bg-subtle)"}}>
                            <div style={{height:"100%",borderRadius:99,background:"var(--blue)",width:`${Math.min(Number(pct)*2.5,100)}%`}}/>
                          </div>
                          <span style={{fontSize:10,color:"var(--t3)",flexShrink:0}}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Valorizaciones ── */}
      {tab==="valorizaciones" && (
        <div className="card">
          <div className="card-header">
            <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>Valorizaciones mensuales</div>
            <span style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--t2)"}}>
              Total valorizado: {fmt(d.valorizaciones.reduce((s,v)=>s+v.monto,0))}
            </span>
          </div>
          {d.valorizaciones.map(v=>{
            const statusColor = v.status==="aprobada"?"green":v.status==="pendiente"?"amber":"slate";
            return (
              <div key={v.n} style={{display:"flex",gap:14,alignItems:"center",padding:"10px 16px",borderBottom:"1px solid var(--border)"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"var(--blue-bg)",border:"1px solid var(--blue-border)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,fontWeight:700,color:"var(--blue-text)"}}>{v.n}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:"var(--t1)"}}>{v.mes}</div>
                  <div style={{fontSize:11,color:"var(--t3)"}}>Avance: {v.avance}%</div>
                </div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t1)",fontFamily:"var(--mono)"}}>{fmt(v.monto)}</div>
                <span className={`badge badge--${statusColor}`}>{v.status}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Adicionales ── */}
      {tab==="adicionales" && (
        <div className="card">
          <div className="card-header">
            <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>Adicionales de obra</div>
            {d.adicionales.length===0 && <span className="badge badge--green">Sin adicionales</span>}
          </div>
          {d.adicionales.length===0 && (
            <div style={{padding:"24px",textAlign:"center",color:"var(--t3)",fontSize:12}}>Sin adicionales registrados para este proyecto.</div>
          )}
          {d.adicionales.map(a=>{
            const sc = a.status==="pendiente"?"orange":a.status==="aprobado"?"green":"amber";
            return (
              <div key={a.id} style={{padding:"10px 16px",borderBottom:"1px solid var(--border)",borderLeft:`3px solid var(--${sc})`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:5}}>
                  <div>
                    <div style={{fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)"}}>{a.id}</div>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{a.desc}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                    <div style={{fontSize:15,fontWeight:700,color:"var(--t1)",fontFamily:"var(--mono)"}}>{fmt(a.monto)}</div>
                    <span className={`badge badge--${sc}`}>{a.status}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {a.status==="pendiente" && (
                    <>
                      <button className="btn btn--success btn--sm" onClick={()=>{IGActions.decideApproval(a.id,"approved",{title:a.desc});IGActions.notify({kind:"success",title:"Adicional aprobado",body:a.desc,route:"costs"});}}>Aprobar</button>
                      <button className="btn btn--danger btn--sm">Rechazar</button>
                    </>
                  )}
                  <button className="btn btn--ghost btn--sm" onClick={async()=>{
                    const system = buildSystemPrompt("ic");
                    const r = await callClaude(system,`Analiza este adicional de obra:\nDescripción: ${a.desc}\nMonto: ${fmt(a.monto)}\nProyecto: ${activeProject}\n¿Es razonable? ¿Qué documentos respaldan? Recomienda al GG.`);
                    IGActions.appendChat("ic",{role:"assistant",content:r.text});
                    IGActions.notify({kind:"info",title:"IC analizó adicional",body:a.id,route:"chat"});
                  }}>
                    <Icons.sparkle width="11" height="11"/> Analizar con IC
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

Object.assign(window, { CostosView });
