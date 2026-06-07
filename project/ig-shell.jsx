// ig-shell.jsx — AppShell, Sidebar, Topbar, ContextPanel, PageHeader

// ─── Sidebar ────────────────────────────────────────────────────────────────

function buildSidebarGroups() {
  const s = (typeof IGStore !== "undefined") ? IGStore.get() : { knowledge:[], customProjects:[], customSkills:[], approvalDecisions:{} };
  const pendingApprovals = (window.APPROVALS||[]).filter(a => (s.approvalDecisions[a.id]||a.status)==="pending").length;
  const proposedKB = s.knowledge.filter(k => k.status==="proposed").length;
  const totalProjects = (window.PROJECTS||[]).length + s.customProjects.length;
  const totalSkills = (window.SKILLS||[]).length + s.customSkills.length;
  return [
    {
      label: "Principal",
      items: [
        { id:"dashboard", label:"Dashboard",         icon:"dashboard",  badge:null, available:true  },
        { id:"office",    label:"Oficina IA",         icon:"office",     badge:null, available:true  },
        { id:"roundtable",label:"Mesa de trabajo",    icon:"agents",     badge:null, available:true  },
        { id:"chat",      label:"Chat privado",       icon:"user",       badge:null, available:true  },
        { id:"inbox",     label:"Bandeja Gerencial",  icon:"inbox",      badge:null, available:true  },
        { id:"approvals", label:"Aprobaciones",       icon:"approvals",  badge: pendingApprovals||null, available:true  },
      ],
    },
    {
      label: "Gestión de Proyectos",
      items: [
        { id:"projects",     label:"Proyectos",         icon:"projects",     badge: totalProjects||null,  available:true  },
        { id:"operaciones",  label:"Operaciones SGP",    icon:"folder",       badge: null, available:true },
        { id:"report",       label:"Reporte ejecutivo",  icon:"layers",       badge:null, available:true  },
        { id:"costs",        label:"Costos",             icon:"costs",        badge:null, available:true  },
        { id:"engineering",  label:"Ingeniería",          icon:"engineering",  badge:null, available:true  },
      ],
    },
    {
      label: "Inteligencia Operativa",
      items: [
        { id:"agents", label:"Agentes",            icon:"agents",  badge: (window.IGAgents? IGAgents.getAll().length : null), available:true  },
        { id:"org",    label:"Organigrama",          icon:"office",  badge:null, available:true  },
        { id:"skills", label:"Skills",             icon:"skills",  badge: totalSkills||null,  available:true  },
        { id:"memory", label:"Conocimiento",       icon:"memory",  badge: proposedKB||null, available:true  },
        { id:"vault",  label:"Bóveda Obsidian",     icon:"layers",  badge: (typeof ExportManager !== 'undefined' ? ExportManager.getPending().length || null : null), available:true  },
        { id:"timeline", label:"Línea de tiempo",  icon:"clock",   badge:null, available:true  },
        { id:"models",   label:"Modelos Ollama",  icon:"layers",  badge:null, available:true  },
        { id:"files",    label:"Archivos",         icon:"folder",  badge: s.files?.length||null, available:true  },
        { id:"connections", label:"Conexiones",     icon:"link",    badge:null, available:true  },
      ],
    },
    {
      label: "Sistema",
      items: [
        { id:"settings", label:"Estado / Respaldo", icon:"settings", badge:null, available:true },
      ],
    },
  ];
}

function AISidebar({ activeRoute, onNavigate }) {
  useStore();
  const SIDEBAR_GROUPS = buildSidebarGroups();
  const [expanded, setExpanded] = React.useState({});

  // Auto-expand parent if child is active
  React.useEffect(() => {
    SIDEBAR_GROUPS.forEach(g => g.items.forEach(item => {
      if (item.children && item.children.some(c => c.id === activeRoute)) {
        setExpanded(prev => ({...prev, [item.id]: true}));
      }
    }));
  }, [activeRoute]);

  function toggleExpand(id) { setExpanded(prev => ({...prev, [id]: !prev[id]})); }

  return (
    <aside className="ig-sidebar">
      {/* Logo */}
      <div className="sb-logo">
        <div className="sb-logo-mark">IG</div>
        <div>
          <div className="sb-logo-name">IA Gerencial</div>
          <div className="sb-logo-sub">Plataforma t\u00e9cnica</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sb-nav">
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.label} className="sb-group">
            <span className="sb-group-label">{group.label}</span>
            {group.items.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded  = !!expanded[item.id];
              const childActive = hasChildren && item.children.some(c => c.id === activeRoute);
              const active = activeRoute === item.id || childActive;
              const IconComp = Icons[item.icon];
              const cls = [
                "sb-item",
                active ? "sb-item--active" : "",
                !item.available ? "sb-item--disabled" : "",
              ].filter(Boolean).join(" ");
              const inner = (
                <>
                  <span className="sb-item-left">
                    <span className="sb-icon">
                      {IconComp && <IconComp />}
                    </span>
                    <span className="sb-item-label">{item.label}</span>
                  </span>
                  {hasChildren ? (
                    <span style={{fontSize:10,color:"var(--t3)",transition:"transform .2s",transform:isExpanded?"rotate(90deg)":"rotate(0)"}}>▶</span>
                  ) : item.badge ? (
                    <span className="sb-badge">{item.badge}</span>
                  ) : !item.available ? (
                    <span className="sb-prox">Pr\u00f3x</span>
                  ) : null}
                </>
              );
              if (!item.available) {
                return <span key={item.id} className={cls} aria-disabled="true">{inner}</span>;
              }
              return (
                <React.Fragment key={item.id}>
                  <button className={cls}
                    onClick={() => hasChildren ? toggleExpand(item.id) : onNavigate(item.id)}>
                    {inner}
                  </button>
                  {hasChildren && isExpanded && (
                    <div style={{marginLeft:18,borderLeft:"1px solid var(--border)",paddingLeft:0,marginBottom:2}}>
                      {item.children.map(child => {
                        const cActive = activeRoute === child.id;
                        return (
                          <button key={child.id}
                            className={`sb-item ${cActive?"sb-item--active":""}`}
                            style={{paddingLeft:12,fontSize:11.5}}
                            onClick={() => onNavigate(child.id)}>
                            <span className="sb-item-left">
                              <span className="sb-item-label">{child.label}</span>
                            </span>
                            {child.badge && <span className="sb-badge">{child.badge}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sb-footer">
        <div className="sb-status">
          <div className="sb-status-row">
            <span className="sb-status-dot"></span>
            <span className="sb-status-label">Control GG activo</span>
          </div>
          <div className="sb-status-desc">
            Toda acción crítica requiere aprobación explícita del GG.
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Topbar ─────────────────────────────────────────────────────────────────

function AITopbar({ onNavigate, onOpenSearch }) {
  const [state] = useStore();
  const [showNotif, setShowNotif] = React.useState(false);
  const systemChips = ["Mock", "Memoria local"];
  const unread = state.notifications.filter(n => !n.read).length;

  return (
    <header className="ig-topbar">
      <div className="ig-topbar-left">
        {/* Project selector */}
        <div className="tb-project" onClick={() => onNavigate("projects")}>
          <div className="tb-project-icon">
            <Icons.folder width="12" height="12" />
          </div>
          <div>
            <div className="tb-project-name">Oficina Técnica</div>
            <div className="tb-project-sub">Portafolio de ingeniería</div>
          </div>
        </div>

        {/* System status chips */}
        <div style={{display:"flex", alignItems:"center", gap:5}}>
          {systemChips.map((c) => (
            <span key={c} className="tb-chip">{c}</span>
          ))}
          <span className="tb-chip tb-chip--ai">IA real al publicar</span>
          {typeof ModelChip !== 'undefined' && <ModelChip />}
        </div>
      </div>

      <div className="ig-topbar-right">
        {/* Ollama + Obsidian dots */}
        {typeof OllamaStatusDot !== 'undefined' && <OllamaStatusDot />}
        {typeof ObsidianStatusDot !== 'undefined' && <ObsidianStatusDot />}

        {/* Global search */}
        <button className="tb-chip" onClick={onOpenSearch}
          style={{display:"flex", alignItems:"center", gap:6, cursor:"pointer", padding:"5px 10px"}}>
          <Icons.eye width="13" height="13" />
          <span>Buscar</span>
          <span style={{fontFamily:"var(--mono)", fontSize:10, color:"var(--t3)", border:"1px solid var(--border)", borderRadius:3, padding:"0 4px"}}>⌘K</span>
        </button>

        {/* Notifications */}
        <div style={{position:"relative"}}>
          <button className="tb-alert" onClick={() => setShowNotif(s => !s)}
            style={unread===0 ? {background:"var(--bg-card)", borderColor:"var(--border)", color:"var(--t2)"} : {}}>
            <Icons.bell width="13" height="13" />
            <span>{unread > 0 ? `${unread} nueva${unread>1?"s":""}` : "Alertas"}</span>
          </button>
          {showNotif && (
            <>
              <div style={{position:"fixed", inset:0, zIndex:80}} onClick={() => setShowNotif(false)} />
              <NotificationPanel onClose={() => setShowNotif(false)} onNavigate={onNavigate} />
            </>
          )}
        </div>

        {/* GG user */}
        <div className="tb-user">
          <div className="tb-avatar">GG</div>
          <div>
            <div className="tb-user-name">Gerente General</div>
            <div className="tb-user-role">Aprobador</div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Page Header ─────────────────────────────────────────────────────────────

function AIPageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        <div className="page-eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

// ─── Context Panel ───────────────────────────────────────────────────────────

function CtxCard({ title, badge, children }) {
  return (
    <div className="ctx-card">
      <div className="ctx-title">
        <span>{title}</span>
        {badge && <span className={`badge badge--${badge.color || "slate"}`}>{badge.label}</span>}
      </div>
      <div className="ctx-body">{children}</div>
    </div>
  );
}

function CtxMetric2({ a, b }) {
  return (
    <div className="ctx-metric">
      <div className="ctx-metric-item">
        <div className="ctx-metric-label">{a.label}</div>
        <div className="ctx-metric-value">{a.value}</div>
      </div>
      <div className="ctx-metric-item">
        <div className="ctx-metric-label">{b.label}</div>
        <div className="ctx-metric-value">{b.value}</div>
      </div>
    </div>
  );
}

function CtxInfoRow({ label, value, color }) {
  return (
    <div className="info-row">
      <span className="info-row-label">{label}</span>
      <span className="info-row-value" style={color ? {color} : {}}>{value}</span>
    </div>
  );
}

function DashboardContext() {
  const pendingCount = APPROVALS.filter(a => a.status === "pending").length;
  const highRisk = PROJECTS.filter(p => p.risk === "high" || p.risk === "critical").length;
  return (
    <>
      <CtxCard title="Pulso operativo" badge={{label:"Mock", color:"mock"}}>
        <CtxMetric2
          a={{ label:"Alertas",      value:String(ALERTS.length)   }}
          b={{ label:"Aprobaciones", value:String(pendingCount)    }}
        />
        <CtxMetric2
          a={{ label:"Agentes",      value:"2 activos"             }}
          b={{ label:"En riesgo",    value:String(highRisk)        }}
        />
      </CtxCard>

      <CtxCard title="Alertas activas">
        {ALERTS.map(a => (
          <div key={a.id} className={`alert-item alert-item--${a.level}`}>
            <div className={`alert-dot alert-dot--${a.level}`}></div>
            <div>
              <div className="alert-title">{a.title}</div>
              <div className="alert-msg">{a.message}</div>
            </div>
          </div>
        ))}
      </CtxCard>

      <CtxCard title="Próximos hitos">
        {MILESTONES.map((m, i) => (
          <div key={i} style={{padding:"5px 0", borderBottom: i < MILESTONES.length-1 ? "1px solid var(--border)":"none"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8}}>
              <span style={{fontSize:12, fontWeight:600, color:"var(--t1)"}}>{m.label}</span>
              <span style={{fontSize:11, color:"var(--t3)", fontFamily:"var(--mono)"}}>{m.date}</span>
            </div>
            <div style={{fontSize:11, color:"var(--t3)", marginTop:2}}>{m.project} · {m.days}d</div>
          </div>
        ))}
      </CtxCard>
    </>
  );
}

function OfficeContext() {
  const pendingCount = APPROVALS.filter(a => a.status === "pending").length;
  return (
    <>
      <CtxCard title="Agente seleccionado">
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
          <div className="agent-avatar agent-avatar--gg">GG</div>
          <div>
            <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Gerente General</div>
            <div style={{fontSize:11, color:"var(--t3)"}}>Supervisión y aprobación</div>
          </div>
        </div>
        <p style={{fontSize:11, color:"var(--t2)", lineHeight:1.5}}>
          Autoridad central de decisión. Los agentes analizan y recomiendan; el GG aprueba toda acción crítica.
        </p>
      </CtxCard>

      <CtxCard title="Red multiagente">
        <CtxMetric2
          a={{ label:"Conexiones",  value:String(CONNECTIONS.length)                                }}
          b={{ label:"Colaboración",value:String(CONNECTIONS.filter(c=>c.kind==="collaboration").length) }}
        />
        {CONNECTIONS.map(c => (
          <div key={c.id} style={{padding:"5px 0", borderBottom:"1px solid var(--border)"}}>
            <div style={{fontSize:10, textTransform:"uppercase", letterSpacing:".08em", color:"var(--t3)", fontWeight:600, marginBottom:2}}>
              {c.kind === "supervision" ? "Supervisión" : "Colaboración"}
            </div>
            <div style={{fontSize:12, color:"var(--t2)"}}>{c.from} → {c.to}</div>
            <div style={{fontSize:11, color:"var(--t3)"}}>{c.label}</div>
          </div>
        ))}
      </CtxCard>

      <CtxCard title="Aprobaciones bloqueadas" badge={{label:String(pendingCount)+" pend.", color:"orange"}}>
        <p style={{fontSize:11, color:"var(--t2)", lineHeight:1.5}}>
          Ninguna acción crítica se ejecuta sin aprobación explícita del GG.
        </p>
      </CtxCard>
    </>
  );
}

function InboxContext() {
  const pending = APPROVALS.filter(a => a.status === "pending");
  const firstPending = pending[0];
  return (
    <>
      <CtxCard title="Decisión activa" badge={{label:"Pendiente", color:"orange"}}>
        {firstPending && (
          <div>
            <div style={{fontSize:12, fontWeight:600, color:"var(--t1)", marginBottom:4, lineHeight:1.3}}>{firstPending.title}</div>
            <div style={{fontSize:11, color:"var(--t2)", marginBottom:10, lineHeight:1.4}}>{firstPending.summary}</div>
            <div style={{display:"flex", gap:5}}>
              <button className="btn btn--success btn--sm">Aprobar</button>
              <button className="btn btn--warning btn--sm">Observar</button>
              <button className="btn btn--danger  btn--sm">Rechazar</button>
            </div>
            <div style={{fontSize:10, color:"var(--t3)", marginTop:6, textAlign:"center"}}>Solo visual · sin acción real</div>
          </div>
        )}
      </CtxCard>

      <CtxCard title="Memoria propuesta">
        <div style={{padding:"6px 0"}}>
          <div style={{fontSize:12, fontWeight:600, color:"var(--t1)", marginBottom:2}}>Criterio de cableado en terreno rocoso</div>
          <div style={{fontSize:11, color:"var(--t3)"}}>Propuesta por IC · PRY-001</div>
          <span className="badge badge--amber" style={{marginTop:6}}>Pendiente GG</span>
        </div>
      </CtxCard>

      <CtxCard title="Skill propuesta">
        <div style={{padding:"6px 0"}}>
          <div style={{fontSize:12, fontWeight:600, color:"var(--t1)", marginBottom:2}}>Gestión de Restricciones v1.1</div>
          <div style={{fontSize:11, color:"var(--t3)"}}>Propuesta por PM · PRY-002</div>
          <span className="badge badge--blue" style={{marginTop:6}}>Requiere aprobación GG</span>
        </div>
      </CtxCard>
    </>
  );
}

function ApprovalsContext() {
  const pending  = APPROVALS.filter(a => a.status === "pending").length;
  const highRisk = APPROVALS.filter(a => a.risk === "high" || a.risk === "critical").length;
  const skills   = APPROVALS.filter(a => a.category === "skill").length;
  return (
    <>
      <CtxCard title="Carga de decisiones">
        <CtxMetric2
          a={{ label:"Pendientes",  value:String(pending)    }}
          b={{ label:"Riesgo alto", value:String(highRisk)   }}
        />
        <CtxMetric2
          a={{ label:"Skills",  value:String(skills)         }}
          b={{ label:"Memoria", value:"1"                    }}
        />
      </CtxCard>

      <CtxCard title="Siguiente prioridad" badge={{label:"Crítico", color:"red"}}>
        <div style={{fontSize:12, fontWeight:600, color:"var(--t1)", lineHeight:1.3, marginBottom:6}}>
          {APPROVALS[0].title}
        </div>
        <div style={{fontSize:11, color:"var(--t2)", lineHeight:1.4}}>{APPROVALS[0].summary}</div>
      </CtxCard>

      <CtxCard title="Regla de control">
        <p style={{fontSize:11, color:"var(--t2)", lineHeight:1.5}}>
          Aprobar, observar y rechazar son acciones visuales en este prototipo. En producción, ninguna decisión crítica se ejecuta sin aprobación real del GG.
        </p>
      </CtxCard>
    </>
  );
}

function ProjectsContext() {
  const atRisk = PROJECTS.filter(p => p.status === "at-risk" || p.status === "delayed").length;
  const active = PROJECTS[0];
  return (
    <>
      <CtxCard title="Portafolio activo">
        <CtxMetric2
          a={{ label:"Proyectos", value:String(PROJECTS.length) }}
          b={{ label:"En riesgo", value:String(atRisk)          }}
        />
        <CtxMetric2
          a={{ label:"Costo total",  value:"S/ 4.83 M"  }}
          b={{ label:"Disciplinas",  value:"Eléctrica"  }}
        />
      </CtxCard>

      <CtxCard title="Foco: PRY-001">
        <div style={{fontSize:12, fontWeight:600, color:"var(--t1)", marginBottom:4}}>{active.name}</div>
        <div style={{fontSize:11, color:"var(--t2)", lineHeight:1.4, marginBottom:8}}>{active.summary}</div>
        <div className="info-row"><span className="info-row-label">Próximo hito</span><span className="info-row-value">{active.nextMilestone}</span></div>
        <div className="info-row"><span className="info-row-label">Vencimiento</span><span className="info-row-value">{active.due}</span></div>
        <div className="info-row"><span className="info-row-label">Avance</span><span className="info-row-value">{active.progress}%</span></div>
      </CtxCard>

      <CtxCard title="Agentes asignados">
        <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
          {active.agents.map(a => (
            <span key={a} className="badge badge--blue">{a}</span>
          ))}
        </div>
      </CtxCard>
    </>
  );
}

function SkillsContext() {
  const active   = SKILLS.filter(s => s.status === "active").length;
  const proposed = SKILLS.filter(s => s.status === "proposed").length;
  const observed = SKILLS.filter(s => s.status === "observed").length;
  const focused  = SKILLS[1];
  return (
    <>
      <CtxCard title="Estado del registry">
        <CtxMetric2
          a={{ label:"Activas",    value:String(active)   }}
          b={{ label:"Propuestas", value:String(proposed) }}
        />
        <CtxMetric2
          a={{ label:"Observadas", value:String(observed) }}
          b={{ label:"Req. GG",    value:String(SKILLS.filter(s=>s.approvalRequired).length) }}
        />
      </CtxCard>

      <CtxCard title="Skill en foco">
        <div style={{fontSize:12, fontWeight:600, color:"var(--t1)", marginBottom:4, lineHeight:1.3}}>{focused.name}</div>
        <div className="info-row"><span className="info-row-label">Versión</span><span className="info-row-value">{focused.version}</span></div>
        <div className="info-row"><span className="info-row-label">Riesgo</span><span className="info-row-value">{focused.risk}</span></div>
        <div className="info-row"><span className="info-row-label">Agente</span><span className="info-row-value">{focused.agent}</span></div>
        <div style={{marginTop:8}}>
          <span className={`badge badge--${focused.status==="active"?"green":focused.status==="proposed"?"blue":"amber"}`}>
            {focused.status === "active" ? "Activa" : focused.status === "proposed" ? "Propuesta" : "Observada"}
          </span>
        </div>
      </CtxCard>

      <CtxCard title="Sin autoactivación">
        <p style={{fontSize:11, color:"var(--t2)", lineHeight:1.5}}>
          Una skill propuesta no se activa hasta que el GG apruebe versión, alcance, riesgos, entradas y salida esperada.
        </p>
      </CtxCard>
    </>
  );
}

function AIContextPanel({ route }) {
  const contextMap = {
    dashboard: <DashboardContext />,
    office:    <OfficeContext    />,
    inbox:     <InboxContext     />,
    approvals: <ApprovalsContext />,
    projects:  <ProjectsContext  />,
    skills:    <SkillsContext    />,
  };
  const content = contextMap[route];
  if (!content) return null;
  return (
    <aside className="ig-ctx">
      {content}
    </aside>
  );
}

// ─── AppShell ────────────────────────────────────────────────────────────────

function AIAppShell({ activeRoute, onNavigate, onOpenSearch, children, hideCtx }) {
  const hasCtx = ["dashboard","office","inbox","approvals","projects","skills"].includes(activeRoute);
  return (
    <div className="ig-layout">
      <AITopbar onNavigate={onNavigate} onOpenSearch={onOpenSearch} />
      <div className="ig-body">
        <AISidebar activeRoute={activeRoute} onNavigate={onNavigate} />
        <main className="ig-main">
          <div style={{maxWidth: hasCtx ? 1100 : 1180}}>{children}</div>
        </main>
        {!hideCtx && hasCtx && <AIContextPanel route={activeRoute} />}
      </div>
    </div>
  );
}

Object.assign(window, {
  AISidebar, AITopbar, AIPageHeader, AIContextPanel, AIAppShell,
  CtxCard, CtxMetric2, CtxInfoRow,
});
