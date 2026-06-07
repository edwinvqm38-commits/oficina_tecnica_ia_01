// ig-app.jsx — Root application with routing, search, settings + Tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density":      "compact",
  "projectsView": "kanban",
  "showCtx":      true,
  "accentColor":  "#1a50d6",
  "darkMode":     false
}/*EDITMODE-END*/;

// ─── Settings / Backup view ──────────────────────────────────────────────────
function SettingsView() {
  const [state] = useStore();
  const [msg, setMsg] = React.useState(null);
  const importRef = React.useRef(null);

  function doImport(file) {
    importStateFile(file, (ok) => {
      setMsg(ok ? {kind:"success", text:"Estado importado correctamente."} : {kind:"danger", text:"Archivo inválido."});
      setTimeout(() => setMsg(null), 3000);
    });
  }

  const counts = [
    { label:"Decisiones de aprobación", value:Object.keys(state.approvalDecisions).length },
    { label:"Conversaciones", value:Object.keys(state.chats).length },
    { label:"Criterios de conocimiento", value:state.knowledge.length },
    { label:"Proyectos propios", value:state.customProjects.length },
    { label:"Skills propuestas", value:state.customSkills.length },
    { label:"Eventos en timeline", value:state.timeline.length },
  ];

  return (
    <>
      <AIPageHeader
        eyebrow="Sistema"
        title="Estado y respaldo"
        description="Todo tu trabajo se guarda automáticamente en este navegador. Exporta un respaldo para llevarlo a otra máquina o compartirlo."
      />

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, alignItems:"start"}}>
        <div className="card">
          <div className="card-header"><div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Datos guardados</div></div>
          <div style={{padding:"6px 0"}}>
            {counts.map((c,i) => (
              <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"8px 14px", borderBottom: i<counts.length-1?"1px solid var(--border)":"none"}}>
                <span style={{fontSize:12, color:"var(--t2)"}}>{c.label}</span>
                <span style={{fontSize:13, fontWeight:700, color:"var(--t1)", fontFamily:"var(--mono)"}}>{c.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="card">
            <div className="card-header"><div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Respaldo</div></div>
            <div className="card-body">
              <p style={{fontSize:12, color:"var(--t2)", lineHeight:1.6, marginBottom:12}}>
                Exporta todo el estado (aprobaciones, chats, conocimiento, proyectos, timeline) a un archivo <span className="mono">.json</span>. Impórtalo en cualquier momento para restaurar.
              </p>
              <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                <button className="btn btn--primary" onClick={downloadState}>
                  <Icons.arrowRight width="13" height="13" /> Exportar estado
                </button>
                <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={(e)=>{if(e.target.files[0]) doImport(e.target.files[0]); e.target.value="";}} />
                <button className="btn btn--ghost" onClick={()=>importRef.current?.click()}>
                  <Icons.folder width="13" height="13" /> Importar estado
                </button>
              </div>
              {msg && <div style={{marginTop:10, fontSize:12, fontWeight:600, color: msg.kind==="success"?"var(--green-text)":"var(--red-text)"}}>{msg.text}</div>}
            </div>
          </div>

          <div className="card" style={{borderColor:"var(--red-border)"}}>
            <div className="card-header"><div style={{fontSize:13, fontWeight:600, color:"var(--red-text)"}}>Zona de reinicio</div></div>
            <div className="card-body">
              <p style={{fontSize:12, color:"var(--t2)", lineHeight:1.6, marginBottom:12}}>
                Borra todo el estado guardado y vuelve a los datos de ejemplo. Esta acción no se puede deshacer.
              </p>
              <button className="btn btn--danger" onClick={()=>{ if(confirm("¿Borrar todo el estado guardado y reiniciar?")) { IGStore.reset(); setMsg({kind:"success", text:"Estado reiniciado."}); } }}>
                <Icons.x width="13" height="13" /> Reiniciar todo
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── App root ────────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState("dashboard");
  const [searchOpen, setSearchOpen] = React.useState(false);

  const handleNavigate = (r) => {
    const available = ["dashboard","office","roundtable","chat","inbox","approvals","projects","operaciones","costs","engineering","report","agents","org","skills","memory","vault","models","files","connections","timeline","settings"];
    if (available.includes(r)) { setRoute(r); window.scrollTo?.(0,0); }
  };
  // Expose navigate globally so deep links in chat bubbles work
  React.useEffect(() => { window.__igNavigate = handleNavigate; }, []);

  // ⌘K / Ctrl+K opens search
  React.useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(s => !s); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    document.documentElement.style.setProperty("--blue", t.accentColor || "#1a50d6");
    document.documentElement.style.setProperty("--blue-hover", shade(t.accentColor || "#1a50d6", -18));
    // dark mode
    document.body.classList.toggle("ig-dark", !!t.darkMode);
  }, [t.accentColor, t.darkMode]);

  const pageMap = {
    dashboard: <DashboardView />,
    office:    <OfficeView    />,
    roundtable:<RoundtableView onNavigate={handleNavigate} />,
    chat:      <ChatView onNavigate={handleNavigate} />,
    inbox:     <InboxLiveView />,
    approvals: <ApprovalsView />,
    projects:  <ProjectsView viewMode={t.projectsView} />,
    operaciones:<OperacionesView />,
    costs:     <CostosView      />,
    engineering:<IngenieriaView />,
    report:    <ReportView      />,
    agents:    <AgentsView    />,
    org:       <OrgChartView  />,
    skills:    <SkillsView    />,
    memory:    <MemoryView    />,
    vault:     <VaultView     />,
    models:    <ModelsView    />,
    files:     <FilesView       />,
    connections:<ConnectionsView />,
    timeline:  <TimelineView   />,
    settings:  <SettingsView  />,
  };

  return (
    <AIAppShell
      activeRoute={route}
      onNavigate={handleNavigate}
      onOpenSearch={() => setSearchOpen(true)}
      hideCtx={!t.showCtx}
    >
      {pageMap[route] || <DashboardView />}

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} onNavigate={handleNavigate} />}

      <TweaksPanel>
        <TweakSection label="Diseño" />
        <TweakRadio
          label="Densidad"
          value={t.density}
          options={["compact","normal"]}
          onChange={(v) => setTweak("density", v)}
        />
        <TweakColor
          label="Acento principal"
          value={t.accentColor}
          options={["#1a50d6","#0f766e","#7c3aed","#b45309"]}
          onChange={(v) => setTweak("accentColor", v)}
        />

        <TweakSection label="Vistas" />
        <TweakRadio
          label="Vista de proyectos"
          value={t.projectsView}
          options={["kanban","list"]}
          onChange={(v) => setTweak("projectsView", v)}
        />
        <TweakToggle
          label="Panel derecho"
          value={t.showCtx}
          onChange={(v) => setTweak("showCtx", v)}
        />
        <TweakToggle
          label="Modo oscuro"
          value={t.darkMode}
          onChange={(v) => setTweak("darkMode", v)}
        />
      </TweaksPanel>
    </AIAppShell>
  );
}

// small hex shade helper
function shade(hex, pct) {
  const h = hex.replace("#","");
  const n = parseInt(h.length===3 ? h.split("").map(c=>c+c).join("") : h, 16);
  let r = (n>>16)&255, g = (n>>8)&255, b = n&255;
  const f = pct/100;
  r = Math.round(r + (f<0? r: (255-r))*Math.abs(f)* (f<0?-1:1));
  g = Math.round(g + (f<0? g: (255-g))*Math.abs(f)* (f<0?-1:1));
  b = Math.round(b + (f<0? b: (255-b))*Math.abs(f)* (f<0?-1:1));
  r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
  return "#" + [r,g,b].map(x=>x.toString(16).padStart(2,"0")).join("");
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
