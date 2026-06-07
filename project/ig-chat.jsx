// ig-chat.jsx — Chat interface with agents + file upload + knowledge capture
// ============================================================================

// ─── File reader util ────────────────────────────────────────────────────────
function readFileAsText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    // text-like files only; for others we store name + note
    if (/\.(txt|md|csv|json|tsv|log|xml|html?)$/i.test(file.name) || file.type.startsWith("text")) {
      reader.readAsText(file);
    } else {
      resolve(`(Archivo ${file.name} — ${(file.size/1024).toFixed(0)} KB. Formato binario: el agente trabajará con el nombre y los parámetros que describas en el mensaje.)`);
    }
  });
}

const CHAT_AGENTS = ["ic", "pm", "gg", "ie"];

const AGENT_AVATAR_CLASS = { gg:"agent-avatar--gg", ic:"agent-avatar--ic", pm:"agent-avatar--pm", ie:"agent-avatar--future" };

function AgentPicker({ active, onPick }) {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:4}}>
      {CHAT_AGENTS.map((id) => {
        const p = AGENT_PERSONAS[id];
        const isActive = active === id;
        const future = id === "ie";
        return (
          <button key={id}
            onClick={() => onPick(id)}
            style={{
              display:"flex", alignItems:"center", gap:9, padding:"8px 10px",
              borderRadius:"var(--r)", textAlign:"left", width:"100%",
              border:"1px solid " + (isActive ? "var(--blue-border)" : "transparent"),
              background: isActive ? "var(--blue-bg)" : "transparent",
              cursor:"pointer", transition:"all .12s", opacity: future ? .7 : 1,
            }}>
            <div className={`agent-avatar ${AGENT_AVATAR_CLASS[id]}`} style={{width:30, height:30, fontSize:11}}>
              {id.toUpperCase()}
            </div>
            <div style={{minWidth:0, flex:1}}>
              <div style={{fontSize:12, fontWeight:600, color:"var(--t1)"}}>{p.name}</div>
              <div style={{fontSize:10.5, color:"var(--t3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{p.role}</div>
            </div>
            {future && <span className="badge badge--slate" style={{flexShrink:0}}>Futuro</span>}
          </button>
        );
      })}
    </div>
  );
}

function MessageBubble({ msg, agentId }) {
  const isUser = msg.role === "user";
  return (
    <div style={{display:"flex", gap:9, flexDirection: isUser ? "row-reverse" : "row", alignItems:"flex-start"}}>
      <div className={`agent-avatar ${isUser ? "agent-avatar--gg" : AGENT_AVATAR_CLASS[agentId]}`}
        style={{width:28, height:28, fontSize:10, flexShrink:0}}>
        {isUser ? "GG" : agentId.toUpperCase()}
      </div>
      <div style={{maxWidth:"78%"}}>
        <div style={{
          padding:"8px 11px", borderRadius:10,
          background: isUser ? "var(--blue)" : "var(--bg-card)",
          color: isUser ? "#fff" : "var(--t1)",
          border: isUser ? "none" : "1px solid var(--border)",
          fontSize:12.5, lineHeight:1.55,
          borderTopRightRadius: isUser ? 3 : 10,
          borderTopLeftRadius: isUser ? 10 : 3,
        }}>
          {isUser ? msg.content : (
            typeof MessageContent !== 'undefined'
              ? <MessageContent content={msg.content} onNavigate={window.__igNavigate}/>
              : <span style={{whiteSpace:"pre-wrap"}}>{msg.content}</span>
          )}
        </div>
        {msg.files && msg.files.length > 0 && (
          <div style={{display:"flex", gap:4, flexWrap:"wrap", marginTop:5, justifyContent: isUser ? "flex-end" : "flex-start"}}>
            {msg.files.map((f) => (
              <span key={f.id} className="badge badge--slate" style={{gap:4}}>
                <Icons.folder width="11" height="11" /> {f.name}
              </span>
            ))}
          </div>
        )}
        <div style={{fontSize:10, color:"var(--t3)", marginTop:3, textAlign: isUser ? "right":"left"}}>
          {new Date(msg.ts).toLocaleTimeString("es-PE", {hour:"2-digit", minute:"2-digit"})}
          {msg.meta?.skills ? ` · ${msg.meta.skills} skills` : ""}
        </div>
      </div>
    </div>
  );
}

function TypingDots({ agentId }) {
  return (
    <div style={{display:"flex", gap:9, alignItems:"center"}}>
      <div className={`agent-avatar ${AGENT_AVATAR_CLASS[agentId]}`} style={{width:28, height:28, fontSize:10}}>
        {agentId.toUpperCase()}
      </div>
      <div style={{padding:"10px 14px", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:10, display:"flex", gap:4}}>
        {[0,1,2].map(i => (
          <span key={i} style={{
            width:6, height:6, borderRadius:"50%", background:"var(--t3)",
            animation:`igblink 1.2s ${i*0.2}s infinite ease-in-out`,
          }}/>
        ))}
      </div>
    </div>
  );
}

function ChatView({ onNavigate }) {
  const [state] = useStore();
  const [agentId, setAgentId] = React.useState(() => {
    const pre = window.__igChatAgent; window.__igChatAgent = null;
    return pre || "ic";
  });
  const [input, setInput] = React.useState("");
  const [pendingFiles, setPendingFiles] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [, force] = React.useReducer(x=>x+1, 0);
  const scrollRef = React.useRef(null);
  const fileRef = React.useRef(null);

  const thread = (IGStore.get().chats[agentId]) || [];
  const persona = AGENT_PERSONAS[agentId];
  const ctx = agentContext(agentId);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.length, busy]);

  async function handleFiles(fileList) {
    const arr = Array.from(fileList);
    const metas = [];
    for (const file of arr) {
      const content = await readFileAsText(file);
      const meta = IGActions.registerFile({
        name: file.name, size: file.size, type: file.type, agentId,
        excerpt: content.slice(0, 200),
      });
      IGFiles.put(meta.id, content);
      metas.push(meta);
    }
    setPendingFiles((prev) => [...prev, ...metas]);
  }

  async function send() {
    const text = input.trim();
    if (!text && pendingFiles.length === 0) return;
    if (busy) return;

    const files = pendingFiles;
    IGActions.appendChat(agentId, { role:"user", content: text || "(archivos adjuntos)", files });
    setInput(""); setPendingFiles([]); setBusy(true); force();

    const history = (IGStore.get().chats[agentId] || []).map(m => ({role:m.role, content:m.content}));
    const res = await askAgent(agentId, text || "Analiza los archivos adjuntos.", { files, history });

    IGActions.appendChat(agentId, {
      role:"assistant", content: res.text,
      meta: { skills: ctx.skills.length || undefined },
    });
    IGActions.notify({ kind:"info", title:`${persona.name} respondió`, body: text.slice(0,60) || "Análisis de archivos", route:"chat" });
    setBusy(false); force();
  }

  async function captureKnowledge() {
    const convo = thread.map(m => `${m.role==="user"?"GG":persona.name}: ${m.content}`).join("\n");
    if (!convo) return;
    setBusy(true); force();
    const note = await suggestKnowledge(agentId, convo);
    setBusy(false);
    if (note) {
      IGActions.proposeKnowledge({ agentId, title: note.title, body: note.body, source:"chat" });
      IGActions.notify({ kind:"success", title:"Conocimiento propuesto", body: note.title, route:"memory" });
    }
    force();
  }

  return (
    <>
      <AIPageHeader
        eyebrow="Chat con agentes"
        title="Consulta directa a tu equipo IA"
        description="Conversa con cada agente, adjunta archivos (memorias, parámetros, CSV) y deja que analicen con sus skills activas y la base de conocimiento."
        actions={<span className="badge badge--blue badge--dot">IA real al publicar</span>}
      />

      <div style={{display:"grid", gridTemplateColumns:"230px 1fr", gap:10, alignItems:"start"}}>
        {/* Agent picker + context */}
        <div className="space-y-2">
          <div className="card" style={{padding:8}}>
            <div style={{fontSize:10, textTransform:"uppercase", letterSpacing:".08em", fontWeight:600, color:"var(--t3)", padding:"4px 6px 6px"}}>Tu equipo</div>
            <AgentPicker active={agentId} onPick={setAgentId} />
          </div>

          <div className="card" style={{padding:"10px 12px"}}>
            <div style={{fontSize:11, fontWeight:600, color:"var(--t1)", marginBottom:6}}>Contexto activo de {persona.name.split(" ").pop()}</div>
            <div className="info-row"><span className="info-row-label">Skills activas</span><span className="info-row-value">{ctx.skills.length}</span></div>
            <div className="info-row"><span className="info-row-label">Conoc. validado</span><span className="info-row-value">{ctx.knowledge.length}</span></div>
            <div className="info-row"><span className="info-row-label">Mensajes</span><span className="info-row-value">{thread.length}</span></div>
            {ctx.skills.length > 0 && (
              <div style={{marginTop:8, display:"flex", flexDirection:"column", gap:4}}>
                {ctx.skills.map(s => <span key={s.id} className="badge badge--green" style={{justifyContent:"flex-start"}}>{s.name}</span>)}
              </div>
            )}
            <p style={{fontSize:10.5, color:"var(--t3)", marginTop:8, lineHeight:1.5}}>{persona.persona.slice(0, 130)}…</p>
          </div>

          {thread.length > 1 && (
            <button className="btn btn--ghost w-full" onClick={captureKnowledge} disabled={busy}>
              <Icons.sparkle width="13" height="13" /> Proponer aprendizaje al GG
            </button>
          )}
          {thread.length > 0 && (
            <button className="btn btn--ghost w-full" onClick={() => { IGActions.clearChat(agentId); force(); }}>
              Limpiar conversación
            </button>
          )}
        </div>

        {/* Chat panel */}
        <div className="card" style={{display:"flex", flexDirection:"column", height:"calc(100dvh - 190px)", minHeight:420}}>
          {/* header */}
          <div className="card-header" style={{flexShrink:0}}>
            <div style={{display:"flex", alignItems:"center", gap:9}}>
              <div className={`agent-avatar ${AGENT_AVATAR_CLASS[agentId]}`}>{agentId.toUpperCase()}</div>
              <div>
                <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>{persona.fullName||persona.name}</div>
                <div style={{fontSize:11, color:"var(--t3)"}}>{persona.expertise}</div>
              </div>
            </div>
            <span className="badge badge--mock">Haiku · 1024 tok</span>
          </div>

          {/* messages */}
          <div ref={scrollRef} style={{flex:1, overflowY:"auto", padding:"14px", display:"flex", flexDirection:"column", gap:12, background:"var(--bg-muted)"}}>
            {thread.length === 0 && (
              <div style={{margin:"auto", textAlign:"center", maxWidth:340}}>
                <div className={`agent-avatar ${AGENT_AVATAR_CLASS[agentId]}`} style={{width:48, height:48, fontSize:16, margin:"0 auto 12px"}}>{agentId.toUpperCase()}</div>
                <div style={{fontSize:14, fontWeight:600, color:"var(--t1)", marginBottom:4}}>Hola, soy {persona.fullName||persona.name}</div>
                <p style={{fontSize:12, color:"var(--t2)", lineHeight:1.6}}>
                  {agentId === "ic" && "Pídeme un presupuesto, análisis de desviación o valorización. Adjunta una memoria descriptiva o parámetros y lo proceso con mis skills."}
                  {agentId === "pm" && "Consúltame sobre cronograma, ruta crítica, riesgos o restricciones. Adjunta tu plan y modelo escenarios de recuperación."}
                  {agentId === "gg" && "Plantéame una decisión y te doy síntesis ejecutiva: diagnóstico, decisión y siguiente acción."}
                  {agentId === "ie" && "Soy un agente futuro. Cuando el GG apruebe mi alcance normativo, revisaré criterios de diseño eléctrico (CNE, IEC, IEEE)."}
                </p>
                <div style={{display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center", marginTop:14}}>
                  {(agentId === "ic"
                    ? ["Presupuesto de tendido de cable 138kV","Analiza esta desviación de costo","¿Qué contingencia recomiendas?"]
                    : agentId === "pm"
                    ? ["Riesgo de retraso en PRY-001","¿Cómo recupero 12 días?","Restricciones de la ruta crítica"]
                    : agentId === "gg"
                    ? ["Resume el estado del portafolio","¿Apruebo el adicional de Tintaya?"]
                    : ["¿Qué norma aplica a esta SET?"]
                  ).map((s) => (
                    <button key={s} className="btn btn--ghost btn--sm" onClick={() => setInput(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {thread.map((m, i) => <MessageBubble key={i} msg={m} agentId={agentId} />)}
            {busy && <TypingDots agentId={agentId} />}
          </div>

          {/* model recommendation */}
          {input.length > 15 && typeof ModelRecommendBanner !== 'undefined' && (
            <div style={{padding:"6px 10px", borderTop:"1px solid var(--border)", flexShrink:0}}>
              <ModelRecommendBanner text={input} agentId={agentId} />
            </div>
          )}

          {/* pending files */}
          {pendingFiles.length > 0 && (
            <div style={{flexShrink:0, padding:"8px 12px", borderTop:"1px solid var(--border)", display:"flex", gap:6, flexWrap:"wrap", background:"var(--bg-subtle)"}}>
              {pendingFiles.map((f) => (
                <span key={f.id} className="badge badge--blue" style={{gap:5}}>
                  <Icons.folder width="11" height="11" /> {f.name}
                  <button onClick={() => setPendingFiles(p => p.filter(x => x.id !== f.id))} style={{display:"flex", marginLeft:2}}>
                    <Icons.x width="10" height="10" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* composer */}
          <div style={{flexShrink:0, padding:10, borderTop:"1px solid var(--border)", display:"flex", gap:8, alignItems:"flex-end"}}>
            <input ref={fileRef} type="file" multiple style={{display:"none"}}
              onChange={(e) => { handleFiles(e.target.files); e.target.value=""; }} />
            <button className="btn btn--ghost" style={{padding:"8px 10px"}} onClick={() => fileRef.current?.click()} title="Adjuntar archivos">
              <Icons.folder width="15" height="15" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Escribe a ${persona.name}… (Enter para enviar, Shift+Enter salto de línea)`}
              rows={1}
              style={{
                flex:1, resize:"none", border:"1px solid var(--border)", borderRadius:"var(--r)",
                padding:"9px 11px", fontSize:12.5, fontFamily:"var(--font)", color:"var(--t1)",
                maxHeight:120, lineHeight:1.5, outline:"none",
              }}
            />
            <button className="btn btn--primary" style={{padding:"9px 14px"}} onClick={send} disabled={busy}>
              <Icons.arrowRight width="15" height="15" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { ChatView, readFileAsText });
