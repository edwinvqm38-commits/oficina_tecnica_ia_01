// ig-extras.jsx — Project form, Skill proposal form, global search,
// notifications dropdown, and export/import state utilities.
// ============================================================================

// ─── PROJECT FORM ────────────────────────────────────────────────────────────
function ProjectForm({ onClose, initial }) {
  const [f, setF] = React.useState(initial || {
    name:"", client:"", discipline:"Eléctrica", column:"Planificacion",
    status:"planning", risk:"low", progress:0, cost:"Por definir",
    nextMilestone:"", due:"", summary:"", agents:["PM"],
  });
  const set = (k,v) => setF(prev => ({...prev, [k]:v}));

  function submit() {
    if (!f.name.trim() || !f.client.trim()) return;
    IGActions.upsertProject({ ...f, agents: f.agents });
    IGActions.notify({ kind:"success", title:"Proyecto guardado", body:f.name, route:"projects" });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial ? "Editar proyecto" : "Nuevo proyecto"}</span>
          <button className="btn btn--ghost btn--sm" onClick={onClose}><Icons.x width="13" height="13"/></button>
        </div>
        <div className="modal-body">
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
            <div className="field"><label className="field-label">Nombre</label>
              <input className="input" value={f.name} onChange={(e)=>set("name",e.target.value)} placeholder="SET Tintaya 138kV" /></div>
            <div className="field"><label className="field-label">Cliente</label>
              <input className="input" value={f.client} onChange={(e)=>set("client",e.target.value)} placeholder="Antapaccay S.A." /></div>
          </div>
          <div className="field"><label className="field-label">Descripción</label>
            <textarea className="textarea" value={f.summary} onChange={(e)=>set("summary",e.target.value)} placeholder="Alcance técnico del proyecto…" /></div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10}}>
            <div className="field"><label className="field-label">Fase</label>
              <select className="select" value={f.column} onChange={(e)=>set("column",e.target.value)}>
                {["Planificacion","Ejecucion","Control","Cierre"].map(c=><option key={c} value={c}>{c}</option>)}
              </select></div>
            <div className="field"><label className="field-label">Estado</label>
              <select className="select" value={f.status} onChange={(e)=>set("status",e.target.value)}>
                {["planning","on-track","at-risk","delayed"].map(c=><option key={c} value={c}>{c}</option>)}
              </select></div>
            <div className="field"><label className="field-label">Riesgo</label>
              <select className="select" value={f.risk} onChange={(e)=>set("risk",e.target.value)}>
                {["low","medium","high","critical"].map(c=><option key={c} value={c}>{c}</option>)}
              </select></div>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10}}>
            <div className="field"><label className="field-label">Avance %</label>
              <input className="input" type="number" min="0" max="100" value={f.progress} onChange={(e)=>set("progress",Number(e.target.value))} /></div>
            <div className="field"><label className="field-label">Costo</label>
              <input className="input" value={f.cost} onChange={(e)=>set("cost",e.target.value)} placeholder="S/ 2.40 M" /></div>
            <div className="field"><label className="field-label">Vencimiento</label>
              <input className="input" value={f.due} onChange={(e)=>set("due",e.target.value)} placeholder="23 Jun 2026" /></div>
          </div>
          <div className="field"><label className="field-label">Próximo hito</label>
            <input className="input" value={f.nextMilestone} onChange={(e)=>set("nextMilestone",e.target.value)} placeholder="Revisión diseño básico" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={submit}>Guardar proyecto</button>
        </div>
      </div>
    </div>
  );
}

// ─── SKILL FORM ──────────────────────────────────────────────────────────────
function SkillForm({ onClose }) {
  const [f, setF] = React.useState({
    name:"", agent:"Ing. de Costos", agentId:"ic", version:"v1.0", risk:"medium",
    type:"analysis-workflow", trigger:"", steps:"", safety:"", improvement:"",
  });
  const set = (k,v) => setF(prev => ({...prev, [k]:v}));

  function submit() {
    if (!f.name.trim()) return;
    IGActions.addCustomSkill({
      name:f.name.trim(), agent:f.agent, agentId:f.agentId, version:f.version, risk:f.risk,
      type:f.type, status:"proposed", approvalRequired:true,
      trigger:f.trigger, inputs:[], discipline:"—",
      steps: f.steps.split("\n").map(s=>s.trim()).filter(Boolean),
      safety: f.safety.split("\n").map(s=>s.trim()).filter(Boolean),
      improvement:f.improvement,
      crossAgents:[], crossPurpose:"",
      ggApproval:{label:"Pendiente GG", scope:"Propuesta desde formulario. Requiere aprobación."},
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Proponer nueva skill</span>
          <button className="btn btn--ghost btn--sm" onClick={onClose}><Icons.x width="13" height="13"/></button>
        </div>
        <div className="modal-body">
          <div className="field"><label className="field-label">Nombre de la skill</label>
            <input className="input" value={f.name} onChange={(e)=>set("name",e.target.value)} placeholder="Análisis de precios unitarios (APU)" /></div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10}}>
            <div className="field"><label className="field-label">Agente</label>
              <select className="select" value={f.agentId} onChange={(e)=>{const v=e.target.value; set("agentId",v); set("agent",{ic:"Ing. de Costos",pm:"Project Management",ie:"Ing. Eléctrico"}[v]);}}>
                <option value="ic">Ing. de Costos</option>
                <option value="pm">Project Management</option>
                <option value="ie">Ing. Eléctrico</option>
              </select></div>
            <div className="field"><label className="field-label">Versión</label>
              <input className="input" value={f.version} onChange={(e)=>set("version",e.target.value)} /></div>
            <div className="field"><label className="field-label">Riesgo</label>
              <select className="select" value={f.risk} onChange={(e)=>set("risk",e.target.value)}>
                {["low","medium","high","critical"].map(c=><option key={c} value={c}>{c}</option>)}
              </select></div>
          </div>
          <div className="field"><label className="field-label">Disparador (cuándo se activa)</label>
            <input className="input" value={f.trigger} onChange={(e)=>set("trigger",e.target.value)} placeholder="Solicitud de presupuesto de obra" /></div>
          <div className="field"><label className="field-label">Flujo de trabajo <span className="field-hint">(un paso por línea)</span></label>
            <textarea className="textarea" value={f.steps} onChange={(e)=>set("steps",e.target.value)} placeholder={"Identificar partidas\nCalcular metrados\nAplicar APU\nConsolidar presupuesto"} /></div>
          <div className="field"><label className="field-label">Reglas de seguridad <span className="field-hint">(una por línea)</span></label>
            <textarea className="textarea" value={f.safety} onChange={(e)=>set("safety",e.target.value)} placeholder={"Indicar fuente de cada precio\nNo aprobar adicionales sin evidencia"} /></div>
          <div className="field"><label className="field-label">Mejora sugerida</label>
            <input className="input" value={f.improvement} onChange={(e)=>set("improvement",e.target.value)} placeholder="Incorporar base de precios regional" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={submit}>Proponer al GG</button>
        </div>
      </div>
    </div>
  );
}

// ─── GLOBAL SEARCH ───────────────────────────────────────────────────────────
function GlobalSearch({ onClose, onNavigate }) {
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef(null);
  const state = IGStore.get();

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const index = React.useMemo(() => {
    const items = [];
    [...(window.PROJECTS||[]), ...state.customProjects].forEach(p =>
      items.push({ kind:"Proyecto", route:"projects", title:p.name, sub:`${p.id} · ${p.client}`, text:`${p.name} ${p.client} ${p.id} ${p.summary||""}` }));
    [...(window.SKILLS||[]), ...state.customSkills].forEach(s =>
      items.push({ kind:"Skill", route:"skills", title:s.name, sub:`${s.agent} · ${s.version}`, text:`${s.name} ${s.agent} ${s.trigger||""}` }));
    (window.APPROVALS||[]).forEach(a =>
      items.push({ kind:"Aprobación", route:"approvals", title:a.title, sub:a.agent, text:`${a.title} ${a.summary} ${a.agent}` }));
    state.knowledge.forEach(k =>
      items.push({ kind:"Conocimiento", route:"memory", title:k.title, sub:k.body.slice(0,40), text:`${k.title} ${k.body}` }));
    Object.entries(AGENT_PERSONAS).forEach(([id,p]) =>
      items.push({ kind:"Agente", route:"chat", title:p.name, sub:p.role, text:`${p.name} ${p.role} ${p.expertise}` }));
    return items;
  }, [state.customProjects, state.customSkills, state.knowledge]);

  const results = q.trim()
    ? index.filter(i => i.text.toLowerCase().includes(q.toLowerCase())).slice(0, 12)
    : index.slice(0, 8);

  React.useEffect(() => { setActive(0); }, [q]);

  function go(r) { onNavigate(r.route); onClose(); }

  function onKey(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a+1, results.length-1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a-1, 0)); }
    else if (e.key === "Enter" && results[active]) { go(results[active]); }
    else if (e.key === "Escape") { onClose(); }
  }

  return (
    <div className="search-backdrop" onClick={onClose}>
      <div className="search-box" onClick={(e)=>e.stopPropagation()}>
        <div className="search-input-wrap">
          <Icons.eye width="18" height="18" />
          <input ref={inputRef} className="search-input" value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Buscar proyectos, skills, aprobaciones, conocimiento, agentes…" />
          <span className="badge badge--slate">Esc</span>
        </div>
        <div className="search-results">
          {results.length === 0 ? (
            <div style={{padding:"24px", textAlign:"center", color:"var(--t3)", fontSize:12}}>Sin resultados para "{q}"</div>
          ) : results.map((r, i) => (
            <div key={i} className={`search-result ${i===active?"search-result--active":""}`}
              onClick={()=>go(r)} onMouseEnter={()=>setActive(i)}>
              <span className="search-result-kind">{r.kind}</span>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:13, fontWeight:600, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{r.title}</div>
                <div style={{fontSize:11, color:"var(--t3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{r.sub}</div>
              </div>
              <Icons.arrowRight width="14" height="14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── NOTIFICATIONS DROPDOWN ──────────────────────────────────────────────────
const NOTIF_COLOR = { success:"var(--green)", danger:"var(--red)", warning:"var(--amber)", info:"var(--blue)" };

function NotificationPanel({ onClose, onNavigate }) {
  const [state] = useStore();
  const notifs = state.notifications;

  React.useEffect(() => {
    const t = setTimeout(() => IGActions.markAllRead(), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="notif-panel" onClick={(e)=>e.stopPropagation()}>
      <div style={{padding:"10px 12px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <span style={{fontSize:12.5, fontWeight:600, color:"var(--t1)"}}>Notificaciones</span>
        <button className="btn btn--ghost btn--sm" onClick={()=>IGActions.markAllRead()}>Marcar leídas</button>
      </div>
      <div style={{maxHeight:380, overflowY:"auto"}}>
        {notifs.length === 0 ? (
          <div style={{padding:"28px 16px", textAlign:"center", color:"var(--t3)", fontSize:12}}>
            <Icons.bell width="24" height="24" style={{margin:"0 auto 8px", opacity:.4}} />
            Sin notificaciones
          </div>
        ) : notifs.map(n => (
          <div key={n.id} className={`notif-item ${!n.read?"notif-item--unread":""}`}
            onClick={()=>{ if(n.route) onNavigate(n.route); onClose(); }}>
            <div className="notif-dot" style={{background:NOTIF_COLOR[n.kind]||"var(--blue)"}} />
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, fontWeight:600, color:"var(--t1)"}}>{n.title}</div>
              <div style={{fontSize:11, color:"var(--t2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{n.body}</div>
              <div style={{fontSize:10, color:"var(--t3)", marginTop:2, fontFamily:"var(--mono)"}}>
                {new Date(n.ts).toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── EXPORT / IMPORT ─────────────────────────────────────────────────────────
function downloadState() {
  const blob = new Blob([IGStore.exportJSON()], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `oficina-tecnica-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importStateFile(file, cb) {
  const reader = new FileReader();
  reader.onload = () => { const ok = IGStore.importJSON(String(reader.result||"")); cb && cb(ok); };
  reader.readAsText(file);
}

// ─── SETTINGS / BACKUP VIEW ─────────────────────────────────────────
function SettingsView() {
  const [state] = useStore();
  const [msg, setMsg] = React.useState(null);
  const importRef = React.useRef(null);

  const stats = [
    { label:"Proyectos creados",    value: state.customProjects.length },
    { label:"Skills propuestas",     value: state.customSkills.length },
    { label:"Criterios de conoc.",  value: state.knowledge.length },
    { label:"Decisiones tomadas",   value: Object.keys(state.approvalDecisions).length },
    { label:"Conversaciones",        value: Object.keys(state.chats).length },
    { label:"Eventos en bitácora",   value: state.timeline.length },
  ];

  function flash(t) { setMsg(t); setTimeout(()=>setMsg(null), 2500); }

  return (
    <>
      <AIPageHeader
        eyebrow="Sistema"
        title="Estado y respaldo local"
        description="Todo tu avance se guarda automáticamente en este navegador (memoria local). Exporta un respaldo para llevarlo a otra máquina o como copia de seguridad."
        actions={<span className="badge badge--green badge--dot">Guardado automático activo</span>}
      />

      <div className="grid-3" style={{marginBottom:14}}>
        {stats.map(s => (
          <div key={s.label} className="kpi">
            <div className="kpi-label">{s.label}</div>
            <div className="kpi-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{marginBottom:12}}>
        <div className="card-header"><div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Respaldo de datos</div></div>
        <div className="card-body">
          <p style={{fontSize:12, color:"var(--t2)", lineHeight:1.6, marginBottom:12}}>
            El estado vive en <b>localStorage</b> bajo la clave <span className="mono" style={{fontSize:11, background:"var(--bg-subtle)", padding:"1px 5px", borderRadius:3}}>oficina-tecnica:v1</span>. Persiste entre recargas y cierres del navegador. Los archivos adjuntos a chats viven en memoria de la sesión (no se exportan).
          </p>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <button className="btn btn--primary" onClick={()=>{ downloadState(); flash("Respaldo descargado."); }}>
              <Icons.arrowRight width="13" height="13" /> Exportar estado (.json)
            </button>
            <input ref={importRef} type="file" accept="application/json" style={{display:"none"}}
              onChange={(e)=>{ const f=e.target.files[0]; if(f) importStateFile(f, (ok)=>flash(ok?"Estado importado correctamente.":"Error al importar el archivo.")); e.target.value=""; }} />
            <button className="btn btn--ghost" onClick={()=>importRef.current?.click()}>
              <Icons.folder width="13" height="13" /> Importar estado
            </button>
            <button className="btn btn--danger" onClick={()=>{ if(confirm("¿Reiniciar todo el estado local? Esta acción no se puede deshacer.")){ IGStore.reset(); flash("Estado reiniciado."); } }}>
              <Icons.x width="13" height="13" /> Reiniciar todo
            </button>
          </div>
          {msg && <div style={{marginTop:10, fontSize:12, color:"var(--green-text)", fontWeight:600}}>{msg}</div>}
        </div>
      </div>

      <div className="card" style={{padding:"12px 14px", display:"flex", gap:10, alignItems:"flex-start", background:"var(--blue-bg)", borderColor:"var(--blue-border)"}}>
        <Icons.shield width="18" height="18" />
        <div style={{fontSize:11.5, color:"var(--blue-text)", lineHeight:1.55}}>
          <b>Hacia producción:</b> cuando conectes un backend, esta capa local se reemplaza por una base de datos. La base de conocimiento podría migrarse a Obsidian/Markdown + RAG, y los proyectos a una conexión de solo lectura. La arquitectura ya separa estado (store) de lógica de IA (motor de agentes) para facilitar esa migración.
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  ProjectForm, SkillForm, GlobalSearch, NotificationPanel,
  downloadState, importStateFile, SettingsView,
});
