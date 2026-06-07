// ig-roundtable.jsx — Mesa de trabajo v2: comandos /, @menciones, humanización
// ============================================================================

const RT_AVATAR = { gg:"agent-avatar--gg", ic:"agent-avatar--ic", pm:"agent-avatar--pm", ie:"agent-avatar--future" };

function rtAgentIds() {
  return (window.IGAgents ? IGAgents.getAll() : []).filter(a => a.id !== "gg").map(a => a.id);
}

const RT_KEYWORDS = {
  ic: ["costo","costos","presupuesto","precio","valoriz","adicional","desviaci","apu","metrado","contingencia","s/","soles","económic","rentab","partida","gasto","inversión"],
  pm: ["cronograma","plazo","retraso","riesgo","restricci","ruta crítica","hito","avance","recuper","planific","fecha","entrega"],
  ie: ["diseño","eléctric","norma","normativ","cálculo","cne","iec","ieee","protección","tensión","kv","subestación","cable","tendido"],
};

function rtRelevance(agentId, text) {
  const t = (text||"").toLowerCase();
  let score=0; const hits=[];
  (RT_KEYWORDS[agentId]||[]).forEach(k=>{ if(t.includes(k)){score++;hits.push(k);} });
  if(!RT_KEYWORDS[agentId] && window.IGAgents) {
    const a = IGAgents.get(agentId);
    if(a) { const words=`${a.role} ${a.description||""}`.toLowerCase().split(/[^a-záéíóú]+/).filter(w=>w.length>4);
      [...new Set(words)].forEach(w=>{if(t.includes(w)){score++;hits.push(w);}});
    }
  }
  return {score, hits};
}

function parseMentions(text) {
  const ids = window.IGAgents ? IGAgents.getAll().map(a=>a.id) : [];
  const aliases = typeof getAllAliases !== 'undefined' ? getAllAliases() : {};
  const found = (text.match(/@([a-z0-9-áéíóú]+)/gi)||[]).map(s=>s.slice(1).toLowerCase());
  return [...new Set(found.map(m => aliases[m] || (ids.includes(m)?m:null)).filter(Boolean))];
}

// ─── Help panel ──────────────────────────────────────────────────────────────
function HelpPanel({ onInsert, onClose }) {
  const cats = [...new Set(COMMANDS.map(c=>c.category))];
  return (
    <div style={{
      position:"absolute", bottom:"calc(100% + 6px)", left:0, right:0,
      background:"var(--bg-card)", border:"1px solid var(--border)",
      borderRadius:"var(--r-lg)", boxShadow:"var(--shadow-md)",
      zIndex:50, overflow:"hidden", maxHeight:360, overflowY:"auto",
    }}>
      <div style={{padding:"8px 12px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between"}}>
        <span style={{fontSize:12, fontWeight:700, color:"var(--t1)"}}>Comandos disponibles</span>
        <button onClick={onClose} style={{color:"var(--t3)"}}><Icons.x width="12" height="12"/></button>
      </div>
      {cats.map(cat=>(
        <div key={cat}>
          <div style={{padding:"5px 12px 2px", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".12em", color:"var(--t3)"}}>{cat}</div>
          {COMMANDS.filter(c=>c.category===cat).map(c=>(
            <div key={c.cmd} onClick={()=>onInsert(c.cmd+" ")}
              style={{display:"flex", alignItems:"baseline", gap:10, padding:"6px 12px", cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background="var(--bg-subtle)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span style={{fontSize:11.5, fontFamily:"var(--mono)", fontWeight:600, color:"var(--blue-text)", flexShrink:0}}>{c.cmd}</span>
              {c.alias?.length>0 && <span style={{fontSize:10, color:"var(--t3)"}}>{c.alias.join(", ")}</span>}
              <span style={{fontSize:11, color:"var(--t2)", flex:1}}>{c.desc}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{padding:"8px 12px", borderTop:"1px solid var(--border)", background:"var(--bg-subtle)", fontSize:10.5, color:"var(--t3)", lineHeight:1.6}}>
        Combina comandos con @agente — ej: <span style={{fontFamily:"var(--mono)"}}>/presupuesto @ic tendido 500m cable 138kV</span>
      </div>
    </div>
  );
}

// ─── Autocomplete overlay ─────────────────────────────────────────────────────
function AutocompletePanel({ suggestions, activeIdx, onSelect }) {
  if(!suggestions.length) return null;
  return (
    <div style={{
      position:"absolute", bottom:"calc(100% + 4px)", left:0,
      background:"var(--bg-card)", border:"1px solid var(--border)",
      borderRadius:"var(--r-lg)", boxShadow:"var(--shadow-md)", zIndex:50,
      minWidth:280, overflow:"hidden",
    }}>
      {suggestions.map((c,i)=>(
        <div key={c.cmd} onClick={()=>onSelect(c.cmd+" ")}
          style={{display:"flex", alignItems:"center", gap:10, padding:"7px 12px", cursor:"pointer",
            background:i===activeIdx?"var(--blue-bg)":"transparent"}}
          onMouseEnter={e=>e.currentTarget.style.background="var(--bg-subtle)"}
          onMouseLeave={e=>{ if(i!==activeIdx) e.currentTarget.style.background="transparent"; }}>
          <span style={{fontSize:12, fontFamily:"var(--mono)", fontWeight:700, color:"var(--blue-text)", flexShrink:0}}>{c.cmd}</span>
          <span style={{fontSize:11, color:"var(--t2)", flex:1}}>{c.desc}</span>
          <span className={`badge badge--${c.category==="social"?"green":c.category==="proyecto"?"blue":c.category==="costos"?"amber":"slate"}`} style={{fontSize:9}}>{c.category}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Mention picker ──────────────────────────────────────────────────────────
function MentionPicker({ query, onSelect }) {
  const agents = window.IGAgents ? IGAgents.getAll().filter(a=>a.id!=="gg") : [];
  const filtered = agents.filter(a => a.id.includes(query)||a.name.toLowerCase().includes(query));
  if(!filtered.length) return null;
  return (
    <div style={{
      position:"absolute", bottom:"calc(100% + 4px)", left:0,
      background:"var(--bg-card)", border:"1px solid var(--border)",
      borderRadius:"var(--r-lg)", boxShadow:"var(--shadow-md)", zIndex:50,
      minWidth:220, overflow:"hidden",
    }}>
      <div style={{padding:"4px 10px 3px", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", color:"var(--t3)"}}>Mencionar agente</div>
      {filtered.slice(0,6).map(a=>{
        const at=agentAvatarAttrs(a.id,22);
        return (
          <div key={a.id} onClick={()=>onSelect("@"+a.id+" ")}
            style={{display:"flex", alignItems:"center", gap:8, padding:"6px 10px", cursor:"pointer"}}
            onMouseEnter={e=>e.currentTarget.style.background="var(--bg-subtle)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div className={at.className} style={{...at.style, width:22, height:22, fontSize:8}}>{at.initials}</div>
            <div>
              <div style={{fontSize:12, fontWeight:600, color:"var(--t1)"}}>{a.name}</div>
              <div style={{fontSize:10, color:"var(--t3)"}}>@{a.id}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Deep link card renderer ─────────────────────────────────────────────────
function DeepLinkCard({ href, label, onNavigate }) {
  const routeIcon = {
    projects:  "projects",  costs:     "costs",     approvals: "approvals",
    skills:    "skills",    memory:    "memory",    report:    "layers",
    vault:     "memory",    inbox:     "inbox",     engineering:"engineering",
  };
  const route = href.split(":")[0];
  const IconName = routeIcon[route] || "arrowRight";
  const IconC = Icons[IconName] || Icons.arrowRight;
  return (
    <button onClick={()=>onNavigate&&onNavigate(route)}
      style={{
        display:"flex", alignItems:"center", gap:7,
        padding:"6px 10px", marginTop:6,
        background:"var(--blue-bg)", border:"1px solid var(--blue-border)",
        borderRadius:"var(--r)", cursor:"pointer", width:"fit-content",
        transition:"all .12s",
      }}
      onMouseEnter={e=>e.currentTarget.style.background="var(--blue-border)"}
      onMouseLeave={e=>e.currentTarget.style.background="var(--blue-bg)"}
    >
      <IconC width="13" height="13" style={{color:"var(--blue)"}}/>
      <span style={{fontSize:11.5, fontWeight:600, color:"var(--blue-text)"}}>{label}</span>
      <Icons.arrowRight width="11" height="11" style={{color:"var(--blue-text)", opacity:.6}}/>
    </button>
  );
}

// Parse [[→route:id|Label]] markers from text
function parseDeepLinks(text) {
  const parts = [];
  const re = /\[\[\u2192([^|\]]+)(?:\|([^\]]+))?\]\]/g;
  let last = 0; let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type:"text", content:text.slice(last, m.index) });
    parts.push({ type:"link", href:m[1].trim(), label:m[2]||m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type:"text", content:text.slice(last) });
  return parts;
}

function MessageContent({ content, onNavigate }) {
  const parts = parseDeepLinks(content);
  if (parts.every(p=>p.type==="text")) {
    return <span style={{whiteSpace:"pre-wrap"}}>{content}</span>;
  }
  return (
    <div>
      {parts.map((p,i) => p.type==="text"
        ? <span key={i} style={{whiteSpace:"pre-wrap"}}>{p.content}</span>
        : <DeepLinkCard key={i} href={p.href} label={p.label} onNavigate={onNavigate}/>
      )}
    </div>
  );
}
function RTMessage({ msg, onPrivate, onNavigate }) {
  const isUser = msg.role==="user";
  const agentId = msg.agentId;
  const ag = agentId && window.IGAgents ? IGAgents.get(agentId) : null;
  const persona = AGENT_PERSONAS[agentId];
  const at = agentAvatarAttrs(isUser?"gg":agentId, 28);
  const displayName = persona?.fullName || ag?.name || persona?.name || agentId;
  return (
    <div style={{display:"flex", gap:9, flexDirection:isUser?"row-reverse":"row", alignItems:"flex-start"}}>
      <div className={at.className} style={{...at.style, width:28, height:28, fontSize:10, flexShrink:0}}>
        {isUser?"GG":at.initials}
      </div>
      <div style={{maxWidth:"80%"}}>
        {!isUser && (
          <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:3}}>
            <span style={{fontSize:11.5, fontWeight:600, color:"var(--t1)"}}>{displayName}</span>
            {msg.reactingTo && <span style={{fontSize:10, color:"var(--t3)"}}>↳ responde a {(AGENT_PERSONAS[msg.reactingTo]?.fullName||AGENT_PERSONAS[msg.reactingTo]?.name||msg.reactingTo).split(" ").slice(-1)[0]}</span>}
            {msg.model && <span style={{fontSize:9.5, fontFamily:"var(--mono)", color:"var(--t3)"}}>{msg.model}</span>}
          </div>
        )}
        <div style={{
          padding:"8px 11px", borderRadius:10,
          background:isUser?"var(--blue)":"var(--bg-card)",
          color:isUser?"#fff":"var(--t1)",
          border:isUser?"none":"1px solid var(--border)",
          fontSize:12.5, lineHeight:1.55,
          borderTopRightRadius:isUser?3:10, borderTopLeftRadius:isUser?10:3,
        }}>
          {!isUser ? <MessageContent content={msg.content} onNavigate={onNavigate}/> : msg.content}
        </div>
        {msg.files?.length>0 && (
          <div style={{display:"flex", gap:4, flexWrap:"wrap", marginTop:5, justifyContent:isUser?"flex-end":"flex-start"}}>
            {msg.files.map(f=><span key={f.id} className="badge badge--slate" style={{gap:4}}><Icons.folder width="11" height="11"/>{f.name}</span>)}
          </div>
        )}
        <div style={{display:"flex", alignItems:"center", gap:8, marginTop:3, justifyContent:isUser?"flex-end":"flex-start"}}>
          <span style={{fontSize:10, color:"var(--t3)"}}>{new Date(msg.ts).toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}</span>
          {!isUser && <button onClick={()=>onPrivate(agentId)} style={{fontSize:10, color:"var(--blue-text)", display:"flex", alignItems:"center", gap:3}}>
            <Icons.arrowRight width="10" height="10"/> Privado
          </button>}
        </div>
      </div>
    </div>
  );
}

function HandRaiseCard({ agentId, reason }) {
  const ag = window.IGAgents ? IGAgents.get(agentId) : null;
  const at = agentAvatarAttrs(agentId, 26);
  return (
    <div style={{display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"var(--amber-bg)", border:"1px solid var(--amber-border)", borderRadius:"var(--r)"}}>
      <div className={at.className} style={{...at.style, width:26, height:26, fontSize:9}}>{at.initials}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:12, fontWeight:600, color:"var(--t1)"}}>✋ {ag?.name||agentId} quiere aportar</div>
        <div style={{fontSize:11, color:"var(--amber-text)"}}>{reason}</div>
      </div>
    </div>
  );
}

// ─── Main RoundtableView ──────────────────────────────────────────────────────
function RoundtableView({ onNavigate }) {
  const [state] = useStore();
  const [input, setInput] = React.useState("");
  const [projectId, setProjectId] = React.useState("PRY-001");
  const [pendingFiles, setPendingFiles] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [debate, setDebate] = React.useState(true);
  const [hands, setHands] = React.useState([]);
  const [showHelp, setShowHelp] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState([]);
  const [suggestIdx, setSuggestIdx] = React.useState(0);
  const [mentionQuery, setMentionQuery] = React.useState(null); // string|null
  const [, force] = React.useReducer(x=>x+1, 0);
  const scrollRef = React.useRef(null);
  const fileRef   = React.useRef(null);
  const textareaRef = React.useRef(null);

  const thread      = IGStore.get().chats["roundtable"] || [];
  const allProjects = [...(window.PROJECTS||[]), ...state.customProjects];
  const project     = allProjects.find(p=>p.id===projectId);

  React.useEffect(() => {
    if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.length, busy, hands.length]);

  function goPrivate(agentId) { window.__igChatAgent=agentId; onNavigate&&onNavigate("chat"); }

  function handleInputChange(val) {
    setInput(val);
    // Command autocomplete
    if(val.startsWith("/")) {
      const s = typeof getCommandSuggestions!=="undefined" ? getCommandSuggestions(val) : [];
      setSuggestions(s); setSuggestIdx(0);
    } else { setSuggestions([]); }
    // @mention picker
    const mentionMatch = val.match(/@([a-z0-9-]*)$/i);
    setMentionQuery(mentionMatch ? mentionMatch[1].toLowerCase() : null);
  }

  function insertText(text) {
    const cur = input;
    // Replace trailing partial command or @mention
    const cleaned = cur.replace(/\/\S*$/, "").replace(/@[a-z0-9-]*$/, "");
    const next = cleaned + text;
    setInput(next); setSuggestions([]); setMentionQuery(null);
    setTimeout(()=>textareaRef.current?.focus(), 50);
  }

  async function handleFiles(fileList) {
    const arr = Array.from(fileList);
    const metas = [];
    for(const file of arr) {
      const content = await readFileAsText(file);
      const meta = IGActions.registerFile({name:file.name, size:file.size, type:file.type, excerpt:content.slice(0,200)});
      IGFiles.put(meta.id, content);
      metas.push(meta);
    }
    setPendingFiles(prev=>[...prev,...metas]);
  }

  async function send() {
    const text = input.trim();
    if(!text && pendingFiles.length===0) return;
    if(busy) return;

    // Show help
    if(text==="/help"||text==="/menu"||text==="/comandos") {
      setInput(""); setShowHelp(true); return;
    }

    // Check for direct-text command (no AI call)
    const cmdParsed = typeof parseCommand!=="undefined" ? parseCommand(text) : null;
    if(cmdParsed?.cmd?.directText) {
      const result = typeof cmdParsed.cmd.prompt==="function" ? cmdParsed.cmd.prompt(cmdParsed.args, {projectId}) : cmdParsed.cmd.prompt;
      IGActions.appendChat("roundtable", {role:"user", content:text});
      IGActions.appendChat("roundtable", {role:"assistant", agentId:"gg", content:result});
      setInput(""); force(); return;
    }

    const files = pendingFiles;
    IGActions.appendChat("roundtable", {role:"user", content:text||"(archivos adjuntos)", files});
    setInput(""); setPendingFiles([]); setBusy(true); setHands([]); setSuggestions([]); force();

    // Detect tone for humanization
    const tone    = typeof detectTone!=="undefined" ? detectTone(text) : "neutral";
    const isSocial = tone==="social";

    // Determine responders
    const mentioned = parseMentions(text);
    // Command-specified agents override
    const cmdAgents = cmdParsed?.cmd?.agents || [];
    const allAgentIds = rtAgentIds();

    let responders;
    if(cmdAgents.length) {
      responders = cmdAgents.filter(id => id!=="gg");
      if(cmdAgents.includes("gg")) responders = [...responders]; // gg handled as synth
    } else if(mentioned.length) {
      responders = mentioned.filter(id=>id!=="gg");
    } else if(isSocial) {
      // social: only first 1-2 active agents answer briefly
      responders = allAgentIds.filter(id=>(IGAgents.get(id)||{}).status==="active").slice(0,2);
    } else {
      const scored = allAgentIds
        .map(a=>({a, ...rtRelevance(a, text)}))
        .filter(x=>x.score>0 && (IGAgents.get(x.a)||{}).status==="active")
        .sort((x,y)=>y.score-x.score);
      responders = scored.length ? scored.map(x=>x.a) : allAgentIds.filter(id=>(IGAgents.get(id)||{}).status==="active").slice(0,2);
    }

    // Hand raise
    const handCards = responders.map(a=>({
      agentId:a,
      reason: mentioned.includes(a) ? "Mencionado directamente" : isSocial ? "Saludo al equipo 👋" :
        (rtRelevance(a,text).hits.slice(0,3).join(", ")||"Puede aportar"),
    }));
    setHands(handCards); force();
    await new Promise(r=>setTimeout(r,600));

    // Build prompt — use command prompt if applicable
    const basePrompt = cmdParsed?.cmd?.prompt
      ? (typeof cmdParsed.cmd.prompt==="function" ? cmdParsed.cmd.prompt(cmdParsed.args,{projectId}) : cmdParsed.cmd.prompt)
      : (text||"Analiza los archivos adjuntos.");

    // Inject social modifier into AI calls
    const history = (IGStore.get().chats["roundtable"]||[]).map(m=>({role:m.role, content:(m.agentId?`[${m.agentId}] `:"")+m.content}));

    const collected=[];
    for(const agentId of responders) {
      // Patch: inject social memory into the system prompt
      const origBuild = window.buildSystemPrompt;
      if(tone!=="neutral" && origBuild) {
        window.buildSystemPrompt = (id, opts) => {
          const base = origBuild(id, opts);
          return injectSocialMemory(id, base + (typeof socialPromptModifier!=="undefined"?socialPromptModifier(tone):""), history);
        };
      }
      const res = await askAgent(agentId, basePrompt, {project, files, history});
      if(window.buildSystemPrompt !== origBuild) window.buildSystemPrompt = origBuild;
      IGActions.appendChat("roundtable", {role:"assistant", agentId, content:res.text, model:res.model});
      collected.push({agentId, text:res.text});
      setHands(h=>h.filter(x=>x.agentId!==agentId)); force();
    }

    // Debate (skip for social or commands)
    if(debate && !isSocial && responders.length>1) {
      const reactor = responders[0];
      const others = collected.filter(c=>c.agentId!==reactor).map(c=>`[${IGAgents.get(c.agentId)?.name||c.agentId}]: ${c.text}`).join("\n\n");
      const prompt = `Tus colegas opinaron:\n${others}\n\nReacciona en 2-3 frases: ¿coincides, matizas o ves un riesgo cruzado?`;
      const res = await askAgent(reactor, prompt, {project, history});
      IGActions.appendChat("roundtable", {role:"assistant", agentId:reactor, content:res.text, reactingTo:responders[1]});
      force();
    }

    IGActions.logTimeline({type:"approval", title:"Mesa de trabajo", detail:text.slice(0,70), result:"ok"});
    IGActions.notify({kind:"info", title:"Mesa de trabajo", body:`${responders.length} agente${responders.length!==1?"s":""} respondió${responders.length!==1?"n":""}`, route:"roundtable"});
    setBusy(false); force();
  }

  function onKeyDown(e) {
    if(suggestions.length>0) {
      if(e.key==="ArrowDown"){e.preventDefault();setSuggestIdx(i=>Math.min(i+1,suggestions.length-1)); return;}
      if(e.key==="ArrowUp"){e.preventDefault();setSuggestIdx(i=>Math.max(i-1,0)); return;}
      if(e.key==="Tab"||e.key==="Enter"&&suggestions.length>0){e.preventDefault();insertText(suggestions[suggestIdx].cmd+" "); return;}
    }
    if(mentionQuery!==null&&e.key==="Escape"){setMentionQuery(null); return;}
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}
  }

  return (
    <>
      <AIPageHeader
        eyebrow="Mesa de trabajo"
        title="Sala común multiagente"
        description="Escribe / para comandos, @agente para mencionar, o habla naturalmente. Los agentes entienden tono casual y técnico."
        actions={
          <div style={{display:"flex", gap:6, alignItems:"center"}}>
            <button className={`btn btn--sm ${debate?"btn--success":"btn--ghost"}`} onClick={()=>setDebate(d=>!d)}>
              {debate&&<Icons.check width="12" height="12"/>} Debate
            </button>
            <button className="btn btn--ghost btn--sm" onClick={()=>setShowHelp(h=>!h)}>
              <Icons.memory width="12" height="12"/> /help
            </button>
            {thread.length>0&&<button className="btn btn--ghost btn--sm" onClick={()=>{IGActions.clearChat("roundtable");force();}}>Limpiar</button>}
          </div>
        }
      />

      <div className="card" style={{display:"flex", flexDirection:"column", height:"calc(100dvh - 175px)", minHeight:440}}>
        {/* participants bar */}
        <div className="card-header" style={{flexShrink:0, gap:10}}>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <span style={{fontSize:11, color:"var(--t3)", fontWeight:600}}>En la mesa:</span>
            <div style={{display:"flex"}}>
              {["gg",...rtAgentIds()].map((a,i)=>{
                const at=agentAvatarAttrs(a,26); const ag=IGAgents.get(a);
                return <div key={a} className={at.className} title={ag?.name||a}
                  style={{...at.style,marginLeft:i===0?0:-6,border:"2px solid var(--bg-card)",opacity:(ag?.status==="future")?.6:1}}>{at.initials}</div>;
              })}
            </div>
          </div>
          <select className="select" style={{width:"auto",padding:"4px 8px",fontSize:11}} value={projectId} onChange={e=>setProjectId(e.target.value)}>
            {allProjects.map(p=><option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
          </select>
        </div>

        {/* messages */}
        <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:12,background:"var(--bg-muted)"}}>
          {thread.length===0&&hands.length===0&&(
            <div style={{margin:"auto",textAlign:"center",maxWidth:440}}>
              <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
                {rtAgentIds().slice(0,3).map((a,i)=>{const at=agentAvatarAttrs(a,40);return <div key={a} className={at.className} style={{...at.style,marginLeft:i===0?0:-8,border:"2px solid var(--bg-muted)",width:40,height:40,fontSize:13}}>{at.initials}</div>;})}
              </div>
              <div style={{fontSize:14, fontWeight:600, color:"var(--t1)", marginBottom:4}}>La mesa está lista</div>
              <p style={{fontSize:12, color:"var(--t2)", lineHeight:1.6, marginBottom:12}}>
                Escribe <span style={{fontFamily:"var(--mono)",fontSize:11}}>/</span> para comandos,{" "}
                <span style={{fontFamily:"var(--mono)",fontSize:11}}>@ana</span>, <span style={{fontFamily:"var(--mono)",fontSize:11}}>@marco</span>, <span style={{fontFamily:"var(--mono)",fontSize:11}}>@raul</span> para llamar por nombre,{" "}
                o habla naturalmente.
              </p>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center"}}>
                {["/help","/estado @gg","@ic /presupuesto cable 138kV 500m","Hola equipo, ¿cómo estamos? 😊","¿Cómo recuperamos el retraso de Tintaya?"].map(s=>(
                  <button key={s} className="btn btn--ghost btn--sm" style={{fontSize:11}} onClick={()=>setInput(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {thread.map((m,i)=><RTMessage key={i} msg={m} onPrivate={goPrivate} onNavigate={onNavigate}/>)}
          {hands.map(h=><HandRaiseCard key={h.agentId} agentId={h.agentId} reason={h.reason}/>)}
          {busy&&hands.length===0&&(
            <div style={{display:"flex",alignItems:"center",gap:8,color:"var(--t3)",fontSize:12}}>
              <span className="spinner"/> Los agentes están deliberando…
            </div>
          )}
        </div>

        {/* model recommendation */}
        {input.length>15 && typeof ModelRecommendBanner!=="undefined" && !input.startsWith("/") && (
          <div style={{padding:"4px 10px",borderTop:"1px solid var(--border)",flexShrink:0}}>
            <ModelRecommendBanner text={input} agentId="roundtable"/>
          </div>
        )}

        {/* pending files */}
        {pendingFiles.length>0&&(
          <div style={{flexShrink:0,padding:"8px 12px",borderTop:"1px solid var(--border)",display:"flex",gap:6,flexWrap:"wrap",background:"var(--bg-subtle)"}}>
            {pendingFiles.map(f=>(
              <span key={f.id} className="badge badge--blue" style={{gap:5}}>
                <Icons.folder width="11" height="11"/> {f.name}
                <button onClick={()=>setPendingFiles(p=>p.filter(x=>x.id!==f.id))}><Icons.x width="10" height="10"/></button>
              </span>
            ))}
          </div>
        )}

        {/* composer */}
        <div style={{flexShrink:0, padding:10, borderTop:"1px solid var(--border)", position:"relative"}}>
          {/* autocomplete */}
          {suggestions.length>0&&<AutocompletePanel suggestions={suggestions} activeIdx={suggestIdx} onSelect={insertText}/>}
          {/* mention picker */}
          {mentionQuery!==null&&<MentionPicker query={mentionQuery} onSelect={insertText}/>}
          {/* help panel */}
          {showHelp&&<HelpPanel onInsert={insertText} onClose={()=>setShowHelp(false)}/>}

          <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
            <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={e=>{handleFiles(e.target.files);e.target.value="";}}/>
            <button className="btn btn--ghost" style={{padding:"8px 10px"}} onClick={()=>fileRef.current?.click()} title="Adjuntar"><Icons.folder width="15" height="15"/></button>
            <div style={{flex:1, position:"relative"}}>
              <textarea ref={textareaRef} value={input}
                onChange={e=>handleInputChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={`/ comandos  ·  @agente  ·  o escribe libremente…`}
                rows={1}
                style={{width:"100%",resize:"none",border:"1px solid var(--border)",borderRadius:"var(--r)",padding:"9px 11px",fontSize:12.5,fontFamily:"var(--font)",color:"var(--t1)",maxHeight:120,lineHeight:1.5,outline:"none"}}
              />
            </div>
            <button className="btn btn--primary" style={{padding:"9px 14px"}} onClick={send} disabled={busy}><Icons.arrowRight width="15" height="15"/></button>
          </div>
          <div style={{fontSize:10,color:"var(--t3)",marginTop:4,paddingLeft:2}}>
            Escribe <b style={{fontFamily:"var(--mono)"}}>/help</b> para ver todos los comandos · <b style={{fontFamily:"var(--mono)"}}>/resumen</b>, <b style={{fontFamily:"var(--mono)"}}>/presupuesto</b>, <b style={{fontFamily:"var(--mono)"}}>/riesgo</b>… · Tab para autocompletar
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { RoundtableView });
