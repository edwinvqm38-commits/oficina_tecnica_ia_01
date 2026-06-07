// ig-models-ui.jsx — Model selector topbar chip, recommendation banner,
// and Models settings panel. Loaded after ig-models.js.
// ============================================================================

// ─── Speed badge color ───────────────────────────────────────────────────────
const SPEED_COLOR = {
  "instantáneo": "var(--green)",
  "muy rápido":  "var(--green)",
  "rápido":      "var(--blue)",
  "medio":       "var(--amber)",
  "lento":       "var(--orange)",
};

// ─── Model selector dropdown ─────────────────────────────────────────────────
function ModelSelectorDropdown({ onClose }) {
  const [activeId, setActiveId] = React.useState(ModelStore.getActiveModel());
  const downloaded = ModelStore.getDownloaded();
  const all        = ModelStore.getAll();
  const notDownloaded = all.filter(m => !m.downloaded);

  function select(id) { ModelStore.setActiveModel(id); setActiveId(id); onClose(); }

  return (
    <div style={{
      position:"absolute", top:"calc(100% + 6px)", right:0,
      width:300, background:"var(--bg-card)",
      border:"1px solid var(--border)", borderRadius:"var(--r-lg)",
      boxShadow:"var(--shadow-md)", zIndex:200, overflow:"hidden",
    }} onClick={e=>e.stopPropagation()}>
      <div style={{padding:"8px 12px", borderBottom:"1px solid var(--border)"}}>
        <div style={{fontSize:11, fontWeight:600, color:"var(--t1)"}}>Modelos locales (Ollama)</div>
        <div style={{fontSize:10, color:"var(--t3)"}}>Simulado · Conecta Ollama real en producción</div>
      </div>

      {/* Downloaded */}
      <div style={{padding:"6px 0"}}>
        <div style={{padding:"3px 12px 4px", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", color:"var(--t3)"}}>
          Descargados ({downloaded.length})
        </div>
        {downloaded.map(m => (
          <div key={m.id} onClick={()=>select(m.id)} style={{
            display:"flex", alignItems:"center", gap:9, padding:"7px 12px",
            cursor:"pointer", transition:"background .1s",
            background: activeId===m.id ? "var(--blue-bg)" : "transparent",
          }}
          onMouseEnter={e=>{ if(activeId!==m.id) e.currentTarget.style.background="var(--bg-subtle)"; }}
          onMouseLeave={e=>{ if(activeId!==m.id) e.currentTarget.style.background="transparent"; }}>
            <div style={{
              width:6, height:6, borderRadius:"50%", flexShrink:0,
              background: activeId===m.id ? "var(--blue)" : "var(--green)",
            }}/>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, fontWeight:600, color: activeId===m.id?"var(--blue-text)":"var(--t1)"}}>
                {m.label} <span style={{fontSize:10, color:"var(--t3)"}}>({m.params})</span>
              </div>
              <div style={{fontSize:10, color:"var(--t3)"}}>{m.strengths.slice(0,2).join(" · ")}</div>
            </div>
            <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2, flexShrink:0}}>
              <span style={{fontSize:9, fontFamily:"var(--mono)", color:"var(--t3)"}}>{m.size}</span>
              <span style={{fontSize:9, color: SPEED_COLOR[m.speed]||"var(--t2)", fontWeight:600}}>{m.speed}</span>
            </div>
            {activeId===m.id && <Icons.check width="12" height="12" style={{color:"var(--blue)", flexShrink:0}}/>}
          </div>
        ))}
      </div>

      {/* Not downloaded */}
      <div style={{borderTop:"1px solid var(--border)", padding:"6px 0"}}>
        <div style={{padding:"3px 12px 4px", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", color:"var(--t3)"}}>
          Para descargar
        </div>
        {notDownloaded.map(m => (
          <div key={m.id} style={{
            display:"flex", alignItems:"center", gap:9, padding:"6px 12px",
            opacity:.65,
          }}>
            <div style={{width:6, height:6, borderRadius:"50%", flexShrink:0, background:"var(--border-strong)"}}/>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:11.5, fontWeight:600, color:"var(--t2)"}}>{m.label} ({m.params})</div>
              <div style={{fontSize:10, color:"var(--t3)", fontFamily:"var(--mono)"}}>{`ollama pull ${m.ollama}`}</div>
            </div>
            <span style={{fontSize:9, fontFamily:"var(--mono)", color:"var(--t3)", flexShrink:0}}>{m.size}</span>
          </div>
        ))}
      </div>

      <div style={{padding:"8px 12px", borderTop:"1px solid var(--border)", background:"var(--bg-subtle)"}}>
        <div style={{fontSize:10, color:"var(--t3)", lineHeight:1.5}}>
          Para usar Ollama real: <span style={{fontFamily:"var(--mono)", fontSize:9.5}}>OLLAMA_ORIGINS=* ollama serve</span>
        </div>
      </div>
    </div>
  );
}

// ─── Topbar model chip (exported — used in ig-shell.jsx AITopbar) ─────────────
function ModelChip() {
  const [open, setOpen]   = React.useState(false);
  const [, force]         = React.useReducer(x=>x+1, 0);
  IGStore.subscribe(force);
  const modelId = ModelStore.getActiveModel();
  const model   = ModelStore.findById(modelId) || ModelStore.getDownloaded()[0];

  React.useEffect(() => {
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <div style={{position:"relative"}}>
      <button
        onClick={e=>{e.stopPropagation(); setOpen(o=>!o);}}
        style={{
          display:"flex", alignItems:"center", gap:6,
          padding:"3px 8px 3px 6px",
          border:"1px solid var(--border)", borderRadius:"var(--r)",
          background: open ? "var(--blue-bg)" : "var(--bg-card)",
          cursor:"pointer", transition:"all .12s",
        }}>
        <span style={{width:6, height:6, borderRadius:"50%", background:"var(--green)", flexShrink:0}}/>
        <span style={{fontSize:11, fontWeight:600, color:"var(--t1)"}}>
          {model?.label || "Sin modelo"} <span style={{fontSize:10, color:"var(--t3)"}}>local</span>
        </span>
        <Icons.chevronDown width="11" height="11" />
      </button>
      {open && <ModelSelectorDropdown onClose={()=>setOpen(false)} />}
    </div>
  );
}

// ─── Recommendation banner (shown in chat + roundtable) ──────────────────────
function ModelRecommendBanner({ text, agentId }) {
  const [dismissed, setDismissed] = React.useState(false);
  if (!text || dismissed) return null;

  const { recommended, betterAvailable, score } = recommendModel(text, agentId);
  const active = ModelStore.findById(ModelStore.getActiveModel());
  const needsSwitch = active?.id !== recommended?.id;

  if (!needsSwitch && !betterAvailable) return null;

  return (
    <div style={{
      display:"flex", alignItems:"flex-start", gap:8,
      padding:"7px 10px", marginBottom:6,
      borderRadius:"var(--r)", fontSize:11,
      background: needsSwitch ? "var(--blue-bg)" : "var(--amber-bg)",
      border:`1px solid ${needsSwitch ? "var(--blue-border)" : "var(--amber-border)"}`,
      color: needsSwitch ? "var(--blue-text)" : "var(--amber-text)",
    }}>
      <Icons.layers width="13" height="13" style={{flexShrink:0, marginTop:1}}/>
      <div style={{flex:1}}>
        {needsSwitch && (
          <span>Para esta consulta, <b>{recommended?.label}</b> ({recommended?.params}) daría mejor resultado.
          {" "}<button onClick={()=>{ModelStore.setActiveModel(recommended.id); setDismissed(true);}}
            style={{textDecoration:"underline", color:"var(--blue-text)", cursor:"pointer", fontWeight:600}}>
            Cambiar ahora
          </button></span>
        )}
        {betterAvailable && (
          <span style={{display:"block", marginTop:3, fontSize:10}}>
            💡 <b>{betterAvailable.label}</b> ({betterAvailable.size}) sería ideal para esta tarea.
            Descárgalo: <span style={{fontFamily:"var(--mono)", fontSize:9.5}}>{`ollama pull ${betterAvailable.ollama}`}</span>
          </span>
        )}
      </div>
      <button onClick={()=>setDismissed(true)} style={{flexShrink:0, color:"inherit", opacity:.6}}>
        <Icons.x width="11" height="11"/>
      </button>
    </div>
  );
}

// ─── Models settings panel ────────────────────────────────────────────────────
function ModelsView() {
  const [vaultOpen, setVaultOpen] = React.useState(false);
  const [, force] = React.useReducer(x=>x+1, 0);
  IGStore.subscribe(force);
  const all        = ModelStore.getAll();
  const downloaded = ModelStore.getDownloaded();

  return (
    <>
      <AIPageHeader
        eyebrow="Modelos locales"
        title="Gestión de modelos Ollama"
        description="Selecciona qué modelo usar por defecto o por agente. En producción conecta Ollama local — por ahora todo es simulado."
        actions={
          <div style={{display:"flex", gap:6}}>
            <div className="kpi" style={{padding:"5px 10px"}}>
              <span style={{fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".07em"}}>Disponibles</span>
              <span style={{fontSize:15, fontWeight:700, color:"var(--green)", marginLeft:6}}>{downloaded.length}</span>
            </div>
            <div className="kpi" style={{padding:"5px 10px"}}>
              <span style={{fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".07em"}}>Por descargar</span>
              <span style={{fontSize:15, fontWeight:700, color:"var(--t3)", marginLeft:6}}>{all.length - downloaded.length}</span>
            </div>
          </div>
        }
      />

      <div style={{display:"grid", gridTemplateColumns:"1fr 340px", gap:12, alignItems:"start"}}>
        {/* Model list */}
        <div className="card">
          <div className="card-header">
            <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Catálogo de modelos</div>
            <span className="badge badge--mock">Simulado</span>
          </div>
          {all.map(m => {
            const active = ModelStore.getActiveModel() === m.id;
            return (
              <div key={m.id} style={{
                display:"flex", gap:12, padding:"10px 14px",
                borderBottom:"1px solid var(--border)",
                background: active ? "var(--blue-bg)" : "transparent",
                opacity: m.downloaded ? 1 : .65,
              }}>
                <div style={{flexShrink:0, marginTop:2}}>
                  <div style={{
                    width:8, height:8, borderRadius:"50%",
                    background: m.downloaded ? "var(--green)" : "var(--border-strong)",
                  }}/>
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:2}}>
                    <span style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>{m.label}</span>
                    <span className="badge badge--slate">{m.params}</span>
                    {active && <span className="badge badge--blue">Activo</span>}
                    {!m.downloaded && <span className="badge badge--mock">No descargado</span>}
                  </div>
                  <div style={{fontSize:11, color:"var(--t2)", marginBottom:4}}>{m.note}</div>
                  <div style={{display:"flex", gap:4, flexWrap:"wrap"}}>
                    {m.strengths.map(s => <span key={s} className="badge badge--slate" style={{fontSize:9.5}}>{s}</span>)}
                  </div>
                  {!m.downloaded && (
                    <div style={{marginTop:5, fontSize:10, fontFamily:"var(--mono)", color:"var(--t3)"}}>
                      {`ollama pull ${m.ollama}`}
                    </div>
                  )}
                </div>
                <div style={{flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4}}>
                  <span style={{fontSize:10, fontFamily:"var(--mono)", color:"var(--t3)"}}>{m.size}</span>
                  <span style={{fontSize:10, fontWeight:600, color: SPEED_COLOR[m.speed]||"var(--t2)"}}>{m.speed}</span>
                  {m.downloaded && (
                    <button className={`btn btn--sm ${active?"btn--done":"btn--ghost"}`}
                      onClick={()=>{ModelStore.setActiveModel(m.id); force();}}>
                      {active ? "Activo" : "Usar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: per-agent + setup guide */}
        <div style={{display:"flex", flexDirection:"column", gap:10}}>
          {/* Per-agent defaults */}
          <div className="card">
            <div className="card-header">
              <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Modelo por agente</div>
            </div>
            <div style={{padding:"6px 0"}}>
              {IGAgents.getAll().filter(a=>a.status==="active"||a.type==="agent").slice(0,6).map(agent => {
                const modelId  = ModelStore.getAgentModel(agent.id);
                const model    = ModelStore.findById(modelId);
                const agentBg  = agent.color || "#4b5563";
                return (
                  <div key={agent.id} style={{display:"flex", alignItems:"center", gap:10, padding:"8px 14px", borderBottom:"1px solid var(--border)"}}>
                    <div className="agent-avatar" style={{width:26, height:26, fontSize:9, flexShrink:0, background:agentBg, color:"#fff"}}>
                      {agent.initials}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:11.5, fontWeight:600, color:"var(--t1)"}}>{agent.name}</div>
                      <div style={{fontSize:10, color:"var(--t3)"}}>{agent.role.split("/")[0]}</div>
                    </div>
                    <select
                      value={modelId}
                      onChange={e=>{ModelStore.setAgentModel(agent.id, e.target.value); force();}}
                      style={{fontSize:10.5, border:"1px solid var(--border)", borderRadius:"var(--r-sm)", padding:"3px 6px", background:"var(--bg-card)", color:"var(--t1)"}}
                    >
                      {ModelStore.getDownloaded().map(m => (
                        <option key={m.id} value={m.id}>{m.label} ({m.params})</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Setup guide */}
          <div className="card">
            <div className="card-header" style={{cursor:"pointer"}} onClick={()=>setVaultOpen(v=>!v)}>
              <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Guía de conexión real</div>
              {vaultOpen ? <Icons.chevronUp /> : <Icons.chevronDown />}
            </div>
            {vaultOpen && (
              <div style={{padding:"12px 14px"}}>
                <pre style={{fontSize:10.5, lineHeight:1.7, color:"var(--t2)", fontFamily:"var(--mono)", whiteSpace:"pre-wrap", wordBreak:"break-all"}}>
                  {OLLAMA_SETUP_GUIDE}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { ModelChip, ModelRecommendBanner, ModelsView, ModelSelectorDropdown });
