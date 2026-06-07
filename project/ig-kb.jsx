// ig-kb.jsx — Knowledge base (Obsidian-style), GG decision timeline,
// and AI-generated executive report.
// ============================================================================

const KB_AGENT_LABEL = { ic:"Ing. Costos", pm:"Project Mgmt", gg:"Gerencia", ie:"Ing. Eléctrico" };

function KBNoteCard({ note }) {
  const statusColor = note.status === "validated" ? "green" : note.status === "proposed" ? "amber" : "slate";
  const statusLabel = note.status === "validated" ? "Validado" : note.status === "proposed" ? "Pendiente GG" : "Rechazado";
  return (
    <div className={`kb-note kb-note--${note.status}`}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:5}}>
        <div style={{fontSize:12.5, fontWeight:600, color:"var(--t1)", lineHeight:1.3}}>{note.title}</div>
        <span className={`badge badge--${statusColor}`} style={{flexShrink:0}}>{statusLabel}</span>
      </div>
      <p style={{fontSize:11.5, color:"var(--t2)", lineHeight:1.55, marginBottom:8}}>{note.body}</p>
      <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
        {note.agentId && <span className="badge badge--blue">{KB_AGENT_LABEL[note.agentId] || note.agentId}</span>}
        {note.project && <span className="badge badge--slate">{note.project}</span>}
        <span style={{fontSize:10, color:"var(--t3)", fontFamily:"var(--mono)"}}>
          {new Date(note.ts).toLocaleDateString("es-PE", {day:"2-digit", month:"short"})}
        </span>
        {note.source && <span style={{fontSize:10, color:"var(--t3)"}}>· vía {note.source}</span>}
      </div>
      {note.status === "proposed" && (
        <div style={{display:"flex", gap:6, marginTop:10}}>
          <button className="btn btn--success btn--sm" onClick={() => IGActions.validateKnowledge(note.id, true)}>
            <Icons.check width="12" height="12" /> Validar y guardar
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => IGActions.validateKnowledge(note.id, false)}>
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}

function MemoryView() {
  const [state] = useStore();
  const [filter, setFilter] = React.useState("all");
  const [showForm, setShowForm] = React.useState(false);

  const notes = state.knowledge;
  const validated = notes.filter(n => n.status === "validated");
  const proposed = notes.filter(n => n.status === "proposed");

  const filtered = filter === "all" ? notes :
                   filter === "validated" ? validated :
                   filter === "proposed" ? proposed :
                   notes.filter(n => n.agentId === filter);

  const tabs = [
    {id:"all", label:`Todo (${notes.length})`},
    {id:"validated", label:`Validado (${validated.length})`},
    {id:"proposed", label:`Pendiente (${proposed.length})`},
    {id:"ic", label:"Costos"},
    {id:"pm", label:"PM"},
  ];

  return (
    <>
      <AIPageHeader
        eyebrow="Base de conocimiento"
        title="Memoria operativa de la oficina técnica"
        description="Criterios técnicos que los agentes aprenden y reutilizan. Cada nota requiere validación del GG antes de convertirse en criterio permanente que alimenta sus respuestas."
        actions={
          <div style={{display:"flex", gap:6}}>
            {proposed.length > 0 && <span className="badge badge--amber">{proposed.length} por validar</span>}
            <button className="btn btn--primary" onClick={() => setShowForm(true)}>
              <Icons.sparkle width="13" height="13" /> Añadir criterio
            </button>
          </div>
        }
      />

      <div style={{display:"flex", gap:2, marginBottom:12, background:"var(--bg-subtle)", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:3, width:"fit-content"}}>
        {tabs.map(t => (
          <button key={t.id} className={`mode-tab ${filter===t.id?"mode-tab--active":""}`} onClick={() => setFilter(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="card" style={{padding:"10px 14px", marginBottom:12, display:"flex", gap:10, alignItems:"center", background:"var(--blue-bg)", borderColor:"var(--blue-border)"}}>
        <Icons.layers width="18" height="18" />
        <div style={{fontSize:11.5, color:"var(--blue-text)", lineHeight:1.5}}>
          <b>Ciclo de aprendizaje:</b> un agente propone un criterio desde un chat o análisis → el GG lo valida → pasa a ser conocimiento permanente que se inyecta en las respuestas futuras de ese agente.
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon"><Icons.memory width="40" height="40" /></div>
          <div style={{fontSize:13, fontWeight:600, color:"var(--t2)", marginBottom:4}}>Sin criterios todavía</div>
          <p style={{fontSize:12, maxWidth:360, margin:"0 auto"}}>Conversa con un agente en el Chat y usa "Proponer aprendizaje al GG", o añade un criterio manualmente.</p>
        </div>
      ) : (
        <div style={{display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:10, alignItems:"start"}}>
          {filtered.map(n => <KBNoteCard key={n.id} note={n} />)}
        </div>
      )}

      {showForm && <KnowledgeForm onClose={() => setShowForm(false)} />}
    </>
  );
}

function KnowledgeForm({ onClose }) {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [agentId, setAgentId] = React.useState("ic");
  const [project, setProject] = React.useState("");

  function submit() {
    if (!title.trim() || !body.trim()) return;
    IGActions.proposeKnowledge({ title: title.trim(), body: body.trim(), agentId, project: project || null, source:"manual" });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Nuevo criterio de conocimiento</span>
          <button className="btn btn--ghost btn--sm" onClick={onClose}><Icons.x width="13" height="13" /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">Título del criterio</label>
            <input className="input" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Ej: Sobrecosto por terreno rocoso no previsto" />
          </div>
          <div className="field">
            <label className="field-label">Criterio / regla</label>
            <textarea className="textarea" value={body} onChange={(e)=>setBody(e.target.value)} placeholder="Describe el criterio técnico reutilizable…" />
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
            <div className="field">
              <label className="field-label">Agente</label>
              <select className="select" value={agentId} onChange={(e)=>setAgentId(e.target.value)}>
                <option value="ic">Ing. de Costos</option>
                <option value="pm">Project Management</option>
                <option value="ie">Ing. Eléctrico</option>
                <option value="gg">Gerencia</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label">Proyecto (opcional)</label>
              <input className="input" value={project} onChange={(e)=>setProject(e.target.value)} placeholder="PRY-001" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={submit}>Proponer al GG</button>
        </div>
      </div>
    </div>
  );
}

// ─── TIMELINE ────────────────────────────────────────────────────────────────

const TL_CONFIG = {
  approval:  { color:"var(--blue)",   bg:"var(--blue-bg)",   icon:"approvals" },
  skill:     { color:"var(--green)",  bg:"var(--green-bg)",  icon:"skills"    },
  knowledge: { color:"var(--amber)",  bg:"var(--amber-bg)",  icon:"memory"    },
  project:   { color:"var(--orange)", bg:"var(--orange-bg)", icon:"projects"  },
  report:    { color:"var(--blue)",   bg:"var(--blue-bg)",   icon:"layers"    },
};

function TimelineView() {
  const [state] = useStore();
  const events = state.timeline;

  return (
    <>
      <AIPageHeader
        eyebrow="Trazabilidad"
        title="Línea de tiempo de decisiones"
        description="Registro cronológico de cada decisión, aprobación, validación de conocimiento y cambio en proyectos. Tu bitácora de gobierno."
        actions={<span className="badge badge--slate">{events.length} eventos</span>}
      />

      {events.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon"><Icons.clock width="40" height="40" /></div>
          <div style={{fontSize:13, fontWeight:600, color:"var(--t2)", marginBottom:4}}>Sin eventos registrados</div>
          <p style={{fontSize:12, maxWidth:360, margin:"0 auto"}}>Aprobaciones, skills activadas y criterios validados aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <div className="card" style={{padding:"16px 18px"}}>
          {events.map((e, i) => {
            const cfg = TL_CONFIG[e.type] || TL_CONFIG.approval;
            const IconC = Icons[cfg.icon] || Icons.clock;
            const last = i === events.length - 1;
            return (
              <div key={e.id} className="tl-entry">
                <div className="tl-rail">
                  <div className="tl-node" style={{background:cfg.bg, color:cfg.color}}>
                    <IconC width="13" height="13" />
                  </div>
                  {!last && <div className="tl-stem" />}
                </div>
                <div className="tl-card">
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8}}>
                    <span style={{fontSize:12.5, fontWeight:600, color:"var(--t1)"}}>{e.title}</span>
                    <span style={{fontSize:10.5, color:"var(--t3)", fontFamily:"var(--mono)", flexShrink:0}}>
                      {new Date(e.ts).toLocaleString("es-PE", {day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"})}
                    </span>
                  </div>
                  {e.detail && <div style={{fontSize:11.5, color:"var(--t2)", marginTop:2}}>{e.detail}</div>}
                  {e.result && (
                    <span className={`badge badge--${e.result==="approved"||e.result==="validated"||e.result==="active"||e.result==="ok"?"green":e.result==="rejected"?"red":e.result==="observed"?"amber":"slate"}`} style={{marginTop:5}}>
                      {e.result}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── EXECUTIVE REPORT ────────────────────────────────────────────────────────

function ReportView() {
  const [state] = useStore();
  const [busy, setBusy] = React.useState(false);
  const [report, setReport] = React.useState(null);
  const [scope, setScope] = React.useState("portfolio");

  async function generate() {
    setBusy(true); setReport(null);
    const projects = [...(window.PROJECTS||[]), ...state.customProjects];
    const pending = (window.APPROVALS||[]).filter(a => (state.approvalDecisions[a.id]||a.status) === "pending");

    const dataDump =
      `PROYECTOS:\n` + projects.map(p => `- ${p.id} ${p.name} (${p.client}): ${p.status}, avance ${p.progress}%, costo ${p.cost}, riesgo ${p.risk}, próx. hito ${p.nextMilestone} ${p.due}`).join("\n") +
      `\n\nAPROBACIONES PENDIENTES:\n` + pending.map(a => `- ${a.title} [${a.risk}] — ${a.agent}`).join("\n") +
      `\n\nALERTAS:\n` + (window.ALERTS||[]).map(a => `- [${a.level}] ${a.title}: ${a.message}`).join("\n");

    const focusText = scope === "portfolio" ? "estado general del portafolio de proyectos"
      : scope === "risk" ? "riesgos y proyectos en peligro"
      : "decisiones pendientes que requieren tu aprobación";

    const system = buildSystemPrompt("gg");
    const prompt =
      `Genera un REPORTE EJECUTIVO para el Gerente General enfocado en: ${focusText}.\n\n` +
      `Datos actuales:\n${dataDump}\n\n` +
      `Estructura el reporte con: (1) Resumen ejecutivo en 2-3 frases, (2) Puntos críticos (viñetas), ` +
      `(3) Decisiones recomendadas, (4) Acción inmediata sugerida. Sé conciso, profesional y orientado a la acción.`;

    const res = await callClaude(system, prompt);
    setReport(res.text);
    setBusy(false);
    IGActions.logTimeline({ type:"report", title:"Reporte ejecutivo generado", detail: focusText, result:"ok" });
  }

  return (
    <>
      <AIPageHeader
        eyebrow="Reporte ejecutivo"
        title="Síntesis gerencial con IA"
        description="El Gerente General sintetiza el estado de la operación a partir de proyectos, aprobaciones y alertas vigentes."
        actions={
          <div style={{display:"flex", gap:6, alignItems:"center"}}>
            <select className="select" style={{width:"auto", padding:"5px 10px"}} value={scope} onChange={(e)=>setScope(e.target.value)}>
              <option value="portfolio">Portafolio general</option>
              <option value="risk">Riesgos</option>
              <option value="decisions">Decisiones pendientes</option>
            </select>
            <button className="btn btn--primary" onClick={generate} disabled={busy}>
              {busy ? <span className="spinner" /> : <Icons.sparkle width="13" height="13" />} Generar reporte
            </button>
          </div>
        }
      />

      <div className="card" style={{minHeight:300}}>
        <div className="card-header">
          <div style={{display:"flex", alignItems:"center", gap:9}}>
            <div className="agent-avatar agent-avatar--gg">GG</div>
            <div>
              <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Reporte del Gerente General</div>
              <div style={{fontSize:11, color:"var(--t3)"}}>{new Date().toLocaleDateString("es-PE", {weekday:"long", day:"2-digit", month:"long", year:"numeric"})}</div>
            </div>
          </div>
          <span className="badge badge--blue badge--dot">IA real al publicar</span>
        </div>
        <div className="card-body" style={{minHeight:240}}>
          {busy && (
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:10, padding:"50px 0", color:"var(--t3)"}}>
              <span className="spinner" style={{width:24, height:24}} />
              <span style={{fontSize:12}}>El GG está analizando la operación…</span>
            </div>
          )}
          {!busy && !report && (
            <div className="empty-state" style={{padding:"50px 20px"}}>
              <div className="empty-state-icon"><Icons.layers width="40" height="40" /></div>
              <p style={{fontSize:12, maxWidth:380, margin:"0 auto"}}>Selecciona un enfoque y genera un reporte ejecutivo sintetizado a partir de los datos vigentes de la operación.</p>
            </div>
          )}
          {!busy && report && (
            <div style={{fontSize:13, color:"var(--t1)", lineHeight:1.65, whiteSpace:"pre-wrap"}}>{report}</div>
          )}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { MemoryView, TimelineView, ReportView, KnowledgeForm });
