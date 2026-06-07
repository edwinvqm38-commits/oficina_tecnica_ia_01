// ig-connections.jsx — Ollama + Obsidian configuration panel + topbar status chips
// ============================================================================

// ─── Connection card primitive ────────────────────────────────────────────────
function ConnCard({ title, subtitle, status, statusLabel, statusColor, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div style={{fontSize:13, fontWeight:700, color:"var(--t1)"}}>{title}</div>
          <div style={{fontSize:11, color:"var(--t3)"}}>{subtitle}</div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:6}}>
          <span style={{width:8, height:8, borderRadius:"50%", background:statusColor, boxShadow:`0 0 5px ${statusColor}`, flexShrink:0}}/>
          <span style={{fontSize:11, fontWeight:600, color:"var(--t2)"}}>{statusLabel}</span>
        </div>
      </div>
      <div style={{padding:"12px 14px"}}>{children}</div>
    </div>
  );
}

// ─── Ollama configuration ─────────────────────────────────────────────────────
function OllamaConfig() {
  const [, force] = React.useReducer(x=>x+1, 0);
  IGStore.subscribe(force);
  const s        = IGStore.get();
  const status   = s.ollamaStatus || "unknown";
  const enabled  = !!s.ollamaEnabled;
  const models   = s.ollamaModels || [];
  const color    = status==="online"?"var(--green)":status==="offline"?"var(--red)":"var(--amber)";
  const statusLbl= status==="online"?`Online · ${models.length} modelos`:status==="offline"?"Sin conexión":"Verificando…";

  async function probe() { await OllamaClient.probe(); force(); }

  return (
    <ConnCard title="Ollama — Modelos locales" subtitle="http://localhost:11434"
      status={status} statusLabel={statusLbl} statusColor={color}>

      {/* Enable toggle */}
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12}}>
        <div>
          <div style={{fontSize:12, fontWeight:600, color:"var(--t1)"}}>Usar Ollama en lugar de Claude</div>
          <div style={{fontSize:11, color:"var(--t3)"}}>Cuando está online, los agentes usan tu modelo local</div>
        </div>
        <label style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer"}}>
          <span style={{fontSize:11, color:"var(--t3)"}}>{enabled?"Activado":"Desactivado"}</span>
          <div onClick={()=>{IGStore.set({ollamaEnabled:!enabled}); force();}}
            style={{
              width:36, height:20, borderRadius:999, cursor:"pointer", transition:"background .2s",
              background: enabled?"var(--blue)":"var(--border)", position:"relative",
            }}>
            <div style={{
              width:16, height:16, borderRadius:"50%", background:"#fff",
              position:"absolute", top:2, transition:"left .2s",
              left: enabled?"18px":"2px", boxShadow:"0 1px 3px rgba(0,0,0,.2)",
            }}/>
          </div>
        </label>
      </div>

      {/* Local models */}
      {models.length > 0 ? (
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:".1em", color:"var(--t3)", marginBottom:6}}>
            Modelos detectados ({models.length})
          </div>
          <div style={{display:"flex", gap:5, flexWrap:"wrap"}}>
            {models.map(m => <span key={m} className="badge badge--green">{m}</span>)}
          </div>
        </div>
      ) : (
        <div style={{padding:"8px 10px", background:"var(--bg-subtle)", borderRadius:"var(--r)", fontSize:11, color:"var(--t2)", marginBottom:12, lineHeight:1.6}}>
          Sin modelos detectados. Instala Ollama y descarga al menos un modelo:
          <div style={{fontFamily:"var(--mono)", fontSize:10, color:"var(--blue-text)", marginTop:4}}>
            ollama pull llama3.2<br/>ollama pull qwen2.5
          </div>
        </div>
      )}

      {/* Setup guide */}
      <div style={{background:"var(--bg-subtle)", borderRadius:"var(--r)", padding:"10px 12px", fontSize:11, color:"var(--t2)", lineHeight:1.7, marginBottom:12}}>
        <b style={{color:"var(--t1)"}}>Requisitos paso a paso:</b>
        <ol style={{marginLeft:16, marginTop:4, display:"flex", flexDirection:"column", gap:3}}>
          <li>Descargar e instalar desde <a href="https://ollama.ai" target="_blank" style={{color:"var(--blue-text)", fontWeight:600}}>ollama.ai</a></li>
          <li>Abrir terminal y ejecutar:
            <div style={{fontFamily:"var(--mono)", fontSize:10, background:"var(--bg-card)", padding:"4px 8px", borderRadius:4, marginTop:3, color:"var(--t1)"}}>OLLAMA_ORIGINS=* ollama serve</div>
          </li>
          <li>En otra terminal, descargar modelos:
            <div style={{fontFamily:"var(--mono)", fontSize:10, background:"var(--bg-card)", padding:"4px 8px", borderRadius:4, marginTop:3, color:"var(--t1)"}}>
              ollama pull llama3.2<br/>
              ollama pull qwen2.5<br/>
              ollama pull phi3
            </div>
          </li>
          <li>Volver aquí → activar el toggle → clic en "Verificar conexión"</li>
          <li>Los agentes usarán tu modelo local automáticamente ✓</li>
        </ol>
      </div>

      {/* Live guide */}
      <div style={{background:"var(--green-bg)", border:"1px solid var(--green-border)", borderRadius:"var(--r)", padding:"10px 12px", fontSize:11, color:"var(--green-text)", lineHeight:1.6, marginBottom:12}}>
        <b>📍 Carpeta de modelos (auto-detectada por Ollama):</b>
        <div style={{display:"flex", flexDirection:"column", gap:2, marginTop:4}}>
          <div><span style={{fontFamily:"var(--mono)", fontSize:10}}>Mac/Linux:</span> <span style={{fontFamily:"var(--mono)", fontSize:10, fontWeight:600}}>~/.ollama/models</span></div>
          <div><span style={{fontFamily:"var(--mono)", fontSize:10}}>Windows:</span> <span style={{fontFamily:"var(--mono)", fontSize:10, fontWeight:600}}>C:\Users\TU_USUARIO\.ollama\models</span></div>
        </div>
        <div style={{marginTop:6, fontSize:10}}>No necesitas configurar ninguna ruta — Ollama los detecta automáticamente al arrancar.</div>
      </div>

      <div style={{display:"flex", gap:8}}>
        <button className="btn btn--ghost" onClick={probe}>
          <Icons.sparkle width="13" height="13"/> Verificar conexión
        </button>
        {status==="online" && enabled && (
          <span className="badge badge--green badge--dot">Activo · usando Ollama</span>
        )}
      </div>
    </ConnCard>
  );
}

// ─── Obsidian configuration ───────────────────────────────────────────────────
function ObsidianConfig() {
  const [, force] = React.useReducer(x=>x+1, 0);
  IGStore.subscribe(force);
  const s        = IGStore.get();
  const status   = s.obsidianStatus || "unknown";
  const enabled  = !!s.obsidianEnabled;
  const [apiKey, setApiKey]     = React.useState(s.obsidianApiKey||"");
  const [vaultRoot, setVaultRoot] = React.useState(s.obsidianVaultRoot||"IA-Gerencial");
  const [protocol, setProtocol]   = React.useState(s.obsidianProtocol||"https");
  const [syncing, setSyncing]   = React.useState(false);
  const [pullBusy, setPullBusy] = React.useState(false);
  const color    = status==="online"?"var(--green)":status==="no-key"?"var(--amber)":status==="offline"?"var(--red)":"var(--t3)";
  const statusLbl= status==="online"?"Online · sync activo":status==="no-key"?"Falta clave API":status==="offline"?"Sin conexión":"Sin configurar";
  const lastSync = s.lastObsidianSyncTs ? new Date(s.lastObsidianSyncTs).toLocaleString("es-PE") : "Nunca";

  function saveConfig() {
    ObsidianClient.setProtocol(protocol);
    ObsidianClient.configure(apiKey, vaultRoot);
    IGStore.set({ obsidianEnabled: !!apiKey });
    ObsidianClient.probe().then(force);
  }

  async function fullSync() {
    setSyncing(true);
    const r = await syncAllToObsidian();
    setSyncing(false);
    force();
    alert(`Sync completo: ${r.pushed} notas enviadas${r.failed ? `, ${r.failed} errores` : ""}`);
  }

  async function pullSkills() {
    setPullBusy(true);
    const ids = await pullAllSkillsFromObsidian();
    setPullBusy(false);
    force();
  }

  return (
    <ConnCard title="Obsidian — Sync bidireccional" subtitle="Local REST API · https://127.0.0.1:27124"
      status={status} statusLabel={statusLbl} statusColor={color}>

      {/* Enable toggle */}
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12}}>
        <div>
          <div style={{fontSize:12, fontWeight:600, color:"var(--t1)"}}>Sincronización automática</div>
          <div style={{fontSize:11, color:"var(--t3)"}}>Cada nota nueva se envía a Obsidian en 5s</div>
        </div>
        <label style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer"}}>
          <span style={{fontSize:11, color:"var(--t3)"}}>{enabled?"Activado":"Desactivado"}</span>
          <div onClick={()=>{IGStore.set({obsidianEnabled:!enabled}); force();}}
            style={{width:36, height:20, borderRadius:999, cursor:"pointer", transition:"background .2s",
              background:enabled?"var(--blue)":"var(--border)", position:"relative"}}>
            <div style={{width:16, height:16, borderRadius:"50%", background:"#fff",
              position:"absolute", top:2, transition:"left .2s", left:enabled?"18px":"2px",
              boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
          </div>
        </label>
      </div>

      {/* API Key */}
      <div className="field" style={{marginBottom:8}}>
        <label className="field-label">API Key (del plugin Local REST API)</label>
        <div style={{display:"flex", gap:6}}>
          <input className="input" type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)}
            placeholder="Pega tu API key aquí…"/>
          <button className="btn btn--primary" onClick={saveConfig}>Guardar</button>
        </div>
      </div>

      {/* Protocol toggle */}
      <div className="field" style={{marginBottom:8}}>
        <label className="field-label">Protocolo de conexión</label>
        <div style={{display:"flex", gap:6}}>
          {[{v:"https",l:"HTTPS · 27124",h:"Requiere aceptar certificado"},{v:"http",l:"HTTP · 27123",h:"Más fácil, sin cifrado"}].map(o=>(
            <button key={o.v} type="button" onClick={()=>setProtocol(o.v)}
              style={{flex:1, padding:"7px 10px", borderRadius:"var(--r)", textAlign:"left",
                border:protocol===o.v?"1.5px solid var(--blue)":"1px solid var(--border)",
                background:protocol===o.v?"var(--blue-bg)":"var(--bg-card)", cursor:"pointer"}}>
              <div style={{fontSize:11.5, fontWeight:600, color:protocol===o.v?"var(--blue-text)":"var(--t1)"}}>{o.l}</div>
              <div style={{fontSize:10, color:"var(--t3)"}}>{o.h}</div>
            </button>
          ))}
        </div>
        <div className="field-hint">Si HTTPS falla, primero visita <span style={{fontFamily:"var(--mono)",fontSize:10}}>https://127.0.0.1:27124</span> en el navegador y acepta el certificado. O usa HTTP (activa "Non-encrypted server" en el plugin).</div>
      </div>

      {/* Vault root */}
      <div className="field" style={{marginBottom:12}}>
        <label className="field-label">Carpeta raíz en tu bóveda</label>
        <input className="input" value={vaultRoot} onChange={e=>setVaultRoot(e.target.value)}
          placeholder="IA-Gerencial"/>
        <div className="field-hint">Todas las notas se guardarán bajo esta carpeta en Obsidian</div>
      </div>

      {/* Setup guide */}
      <div style={{background:"var(--bg-subtle)", borderRadius:"var(--r)", padding:"10px 12px", fontSize:11, color:"var(--t2)", lineHeight:1.7, marginBottom:12}}>
        <b style={{color:"var(--t1)"}}>Cómo configurar:</b>
        <ol style={{marginLeft:16, marginTop:4, display:"flex", flexDirection:"column", gap:2}}>
          <li>Abrir Obsidian → Ajustes → Plugins de comunidad</li>
          <li>Buscar e instalar: <b>Local REST API</b></li>
          <li>Activarlo → copiar la API Key generada</li>
          <li>Pegar la key arriba → clic "Guardar"</li>
          <li>La carpeta <span style={{fontFamily:"var(--mono)",fontSize:10}}>{vaultRoot}/</span> se creará automáticamente</li>
        </ol>
      </div>

      {/* Status + actions */}
      <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"center"}}>
        {status==="online" && (
          <>
            <button className="btn btn--success" onClick={fullSync} disabled={syncing}>
              {syncing ? <span className="spinner"/> : <Icons.arrowRight width="13" height="13"/>}
              Sync completo ahora
            </button>
            <button className="btn btn--ghost" onClick={pullSkills} disabled={pullBusy}>
              {pullBusy ? <span className="spinner"/> : <Icons.layers width="13" height="13"/>}
              Importar skills desde Obsidian
            </button>
          </>
        )}
        <span style={{fontSize:10, color:"var(--t3)", fontFamily:"var(--mono)"}}>
          Último sync: {lastSync}
        </span>
      </div>
    </ConnCard>
  );
}

// ─── ConnectionsView ──────────────────────────────────────────────────────────
function ConnectionsView() {
  return (
    <>
      <AIPageHeader
        eyebrow="Conexiones reales"
        title="Ollama local + Obsidian sync"
        description="Conecta modelos de lenguaje locales (sin internet) y sincroniza la bóveda con Obsidian en tiempo real. Todo funciona en tu PC."
      />
      <div style={{display:"flex", flexDirection:"column", gap:12}}>
        <OllamaConfig   />
        <ObsidianConfig />
      </div>
    </>
  );
}

Object.assign(window, {
  ConnectionsView, OllamaConfig, ObsidianConfig,

  // Status dots — used in topbar
  OllamaStatusDot: function OllamaStatusDot() {
    const [, force] = React.useReducer(x=>x+1, 0);
    React.useEffect(() => { const t = setInterval(force, 3000); return ()=>clearInterval(t); }, []);
    const status  = IGStore.get().ollamaStatus || "unknown";
    const enabled = IGStore.get().ollamaEnabled;
    const color   = status==="online"?"var(--green)":status==="offline"?"var(--red)":"var(--amber)";
    const label   = status==="online"?"Ollama online":status==="offline"?"Ollama offline":"Ollama: verificando…";
    return (
      <div title={`${label}${enabled?"":" (desactivado)"}`}
        style={{display:"flex", alignItems:"center", gap:5, padding:"3px 8px",
          border:"1px solid var(--border)", borderRadius:"var(--r)",
          background:"var(--bg-card)", opacity:enabled?1:.5, cursor:"default"}}>
        <span style={{width:6, height:6, borderRadius:"50%", background:color,
          boxShadow:status==="online"?`0 0 4px ${color}`:"none"}}/>
        <span style={{fontSize:10, fontWeight:600, color:"var(--t2)"}}>Ollama</span>
      </div>
    );
  },

  ObsidianStatusDot: function ObsidianStatusDot() {
    const [, force] = React.useReducer(x=>x+1, 0);
    React.useEffect(() => { const t = setInterval(force, 3000); return ()=>clearInterval(t); }, []);
    const status  = IGStore.get().obsidianStatus || "unknown";
    const enabled = IGStore.get().obsidianEnabled;
    const color   = status==="online"?"var(--green)":status==="no-key"?"var(--amber)":"var(--red)";
    const label   = status==="online"?"Obsidian sync":status==="no-key"?"Sin clave API":"Obsidian offline";
    return (
      <div title={label}
        style={{display:"flex", alignItems:"center", gap:5, padding:"3px 8px",
          border:"1px solid var(--border)", borderRadius:"var(--r)",
          background:"var(--bg-card)", opacity:enabled?1:.45, cursor:"default"}}>
        <span style={{width:6, height:6, borderRadius:"50%", background:color,
          boxShadow:status==="online"?`0 0 4px ${color}`:"none"}}/>
        <span style={{fontSize:10, fontWeight:600, color:"var(--t2)"}}>Obsidian</span>
      </div>
    );
  },
});
