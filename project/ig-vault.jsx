// ig-vault.jsx — Obsidian-style vault UI + Archivist chat panel
// Three-pane: folder tree | note viewer | archivist chat
// ============================================================================

// ─── Storage health bar ──────────────────────────────────────────────────────
function StorageHealthBar() {
  const [, force] = React.useReducer(x=>x+1, 0);
  React.useEffect(() => {
    const t = setInterval(force, 5000); return () => clearInterval(t);
  }, []);
  const pct   = typeof getStoragePercent !== 'undefined' ? getStoragePercent() : 0;
  const sizeKB = typeof getStorageSizeKB !== 'undefined' ? getStorageSizeKB() : 0;
  const color = pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--amber)' : 'var(--green)';
  return (
    <div title={`Memoria local: ${sizeKB} KB usados (${pct}%)`}
      style={{display:'flex', alignItems:'center', gap:6, padding:'5px 10px',
        border:'1px solid var(--border)', borderRadius:'var(--r)', background:'var(--bg-card)'}}>
      <div style={{width:60, height:5, background:'var(--bg-subtle)', borderRadius:999, overflow:'hidden'}}>
        <div style={{width:`${pct}%`, height:'100%', background:color, borderRadius:999, transition:'width .4s'}}/>
      </div>
      <span style={{fontSize:10, fontFamily:'var(--mono)', color: pct>70?color:'var(--t3)'}}>
        {sizeKB} KB
      </span>
    </div>
  );
}

// ─── Pending export chip ──────────────────────────────────────────────────────
function PendingExportChip() {
  const [, force] = React.useReducer(x=>x+1, 0);
  IGStore.subscribe(force);
  const pending = typeof ExportManager !== 'undefined' ? ExportManager.getPending().length : 0;
  if (pending === 0) return (
    <div style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',
      border:'1px solid var(--green-border)',borderRadius:'var(--r)',background:'var(--green-bg)'}}>
      <Icons.check width="12" height="12" style={{color:'var(--green)'}}/>
      <span style={{fontSize:11, fontWeight:600, color:'var(--green-text)'}}>Sincronizado</span>
    </div>
  );
  return (
    <button className="btn btn--warning" onClick={()=>{ ExportManager.exportIncremental(); force(); }}>
      <Icons.arrowRight width="13" height="13"/>
      Exportar {pending} pendiente{pending!==1?'s':''} → Obsidian
    </button>
  );
}

// ─── Folder tree ─────────────────────────────────────────────────────────────
function FolderIcon({ open }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      {open
        ? <path d="M1.5 5h13v8a1 1 0 01-1 1h-11a1 1 0 01-1-1V5zM1.5 5l2-2.5h4.5L9.5 5"/>
        : <path d="M1.5 4.5h4l1.5 2h7a1 1 0 011 1V13a1 1 0 01-1 1h-12a1 1 0 01-1-1V5.5a1 1 0 011-1z"/>}
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
      <path d="M3.5 1.5h6l3 3v9.5a1 1 0 01-1 1h-8a1 1 0 01-1-1V2.5a1 1 0 011-1z"/>
      <polyline points="9.5,1.5 9.5,4.5 12.5,4.5"/>
    </svg>
  );
}

function TreeNode({ node, depth=0, selectedPath, onSelect }) {
  const [open, setOpen] = React.useState(depth < 2);
  const hasChildren = Object.keys(node.children||{}).length > 0;
  const isFile = !!node.note;
  const isSelected = node.note && node.note.path === selectedPath;

  if (!node.name) {
    // root
    return (
      <div>
        {Object.values(node.children).map(child => (
          <TreeNode key={child.name} node={child} depth={depth} selectedPath={selectedPath} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => {
          if (isFile) onSelect(node.note);
          else setOpen(o=>!o);
        }}
        style={{
          display:"flex", alignItems:"center", gap:5,
          padding:"3px 6px 3px " + (depth*14+6) + "px",
          borderRadius:"var(--r-sm)", cursor:"pointer",
          background: isSelected ? "var(--blue-bg)" : "transparent",
          color: isSelected ? "var(--blue-text)" : "var(--t2)",
          fontSize:11.5,
          transition:"background .1s",
        }}
        onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background="var(--bg-subtle)"; }}
        onMouseLeave={e=>{ if(!isSelected) e.currentTarget.style.background="transparent"; }}
      >
        <span style={{color:"var(--t3)", flexShrink:0}}>
          {isFile ? <FileIcon /> : <FolderIcon open={open} />}
        </span>
        <span style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1}}>
          {node.name.replace(".md","")}
        </span>
        {node.note?.tags?.length > 0 && !isFile && (
          <span style={{fontSize:9, color:"var(--t4)"}}>{Object.keys(node.children).length}</span>
        )}
      </div>
      {!isFile && open && (
        <div>
          {Object.values(node.children).map(child => (
            <TreeNode key={child.name} node={child} depth={depth+1} selectedPath={selectedPath} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Markdown renderer (simple) ───────────────────────────────────────────────
function MarkdownView({ body }) {
  const lines = (body||"").split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("# "))      { elements.push(<h1 key={i} style={{fontSize:17, fontWeight:700, color:"var(--t1)", marginBottom:6, marginTop:i>0?16:0, borderBottom:"1px solid var(--border)", paddingBottom:6}}>{line.slice(2)}</h1>); }
    else if (line.startsWith("## ")) { elements.push(<h2 key={i} style={{fontSize:14, fontWeight:600, color:"var(--t1)", marginTop:14, marginBottom:4}}>{line.slice(3)}</h2>); }
    else if (line.startsWith("### ")){ elements.push(<h3 key={i} style={{fontSize:12.5, fontWeight:600, color:"var(--t1)", marginTop:10, marginBottom:3}}>{line.slice(4)}</h3>); }
    else if (line.startsWith("---")) { elements.push(<hr key={i} style={{border:"none", borderTop:"1px solid var(--border)", margin:"10px 0"}}/>); }
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} style={{display:"flex", gap:6, padding:"1px 0"}}>
          <span style={{color:"var(--t3)", flexShrink:0, marginTop:1}}>·</span>
          <span style={{fontSize:12, color:"var(--t2)", lineHeight:1.6}}
            dangerouslySetInnerHTML={{__html: line.slice(2).replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/`(.*?)`/g, `<code style="background:var(--bg-subtle);padding:1px 4px;border-radius:3px;font-family:var(--mono);font-size:11px">$1</code>`)}}
          />
        </div>
      );
    }
    else if (line.trim() === "") { elements.push(<div key={i} style={{height:6}}/>); }
    else {
      elements.push(
        <p key={i} style={{fontSize:12, color:"var(--t2)", lineHeight:1.65, marginBottom:2}}
          dangerouslySetInnerHTML={{__html: line.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/`(.*?)`/g, `<code style="background:var(--bg-subtle);padding:1px 4px;border-radius:3px;font-family:var(--mono);font-size:11px">$1</code>`)}}
        />
      );
    }
    i++;
  }
  return <div>{elements}</div>;
}

// ─── Note editor ──────────────────────────────────────────────────────────────
function NoteEditor({ note, onSave, onDelete }) {
  const [editing, setEditing] = React.useState(false);
  const [body, setBody] = React.useState(note.body);

  React.useEffect(() => { setBody(note.body); setEditing(false); }, [note.path]);

  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", minHeight:0}}>
      {/* Note header */}
      <div style={{padding:"10px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexShrink:0}}>
        <div>
          <div style={{fontSize:11, color:"var(--t3)", fontFamily:"var(--mono)", marginBottom:2}}>{note.path}</div>
          <div style={{fontSize:14, fontWeight:600, color:"var(--t1)"}}>{note.title}</div>
          <div style={{display:"flex", gap:4, marginTop:4, flexWrap:"wrap"}}>
            {(note.tags||[]).map(tag => (
              <span key={tag} className="badge badge--slate">{tag}</span>
            ))}
            {note.auto && <span className="badge badge--mock">Auto-archivado</span>}
          </div>
        </div>
        <div style={{display:"flex", gap:5, flexShrink:0}}>
          {editing ? (
            <>
              <button className="btn btn--primary btn--sm" onClick={() => { onSave(note.path, {body}); setEditing(false); }}>
                <Icons.check width="12" height="12"/> Guardar
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => { setBody(note.body); setEditing(false); }}>Cancelar</button>
            </>
          ) : (
            <>
              <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>Editar</button>
              {!note.auto && <button className="btn btn--ghost btn--sm" onClick={() => onDelete(note.path)}>
                <Icons.x width="12" height="12"/>
              </button>}
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{flex:1, overflowY:"auto", padding:"14px 16px"}}>
        {editing ? (
          <textarea
            value={body}
            onChange={e=>setBody(e.target.value)}
            style={{
              width:"100%", height:"100%", minHeight:320,
              border:"1px solid var(--border)", borderRadius:"var(--r)",
              padding:"10px 12px", fontSize:12, fontFamily:"var(--mono)",
              color:"var(--t1)", background:"var(--bg-card)",
              resize:"vertical", lineHeight:1.65, outline:"none",
            }}
          />
        ) : (
          <MarkdownView body={body} />
        )}
      </div>

      <div style={{padding:"6px 14px", borderTop:"1px solid var(--border)", fontSize:10, color:"var(--t3)", display:"flex", justifyContent:"space-between"}}>
        <span>{body.split("\n").length} líneas · {body.length} chars</span>
        <span>Actualizado {new Date(note.ts).toLocaleString("es-PE",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
      </div>
    </div>
  );
}

// ─── Archivist chat ───────────────────────────────────────────────────────────
function ArchivistPanel() {
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages(m => [...m, {role:"user", content:text}]);
    setBusy(true);
    const res = await askArchivist(text);
    setMessages(m => [...m, {role:"assistant", content:res.text}]);
    setBusy(false);
  }

  return (
    <div style={{width:240, borderLeft:"1px solid var(--border)", display:"flex", flexDirection:"column", background:"var(--bg-muted)", flexShrink:0}}>
      <div style={{padding:"8px 10px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:7}}>
        <div className="agent-avatar" style={{width:24, height:24, fontSize:9, background:"#4338ca", color:"#fff"}}>AA</div>
        <div>
          <div style={{fontSize:11.5, fontWeight:600, color:"var(--t1)"}}>Agente Archivista</div>
          <div style={{fontSize:9.5, color:"var(--t3)"}}>Búsqueda y síntesis</div>
        </div>
      </div>

      <div ref={scrollRef} style={{flex:1, overflowY:"auto", padding:8, display:"flex", flexDirection:"column", gap:8}}>
        {messages.length === 0 && (
          <div style={{padding:"16px 4px", textAlign:"center", color:"var(--t3)"}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:6}}>Hola, soy el AA</div>
            <p style={{fontSize:11, lineHeight:1.5}}>Pregúntame dónde está algo, pídeme un resumen de un proyecto o un agente.</p>
            <div style={{display:"flex", flexDirection:"column", gap:4, marginTop:10}}>
              {["¿Dónde están las decisiones de hoy?","Resume el portafolio de proyectos","¿Qué skills tiene el IC?"].map(s=>(
                <button key={s} className="btn btn--ghost btn--sm" style={{fontSize:10, textAlign:"left", justifyContent:"flex-start"}} onClick={()=>setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m,i) => (
          <div key={i} style={{
            padding:"7px 9px", borderRadius:"var(--r)",
            background: m.role==="user" ? "var(--blue)" : "var(--bg-card)",
            color: m.role==="user" ? "#fff" : "var(--t1)",
            border: m.role==="user" ? "none" : "1px solid var(--border)",
            fontSize:11.5, lineHeight:1.5, whiteSpace:"pre-wrap",
            alignSelf: m.role==="user" ? "flex-end" : "flex-start",
            maxWidth:"90%",
          }}>{m.content}</div>
        ))}
        {busy && <div style={{display:"flex", gap:4, padding:"4px 0"}}>
          {[0,1,2].map(i=>(
            <span key={i} style={{width:5, height:5, borderRadius:"50%", background:"var(--t3)", animation:`igblink 1.2s ${i*0.2}s infinite`}}/>
          ))}
        </div>}
      </div>

      <div style={{padding:8, borderTop:"1px solid var(--border)", display:"flex", gap:5}}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter")send();}}
          placeholder="Pregunta al AA…"
          style={{flex:1, border:"1px solid var(--border)", borderRadius:"var(--r)", padding:"6px 8px", fontSize:11.5, fontFamily:"var(--font)", outline:"none"}}
        />
        <button className="btn btn--primary" style={{padding:"6px 10px"}} onClick={send} disabled={busy}>
          <Icons.arrowRight width="13" height="13"/>
        </button>
      </div>
    </div>
  );
}

// ─── New note form ─────────────────────────────────────────────────────────────
function NewNoteForm({ onClose, onCreate }) {
  const [path, setPath] = React.useState("/Notas/nueva-nota.md");
  const [title, setTitle] = React.useState("Nueva nota");
  const [body, setBody] = React.useState("# Nueva nota\n\n");
  const [tags, setTags] = React.useState("");

  function submit() {
    if (!path.trim()) return;
    const note = Vault.upsertNote(path.trim(), {
      title, body, tags: tags.split(",").map(t=>t.trim()).filter(Boolean), auto:false,
    });
    rebuildMOC();
    onCreate(note);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Nueva nota en la bóveda</span>
          <button className="btn btn--ghost btn--sm" onClick={onClose}><Icons.x width="13" height="13"/></button>
        </div>
        <div className="modal-body">
          <div className="field"><label className="field-label">Ruta (path)</label>
            <input className="input" value={path} onChange={e=>setPath(e.target.value)} placeholder="/Carpeta/Subcarpeta/Nombre.md"/></div>
          <div className="field"><label className="field-label">Título</label>
            <input className="input" value={title} onChange={e=>setTitle(e.target.value)}/></div>
          <div className="field"><label className="field-label">Contenido (Markdown)</label>
            <textarea className="textarea" style={{minHeight:120, fontFamily:"var(--mono)", fontSize:11}} value={body} onChange={e=>setBody(e.target.value)}/></div>
          <div className="field"><label className="field-label">Tags (separados por coma)</label>
            <input className="input" value={tags} onChange={e=>setTags(e.target.value)} placeholder="proyecto, decisión, gg"/></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={submit}>Crear nota</button>
        </div>
      </div>
    </div>
  );
}

// ─── Export vault as ZIP (simulated — generates downloadable .md files) ───────
function exportVaultAsZip() {
  const notes = Vault.allNotes();
  const lines = ["# BÓVEDA — OFICINA TÉCNICA\n# Exportado: " + new Date().toLocaleString("es-PE") + "\n"];
  notes.forEach(n => {
    lines.push(`\n${"=".repeat(60)}\n# ARCHIVO: ${n.path}\n${"=".repeat(60)}\n\n${n.body}\n`);
  });
  const blob = new Blob([lines.join("\n")], { type:"text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "boveda-oficina-tecnica.txt"; a.click();
  URL.revokeObjectURL(url);
}

// ─── VaultView (main) ─────────────────────────────────────────────────────────
function VaultView() {
  const [, force] = React.useReducer(x=>x+1, 0);
  const [selectedNote, setSelectedNote] = React.useState(null);
  const [showNewForm, setShowNewForm] = React.useState(false);
  const [search, setSearch] = React.useState("");

  IGStore.subscribe(force);
  const tree  = Vault.buildTree();
  const notes = Vault.allNotes();
  const totalNotes = notes.length;

  // Auto-select MOC on first render
  React.useEffect(() => {
    const moc = Vault.getNote("/MOC.md");
    if (moc) setSelectedNote(moc);
  }, []);

  const filteredNotes = search.trim()
    ? notes.filter(n => (n.title+n.body+n.tags.join(" ")).toLowerCase().includes(search.toLowerCase()))
    : null;

  function handleSave(path, patch) {
    Vault.upsertNote(path, patch);
    setSelectedNote(Vault.getNote(path));
    rebuildMOC();
    force();
  }

  function handleDelete(path) {
    if (!confirm("¿Eliminar esta nota?")) return;
    Vault.deleteNote(path);
    setSelectedNote(null);
    rebuildMOC();
    force();
  }

  return (
    <>
      <AIPageHeader
        eyebrow="Bóveda Obsidian"
        title="Memoria organizacional de la Oficina Técnica"
        description="Todas las conversaciones, decisiones, skills y conocimiento validado se archivan aquí automáticamente. El Agente Archivista (AA) organiza y responde consultas."
        actions={
          <div style={{display:"flex", gap:6}}>
            <StorageHealthBar />
            <PendingExportChip onNavigate={()=>{}} />
            <button className="btn btn--ghost" onClick={exportVaultAsZip}>
              <Icons.arrowRight width="13" height="13"/> Exportar todo
            </button>
            <button className="btn btn--primary" onClick={()=>setShowNewForm(true)}>
              <Icons.memory width="13" height="13"/> Nueva nota
            </button>
          </div>
        }
      />

      <div style={{display:"flex", gap:0, border:"1px solid var(--border)", borderRadius:"var(--r-lg)", overflow:"hidden", height:"calc(100dvh - 200px)", minHeight:480, background:"var(--bg-card)"}}>

        {/* Folder tree */}
        <div style={{width:200, flexShrink:0, borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", background:"var(--bg-muted)"}}>
          <div style={{padding:"8px", borderBottom:"1px solid var(--border)"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Buscar notas…"
              style={{width:"100%", border:"1px solid var(--border)", borderRadius:"var(--r-sm)", padding:"5px 7px", fontSize:11, fontFamily:"var(--font)", outline:"none", background:"var(--bg-card)"}}
            />
          </div>
          <div style={{flex:1, overflowY:"auto", padding:"6px 4px"}}>
            {filteredNotes ? (
              filteredNotes.length === 0
                ? <div style={{fontSize:11, color:"var(--t3)", padding:"12px 8px", textAlign:"center"}}>Sin resultados</div>
                : filteredNotes.map(n => (
                  <div key={n.path} onClick={()=>{setSelectedNote(n); setSearch("");}}
                    style={{padding:"5px 8px", borderRadius:"var(--r-sm)", cursor:"pointer", fontSize:11, color:selectedNote?.path===n.path?"var(--blue-text)":"var(--t2)", background:selectedNote?.path===n.path?"var(--blue-bg)":"transparent", marginBottom:1}}>
                    <div style={{fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{n.title}</div>
                    <div style={{fontSize:9.5, color:"var(--t3)", fontFamily:"var(--mono)"}}>{n.path}</div>
                  </div>
                ))
            ) : (
              <TreeNode node={tree} selectedPath={selectedNote?.path} onSelect={n=>{setSelectedNote(n); setSearch("");}} />
            )}
          </div>
        </div>

        {/* Note viewer */}
        {selectedNote ? (
          <NoteEditor
            key={selectedNote.path}
            note={selectedNote}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        ) : (
          <div style={{flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--t3)"}}>
            <div style={{textAlign:"center"}}>
              <Icons.memory width="32" height="32" style={{margin:"0 auto 10px", color:"var(--t4)"}}/>
              <div style={{fontSize:13, fontWeight:600, color:"var(--t2)", marginBottom:4}}>Selecciona una nota</div>
              <p style={{fontSize:11}}>Haz clic en cualquier archivo del árbol para leerlo o editarlo.</p>
            </div>
          </div>
        )}

        {/* Archivist chat panel */}
        <ArchivistPanel />
      </div>

      {showNewForm && (
        <NewNoteForm onClose={()=>setShowNewForm(false)} onCreate={n=>{setSelectedNote(n); force();}} />
      )}
    </>
  );
}

Object.assign(window, { VaultView, exportVaultAsZip });
