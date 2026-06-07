// ig-operaciones.jsx — SGP-LITE completo: sub-sidebar, cotizaciones workspace,
// RQ workspace con items grid, catálogo de recursos.
// ============================================================================

const ESTADO_COT_COLOR = {
  "Borrador":                  { bg:"var(--bg-subtle)",   color:"var(--t3)",         border:"var(--border)"         },
  "En revisión":               { bg:"var(--blue-bg)",     color:"var(--blue-text)",  border:"var(--blue-border)"    },
  "No participa":              { bg:"var(--bg-subtle)",   color:"var(--t3)",         border:"var(--border)"         },
  "Elaboración de cotización": { bg:"var(--amber-bg)",    color:"var(--amber-text)", border:"var(--amber-border)"   },
  "VB Gerencia":               { bg:"var(--blue-bg)",     color:"var(--blue-text)",  border:"var(--blue-border)"    },
  "Aprobada para envío":       { bg:"var(--green-bg)",    color:"var(--green-text)", border:"var(--green-border)"   },
  "Enviada":                   { bg:"var(--blue-bg)",     color:"var(--blue-text)",  border:"var(--blue-border)"    },
  "Ganada":                    { bg:"var(--green-bg)",    color:"var(--green-text)", border:"var(--green-border)"   },
  "Adjudicado":                { bg:"var(--green-bg)",    color:"var(--green-text)", border:"var(--green-border)"   },
  "Perdida / No adjudicada":   { bg:"var(--red-bg)",      color:"var(--red-text)",   border:"var(--red-border)"     },
};

const ESTADO_RQ_COLOR = {
  "Pendiente":  { bg:"var(--amber-bg)",  color:"var(--amber-text)", border:"var(--amber-border)"  },
  "En proceso": { bg:"var(--blue-bg)",   color:"var(--blue-text)",  border:"var(--blue-border)"   },
  "Atendido":   { bg:"var(--green-bg)",  color:"var(--green-text)", border:"var(--green-border)"  },
};

// ─── Primitives ──────────────────────────────────────────────────────────────
function OBadge({ estado, map }) {
  const m = (map||ESTADO_COT_COLOR||{})[estado] || { bg:"var(--bg-subtle)", color:"var(--t3)", border:"var(--border)" };
  return <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:"var(--r-sm)",background:m.bg,color:m.color,border:`1px solid ${m.border}`,whiteSpace:"nowrap",flexShrink:0}}>{estado}</span>;
}
function OPrio({ p }) {
  const c = p==="Alta"?"var(--red)":p==="Media"?"var(--amber)":"var(--green)";
  return <span style={{width:8,height:8,borderRadius:"50%",background:c,display:"inline-block",flexShrink:0}} title={p}/>;
}
function OMonto({ v, m }) {
  return <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--t1)",whiteSpace:"nowrap"}}>{m==="USD"?"US$":"S/"} {Number(v||0).toLocaleString("es-PE",{minimumFractionDigits:0})}</span>;
}
function OProg({ v=0, color }) {
  const c = color||(v===100?"var(--green)":v>60?"var(--blue)":"var(--amber)");
  return <div style={{height:4,borderRadius:99,background:"var(--bg-subtle)",minWidth:48}}><div style={{height:"100%",borderRadius:99,background:c,width:`${Math.min(v,100)}%`,transition:"width .3s"}}/></div>;
}
function OLabel({ icon, text }) {
  return <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 0",borderBottom:"1px solid var(--border)"}}><span style={{fontSize:10.5,color:"var(--t3)",minWidth:130,flexShrink:0}}>{text}</span></div>;
}
function ORow({ label, value, mono }) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid var(--border)",gap:8}}>
      <span style={{fontSize:10.5,color:"var(--t3)",flexShrink:0}}>{label}</span>
      <span style={{fontSize:11,color:"var(--t1)",fontWeight:500,fontFamily:mono?"var(--mono)":"var(--font)",textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:240}}>{value||"—"}</span>
    </div>
  );
}

// ─── AI Analysis panel ─────────────────────────────────────────────────────
function OpsAIPanel({ context, placeholder, agentId="ic" }) {
  const [query, setQuery]   = React.useState("");
  const [result, setResult] = React.useState(null);
  const [busy, setBusy]     = React.useState(false);
  const persona = AGENT_PERSONAS[agentId];

  async function analyze() {
    if(!query.trim()) return;
    setBusy(true); setResult(null);
    const opsCtx = typeof opsAgentContext !== "undefined" ? opsAgentContext(query) : "";
    const sys = buildSystemPrompt(agentId, { knowledge: IGStore.get().knowledge });
    const prompt = `${opsCtx}\n\n---\nSolicitud del GG: ${query}\n\nResponde con análisis fundamentado, datos concretos del portafolio y recomendación accionable.`;
    const res = await callClaude(sys, prompt);
    setResult(res.text);
    setBusy(false);
    IGActions.logTimeline({type:"knowledge", title:`Análisis OPS por ${persona?.name||agentId}`, detail:query.slice(0,60), result:"ok"});
  }

  const at = agentAvatarAttrs(agentId, 26);
  return (
    <div className="card">
      <div className="card-header">
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <div className={at.className} style={{...at.style, width:26, height:26, fontSize:9}}>{at.initials}</div>
          <div>
            <div style={{fontSize:12.5, fontWeight:600, color:"var(--t1)"}}>{persona?.fullName||persona?.name||agentId} — Análisis IA</div>
            <div style={{fontSize:10.5, color:"var(--t3)"}}>Lee los datos del portafolio y responde consultas</div>
          </div>
        </div>
        <span className="badge badge--blue badge--dot">IA real</span>
      </div>
      <div style={{padding:"10px 14px"}}>
        <div style={{display:"flex", gap:8, marginBottom:8}}>
          <textarea className="textarea" style={{flex:1, minHeight:48, resize:"none"}}
            value={query} onChange={e=>setQuery(e.target.value)}
            placeholder={placeholder||"Haz una consulta sobre este módulo…"}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();analyze();}}}
          />
          <button className="btn btn--primary" onClick={analyze} disabled={busy||!query.trim()} style={{alignSelf:"flex-end",padding:"8px 12px"}}>
            {busy?<span className="spinner"/>:<Icons.sparkle width="13" height="13"/>}
          </button>
        </div>
        {result && (
          <div style={{padding:"10px 12px", background:"var(--bg-subtle)", borderRadius:"var(--r)", fontSize:12.5, lineHeight:1.65, color:"var(--t1)", whiteSpace:"pre-wrap"}}>{result}</div>
        )}
      </div>
    </div>
  );
}

// ─── Resumen/Dashboard ───────────────────────────────────────────────────────
function OpsResumen() {
  const byEstado = OPS_ESTADOS_COT.reduce((a,e)=>({...a,[e]:OPS_COTIZACIONES.filter(c=>c.estado===e).length}),{});
  const ganadas  = (byEstado["Ganada"]||0)+(byEstado["Adjudicado"]||0);
  const totalPEN = OPS_COTIZACIONES.filter(c=>c.moneda==="PEN").reduce((s,c)=>s+c.monto,0);
  const totalUSD = OPS_COTIZACIONES.filter(c=>c.moneda==="USD").reduce((s,c)=>s+c.monto,0);
  const rqByEstado = OPS_ESTADOS_RQ.reduce((a,e)=>({...a,[e]:OPS_REQUERIMIENTOS.filter(r=>r.estado===e).length}),{});

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
        {[
          {l:"Cotizaciones",v:OPS_COTIZACIONES.length,c:"var(--blue)"},
          {l:"Ganadas/Adj.",v:ganadas,c:"var(--green)"},
          {l:"Monto PEN",v:`S/ ${(totalPEN/1000).toFixed(0)}k`,c:"var(--t1)"},
          {l:"Monto USD",v:`US$ ${(totalUSD/1000).toFixed(0)}k`,c:"var(--t1)"},
        ].map(s=>(
          <div key={s.l} className="card" style={{padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:700,color:s.c,fontFamily:"var(--mono)"}}>{s.v}</div>
            <div style={{fontSize:10.5,color:"var(--t3)"}}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div className="card">
          <div className="card-header"><div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>Cotizaciones por estado</div></div>
          <div style={{padding:"8px 14px"}}>
            {OPS_ESTADOS_COT.filter(e=>byEstado[e]>0).map(e=>{
              const pct=Math.round((byEstado[e]/OPS_COTIZACIONES.length)*100);
              const m=(ESTADO_COT_COLOR||{})[e]||{bg:"var(--bg-subtle)",color:"var(--t3)",border:"var(--border)"};
              return (
                <div key={e} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                  <OBadge estado={e}/>
                  <div style={{flex:1,height:5,borderRadius:99,background:"var(--bg-subtle)"}}>
                    <div style={{height:"100%",borderRadius:99,background:m.color,width:`${pct}%`}}/>
                  </div>
                  <span style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--t2)",flexShrink:0,minWidth:28,textAlign:"right"}}>{byEstado[e]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>Requerimientos</div></div>
          <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:10}}>
            {[
              {l:"Total",v:OPS_REQUERIMIENTOS.length,c:"var(--blue)"},
              {l:"Pendientes",v:rqByEstado["Pendiente"]||0,c:"var(--amber-text)"},
              {l:"En proceso",v:rqByEstado["En proceso"]||0,c:"var(--blue-text)"},
              {l:"Atendidos",v:rqByEstado["Atendido"]||0,c:"var(--green-text)"},
            ].map(s=>(
              <div key={s.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:"var(--t2)"}}>{s.l}</span>
                <span style={{fontSize:18,fontWeight:700,color:s.c,fontFamily:"var(--mono)"}}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cotización workspace modal ──────────────────────────────────────────────
function CotizacionModal({ cot, onClose }) {
  const [tab, setTab]   = React.useState("general");
  const [edit, setEdit] = React.useState(false);
  const [draft, setDraft] = React.useState({...cot});
  const relRQs = OPS_REQUERIMIENTOS.filter(r=>r.cotizacion_id===cot.id);
  const allItems = OPS_DETALLE.filter(d=>relRQs.some(r=>r.id===d.requerimiento_id));

  // Economic summary by resource type
  const econByType = allItems.reduce((acc,d) => {
    if(!acc[d.tipo_recurso]) acc[d.tipo_recurso]={type:d.tipo_recurso,items:0,total_pen:0};
    acc[d.tipo_recurso].items++;
    acc[d.tipo_recurso].total_pen += d.costo_total * (d.moneda==="USD"?3.75:1);
    return acc;
  },{});
  const econRows = Object.values(econByType);
  const totalEcon = econRows.reduce((s,r)=>s+r.total_pen,0);

  const modalTabs = [
    {id:"general",    label:"Datos generales"},
    {id:"economico",  label:"Resumen económico"},
    {id:"rqs",        label:`RQ relacionados (${relRQs.length})`},
    {id:"documentos", label:"Documentos"},
    {id:"trazab",     label:"Trazabilidad"},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"var(--bg-card)",borderRadius:"var(--r-lg)",boxShadow:"0 20px 60px rgba(0,0,0,.2)",width:"min(900px,100%)",maxHeight:"92dvh",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Modal header */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--blue-text)",fontWeight:600}}>{cot.codigo}</span>
              <OBadge estado={cot.estado}/>
              <OPrio p={cot.prioridad}/>
              <span style={{fontSize:10.5,color:"var(--t3)"}}>Prioridad {cot.prioridad}</span>
            </div>
            <div style={{fontSize:13.5,fontWeight:700,color:"var(--t1)",marginTop:2}}>{cot.proyecto}</div>
            <div style={{fontSize:11.5,color:"var(--t2)"}}>{cot.cliente} · {cot.unidad_trabajo}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button className={`btn btn--sm ${edit?"btn--amber":"btn--ghost"}`} onClick={()=>setEdit(e=>!e)}>
              {edit?"Editando":"Editar"}
            </button>
            {edit && <button className="btn btn--primary btn--sm" onClick={()=>{setEdit(false);}}>Guardar</button>}
            <button className="btn btn--ghost btn--sm" onClick={onClose}><Icons.x width="13" height="13"/></button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:0,borderBottom:"1px solid var(--border)",flexShrink:0,overflowX:"auto"}}>
          {modalTabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:"8px 14px",fontSize:11.5,fontWeight:tab===t.id?600:400,color:tab===t.id?"var(--blue-text)":"var(--t3)",borderBottom:tab===t.id?"2px solid var(--blue)":"2px solid transparent",background:"transparent",whiteSpace:"nowrap",transition:"all .12s"}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"14px 16px"}}>

          {/* ── Datos generales ── */}
          {tab==="general" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"var(--t3)",marginBottom:8}}>Identificación</div>
                {[
                  {l:"Código",       v:cot.codigo,             mono:true},
                  {l:"OC / OS",      v:cot.oc,                 mono:true},
                  {l:"Cliente",      v:cot.cliente},
                  {l:"Proyecto",     v:cot.proyecto},
                  {l:"Unidad",       v:cot.unidad_trabajo},
                  {l:"Tipo servicio",v:cot.tipo_servicio},
                ].map(r=><ORow key={r.l} label={r.l} value={r.v} mono={!!r.mono}/>)}
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"var(--t3)",marginBottom:8}}>Gestión</div>
                {[
                  {l:"Estado",       v:<OBadge estado={cot.estado}/>},
                  {l:"Prioridad",    v:<span style={{display:"flex",alignItems:"center",gap:5}}><OPrio p={cot.prioridad}/> {cot.prioridad}</span>},
                  {l:"Resp. técnico",v:cot.responsable_tecnico},
                  {l:"Resp. económ.",v:cot.responsable_economico},
                  {l:"Solicitante",  v:cot.solicitante},
                  {l:"F. registro",  v:cot.fecha_registro, mono:true},
                  {l:"F. invitación",v:cot.fecha_invitacion, mono:true},
                  {l:"F. presentación",v:cot.fecha_presentacion, mono:true},
                  {l:"F. entrega",   v:cot.fecha_entrega, mono:true},
                ].map(r=><ORow key={r.l} label={r.l} value={r.v} mono={!!r.mono}/>)}
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:"var(--bg-subtle)",borderRadius:"var(--r)",border:"1px solid var(--border)"}}>
                  <div>
                    <div style={{fontSize:10.5,color:"var(--t3)"}}>Monto cotización</div>
                    <div style={{fontSize:24,fontWeight:700,color:"var(--t1)",fontFamily:"var(--mono)",marginTop:2}}><OMonto v={cot.monto} m={cot.moneda}/></div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:10.5,color:"var(--t3)"}}>Avance</div>
                    <div style={{fontSize:18,fontWeight:700,color:cot.avance===100?"var(--green)":"var(--blue)",fontFamily:"var(--mono)"}}>{cot.avance}%</div>
                    <OProg v={cot.avance}/>
                  </div>
                </div>
              </div>
              {cot.observaciones && (
                <div style={{gridColumn:"1/-1",padding:"8px 12px",background:"var(--amber-bg)",borderRadius:"var(--r)",border:"1px solid var(--amber-border)",fontSize:11.5,color:"var(--amber-text)"}}>
                  <b>Observaciones:</b> {cot.observaciones}
                </div>
              )}
            </div>
          )}

          {/* ── Resumen económico ── */}
          {tab==="economico" && (
            <div>
              <div style={{marginBottom:10,padding:"8px 12px",background:"var(--bg-subtle)",borderRadius:"var(--r)",border:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:11.5,color:"var(--t2)"}}>Total costo estimado (en PEN equiv.)</div>
                <div style={{fontSize:18,fontWeight:700,color:"var(--t1)",fontFamily:"var(--mono)"}}>S/ {totalEcon.toLocaleString("es-PE",{minimumFractionDigits:0})}</div>
              </div>
              <div className="card" style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
                  <thead>
                    <tr style={{background:"var(--bg-subtle)"}}>
                      {["Tipo de recurso","Ítems","Costo PEN equiv.","% del total","Margen est."].map(h=>(
                        <th key={h} style={{padding:"7px 10px",textAlign:h==="Tipo de recurso"?"left":"right",fontWeight:600,color:"var(--t3)",borderBottom:"1px solid var(--border)",fontSize:10.5,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {econRows.length===0 ? (
                      <tr><td colSpan={5} style={{padding:"20px",textAlign:"center",color:"var(--t3)",fontSize:11}}>Sin ítems de requerimiento vinculados</td></tr>
                    ) : econRows.map((r,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                        <td style={{padding:"7px 10px",color:"var(--t1)",fontWeight:500}}>{r.type}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"var(--mono)",color:"var(--t2)"}}>{r.items}</td>
                        <td style={{padding:"7px 10px",textAlign:"right"}}><OMonto v={r.total_pen} m="PEN"/></td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"var(--mono)",color:"var(--t3)"}}>{totalEcon>0?Math.round((r.total_pen/totalEcon)*100):0}%</td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"var(--mono)",color:"var(--t3)"}}>—</td>
                      </tr>
                    ))}
                    {econRows.length>0 && (
                      <tr style={{background:"var(--bg-subtle)",fontWeight:700}}>
                        <td style={{padding:"7px 10px",color:"var(--t1)"}}>TOTAL</td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"var(--mono)",color:"var(--t1)"}}>{allItems.length}</td>
                        <td style={{padding:"7px 10px",textAlign:"right"}}><OMonto v={totalEcon} m="PEN"/></td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"var(--mono)",color:"var(--t1)"}}>100%</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:"var(--t3)"}}>{cot.monto>0?`${Math.round(((cot.monto-totalEcon/3.75)/cot.monto)*100)}%`:"-"}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── RQ relacionados ── */}
          {tab==="rqs" && (
            <div>
              {relRQs.length===0 ? (
                <div style={{padding:"30px",textAlign:"center",color:"var(--t3)",fontSize:12}}>
                  No hay requerimientos vinculados a esta cotización.<br/>
                  {(cot.estado==="Ganada"||cot.estado==="Adjudicado")&&<span style={{color:"var(--green-text)",fontWeight:600}}>✓ Cotización ganada — puede crear RQ</span>}
                </div>
              ) : relRQs.map(rq=>(
                <div key={rq.id} className="card" style={{marginBottom:8}}>
                  <div style={{padding:"10px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                      <div>
                        <div style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--blue-text)",fontWeight:600,marginBottom:2}}>{rq.codigo}</div>
                        <div style={{fontSize:12.5,fontWeight:600,color:"var(--t1)"}}>{rq.proyecto_servicio}</div>
                        <div style={{fontSize:11,color:"var(--t3)"}}>{rq.area} · {rq.solicitante_rq}</div>
                      </div>
                      <OBadge estado={rq.estado} map={ESTADO_RQ_COLOR}/>
                    </div>
                    <div style={{display:"flex",gap:12,alignItems:"center"}}>
                      <div style={{flex:1}}><OProg v={rq.avance}/></div>
                      <span style={{fontSize:11,color:"var(--t2)",fontFamily:"var(--mono)",flexShrink:0}}>{rq.avance}% · {rq.total_items} ítems</span>
                      <span style={{fontSize:10.5,color:"var(--t3)",flexShrink:0}}>{rq.fecha_requerida}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Documentos ── */}
          {tab==="documentos" && (
            <div style={{padding:"20px",textAlign:"center",color:"var(--t3)"}}>
              <Icons.folder width="32" height="32" style={{opacity:.3,margin:"0 auto 10px",display:"block"}}/>
              <div style={{fontSize:12,marginBottom:8}}>Sin documentos adjuntos en la demo</div>
              <div style={{fontSize:11,color:"var(--t3)"}}>En producción: se vinculan a Google Drive por carpeta de proyecto</div>
            </div>
          )}

          {/* ── Trazabilidad ── */}
          {tab==="trazab" && (
            <div>
              {[
                {ts:cot.fecha_registro, icon:"📋", event:"Cotización registrada", actor:cot.solicitante},
                {ts:cot.fecha_invitacion, icon:"📬", event:"Invitación recibida", actor:cot.responsable_tecnico},
                {ts:cot.fecha_presentacion, icon:"📤", event:"Propuesta presentada", actor:cot.responsable_economico},
                {ts:cot.fecha_entrega, icon:"✅", event:"Entrega / cierre", actor:cot.responsable_tecnico},
                ...(cot.estado==="Ganada"||cot.estado==="Adjudicado"
                  ? [{ts:cot.fecha_oc, icon:"🏆", event:`Adjudicado · OC ${cot.oc}`, actor:"Cliente"}]
                  : []),
              ].filter(e=>e.ts).map((e,i)=>(
                <div key={i} style={{display:"flex",gap:12,padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                  <div style={{flexShrink:0,width:24,textAlign:"center",fontSize:16}}>{e.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:"var(--t1)"}}>{e.event}</div>
                    <div style={{fontSize:11,color:"var(--t3)"}}>{e.actor}</div>
                  </div>
                  <div style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--t3)",flexShrink:0}}>{e.ts}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RQ workspace modal ───────────────────────────────────────────────────────
function RQModal({ rq, onClose }) {
  const items  = OPS_DETALLE.filter(d=>d.requerimiento_id===rq.id);
  const cot    = OPS_COTIZACIONES.find(c=>c.id===rq.cotizacion_id);
  const total  = items.reduce((s,d)=>s+d.costo_total,0);
  const byType = items.reduce((a,d)=>{a[d.tipo_recurso]=(a[d.tipo_recurso]||0)+d.costo_total;return a},{});

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"var(--bg-card)",borderRadius:"var(--r-lg)",boxShadow:"0 20px 60px rgba(0,0,0,.2)",width:"min(960px,100%)",maxHeight:"92dvh",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 16px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:9.5,fontFamily:"var(--mono)",color:"var(--blue-text)",fontWeight:600,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rq.codigo}</div>
            <div style={{fontSize:13.5,fontWeight:700,color:"var(--t1)"}}>{rq.proyecto_servicio}</div>
            <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
              <OBadge estado={rq.estado} map={ESTADO_RQ_COLOR}/>
              <span style={{fontSize:11,color:"var(--t3)"}}>{rq.cliente} · {rq.area}</span>
              <span style={{fontSize:11,color:"var(--t3)"}}>Resp: {rq.responsable}</span>
            </div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onClose}><Icons.x width="13" height="13"/></button>
        </div>

        {/* Info grid */}
        <div style={{flexShrink:0,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0,borderBottom:"1px solid var(--border)"}}>
          {[
            {l:"Cotización", v:rq.cotizacion_codigo, mono:true},
            {l:"OC",         v:rq.oc, mono:true},
            {l:"Solicitante",v:rq.solicitante_rq},
            {l:"F. requerida",v:rq.fecha_requerida, mono:true},
          ].map(f=>(
            <div key={f.l} style={{padding:"8px 14px",borderRight:"1px solid var(--border)"}}>
              <div style={{fontSize:10,color:"var(--t3)",marginBottom:2}}>{f.l}</div>
              <div style={{fontSize:11.5,fontWeight:600,color:"var(--t1)",fontFamily:f.mono?"var(--mono)":"var(--font)"}}>{f.v||"—"}</div>
            </div>
          ))}
        </div>

        {/* Type summary chips */}
        {Object.entries(byType).length>0 && (
          <div style={{flexShrink:0,padding:"6px 14px",borderBottom:"1px solid var(--border)",display:"flex",gap:6,flexWrap:"wrap",background:"var(--bg-subtle)"}}>
            {Object.entries(byType).map(([t,v])=>(
              <span key={t} style={{fontSize:10,padding:"2px 8px",borderRadius:"var(--r-sm)",background:"var(--bg-card)",border:"1px solid var(--border)",color:"var(--t2)"}}>
                {t}: <b style={{color:"var(--t1)"}}>S/ {Number(v).toLocaleString("es-PE",{minimumFractionDigits:0})}</b>
              </span>
            ))}
          </div>
        )}

        {/* Items table */}
        <div style={{flex:1,overflowY:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead style={{position:"sticky",top:0,zIndex:2}}>
              <tr style={{background:"var(--bg-subtle)"}}>
                {["#","Descripción","Tipo","Unidad","Cant.","P.Unit.","Total","Proveedor","Entrega","EQ","LL","HB","Estado"].map((h,i)=>(
                  <th key={h} style={{padding:"6px 8px",textAlign:["Cant.","P.Unit.","Total"].includes(h)?"right":"left",fontWeight:600,color:"var(--t3)",borderBottom:"1px solid var(--border)",fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length===0 ? (
                <tr><td colSpan={13} style={{padding:"20px",textAlign:"center",color:"var(--t3)",fontSize:11}}>Sin ítems en este requerimiento</td></tr>
              ) : items.map((d,i)=>(
                <tr key={d.id} style={{borderBottom:"1px solid var(--border)"}}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--bg-subtle)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"5px 8px",color:"var(--t3)",fontSize:10}}>{i+1}</td>
                  <td style={{padding:"5px 8px",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--t1)",fontWeight:500}}>{d.descripcion}</td>
                  <td style={{padding:"5px 8px",fontSize:10,color:"var(--t2)",whiteSpace:"nowrap"}}>{d.tipo_recurso}</td>
                  <td style={{padding:"5px 8px",fontFamily:"var(--mono)",textAlign:"center",color:"var(--t2)"}}>{d.unidad}</td>
                  <td style={{padding:"5px 8px",fontFamily:"var(--mono)",textAlign:"right",fontWeight:600,color:"var(--t1)"}}>{d.cantidad}</td>
                  <td style={{padding:"5px 8px",textAlign:"right",whiteSpace:"nowrap"}}><OMonto v={d.precio_unitario} m={d.moneda}/></td>
                  <td style={{padding:"5px 8px",textAlign:"right",whiteSpace:"nowrap",fontWeight:600}}><OMonto v={d.costo_total} m={d.moneda}/></td>
                  <td style={{padding:"5px 8px",fontSize:10,color:"var(--t2)",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.proveedor}</td>
                  <td style={{padding:"5px 8px",fontSize:10,color:"var(--t3)",fontFamily:"var(--mono)",whiteSpace:"nowrap"}}>{d.fecha_entrega}</td>
                  {[d.eq,d.ll,d.hb].map((v,j)=>(
                    <td key={j} style={{padding:"5px 8px",textAlign:"center"}}>
                      <span style={{fontSize:11,fontWeight:700,color:v==="Aprobado"?"var(--green-text)":"var(--amber-text)"}} title={v}>{v==="Aprobado"?"✓":"○"}</span>
                    </td>
                  ))}
                  <td style={{padding:"5px 8px"}}><OBadge estado={d.estado} map={ESTADO_RQ_COLOR}/></td>
                </tr>
              ))}
            </tbody>
            {items.length>0&&(
              <tfoot>
                <tr style={{background:"var(--bg-subtle)",fontWeight:700}}>
                  <td colSpan={6} style={{padding:"6px 8px",fontSize:11,color:"var(--t1)"}}>TOTAL ({items.length} ítems)</td>
                  <td style={{padding:"6px 8px",textAlign:"right"}}><OMonto v={total} m="PEN"/></td>
                  <td colSpan={6}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Cotizaciones section ─────────────────────────────────────────────────────
function OpsCotizaciones() {
  const [search, setSearch]   = React.useState("");
  const [estado, setEstado]   = React.useState("Todos");
  const [cliente, setCliente] = React.useState("Todos");
  const [moneda, setMoneda]   = React.useState("Todos");
  const [page, setPage]       = React.useState(1);
  const [selected, setSelected] = React.useState(null);
  const PER = 15;

  const filtered = OPS_COTIZACIONES.filter(c => {
    const q = search.toLowerCase();
    return (estado==="Todos"||c.estado===estado)&&(cliente==="Todos"||c.cliente===cliente)&&(moneda==="Todos"||c.moneda===moneda)&&(!q||c.codigo.toLowerCase().includes(q)||c.proyecto.toLowerCase().includes(q)||c.cliente.toLowerCase().includes(q));
  });
  const pages = Math.ceil(filtered.length/PER);
  const rows  = filtered.slice((page-1)*PER, page*PER);

  return (
    <div>
      {selected && <CotizacionModal cot={selected} onClose={()=>setSelected(null)}/>}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8,alignItems:"center"}}>
        <input className="input" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Código, proyecto, cliente…" style={{width:200}}/>
        <select className="select" style={{width:"auto"}} value={estado} onChange={e=>{setEstado(e.target.value);setPage(1);}}>
          <option value="Todos">Todos</option>
          {OPS_ESTADOS_COT.map(e=><option key={e}>{e}</option>)}
        </select>
        <select className="select" style={{width:"auto"}} value={cliente} onChange={e=>{setCliente(e.target.value);setPage(1);}}>
          <option value="Todos">Todos los clientes</option>
          {OPS_CLIENTES.map(c=><option key={c}>{c}</option>)}
        </select>
        <select className="select" style={{width:"auto"}} value={moneda} onChange={e=>{setMoneda(e.target.value);setPage(1);}}>
          <option value="Todos">PEN + USD</option>
          <option value="PEN">PEN</option>
          <option value="USD">USD</option>
        </select>
        <span style={{fontSize:11,color:"var(--t3)",marginLeft:"auto"}}>{filtered.length} cotizaciones</span>
      </div>
      <div className="card" style={{overflowX:"auto",marginBottom:6}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr style={{background:"var(--bg-subtle)"}}>
              {["","Cotización","Proyecto","Tipo servicio","Estado propuesta","Cliente","Unidad trabajo","Solicitante","Prioridad","Resp. Técnico","Resp. Económico","Avance","F. Registro","F. Invitación","F. Confirmación","F. Visita téc.","F. Consultas","F. Abs. consultas","F. Entrega","F. Entregada","Monto","Moneda","Estado oferta","OC"].map(h=>(
                <th key={h} style={{padding:"6px 9px",textAlign:h==="Monto"||h==="Avance"?"right":"left",fontWeight:600,color:"var(--t3)",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap",fontSize:10,position:"sticky",top:0,background:"var(--bg-subtle)",zIndex:1}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(c=>(
              <tr key={c.id} onClick={()=>setSelected(c)} style={{borderBottom:"1px solid var(--border)",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--bg-subtle)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"6px 8px"}}><OPrio p={c.prioridad}/></td>
                <td style={{padding:"6px 8px",whiteSpace:"nowrap",fontFamily:"var(--mono)",fontSize:10.5,fontWeight:600,color:"var(--blue-text)"}}>{c.codigo}</td>
                <td style={{padding:"6px 8px",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--t2)"}}>{c.proyecto}</td>
                <td style={{padding:"6px 8px",fontSize:10.5,color:"var(--t2)",whiteSpace:"nowrap"}}>{c.tipo_servicio}</td>
                <td style={{padding:"6px 8px"}}><OBadge estado={c.estado_propuesta||"—"}/></td>
                <td style={{padding:"6px 8px",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:11,color:"var(--t1)"}}>{c.cliente}</td>
                <td style={{padding:"6px 8px",maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:10.5,color:"var(--t2)"}}>{c.unidad_trabajo}</td>
                <td style={{padding:"6px 8px",fontSize:10.5,color:"var(--t2)",whiteSpace:"nowrap"}}>{c.solicitante}</td>
                <td style={{padding:"6px 8px",fontSize:10.5,color:"var(--t2)"}}>{c.prioridad}</td>
                <td style={{padding:"6px 8px",fontSize:10.5,color:"var(--t2)",whiteSpace:"nowrap"}}>{c.responsable_tecnico}</td>
                <td style={{padding:"6px 8px",fontSize:10.5,color:"var(--t2)",whiteSpace:"nowrap"}}>{c.responsable_economico}</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"var(--mono)",fontSize:10.5,color:"var(--t2)"}}>{Number(c.avance||0).toFixed(2)}%</td>
                <td style={{padding:"6px 8px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{c.fecha_registro}</td>
                <td style={{padding:"6px 8px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{c.fecha_invitacion}</td>
                <td style={{padding:"6px 8px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{c.fecha_confirmacion||"—"}</td>
                <td style={{padding:"6px 8px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{c.fecha_visita_tecnica||"—"}</td>
                <td style={{padding:"6px 8px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{c.fecha_consultas||"—"}</td>
                <td style={{padding:"6px 8px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{c.fecha_abs_consultas||"—"}</td>
                <td style={{padding:"6px 8px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{c.fecha_entrega}</td>
                <td style={{padding:"6px 8px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{c.fecha_entregada||"—"}</td>
                <td style={{padding:"6px 8px",textAlign:"right",whiteSpace:"nowrap"}}><OMonto v={c.monto} m={c.moneda}/></td>
                <td style={{padding:"6px 8px",fontSize:10.5,color:"var(--t2)"}}>{c.moneda_cotizacion||c.moneda}</td>
                <td style={{padding:"6px 8px"}}><OBadge estado={c.estado}/></td>
                <td style={{padding:"6px 8px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{c.oc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages>1&&<div style={{display:"flex",gap:3,justifyContent:"center",marginBottom:8}}>
        <button className="btn btn--ghost btn--sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹</button>
        {Array.from({length:pages},(_,i)=>i+1).slice(Math.max(0,page-3),page+2).map(p=>(
          <button key={p} className={`btn btn--sm ${p===page?"btn--primary":"btn--ghost"}`} onClick={()=>setPage(p)}>{p}</button>
        ))}
        <button className="btn btn--ghost btn--sm" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>›</button>
      </div>}
      <OpsAIPanel agentId="ic" placeholder="¿Cuáles son las cotizaciones de NEXA? ¿Win rate? ¿Estado del portafolio?" context="cotizaciones"/>
    </div>
  );
}

// ─── Requerimientos section ───────────────────────────────────────────────────
function OpsRequerimientos() {
  const [search, setSearch] = React.useState("");
  const [estado, setEstado] = React.useState("Todos");
  const [area, setArea]     = React.useState("Todos");
  const [page, setPage]     = React.useState(1);
  const [selected, setSelected] = React.useState(null);
  const PER = 15;

  const filtered = OPS_REQUERIMIENTOS.filter(r => {
    const q = search.toLowerCase();
    return (estado==="Todos"||r.estado===estado)&&(area==="Todos"||r.area===area)&&(!q||r.codigo.toLowerCase().includes(q)||r.cliente.toLowerCase().includes(q)||r.proyecto_servicio.toLowerCase().includes(q));
  });
  const pages = Math.ceil(filtered.length/PER);
  const rows  = filtered.slice((page-1)*PER, page*PER);
  const areas = [...new Set(OPS_REQUERIMIENTOS.map(r=>r.area))];

  return (
    <div>
      {selected && <RQModal rq={selected} onClose={()=>setSelected(null)}/>}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8,alignItems:"center"}}>
        <input className="input" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Código, cliente, proyecto…" style={{width:200}}/>
        <select className="select" style={{width:"auto"}} value={estado} onChange={e=>{setEstado(e.target.value);setPage(1);}}>
          <option value="Todos">Todos</option>
          {OPS_ESTADOS_RQ.map(e=><option key={e}>{e}</option>)}
        </select>
        <select className="select" style={{width:"auto"}} value={area} onChange={e=>{setArea(e.target.value);setPage(1);}}>
          <option value="Todos">Todas las áreas</option>
          {areas.map(a=><option key={a}>{a}</option>)}
        </select>
        <span style={{fontSize:11,color:"var(--t3)",marginLeft:"auto"}}>{filtered.length} requerimientos</span>
      </div>
      <div className="card" style={{overflowX:"auto",marginBottom:6}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr style={{background:"var(--bg-subtle)"}}>
              {["Proyecto","Requerimiento","Cotización","OC","Cliente","Unidad trabajo","Solicitante RQ","Estado","F. Solicitud","Responsable","F. Entrega","Tipo servicio","Área","Ítems tot.","Estado RQ","Pend.","En proc.","Atend.","VB compl.","Con rec.","Sin rec.","Con ficha","Con OC/OS","Con guía","Avance"].map(h=>(
                <th key={h} style={{padding:"6px 9px",textAlign:["Ítems tot.","Pend.","En proc.","Atend.","VB compl.","Con rec.","Sin rec.","Con ficha","Con OC/OS","Con guía","Avance"].includes(h)?"right":"left",fontWeight:600,color:"var(--t3)",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap",fontSize:10,position:"sticky",top:0,background:"var(--bg-subtle)",zIndex:1}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id} onClick={()=>setSelected(r)} style={{borderBottom:"1px solid var(--border)",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--bg-subtle)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"6px 8px",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--t2)"}}>{r.proyecto_servicio}</td>
                <td style={{padding:"6px 8px",whiteSpace:"nowrap",fontFamily:"var(--mono)",fontSize:9.5,fontWeight:600,color:"var(--blue-text)",maxWidth:155,overflow:"hidden",textOverflow:"ellipsis"}}>{r.codigo}</td>
                <td style={{padding:"6px 8px",fontFamily:"var(--mono)",fontSize:10,color:"var(--t2)",whiteSpace:"nowrap"}}>{r.cotizacion_codigo}</td>
                <td style={{padding:"6px 8px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{r.oc}</td>
                <td style={{padding:"6px 8px",maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:11,color:"var(--t1)"}}>{r.cliente}</td>
                <td style={{padding:"6px 8px",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:10.5,color:"var(--t2)"}}>{r.unidad_trabajo}</td>
                <td style={{padding:"6px 8px",fontSize:10.5,color:"var(--t2)",whiteSpace:"nowrap"}}>{r.solicitante_rq}</td>
                <td style={{padding:"6px 8px"}}><OBadge estado={r.estado} map={ESTADO_RQ_COLOR}/></td>
                <td style={{padding:"6px 8px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{r.fecha_solicitud}</td>
                <td style={{padding:"6px 8px",fontSize:10.5,color:"var(--t2)",whiteSpace:"nowrap"}}>{r.responsable}</td>
                <td style={{padding:"6px 8px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{r.fecha_requerida}</td>
                <td style={{padding:"6px 8px",fontSize:10.5,color:"var(--t2)",whiteSpace:"nowrap"}}>{r.tipo_servicio}</td>
                <td style={{padding:"6px 8px",fontSize:10.5,color:"var(--t2)",whiteSpace:"nowrap"}}>{r.area}</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"var(--mono)",fontSize:10.5,color:"var(--t1)"}}>{r.items_totales||r.total_items}</td>
                <td style={{padding:"6px 8px"}}><OBadge estado={r.estado_rq||r.estado} map={ESTADO_RQ_COLOR}/></td>
                <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"var(--mono)",fontSize:10.5,color:"var(--t2)"}}>{r.pendientes||0}</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"var(--mono)",fontSize:10.5,color:"var(--t2)"}}>{r.en_proceso||0}</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"var(--mono)",fontSize:10.5,color:"var(--t2)"}}>{r.atendidos||0}</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"var(--mono)",fontSize:10.5,color:"var(--t2)"}}>{r.vb_completos||0}</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"var(--mono)",fontSize:10.5,color:"var(--t2)"}}>{r.con_recurso||0}</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"var(--mono)",fontSize:10.5,color:"var(--t2)"}}>{r.sin_recurso||0}</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"var(--mono)",fontSize:10.5,color:"var(--t2)"}}>{r.con_ficha_suministrar||0}</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"var(--mono)",fontSize:10.5,color:"var(--t2)"}}>{r.con_oc_os||0}</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"var(--mono)",fontSize:10.5,color:"var(--t2)"}}>{r.con_guia||0}</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"var(--mono)",fontSize:10.5,color:"var(--t2)"}}>{r.avance}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages>1&&<div style={{display:"flex",gap:3,justifyContent:"center",marginBottom:8}}>
        <button className="btn btn--ghost btn--sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹</button>
        {Array.from({length:pages},(_,i)=>i+1).slice(Math.max(0,page-3),page+2).map(p=>(
          <button key={p} className={`btn btn--sm ${p===page?"btn--primary":"btn--ghost"}`} onClick={()=>setPage(p)}>{p}</button>
        ))}
        <button className="btn btn--ghost btn--sm" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>›</button>
      </div>}
      <OpsAIPanel agentId="pm" placeholder="¿Cuántos RQ pendientes hay? ¿Áreas con más carga? ¿Riesgo de incumplimiento?" context="requerimientos"/>
    </div>
  );
}

// ─── Recursos section ─────────────────────────────────────────────────────────
function OpsRecursos() {
  const [search, setSearch] = React.useState("");
  const [tipo, setTipo]     = React.useState("Todos");
  const [estado, setEstado] = React.useState("Todos");
  const tipos = [...new Set(OPS_RECURSOS.map(r=>r.tipo_recurso))];
  const filtered = OPS_RECURSOS.filter(r => {
    const q = search.toLowerCase();
    return (tipo==="Todos"||r.tipo_recurso===tipo)&&(estado==="Todos"||r.estado===estado)&&(!q||r.descripcion.toLowerCase().includes(q)||r.codigo_eka.toLowerCase().includes(q)||r.marca.toLowerCase().includes(q));
  });
  return (
    <div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8,alignItems:"center"}}>
        <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Descripción, código EKA, marca…" style={{width:200}}/>
        <select className="select" style={{width:"auto"}} value={tipo} onChange={e=>setTipo(e.target.value)}>
          <option value="Todos">Todos los tipos</option>
          {tipos.map(t=><option key={t}>{t}</option>)}
        </select>
        <select className="select" style={{width:"auto"}} value={estado} onChange={e=>setEstado(e.target.value)}>
          <option value="Todos">Todos</option>
          {["Activo","Inactivo","Por revisar"].map(e=><option key={e}>{e}</option>)}
        </select>
        <span style={{fontSize:11,color:"var(--t3)",marginLeft:"auto"}}>{filtered.length} recursos</span>
      </div>
      <div className="card" style={{overflowX:"auto",marginBottom:8}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr style={{background:"var(--bg-subtle)"}}>
              {["Cód. EKA","Descripción","Tipo","Und.","Precio ref.","Marca","Modelo","Proveedor","Entrega","Estado"].map(h=>(
                <th key={h} style={{padding:"6px 9px",textAlign:"left",fontWeight:600,color:"var(--t3)",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap",fontSize:10}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r=>(
              <tr key={r.id} style={{borderBottom:"1px solid var(--border)"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--bg-subtle)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"6px 8px",whiteSpace:"nowrap"}}>
                  <div style={{fontFamily:"var(--mono)",fontSize:10,fontWeight:600,color:"var(--blue-text)"}}>{r.codigo_eka}</div>
                  <div style={{fontSize:9,color:"var(--t3)"}}>{r.codigo_recurso}</div>
                </td>
                <td style={{padding:"6px 8px",maxWidth:170}}>
                  <div style={{fontSize:11,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{r.descripcion}</div>
                </td>
                <td style={{padding:"6px 8px",fontSize:10,color:"var(--t2)",whiteSpace:"nowrap"}}>{r.tipo_recurso}</td>
                <td style={{padding:"6px 8px",fontFamily:"var(--mono)",textAlign:"center",color:"var(--t2)"}}>{r.unidad}</td>
                <td style={{padding:"6px 8px",textAlign:"right",whiteSpace:"nowrap"}}><OMonto v={r.precio_unitario_ref} m={r.moneda}/></td>
                <td style={{padding:"6px 8px",fontSize:10.5,color:"var(--t2)",whiteSpace:"nowrap"}}>{r.marca}</td>
                <td style={{padding:"6px 8px",fontSize:10,color:"var(--t3)",whiteSpace:"nowrap"}}>{r.modelo}</td>
                <td style={{padding:"6px 8px",fontSize:10,color:"var(--t2)",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.proveedor}</td>
                <td style={{padding:"6px 8px",fontSize:10,color:"var(--t3)",whiteSpace:"nowrap"}}>{r.tiempo_entrega_ref}</td>
                <td style={{padding:"6px 8px"}}>
                  <span style={{fontSize:10,fontWeight:600,padding:"2px 6px",borderRadius:"var(--r-sm)",
                    background:r.estado==="Activo"?"var(--green-bg)":r.estado==="Inactivo"?"var(--bg-subtle)":"var(--amber-bg)",
                    color:r.estado==="Activo"?"var(--green-text)":r.estado==="Inactivo"?"var(--t3)":"var(--amber-text)",
                    border:`1px solid ${r.estado==="Activo"?"var(--green-border)":r.estado==="Inactivo"?"var(--border)":"var(--amber-border)"}`,
                  }}>{r.estado}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <OpsAIPanel agentId="ic" placeholder="¿Qué cables hay disponibles? ¿Recursos por revisar? ¿Materiales más costosos?" context="recursos"/>
    </div>
  );
}

// ─── Detalle RQ section ───────────────────────────────────────────────────────
function OpsDetalleRQ() {
  const [rqId, setRqId]     = React.useState(OPS_REQUERIMIENTOS[0]?.id||"");
  const [search, setSearch] = React.useState("");
  const rq    = OPS_REQUERIMIENTOS.find(r=>r.id===rqId);
  const items = OPS_DETALLE.filter(d=>d.requerimiento_id===rqId&&(!search||d.descripcion.toLowerCase().includes(search.toLowerCase())));
  const total = items.reduce((s,d)=>s+d.costo_total,0);
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        <select className="select" style={{minWidth:220,maxWidth:340}} value={rqId} onChange={e=>setRqId(e.target.value)}>
          {OPS_REQUERIMIENTOS.map(r=><option key={r.id} value={r.id}>[{r.estado}] {r.codigo.slice(0,45)}</option>)}
        </select>
        <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filtrar ítems…" style={{width:160}}/>
        {rq&&<OBadge estado={rq.estado} map={ESTADO_RQ_COLOR}/>}
        {rq&&<span className="badge badge--blue">{rq.area}</span>}
        <span style={{fontSize:11,color:"var(--t3)",marginLeft:"auto"}}>{items.length} ítems</span>
      </div>
      {rq&&(
        <div className="card" style={{padding:"8px 14px",marginBottom:8,background:"var(--bg-subtle)"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
            {[{l:"Cliente",v:rq.cliente},{l:"Proyecto",v:rq.proyecto_servicio},{l:"Responsable",v:rq.responsable},{l:"F. requerida",v:rq.fecha_requerida,m:true}].map(f=>(
              <div key={f.l}><div style={{fontSize:10,color:"var(--t3)"}}>{f.l}</div><div style={{fontSize:11.5,fontWeight:600,color:"var(--t1)",fontFamily:f.m?"var(--mono)":"var(--font)"}}>{f.v}</div></div>
            ))}
          </div>
        </div>
      )}
      <div className="card" style={{overflowX:"auto",marginBottom:8}}>
        <div style={{padding:"7px 12px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:11.5,fontWeight:600,color:"var(--t1)"}}>Ítems del requerimiento</span>
          <span style={{fontSize:12,fontWeight:700,color:"var(--t1)",fontFamily:"var(--mono)"}}>Total: S/ {total.toLocaleString("es-PE",{minimumFractionDigits:0})}</span>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr style={{background:"var(--bg-subtle)"}}>
              {["#","Descripción","Tipo","Und.","Cant.","P.Unit.","Total","Proveedor","Entrega","EQ","LL","HB","Estado"].map(h=>(
                <th key={h} style={{padding:"6px 8px",textAlign:["Cant.","P.Unit.","Total"].includes(h)?"right":"left",fontWeight:600,color:"var(--t3)",borderBottom:"1px solid var(--border)",fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((d,i)=>(
              <tr key={d.id} style={{borderBottom:"1px solid var(--border)"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--bg-subtle)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"5px 8px",color:"var(--t3)"}}>{i+1}</td>
                <td style={{padding:"5px 8px",maxWidth:155,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--t1)",fontWeight:500}}>{d.descripcion}</td>
                <td style={{padding:"5px 8px",fontSize:10,color:"var(--t2)",whiteSpace:"nowrap"}}>{d.tipo_recurso}</td>
                <td style={{padding:"5px 8px",fontFamily:"var(--mono)",textAlign:"center"}}>{d.unidad}</td>
                <td style={{padding:"5px 8px",textAlign:"right",fontWeight:600,fontFamily:"var(--mono)"}}>{d.cantidad}</td>
                <td style={{padding:"5px 8px",textAlign:"right"}}><OMonto v={d.precio_unitario} m={d.moneda}/></td>
                <td style={{padding:"5px 8px",textAlign:"right",fontWeight:600}}><OMonto v={d.costo_total} m={d.moneda}/></td>
                <td style={{padding:"5px 8px",fontSize:10,color:"var(--t2)",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.proveedor}</td>
                <td style={{padding:"5px 8px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{d.fecha_entrega}</td>
                {[d.eq,d.ll,d.hb].map((v,j)=>(
                  <td key={j} style={{padding:"5px 8px",textAlign:"center"}}>
                    <span style={{fontWeight:700,color:v==="Aprobado"?"var(--green-text)":"var(--amber-text)"}}>{v==="Aprobado"?"✓":"○"}</span>
                  </td>
                ))}
                <td style={{padding:"5px 8px"}}><OBadge estado={d.estado} map={ESTADO_RQ_COLOR}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ─── Propuestas técnicas section ──────────────────────────────────────────────
function OpsPropuestas() {
  const [search, setSearch] = React.useState("");
  const [estado, setEstado] = React.useState("Todos");
  const props = (typeof OPS_PROPUESTAS!=="undefined"?OPS_PROPUESTAS:[]).filter(p=>{
    const q=search.toLowerCase();
    return (estado==="Todos"||p.estado===estado)&&(!q||p.codigo.toLowerCase().includes(q)||p.titulo.toLowerCase().includes(q)||p.cliente.toLowerCase().includes(q));
  });
  const estados = [...new Set((typeof OPS_PROPUESTAS!=="undefined"?OPS_PROPUESTAS:[]).map(p=>p.estado))];
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
        {[
          {l:"Total propuestas",v:props.length,c:"var(--blue)"},
          {l:"Aprobadas",v:props.filter(p=>p.estado==="Aprobada").length,c:"var(--green-text)"},
          {l:"En elaboración",v:props.filter(p=>p.estado==="En elaboración").length,c:"var(--amber-text)"},
          {l:"Enviadas",v:props.filter(p=>p.estado==="Enviada").length,c:"var(--blue-text)"},
        ].map(s=>(
          <div key={s.l} className="card" style={{padding:"8px 12px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:s.c,fontFamily:"var(--mono)"}}>{s.v}</div>
            <div style={{fontSize:10.5,color:"var(--t3)"}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}>
        <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar código, título, cliente…" style={{width:240}}/>
        <select className="select" style={{width:"auto"}} value={estado} onChange={e=>setEstado(e.target.value)}>
          <option value="Todos">Todos los estados</option>
          {estados.map(e=><option key={e} value={e}>{e}</option>)}
        </select>
        <span style={{fontSize:11,color:"var(--t3)",marginLeft:"auto"}}>{props.length} propuestas técnicas</span>
      </div>
      <div className="card" style={{overflowX:"auto",marginBottom:8}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
          <thead>
            <tr style={{background:"var(--bg-subtle)"}}>
              {["Código","Título","Cliente","Cotización","Disciplina","Responsable","Rev.","Páginas","F. Emisión","Estado"].map(h=>(
                <th key={h} style={{padding:"7px 10px",textAlign:"left",fontWeight:600,color:"var(--t3)",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap",fontSize:10.5}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.map(p=>(
              <tr key={p.id} style={{borderBottom:"1px solid var(--border)"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--bg-subtle)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"7px 10px",fontFamily:"var(--mono)",fontSize:10.5,fontWeight:600,color:"var(--blue-text)",whiteSpace:"nowrap"}}>{p.codigo}</td>
                <td style={{padding:"7px 10px",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--t1)",fontWeight:500}}>{p.titulo}</td>
                <td style={{padding:"7px 10px",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--t2)"}}>{p.cliente}</td>
                <td style={{padding:"7px 10px",fontFamily:"var(--mono)",fontSize:10,color:"var(--t2)",whiteSpace:"nowrap"}}>{p.cotizacion_codigo}</td>
                <td style={{padding:"7px 10px",fontSize:10.5,color:"var(--t2)",whiteSpace:"nowrap"}}>{p.disciplina}</td>
                <td style={{padding:"7px 10px",fontSize:10.5,color:"var(--t2)",whiteSpace:"nowrap"}}>{p.responsable}</td>
                <td style={{padding:"7px 10px",textAlign:"center",fontFamily:"var(--mono)",color:"var(--t2)"}}>{p.revision}</td>
                <td style={{padding:"7px 10px",textAlign:"center",fontFamily:"var(--mono)",color:"var(--t2)"}}>{p.paginas}</td>
                <td style={{padding:"7px 10px",fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",whiteSpace:"nowrap"}}>{p.fecha_emision}</td>
                <td style={{padding:"7px 10px"}}><OBadge estado={p.estado}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <OpsAIPanel agentId="ie" placeholder="¿Qué propuestas técnicas faltan revisar? ¿Cuáles tienen mayor complejidad? ¿Disciplinas con más carga?" context="propuestas"/>
    </div>
  );
}

// ─── Análisis IA section (cross-data) ─────────────────────────────────────────
function OpsAnalisisIA() {
  const [agentId, setAgentId] = React.useState("gg");
  const [query, setQuery]     = React.useState("");
  const [result, setResult]   = React.useState(null);
  const [busy, setBusy]       = React.useState(false);
  const persona = AGENT_PERSONAS[agentId];

  const QUICK = {
    gg: ["Dame un resumen ejecutivo de toda la operación","¿Cuál es el win rate de cotizaciones?","¿Qué riesgos operativos ves en el portafolio?"],
    pm: ["¿Qué requerimientos están pendientes y son críticos?","¿Qué proyectos tienen más restricciones?","Dame el avance global de los RQ"],
    ic: ["¿Cuál es el monto total cotizado por moneda?","¿Qué recursos son los más costosos?","Analiza el margen de las propuestas ganadas"],
    ie: ["¿Qué propuestas técnicas requieren más ingeniería?","¿Qué disciplinas tienen mayor carga?","Revisa la consistencia técnica de los RQ"],
  };

  async function run(q) {
    const text = q||query;
    if(!text.trim()) return;
    setBusy(true); setResult(null); setQuery(text);
    const opsCtx = typeof opsAgentContext!=="undefined"?opsAgentContext(text):"";
    const sys = buildSystemPrompt(agentId,{knowledge:IGStore.get().knowledge});
    const res = await callClaude(sys, `${opsCtx}\n\n---\nConsulta del GG: ${text}\n\nResponde con datos concretos del portafolio operativo y una recomendación accionable.`);
    setResult(res.text); setBusy(false);
    IGActions.logTimeline({type:"knowledge",title:`Análisis IA operativo — ${persona?.name||agentId}`,detail:text.slice(0,60),result:"ok"});
  }

  const agentsList = ["gg","pm","ic","ie"];
  return (
    <div>
      {/* Agent selector */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        {agentsList.map(id=>{
          const at=agentAvatarAttrs(id,30); const p=AGENT_PERSONAS[id]; const active=agentId===id;
          return (
            <button key={id} onClick={()=>{setAgentId(id);setResult(null);}}
              style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderRadius:"var(--r)",
                border:active?"1.5px solid var(--blue)":"1px solid var(--border)",
                background:active?"var(--blue-bg)":"var(--bg-card)",cursor:"pointer"}}>
              <div className={at.className} style={{...at.style,width:30,height:30,fontSize:11}}>{at.initials}</div>
              <div style={{textAlign:"left"}}>
                <div style={{fontSize:12,fontWeight:600,color:active?"var(--blue-text)":"var(--t1)"}}>{p?.name||id}</div>
                <div style={{fontSize:10,color:"var(--t3)"}}>{p?.role||""}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick prompts */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        {(QUICK[agentId]||[]).map(q=>(
          <button key={q} className="btn btn--ghost btn--sm" style={{fontSize:11}} onClick={()=>run(q)} disabled={busy}>{q}</button>
        ))}
      </div>

      {/* Composer */}
      <div className="card" style={{padding:"12px 14px"}}>
        <div style={{display:"flex",gap:8}}>
          <textarea className="textarea" style={{flex:1,minHeight:60,resize:"none"}} value={query}
            onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();run();}}}
            placeholder={`Pregunta a ${persona?.name||agentId} sobre cotizaciones, RQ, recursos, propuestas…`}/>
          <button className="btn btn--primary" onClick={()=>run()} disabled={busy||!query.trim()} style={{alignSelf:"flex-end",padding:"9px 14px"}}>
            {busy?<span className="spinner"/>:<Icons.sparkle width="14" height="14"/>}
          </button>
        </div>
        {result&&(
          <div style={{marginTop:10,padding:"12px 14px",background:"var(--bg-subtle)",borderRadius:"var(--r)",fontSize:12.5,lineHeight:1.65,color:"var(--t1)",whiteSpace:"pre-wrap"}}>{result}</div>
        )}
        {!result&&!busy&&(
          <div style={{marginTop:10,fontSize:11,color:"var(--t3)",lineHeight:1.6}}>
            El agente <b>{persona?.name}</b> lee automáticamente: cotizaciones, requerimientos, recursos, detalle RQ y propuestas técnicas. Pregúntale lo que necesites para tomar decisiones.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── OperacionesView (main — internal mini-sidebar) ──────────────────────────
const OPS_SECTIONS = [
  { id:"resumen",        label:"Resumen",            icon:"layers"      },
  { id:"cotizaciones",   label:"Cotizaciones",       icon:"costs"       },
  { id:"requerimientos", label:"Requerimientos",     icon:"projects"    },
  { id:"detalle",        label:"Detalle RQ",          icon:"folder"      },
  { id:"recursos",       label:"Recursos",           icon:"engineering" },
  { id:"propuestas",     label:"Propuestas técnicas",icon:"memory"      },
  { id:"analisis",       label:"Análisis IA",         icon:"sparkle"     },
];

function OperacionesView() {
  const [section, setSection] = React.useState("resumen");
  const byEstado = OPS_ESTADOS_COT.reduce((a,e)=>({...a,[e]:OPS_COTIZACIONES.filter(c=>c.estado===e).length}),{});
  const pendRQ   = OPS_REQUERIMIENTOS.filter(r=>r.estado==="Pendiente").length;
  const counts   = {
    cotizaciones: OPS_COTIZACIONES.length,
    requerimientos: OPS_REQUERIMIENTOS.length,
    recursos: OPS_RECURSOS.length,
    propuestas: (typeof OPS_PROPUESTAS!=="undefined"?OPS_PROPUESTAS.length:0),
  };

  return (
    <>
      <AIPageHeader
        eyebrow="Oficina Técnica · SGP-LITE"
        title="Operaciones SGP"
        description="Módulo operativo: cotizaciones, requerimientos, recursos y propuestas técnicas. Los agentes leen estos datos para analizar y decidir."
        actions={
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <span className="badge badge--green">{(byEstado["Ganada"]||0)+(byEstado["Adjudicado"]||0)} Ganadas</span>
            <span className="badge badge--amber">{pendRQ} RQ pend.</span>
            <span className="badge badge--blue">{byEstado["Enviada"]||0} Enviadas</span>
          </div>
        }
      />
      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
        {/* Internal mini-sidebar */}
        <div style={{width:172,flexShrink:0,position:"sticky",top:0}}>
          <div className="card" style={{padding:6,overflow:"hidden"}}>
            {OPS_SECTIONS.map(sec=>{
              const active=section===sec.id; const Ico=Icons[sec.icon];
              const count=counts[sec.id];
              return (
                <button key={sec.id} onClick={()=>setSection(sec.id)}
                  style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 9px",borderRadius:"var(--r-sm)",textAlign:"left",
                    background:active?"var(--blue-bg)":"transparent",transition:"background .12s",marginBottom:1}}
                  onMouseEnter={e=>{if(!active)e.currentTarget.style.background="var(--bg-subtle)";}}
                  onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent";}}>
                  <span style={{display:"flex",width:15,height:15,color:active?"var(--blue-text)":"var(--t3)",flexShrink:0}}>{Ico&&<Ico/>}</span>
                  <span style={{flex:1,fontSize:11.5,fontWeight:active?600:500,color:active?"var(--blue-text)":"var(--t2)"}}>{sec.label}</span>
                  {count!=null&&count>0&&<span style={{fontSize:9.5,fontWeight:700,padding:"1px 5px",borderRadius:99,background:active?"var(--blue)":"var(--bg-subtle)",color:active?"#fff":"var(--t3)"}}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,minWidth:0}}>
          {section==="resumen"        && <OpsResumen/>}
          {section==="cotizaciones"   && <OpsCotizaciones/>}
          {section==="requerimientos" && <OpsRequerimientos/>}
          {section==="detalle"        && <OpsDetalleRQ/>}
          {section==="recursos"       && <OpsRecursos/>}
          {section==="propuestas"     && <OpsPropuestas/>}
          {section==="analisis"       && <OpsAnalisisIA/>}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { OperacionesView });
