// ig-agent-builder.jsx — Agents management view + create/edit agent modal.
// Phase 2: dynamic agent registry UI. Org-chart drag editing is Phase 3.
// ============================================================================

function AgentAvatar({ id, size=32, agent }) {
  const a = agent || IGAgents.get(id);
  const attrs = agentAvatarAttrs(id || (a&&a.id), size);
  return <div className={attrs.className} style={attrs.style}>{a ? a.initials : attrs.initials}</div>;
}

function ModelBadge({ modelId }) {
  const m = BASE_MODELS.find(x => x.id === modelId);
  return <span className="badge badge--slate" style={{gap:4}}><Icons.layers width="10" height="10"/> {m ? m.label.split(" (")[0] : modelId || "—"}</span>;
}

function AgentCard({ agent, onEdit }) {
  const children = IGAgents.children(agent.id);
  const parent = agent.parentId ? IGAgents.get(agent.parentId) : null;
  const allSkills = [...(window.SKILLS||[]), ...(IGStore.get().customSkills||[])];
  const skillNames = (agent.skills||[]).map(sid => (allSkills.find(s=>s.id===sid)||{}).name).filter(Boolean);
  const statusColor = agent.status==="active"?"green":agent.status==="future"?"slate":"amber";
  const statusLabel = agent.status==="active"?"Activo":agent.status==="future"?"Futuro":agent.status;

  return (
    <div className="card" style={{padding:0, opacity: agent.status==="future"?.8:1}}>
      <div style={{padding:"12px 14px", display:"flex", gap:11, alignItems:"flex-start"}}>
        <AgentAvatar id={agent.id} size={40} />
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:2, flexWrap:"wrap"}}>
            <span style={{fontSize:13.5, fontWeight:600, color:"var(--t1)"}}>{agent.name}</span>
            <span className={`badge badge--${statusColor}`}>{statusLabel}</span>
            {agent.core && <span className="badge badge--mock">Base</span>}
          </div>
          <div style={{fontSize:11.5, color:"var(--t2)", marginBottom:6}}>{agent.role}</div>
          <p style={{fontSize:11, color:"var(--t3)", lineHeight:1.5, marginBottom:8}}>{agent.description}</p>
          <div style={{display:"flex", gap:5, flexWrap:"wrap", alignItems:"center"}}>
            <ModelBadge modelId={agent.model} />
            {parent && <span className="badge badge--blue" style={{gap:3}}><Icons.arrowRight width="9" height="9"/> {parent.initials}</span>}
            {children.length > 0 && <span className="badge badge--slate">{children.length} sub-agente{children.length>1?"s":""}</span>}
            {skillNames.length > 0 && <span className="badge badge--green">{skillNames.length} skill{skillNames.length>1?"s":""}</span>}
          </div>
          {skillNames.length > 0 && (
            <div style={{marginTop:7, display:"flex", flexDirection:"column", gap:3}}>
              {skillNames.map((n,i)=><div key={i} className="list-item-bullet" style={{fontSize:10.5}}>{n}</div>)}
            </div>
          )}
        </div>
        <button className="btn btn--ghost btn--sm" onClick={()=>onEdit(agent)} style={{flexShrink:0}}>Editar</button>
      </div>
    </div>
  );
}

function AgentsView() {
  const [state] = useStore();
  const [editing, setEditing] = React.useState(null); // agent or {} for new
  const agents = IGAgents.getAll();
  const roots = agents.filter(a => !a.parentId);
  const byParent = (pid) => agents.filter(a => a.parentId === pid);

  const activeCount = agents.filter(a=>a.status==="active").length;
  const customCount = (state.customAgents||[]).length;

  // render hierarchy grouped: GG first, then its children, then their children
  function renderBranch(agent, depth=0) {
    const kids = byParent(agent.id);
    return (
      <React.Fragment key={agent.id}>
        <div style={{marginLeft: depth*18}}>
          <AgentCard agent={agent} onEdit={setEditing} />
        </div>
        {kids.map(k => renderBranch(k, depth+1))}
      </React.Fragment>
    );
  }

  return (
    <>
      <AIPageHeader
        eyebrow="Agentes"
        title="Equipo de agentes IA"
        description="Crea, configura y organiza tu equipo. Define rol, modelo de lenguaje, skills, jefe directo y sub-agentes. La jerarquía visual y el arrastre se afinan en el organigrama."
        actions={
          <div style={{display:"flex", gap:6, alignItems:"center"}}>
            <div className="kpi" style={{padding:"5px 10px"}}>
              <span style={{fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".07em"}}>Activos</span>
              <span style={{fontSize:15, fontWeight:700, color:"var(--green)", marginLeft:6}}>{activeCount}</span>
            </div>
            <div className="kpi" style={{padding:"5px 10px"}}>
              <span style={{fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".07em"}}>Propios</span>
              <span style={{fontSize:15, fontWeight:700, marginLeft:6}}>{customCount}</span>
            </div>
            <button className="btn btn--primary" onClick={()=>setEditing({})}>
              <Icons.agents width="14" height="14"/> Nuevo agente
            </button>
          </div>
        }
      />

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, alignItems:"start"}}>
        {roots.map(r => renderBranch(r))}
      </div>

      {editing && <AgentForm agent={editing.id ? editing : null} onClose={()=>setEditing(null)} />}
    </>
  );
}

function AgentForm({ agent, onClose }) {
  const isEdit = !!agent;
  const allAgents = IGAgents.getAll().filter(a => !agent || a.id !== agent.id);
  const allSkills = [...(window.SKILLS||[]), ...(IGStore.get().customSkills||[])];

  const [f, setF] = React.useState(agent || {
    name:"", role:"", description:"", initials:"", color:AGENT_COLORS[0],
    model:"llama3.2", parentId:"gg", skills:[], tone:"", status:"active",
  });
  const set = (k,v) => setF(prev => {
    const next = {...prev, [k]:v};
    if (k==="name" && !prev.initials) next.initials = v.split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
    return next;
  });
  const [newSkill, setNewSkill] = React.useState("");

  function toggleSkill(id) {
    setF(prev => ({...prev, skills: (prev.skills||[]).includes(id) ? prev.skills.filter(s=>s!==id) : [...(prev.skills||[]), id]}));
  }

  function addInlineSkill() {
    if (!newSkill.trim()) return;
    const sk = IGActions.addCustomSkill({
      name:newSkill.trim(), agent:f.name||"Agente", agentId:agent?agent.id:"new", version:"v1.0",
      risk:"medium", type:"analysis-workflow", status:"proposed", approvalRequired:true,
      trigger:"", inputs:[], discipline:"—", steps:[], safety:[], improvement:"",
      crossAgents:[], crossPurpose:"", ggApproval:{label:"Pendiente GG", scope:"Propuesta al crear agente."},
    });
    setF(prev => ({...prev, skills:[...(prev.skills||[]), sk.id]}));
    setNewSkill("");
  }

  function submit() {
    if (!f.name.trim() || !f.role.trim()) return;
    if (isEdit) IGAgents.update(agent.id, f);
    else IGAgents.add(f);
    onClose();
  }

  function del() {
    if (confirm(`¿Eliminar al agente ${agent.name}? Sus sub-agentes pasarán a su jefe.`)) { IGAgents.remove(agent.id); onClose(); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{maxWidth:620}} onClick={(e)=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? `Editar — ${agent.name}` : "Nuevo agente"}</span>
          <button className="btn btn--ghost btn--sm" onClick={onClose}><Icons.x width="13" height="13"/></button>
        </div>
        <div className="modal-body">
          {/* Identity */}
          <div style={{display:"flex", gap:12, alignItems:"center", marginBottom:12}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
              <div className="agent-avatar" style={{width:48, height:48, fontSize: f.emoji?28:17, background:f.emoji?"var(--bg-subtle)":f.color, color:f.emoji?"initial":"#fff"}}>{f.emoji||f.initials||"?"}</div>
              <button className="btn btn--ghost btn--sm" style={{fontSize:9, padding:"2px 5px"}} onClick={()=>set("emoji",null)}>reset</button>
            </div>
            {/* Emoji avatar picker */}
            <div style={{display:"flex", flexDirection:"column", gap:4}}>
              <span style={{fontSize:10, fontWeight:600, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".08em"}}>Avatar emoji (opcional)</span>
              <div style={{display:"flex", gap:3, flexWrap:"wrap", maxWidth:200}}>
                {["🤖","👷","🧑‍💼","👩‍🔬","🧑‍🔧","📊","🏗️","⚡","🔩","📋","🛡️","🔍","💡","📐","🗂️","🧠","⚙️","🌐"].map(e=>(
                  <button key={e} onClick={()=>set("emoji",e)}
                    style={{width:26,height:26,fontSize:16,borderRadius:"var(--r-sm)",border:f.emoji===e?"2px solid var(--blue)":"1px solid var(--border)",background:f.emoji===e?"var(--blue-bg)":"var(--bg-card)",cursor:"pointer"}}>{e}</button>
                ))}
              </div>
            </div>
            <div style={{flex:1, display:"grid", gridTemplateColumns:"2fr 1fr", gap:10}}>
              <div className="field" style={{margin:0}}><label className="field-label">Nombre</label>
                <input className="input" value={f.name} onChange={(e)=>set("name",e.target.value)} placeholder="Ing. de Seguridad" /></div>
              <div className="field" style={{margin:0}}><label className="field-label">Iniciales</label>
                <input className="input" value={f.initials} maxLength={3} onChange={(e)=>set("initials",e.target.value.toUpperCase())} placeholder="IS" /></div>
            </div>
          </div>

          <div className="field"><label className="field-label">Rol / cargo</label>
            <input className="input" value={f.role} onChange={(e)=>set("role",e.target.value)} placeholder="Seguridad y Salud Ocupacional" /></div>

          <div className="field"><label className="field-label">Descripción</label>
            <textarea className="textarea" style={{minHeight:48}} value={f.description} onChange={(e)=>set("description",e.target.value)} placeholder="Qué hace este agente y de qué se encarga…" /></div>

          {/* Color */}
          <div className="field"><label className="field-label">Color</label>
            <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
              {AGENT_COLORS.map(c => (
                <button key={c} onClick={()=>set("color",c)} style={{width:26, height:26, borderRadius:"50%", background:c, border: f.color===c?"3px solid var(--t1)":"2px solid var(--bg-card)", boxShadow:"0 0 0 1px var(--border)", cursor:"pointer"}} />
              ))}
            </div>
          </div>

          {/* Model + parent */}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
            <div className="field"><label className="field-label">Modelo de lenguaje</label>
              <select className="select" value={f.model} onChange={(e)=>set("model",e.target.value)}>
                {BASE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label} · {m.size}</option>)}
              </select>
              <span className="field-hint">Recomendaciones por tarea en Fase 5 (Ollama)</span>
            </div>
            <div className="field"><label className="field-label">Jefe directo (reporta a)</label>
              <select className="select" value={f.parentId||""} onChange={(e)=>set("parentId",e.target.value||null)}>
                <option value="">— Sin jefe (raíz) —</option>
                {allAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {/* Skills */}
          <div className="field"><label className="field-label">Skills del agente</label>
            <div style={{display:"flex", flexDirection:"column", gap:4, maxHeight:140, overflowY:"auto", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:8}}>
              {allSkills.length === 0 && <span style={{fontSize:11, color:"var(--t3)"}}>Aún no hay skills. Crea una abajo.</span>}
              {allSkills.map(s => (
                <label key={s.id} style={{display:"flex", alignItems:"center", gap:8, fontSize:11.5, color:"var(--t2)", cursor:"pointer", padding:"2px 0"}}>
                  <input type="checkbox" checked={(f.skills||[]).includes(s.id)} onChange={()=>toggleSkill(s.id)} />
                  {s.name} <span style={{color:"var(--t3)"}}>· {s.agent}</span>
                </label>
              ))}
            </div>
            <div style={{display:"flex", gap:6, marginTop:6}}>
              <input className="input" value={newSkill} onChange={(e)=>setNewSkill(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();addInlineSkill();}}} placeholder="Crear nueva skill…" />
              <button className="btn btn--ghost" onClick={addInlineSkill}>Añadir</button>
            </div>
          </div>

          {/* Tone */}
          <div className="field"><label className="field-label">Personalidad / tono <span className="field-hint">(prompt base)</span></label>
            <textarea className="textarea" value={f.tone} onChange={(e)=>set("tone",e.target.value)} placeholder="Eres [nombre], [rol]. Eres riguroso, empático y siempre propones una solución…" /></div>
        </div>
        <div className="modal-footer" style={{justifyContent: isEdit && !agent.core ? "space-between" : "flex-end"}}>
          {isEdit && !agent.core && <button className="btn btn--danger" onClick={del}><Icons.x width="12" height="12"/> Eliminar</button>}
          <div style={{display:"flex", gap:8}}>
            <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn--primary" onClick={submit}>{isEdit ? "Guardar cambios" : "Crear agente"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AgentsView, AgentForm, AgentAvatar, ModelBadge });
