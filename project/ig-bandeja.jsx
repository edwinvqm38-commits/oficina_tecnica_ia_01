// ig-bandeja.jsx — Live multi-agent inbox: GG writes a request, agents respond
// with real AI, then GG produces an executive synthesis.
// ============================================================================

const BANDEJA_AVATAR = { gg:"agent-avatar--gg", ic:"agent-avatar--ic", pm:"agent-avatar--pm", ie:"agent-avatar--future" };

function LiveResponseCard({ result, status }) {
  const persona = AGENT_PERSONAS[result?.agentId] || {};
  return (
    <div className="card">
      <div className="card-header">
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <div className={`agent-avatar ${BANDEJA_AVATAR[result?.agentId]}`}>{(result?.agentId||"").toUpperCase()}</div>
          <div>
            <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>{result?.name || (AGENT_PERSONAS[result?.agentId]?.fullName) || persona.name}</div>
            <div style={{fontSize:11, color:"var(--t3)"}}>{persona.expertise}</div>
          </div>
        </div>
        {status === "thinking" ? (
          <span className="badge badge--amber" style={{gap:5}}><span className="spinner" style={{width:10,height:10}}/> Analizando…</span>
        ) : (
          <span className="badge badge--green">Respondido</span>
        )}
      </div>
      <div className="card-body">
        {status === "thinking" ? (
          <div style={{display:"flex", flexDirection:"column", gap:6}}>
            {[100,92,78].map((w,i)=>(
              <div key={i} style={{height:9, width:`${w}%`, borderRadius:4, background:"var(--bg-subtle)", animation:"igblink 1.4s infinite", animationDelay:`${i*0.15}s`}}/>
            ))}
          </div>
        ) : (
          <div style={{fontSize:12.5, color:"var(--t1)", lineHeight:1.65, whiteSpace:"pre-wrap"}}>{result?.text}</div>
        )}
      </div>
    </div>
  );
}

function InboxLiveView() {
  const [state] = useStore();
  const [request, setRequest] = React.useState("");
  const [selectedAgents, setSelectedAgents] = React.useState(["ic", "pm"]);
  const [projectId, setProjectId] = React.useState("PRY-001");
  const [pendingFiles, setPendingFiles] = React.useState([]);
  const [phase, setPhase] = React.useState("compose"); // compose | running | done
  const [results, setResults] = React.useState([]);
  const [thinking, setThinking] = React.useState(null);
  const [synthesis, setSynthesis] = React.useState(null);
  const [synthBusy, setSynthBusy] = React.useState(false);
  const fileRef = React.useRef(null);

  const allProjects = [...(window.PROJECTS||[]), ...state.customProjects];
  const project = allProjects.find(p => p.id === projectId);

  function toggleAgent(id) {
    setSelectedAgents(prev => prev.includes(id) ? prev.filter(a=>a!==id) : [...prev, id]);
  }

  async function handleFiles(fileList) {
    const arr = Array.from(fileList);
    const metas = [];
    for (const file of arr) {
      const content = await readFileAsText(file);
      const meta = IGActions.registerFile({ name:file.name, size:file.size, type:file.type, excerpt:content.slice(0,200) });
      IGFiles.put(meta.id, content);
      metas.push(meta);
    }
    setPendingFiles(prev => [...prev, ...metas]);
  }

  async function runAnalysis() {
    if (!request.trim() || selectedAgents.length === 0) return;
    setPhase("running");
    setResults([]); setSynthesis(null);

    const collected = [];
    await runMultiAgent(request, selectedAgents, {
      project, files: pendingFiles,
      onAgentStart: (id) => setThinking(id),
      onAgentDone: (entry) => { collected.push(entry); setResults([...collected]); setThinking(null); },
    });
    setThinking(null);
    setPhase("done");

    IGActions.logTimeline({ type:"approval", title:"Solicitud multiagente procesada", detail: request.slice(0,80), result:"ok" });
    IGActions.notify({ kind:"success", title:"Análisis completado", body:`${collected.length} agentes respondieron`, route:"bandeja" });
    // Auto-archive to vault
    if (window.archiveProjectRequest) {
      const agentNames = selectedAgents.map(id => (AGENT_PERSONAS[id]||{}).name || id);
      const respText = collected.map(r => `**${r.name}:**\n${r.text}`).join("\n\n");
      archiveProjectRequest(projectId, request, agentNames, respText);
    }

    // auto-synthesis
    setSynthBusy(true);
    const synth = await ggSynthesis(request, collected, { project });
    setSynthesis(synth.text);
    setSynthBusy(false);
  }

  function reset() {
    setPhase("compose"); setResults([]); setSynthesis(null); setRequest(""); setPendingFiles([]);
  }

  return (
    <>
      <AIPageHeader
        eyebrow="Bandeja Gerencial"
        title="Solicitud y análisis multiagente"
        description="Plantea una solicitud, elige qué agentes deben analizarla y recibe sus respuestas más una síntesis ejecutiva del GG. Con IA real al publicar el prototipo."
        actions={
          phase !== "compose"
            ? <button className="btn btn--ghost" onClick={reset}>Nueva solicitud</button>
            : <span className="badge badge--blue badge--dot">IA real al publicar</span>
        }
      />

      {/* Composer */}
      {phase === "compose" && (
        <div className="card" style={{marginBottom:12}}>
          <div className="card-header">
            <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Nueva solicitud del Gerente General</div>
          </div>
          <div className="card-body">
            <div className="field">
              <label className="field-label">¿Qué necesitas analizar?</label>
              <textarea className="textarea" style={{minHeight:90}} value={request} onChange={(e)=>setRequest(e.target.value)}
                placeholder="Ej: Evalúa la desviación de costo-plazo de la SET Tintaya y recomiéndame una acción correctiva." />
            </div>

            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
              <div className="field">
                <label className="field-label">Proyecto en contexto</label>
                <select className="select" value={projectId} onChange={(e)=>setProjectId(e.target.value)}>
                  {allProjects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Adjuntar archivos (memoria, parámetros, CSV)</label>
                <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={(e)=>{handleFiles(e.target.files); e.target.value="";}} />
                <button className="btn btn--ghost" onClick={()=>fileRef.current?.click()} style={{justifyContent:"flex-start"}}>
                  <Icons.folder width="14" height="14" /> Seleccionar archivos
                </button>
              </div>
            </div>

            {pendingFiles.length > 0 && (
              <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:10}}>
                {pendingFiles.map(f => (
                  <span key={f.id} className="badge badge--blue" style={{gap:5}}>
                    <Icons.folder width="11" height="11" /> {f.name}
                    <button onClick={()=>setPendingFiles(p=>p.filter(x=>x.id!==f.id))} style={{display:"flex"}}><Icons.x width="10" height="10"/></button>
                  </span>
                ))}
              </div>
            )}

            <div className="field">
              <label className="field-label">Asignar a</label>
              <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                {["ic","pm","ie"].map(id => {
                  const sel = selectedAgents.includes(id);
                  const p = AGENT_PERSONAS[id];
                  return (
                    <button key={id} onClick={()=>toggleAgent(id)}
                      style={{
                        display:"flex", alignItems:"center", gap:8, padding:"7px 12px",
                        borderRadius:"var(--r)", border:"1px solid "+(sel?"var(--blue-border)":"var(--border)"),
                        background: sel?"var(--blue-bg)":"var(--bg-card)", cursor:"pointer", transition:"all .12s",
                      }}>
                      <div className={`agent-avatar ${BANDEJA_AVATAR[id]}`} style={{width:24,height:24,fontSize:9}}>{id.toUpperCase()}</div>
                      <span style={{fontSize:12, fontWeight:600, color:"var(--t1)"}}>{p.name}</span>
                      {sel && <Icons.check width="13" height="13" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{display:"flex", justifyContent:"flex-end", marginTop:6}}>
              <button className="btn btn--primary" onClick={runAnalysis} disabled={!request.trim() || selectedAgents.length===0}>
                <Icons.sparkle width="14" height="14" /> Enviar a {selectedAgents.length} agente{selectedAgents.length!==1?"s":""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Running / done — request recap + responses */}
      {phase !== "compose" && (
        <div className="space-y-3">
          <div className="card">
            <div className="card-header">
              <div>
                <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:3}}>
                  <span style={{fontSize:11, fontFamily:"var(--mono)", color:"var(--t3)"}}>{project?.id}</span>
                  <span className="badge badge--blue">En análisis</span>
                </div>
                <div style={{fontSize:13.5, fontWeight:600, color:"var(--t1)", lineHeight:1.4}}>{request}</div>
              </div>
              <div style={{display:"flex", gap:5, flexShrink:0}}>
                {selectedAgents.map(a => <span key={a} className="badge badge--blue">{a.toUpperCase()}</span>)}
              </div>
            </div>
          </div>

          {selectedAgents.map(agentId => {
            const result = results.find(r => r.agentId === agentId);
            const status = result ? "done" : (thinking === agentId || phase === "running") ? "thinking" : "thinking";
            return <LiveResponseCard key={agentId} result={result || {agentId}} status={result ? "done":"thinking"} />;
          })}

          {/* GG synthesis */}
          {(synthBusy || synthesis) && (
            <div className="card" style={{borderColor:"var(--blue-border)"}}>
              <div className="card-header" style={{background:"var(--blue-bg)"}}>
                <div style={{display:"flex", alignItems:"center", gap:10}}>
                  <div className="agent-avatar agent-avatar--gg">GG</div>
                  <div>
                    <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Síntesis ejecutiva</div>
                    <div style={{fontSize:11, color:"var(--blue-text)"}}>Decisión recomendada del Gerente General</div>
                  </div>
                </div>
                <Icons.shield width="16" height="16" />
              </div>
              <div className="card-body">
                {synthBusy ? (
                  <div style={{display:"flex", alignItems:"center", gap:10, padding:"10px 0", color:"var(--t3)"}}>
                    <span className="spinner" /> <span style={{fontSize:12}}>El GG está sintetizando las respuestas…</span>
                  </div>
                ) : (
                  <>
                    <div style={{fontSize:13, color:"var(--t1)", lineHeight:1.65, whiteSpace:"pre-wrap"}}>{synthesis}</div>
                    <div style={{display:"flex", gap:6, marginTop:12, paddingTop:12, borderTop:"1px solid var(--border)"}}>
                      <button className="btn btn--success btn--sm" onClick={()=>{IGActions.notify({kind:"success",title:"Decisión registrada",body:"Aprobada por GG",route:"bandeja"}); IGActions.logTimeline({type:"approval",title:"Decisión GG sobre solicitud",detail:request.slice(0,60),result:"approved"});}}>
                        <Icons.check width="12" height="12" /> Aprobar acción
                      </button>
                      <button className="btn btn--warning btn--sm">Observar</button>
                      <button className="btn btn--ghost btn--sm" onClick={async()=>{
                        const convo = results.map(r=>`${r.name}: ${r.text}`).join("\n\n");
                        const note = await suggestKnowledge("gg", convo);
                        if(note){IGActions.proposeKnowledge({agentId:"gg",title:note.title,body:note.body,project:project?.id,source:"bandeja"});}
                      }}>
                        <Icons.sparkle width="12" height="12" /> Guardar aprendizaje
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

Object.assign(window, { InboxLiveView });
