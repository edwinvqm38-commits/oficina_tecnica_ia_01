// ig-files.jsx — File browser, PDF extraction (via pdf.js), file-conversation linking.
// Each file is tied to exactly ONE conversation — no cross-contamination.
// ============================================================================

// ─── PDF extractor (uses pdf.js loaded from CDN) ─────────────────────────────
async function extractPdfText(file) {
  if (!file.name.toLowerCase().endsWith(".pdf")) return null;
  if (typeof pdfjsLib === "undefined") {
    return `(PDF: ${file.name} — pdf.js no disponible. El agente usará el nombre y los parámetros que describas en el mensaje.)`;
  }
  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const pdf   = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pages = [];
    const maxPages = Math.min(pdf.numPages, 20); // cap at 20 pages
    for (let i = 1; i <= maxPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text    = content.items.map(item => item.str).join(" ");
      pages.push(`--- Página ${i} ---\n${text}`);
    }
    if (pdf.numPages > maxPages) pages.push(`\n(${pdf.numPages - maxPages} páginas adicionales no incluidas)`);
    return pages.join("\n\n");
  } catch (e) {
    console.warn("[PDF] extraction error", e);
    return `(Error al leer ${file.name}: ${e.message}. Describe el contenido en el mensaje.)`;
  }
}

// ─── Enhanced readFileAsText (replaces ig-chat.jsx's version) ────────────────
async function readFileAsTextEnhanced(file) {
  // PDF → pdf.js extraction
  if (file.name.toLowerCase().endsWith(".pdf")) {
    const text = await extractPdfText(file);
    return text || `(PDF: ${file.name})`;
  }
  // Text-like files
  if (/\.(txt|md|csv|json|tsv|log|xml|html?|yaml|yml)$/i.test(file.name) || file.type.startsWith("text")) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload  = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve(`(Error leyendo ${file.name})`);
      reader.readAsText(file);
    });
  }
  // Images — return description
  if (file.type.startsWith("image/")) {
    return `(Imagen: ${file.name}, ${(file.size/1024).toFixed(0)} KB. Describe su contenido en el mensaje.)`;
  }
  // Other binary
  return `(Archivo: ${file.name}, ${(file.size/1024).toFixed(0)} KB, tipo: ${file.type||"desconocido"}. El agente trabajará con el nombre y los parámetros que describas.)`;
}

// Override the global readFileAsText used by chat + roundtable
window.readFileAsText = readFileAsTextEnhanced;

// ─── File registry helpers ────────────────────────────────────────────────────
function registerFileWithContext(meta, content) {
  // meta: { name, size, type, agentId, conversationId, projectId, pageCount? }
  const full = IGActions.registerFile({
    ...meta,
    excerpt: typeof content === "string" ? content.slice(0, 300) : "(binario)",
  });
  if (typeof content === "string") IGFiles.put(full.id, content);
  // Archive to vault
  if (window.Vault && meta.projectId) {
    const path = `/Proyectos/${meta.projectId}/Archivos/${meta.name}.md`;
    Vault.upsertNote(path, {
      title: meta.name,
      body:  `# ${meta.name}\n\nArchivo subido el ${new Date().toLocaleDateString("es-PE")}.\n\n**Proyecto:** ${meta.projectId}\n**Agente:** ${meta.agentId||"general"}\n**Tamaño:** ${(meta.size/1024).toFixed(1)} KB\n\n## Extracto\n\n${(typeof content === "string" ? content.slice(0,800) : "(contenido binario)")}\n`,
      tags:  ["archivo", meta.projectId, meta.agentId||"general"],
    });
  }
  return full;
}

// ─── File icon by type ────────────────────────────────────────────────────────
function FileTypeIcon({ filename, size=16 }) {
  const ext = (filename||"").split(".").pop().toLowerCase();
  const color =
    ext === "pdf" ? "#b91c1c" :
    ["csv","xlsx","xls"].includes(ext) ? "#047857" :
    ["doc","docx"].includes(ext) ? "#1a50d6" :
    ["md","txt"].includes(ext) ? "#374151" :
    ["jpg","jpeg","png","gif","webp"].includes(ext) ? "#b45309" :
    "#64748b";

  return (
    <div style={{
      width:size+10, height:size+10, borderRadius:4,
      background:color+"20", border:`1px solid ${color}40`,
      display:"flex", alignItems:"center", justifyContent:"center",
      flexShrink:0,
    }}>
      <span style={{fontSize:size*0.45, fontWeight:700, color, fontFamily:"var(--mono)", letterSpacing:"-.02em"}}>
        {ext.slice(0,3).toUpperCase()}
      </span>
    </div>
  );
}

// ─── File detail modal ────────────────────────────────────────────────────────
function FileDetailModal({ file, onClose }) {
  const content = IGFiles.get(file.id);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{maxWidth:640}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <FileTypeIcon filename={file.name} size={18}/>
            <span className="modal-title">{file.name}</span>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onClose}><Icons.x width="13" height="13"/></button>
        </div>
        <div className="modal-body">
          {/* Metadata */}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12}}>
            {[
              {label:"Tamaño",      value:`${(file.size/1024).toFixed(1)} KB`},
              {label:"Agente",      value:file.agentId?.toUpperCase()||"—"},
              {label:"Proyecto",    value:file.projectId||"—"},
              {label:"Subido",      value:new Date(file.ts).toLocaleDateString("es-PE")},
              {label:"Tipo",        value:file.type||"desconocido"},
              {label:"Páginas",     value:file.pageCount||"—"},
            ].map(r=>(
              <div key={r.label} style={{background:"var(--bg-subtle)", borderRadius:"var(--r)", padding:"6px 9px"}}>
                <div style={{fontSize:9.5, color:"var(--t3)", fontWeight:600, textTransform:"uppercase", letterSpacing:".08em", marginBottom:2}}>{r.label}</div>
                <div style={{fontSize:12, fontWeight:600, color:"var(--t1)"}}>{r.value}</div>
              </div>
            ))}
          </div>

          {/* Conversation link */}
          {file.conversationId && (
            <div style={{marginBottom:10, padding:"7px 10px", background:"var(--blue-bg)", border:"1px solid var(--blue-border)", borderRadius:"var(--r)", fontSize:11, color:"var(--blue-text)"}}>
              <Icons.link width="12" height="12" style={{display:"inline", marginRight:5}}/>
              Vinculado a conversación: <b>{file.conversationId}</b> — sin cruce con otros chats.
            </div>
          )}

          {/* Content preview */}
          {content && (
            <div>
              <div style={{fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:".1em", color:"var(--t3)", marginBottom:6}}>Contenido extraído</div>
              <pre style={{
                background:"var(--bg-subtle)", borderRadius:"var(--r)",
                padding:"10px 12px", fontSize:11, lineHeight:1.65,
                fontFamily:"var(--mono)", color:"var(--t2)",
                maxHeight:280, overflowY:"auto", whiteSpace:"pre-wrap", wordBreak:"break-word",
              }}>{content.slice(0, 3000)}{content.length > 3000 ? "\n\n…(truncado)" : ""}</pre>
            </div>
          )}
          {!content && (
            <div style={{textAlign:"center", padding:"20px", color:"var(--t3)", fontSize:12}}>
              Contenido no disponible (recarga la sesión puede haberlo liberado de memoria)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FilesView (main) ─────────────────────────────────────────────────────────
function FilesView() {
  const [state]     = useStore();
  const [selected,  setSelected]  = React.useState(null);
  const [filter,    setFilter]    = React.useState("all");  // all | agent | project
  const [searchQ,   setSearchQ]   = React.useState("");

  const files = state.files || [];

  // Group files by conversation owner (agentId)
  const byAgent = {};
  files.forEach(f => {
    const key = f.agentId || "general";
    (byAgent[key] = byAgent[key]||[]).push(f);
  });

  // Filter
  const filtered = files.filter(f => {
    const q = searchQ.toLowerCase();
    return (!q || f.name.toLowerCase().includes(q) || (f.projectId||"").includes(q) || (f.agentId||"").includes(q));
  });

  // Group by project for summary
  const projects = [...new Set(files.map(f => f.projectId).filter(Boolean))];
  const agents   = [...new Set(files.map(f => f.agentId).filter(Boolean))];

  const totalSize = files.reduce((s,f)=>s+(f.size||0),0);

  return (
    <>
      <AIPageHeader
        eyebrow="Archivos vinculados"
        title="Gestión de archivos por conversación"
        description="Cada archivo está vinculado a la conversación donde se subió — sin cruce de contexto entre chats. Los PDF se procesan con extracción de texto automática."
        actions={
          <div style={{display:"flex", gap:6}}>
            <div className="kpi" style={{padding:"5px 10px"}}>
              <span style={{fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".07em"}}>Archivos</span>
              <span style={{fontSize:15, fontWeight:700, marginLeft:6}}>{files.length}</span>
            </div>
            <div className="kpi" style={{padding:"5px 10px"}}>
              <span style={{fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".07em"}}>Total</span>
              <span style={{fontSize:13, fontWeight:700, fontFamily:"var(--mono)", marginLeft:6}}>{(totalSize/1024).toFixed(0)} KB</span>
            </div>
          </div>
        }
      />

      {/* Drive integration callout */}
      <div className="card" style={{marginBottom:12, padding:"10px 14px", display:"flex", gap:10, alignItems:"flex-start", background:"var(--blue-bg)", borderColor:"var(--blue-border)"}}>
        <Icons.folder width="18" height="18" style={{color:"var(--blue)", flexShrink:0, marginTop:1}}/>
        <div>
          <div style={{fontSize:12, fontWeight:600, color:"var(--blue-text)", marginBottom:3}}>
            En tu app local real: Google Drive como almacén
          </div>
          <div style={{fontSize:11, color:"var(--blue-text)", lineHeight:1.6}}>
            Cada archivo sube a una carpeta <span style={{fontFamily:"var(--mono)", fontSize:10}}>/IA-Gerencial/[proyecto]/[conversación]/</span> en Drive.
            El Agente Archivista organiza automáticamente y vincula cada archivo a su conversación específica.
            Los agentes leen solo los archivos de su conversación — sin cruce de información.
          </div>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12}}>
        {/* By agent */}
        <div className="card">
          <div className="card-header"><div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Por agente</div></div>
          {agents.length === 0 ? (
            <div style={{padding:"16px 14px", fontSize:12, color:"var(--t3)", textAlign:"center"}}>Sin archivos subidos aún</div>
          ) : agents.map(a => (
            <div key={a} style={{display:"flex", alignItems:"center", gap:10, padding:"8px 14px", borderBottom:"1px solid var(--border)"}}>
              <div className="agent-avatar" style={{width:26, height:26, fontSize:9, background:"var(--blue)", color:"#fff"}}>{a.toUpperCase().slice(0,2)}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12, fontWeight:600, color:"var(--t1)"}}>{AGENT_PERSONAS[a]?.name || a.toUpperCase()}</div>
                <div style={{fontSize:10, color:"var(--t3)"}}>{byAgent[a]?.length} archivo{byAgent[a]?.length!==1?"s":""}</div>
              </div>
              <div style={{fontSize:11, fontFamily:"var(--mono)", color:"var(--t3)"}}>
                {((byAgent[a]||[]).reduce((s,f)=>s+(f.size||0),0)/1024).toFixed(0)} KB
              </div>
            </div>
          ))}
        </div>

        {/* By project */}
        <div className="card">
          <div className="card-header"><div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Por proyecto</div></div>
          {projects.length === 0 ? (
            <div style={{padding:"16px 14px", fontSize:12, color:"var(--t3)", textAlign:"center"}}>Sin archivos con proyecto asignado</div>
          ) : projects.map(p => {
            const pFiles = files.filter(f=>f.projectId===p);
            return (
              <div key={p} style={{display:"flex", alignItems:"center", gap:10, padding:"8px 14px", borderBottom:"1px solid var(--border)"}}>
                <Icons.projects width="16" height="16" style={{color:"var(--t3)"}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:12, fontWeight:600, color:"var(--t1)"}}>{p}</div>
                  <div style={{fontSize:10, color:"var(--t3)"}}>{pFiles.length} archivo{pFiles.length!==1?"s":""}</div>
                </div>
                <div style={{fontSize:11, fontFamily:"var(--mono)", color:"var(--t3)"}}>
                  {(pFiles.reduce((s,f)=>s+(f.size||0),0)/1024).toFixed(0)} KB
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* File list */}
      <div className="card">
        <div className="card-header">
          <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Todos los archivos</div>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)}
            placeholder="Buscar por nombre, agente o proyecto…"
            style={{border:"1px solid var(--border)", borderRadius:"var(--r)", padding:"4px 8px", fontSize:11, outline:"none", background:"var(--bg-card)", width:200}}
          />
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Icons.folder width="36" height="36"/></div>
            <div style={{fontSize:13, fontWeight:600, color:"var(--t2)", marginBottom:4}}>Sin archivos todavía</div>
            <p style={{fontSize:12, maxWidth:340, margin:"0 auto", color:"var(--t3)"}}>
              Sube archivos (PDF, CSV, TXT, MD) desde el Chat privado o la Mesa de trabajo.
              Aparecerán aquí vinculados a su conversación.
            </p>
          </div>
        ) : filtered.map(f => (
          <div key={f.id} onClick={()=>setSelected(f)}
            style={{
              display:"flex", alignItems:"center", gap:10, padding:"9px 14px",
              borderBottom:"1px solid var(--border)", cursor:"pointer", transition:"background .1s",
            }}
            onMouseEnter={e=>e.currentTarget.style.background="var(--bg-muted)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <FileTypeIcon filename={f.name} size={14}/>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12.5, fontWeight:600, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{f.name}</div>
              <div style={{fontSize:10, color:"var(--t3)"}}>
                {f.agentId?.toUpperCase()||"—"} · {f.projectId||"sin proyecto"} · {new Date(f.ts).toLocaleDateString("es-PE")}
              </div>
            </div>
            <div style={{fontSize:11, fontFamily:"var(--mono)", color:"var(--t3)", flexShrink:0}}>
              {(f.size/1024).toFixed(1)} KB
            </div>
            {IGFiles.has(f.id) && (
              <span className="badge badge--green" style={{fontSize:9}}>texto</span>
            )}
            {!IGFiles.has(f.id) && (
              <span className="badge badge--slate" style={{fontSize:9}}>sin contenido</span>
            )}
          </div>
        ))}
      </div>

      {selected && <FileDetailModal file={selected} onClose={()=>setSelected(null)} />}
    </>
  );
}

Object.assign(window, {
  extractPdfText, readFileAsTextEnhanced, registerFileWithContext,
  FileTypeIcon, FilesView,
});
