// ig-views.jsx — All 6 route views for IA Gerencial prototype

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  "active":        { label:"Activa",        color:"green"  },
  "on-track":      { label:"En curso",      color:"green"  },
  "proposed":      { label:"Propuesta",     color:"blue"   },
  "planning":      { label:"Planificación", color:"blue"   },
  "observed":      { label:"Observada",     color:"amber"  },
  "at-risk":       { label:"En riesgo",     color:"orange" },
  "delayed":       { label:"Retrasado",     color:"red"    },
  "deprecated":    { label:"Deprecada",     color:"slate"  },
  "needs-approval":{ label:"Req. aprobac.", color:"amber"  },
  "future":        { label:"Futuro",        color:"slate"  },
  "in-review":     { label:"En revisión",   color:"blue"   },
  "pending":       { label:"Pendiente",     color:"blue"   },
  "approved":      { label:"Aprobada",      color:"green"  },
  "rejected":      { label:"Rechazada",     color:"red"    },
};

const RISK_BADGE = {
  "low":      { label:"Riesgo bajo",     color:"green"  },
  "medium":   { label:"Riesgo medio",    color:"amber"  },
  "high":     { label:"Riesgo alto",     color:"orange" },
  "critical": { label:"Riesgo crítico",  color:"red"    },
};

const CATEGORY_LABEL = {
  "critical-decision": "Decisión crítica",
  "recommendation":    "Recomendación",
  "memory":            "Memoria",
  "skill":             "Skill",
};

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || { label:status, color:"slate" };
  return <span className={`badge badge--${cfg.color}`}>{cfg.label}</span>;
}

function RiskBadge({ risk }) {
  const cfg = RISK_BADGE[risk] || { label:risk, color:"slate" };
  return <span className={`badge badge--${cfg.color}`}>{cfg.label}</span>;
}

function ProgressFill({ status, progress }) {
  const cls = status === "on-track" ? "green" :
              status === "at-risk"  ? "orange" :
              status === "delayed"  ? "red"    :
              status === "planning" ? "blue"   : "slate";
  return (
    <div className="progress">
      <div className={`progress-fill progress-fill--${cls}`} style={{width:`${progress}%`}}/>
    </div>
  );
}

// ─── DASHBOARD (/dashboard) ──────────────────────────────────────────────────

function AgentCompactRow({ agent }) {
  const avatarClass = agent.id === "gg" ? "agent-avatar--gg" :
                      agent.id === "ic" ? "agent-avatar--ic" :
                      agent.id === "pm" ? "agent-avatar--pm" : "agent-avatar--future";
  const isFuture = agent.type === "agent-future";
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:12, padding:"9px 14px",
      borderBottom:"1px solid var(--border)",
      opacity: isFuture ? .55 : 1,
    }}>
      <div className={`agent-avatar ${avatarClass}`}>{agent.initials}</div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:2}}>
          <span style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>{agent.name}</span>
          <StatusBadge status={agent.status} />
          {isFuture && <span className="badge badge--slate badge--mock">Futuro</span>}
        </div>
        <div style={{fontSize:11, color:"var(--t3)"}}>{agent.role}</div>
      </div>
      {!isFuture && agent.confidence !== null && (
        <div style={{textAlign:"right", flexShrink:0}}>
          <div style={{fontSize:13, fontWeight:700, color:"var(--t1)"}}>{agent.confidence}%</div>
          <div style={{fontSize:10, color:"var(--t3)"}}>confianza</div>
        </div>
      )}
      {!isFuture && (
        <div style={{textAlign:"right", flexShrink:0}}>
          <div style={{fontSize:13, fontWeight:700, color:"var(--t1)"}}>{agent.tasks}</div>
          <div style={{fontSize:10, color:"var(--t3)"}}>tareas</div>
        </div>
      )}
    </div>
  );
}

function DashboardView() {
  const [state] = useStore();
  const pendingApprovals = APPROVALS.filter(a => (state.approvalDecisions[a.id]||a.status) === "pending").length;
  const activeAgents = AGENTS.filter(a => a.status === "active" && a.type !== "human").length;
  const allProjects = [...PROJECTS, ...state.customProjects];
  const atRiskProjects = allProjects.filter(p => p.status === "at-risk" || p.status === "delayed").length;

  return (
    <>
      <AIPageHeader
        eyebrow="Dashboard"
        title="Centro ejecutivo de control"
        description="Vista general del estado del sistema, agentes, proyectos y aprobaciones pendientes."
      />

      {/* KPI row */}
      <div className="grid-4" style={{marginBottom:14}}>
        <div className="kpi">
          <div className="kpi-label">Proyectos</div>
          <div className="kpi-value">{allProjects.length}</div>
          <div className="kpi-sub">{atRiskProjects} en riesgo</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Aprobaciones</div>
          <div className="kpi-value" style={{color:"var(--orange)"}}>{pendingApprovals}</div>
          <div className="kpi-sub">pendientes del GG</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Agentes activos</div>
          <div className="kpi-value">{activeAgents}</div>
          <div className="kpi-sub">de {AGENTS.filter(a=>a.type!=="human").length} total</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Alertas</div>
          <div className="kpi-value" style={{color:"var(--red)"}}>{ALERTS.length}</div>
          <div className="kpi-sub">{ALERTS.filter(a=>a.level==="high").length} alta prioridad</div>
        </div>
      </div>

      {/* Mini project charts */}
      <div className="card" style={{marginBottom:12, padding:"10px 14px"}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10}}>
          <span style={{fontSize:11, fontWeight:600, color:"var(--t2)"}}>Avance de proyectos</span>
          <span className="badge badge--mock">Mock</span>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10}}>
          {allProjects.map(p => {
            const color = p.status==="on-track"?"var(--green)":p.status==="at-risk"?"var(--orange)":p.status==="delayed"?"var(--red)":"var(--blue)";
            const w = 80; const h = 28; const pct = p.progress/100;
            const bars = 12;
            return (
              <div key={p.id}>
                <div style={{display:"flex", justifyContent:"space-between", marginBottom:4}}>
                  <span style={{fontSize:10, fontWeight:600, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"70%"}}>{p.id}</span>
                  <span style={{fontSize:10, fontWeight:700, color}}>{p.progress}%</span>
                </div>
                {/* SVG bar chart */}
                <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%", height:h}}>
                  {Array.from({length:bars}).map((_,i) => {
                    const filled = i < Math.round(bars*pct);
                    const bw = 4; const gap = 2;
                    const x = i*(bw+gap);
                    return <rect key={i} x={x} y={0} width={bw} height={h} rx={1}
                      fill={filled?color:"var(--bg-subtle)"} opacity={filled?1:.7}/>
                  })}
                </svg>
                <div style={{fontSize:10, color:"var(--t3)", marginTop:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{p.nextMilestone}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main grid */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 340px", gap:10, alignItems:"start"}}>
        {/* Left: Agents */}
        <div className="space-y-3">
          <div className="card">
            <div className="card-header">
              <div>
                <div style={{fontSize:10, textTransform:"uppercase", letterSpacing:".1em", fontWeight:600, color:"var(--t3)", marginBottom:1}}>Organización IA</div>
                <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Agentes y subagentes</div>
              </div>
              <span className="badge badge--mock">Mock</span>
            </div>
            {AGENTS.map(a => <AgentCompactRow key={a.id} agent={a} />)}
          </div>

          {/* Recent activity */}
          <div className="card">
            <div className="card-header">
              <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Actividad reciente</div>
            </div>
            <div style={{padding:"6px 0"}}>
              {ACTIVITY.map((act, i) => (
                <div key={act.id} style={{
                  display:"flex", alignItems:"flex-start", gap:10, padding:"7px 14px",
                  borderBottom: i < ACTIVITY.length-1 ? "1px solid var(--border)" : "none",
                }}>
                  <div className={`agent-avatar agent-avatar--${act.agent.toLowerCase()}`}
                    style={{width:24, height:24, fontSize:9}}>
                    {act.agent}
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:12, color:"var(--t1)"}}>{act.action}</div>
                  </div>
                  <div style={{fontSize:11, color:"var(--t3)", flexShrink:0, fontFamily:"var(--mono)"}}>{act.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: pie chart + timeline + system status */}
        <div className="space-y-3">

          {/* Aprobaciones pie chart */}
          <div className="card">
            <div className="card-header">
              <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Aprobaciones por estado</div>
              <span className="badge badge--orange">{pendingApprovals} pend.</span>
            </div>
            <div style={{padding:"10px 14px"}}>
              {(() => {
                const allAppr = APPROVALS;
                const groups = [
                  {label:"Pendientes", key:"pending",  color:"var(--orange)"},
                  {label:"Aprobadas",  key:"approved", color:"var(--green)"},
                  {label:"Observadas", key:"observed", color:"var(--amber)"},
                  {label:"Rechazadas", key:"rejected", color:"var(--red)"},
                ];
                const data = groups.map(g => ({
                  ...g,
                  value: allAppr.filter(a=>(state.approvalDecisions[a.id]||a.status)===g.key).length
                })).filter(g=>g.value>0);
                const total = data.reduce((s,d)=>s+d.value,0);
                return (
                  <div style={{display:"flex", alignItems:"center", gap:16}}>
                    {typeof PieChart !== 'undefined' && total>0 && <PieChart data={data} size={72}/>}
                    <div style={{flex:1, display:"flex", flexDirection:"column", gap:5}}>
                      {data.map(g=>(
                        <div key={g.key} style={{display:"flex", alignItems:"center", gap:7}}>
                          <span style={{width:8, height:8, borderRadius:2, background:g.color, flexShrink:0}}/>
                          <span style={{fontSize:11, color:"var(--t2)", flex:1}}>{g.label}</span>
                          <span style={{fontSize:12, fontWeight:700, color:"var(--t1)"}}>{g.value}</span>
                          <span style={{fontSize:10, color:"var(--t3)"}}>({Math.round((g.value/total)*100)}%)</span>
                        </div>
                      ))}
                      {data.length===0 && <span style={{fontSize:11, color:"var(--t3)"}}>Sin aprobaciones</span>}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Timeline de hitos */}
          <div className="card">
            <div className="card-header">
              <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Próximos hitos</div>
            </div>
            <div style={{padding:"8px 0"}}>
              {MILESTONES.map((m,i)=>{
                const color = m.status==="on-track"?"var(--green)":m.status==="at-risk"?"var(--orange)":"var(--red)";
                return (
                  <div key={i} style={{display:"flex", gap:10, padding:"7px 14px", borderBottom:"1px solid var(--border)"}}>
                    <div style={{display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0}}>
                      <div style={{width:10, height:10, borderRadius:"50%", background:color, marginTop:2}}/>
                      {i<MILESTONES.length-1 && <div style={{width:1, flex:1, background:"var(--border)", marginTop:3, minHeight:12}}/>}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:12, fontWeight:600, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{m.label}</div>
                      <div style={{fontSize:10, color:"var(--t3)"}}>{m.project}</div>
                    </div>
                    <div style={{flexShrink:0, textAlign:"right"}}>
                      <div style={{fontSize:11, fontFamily:"var(--mono)", color:"var(--t2)"}}>{m.date}</div>
                      <div style={{fontSize:10, fontWeight:600, color}}>{m.days}d</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System status widget */}
          <div className="card">
            <div className="card-header">
              <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Estado del sistema</div>
            </div>
            <div style={{padding:"8px 14px", display:"flex", flexDirection:"column", gap:6}}>
              {[
                {
                  label:"Ollama",
                  status: typeof IGStore !== 'undefined' ? (IGStore.get().ollamaStatus||"unknown") : "unknown",
                  enabled: typeof IGStore !== 'undefined' ? !!IGStore.get().ollamaEnabled : false,
                },
                {
                  label:"Obsidian",
                  status: typeof IGStore !== 'undefined' ? (IGStore.get().obsidianStatus||"unknown") : "unknown",
                  enabled: typeof IGStore !== 'undefined' ? !!IGStore.get().obsidianEnabled : false,
                },
                {
                  label:"Memoria local",
                  status:"online",
                  enabled:true,
                },
                {
                  label:"IA (Claude)",
                  status: typeof window.claude !== 'undefined' ? "online" : "fallback",
                  enabled:true,
                },
              ].map(s=>{
                const color = s.status==="online"?"var(--green)":s.status==="offline"?"var(--red)":s.status==="fallback"?"var(--amber)":"var(--t3)";
                const label = s.status==="online"?"Online":s.status==="offline"?"Offline":s.status==="fallback"?"Fallback":"Sin verificar";
                return (
                  <div key={s.label} style={{display:"flex", alignItems:"center", gap:8}}>
                    <span style={{width:7, height:7, borderRadius:"50%", background:color, flexShrink:0, boxShadow:s.status==="online"?`0 0 4px ${color}`:"none"}}/>
                    <span style={{fontSize:12, color:"var(--t2)", flex:1}}>{s.label}</span>
                    <span style={{fontSize:10, fontWeight:600, color, opacity:s.enabled?1:.5}}>{label}</span>
                    {!s.enabled && <span style={{fontSize:9, color:"var(--t3)"}}>inactivo</span>}
                  </div>
                );
              })}
              <div style={{marginTop:4, fontSize:10, color:"var(--t3)", display:"flex", justifyContent:"space-between"}}>
                <span>Última actividad</span>
                <span style={{fontFamily:"var(--mono)"}}>{new Date().toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}</span>
              </div>
            </div>
          </div>

          {/* Alerts compact */}
          <div className="card">
            <div className="card-header">
              <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Alertas activas</div>
            </div>
            <div style={{padding:"8px 10px", display:"flex", flexDirection:"column", gap:5}}>
              {ALERTS.map(a => (
                <div key={a.id} className={`alert-item alert-item--${a.level}`}>
                  <div className={`alert-dot alert-dot--${a.level}`}></div>
                  <div>
                    <div className="alert-title">{a.title}</div>
                    <div className="alert-msg">{a.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── OFICINA (/office) ───────────────────────────────────────────────────────

function OrgChart() {
  const activeAgents = AGENTS.filter(a => a.type === "agent");
  const futureAgents = AGENTS.filter(a => a.type === "agent-future");
  return (
    <div style={{padding:"24px 20px", background:"var(--bg-subtle)", borderRadius:"var(--r-lg)", border:"1px solid var(--border)"}}>
      {/* GG node */}
      <div style={{display:"flex", justifyContent:"center", marginBottom:20}}>
        <div className="org-gg-node">
          <div className="agent-avatar agent-avatar--gg" style={{width:40, height:40, fontSize:13}}>GG</div>
          <div className="org-gg-label">Gerente General</div>
          <div className="org-gg-sub">Supervisión · Aprobación · Decisión</div>
        </div>
      </div>

      {/* Connector lines */}
      <div style={{display:"flex", justifyContent:"center", marginBottom:4}}>
        <div style={{width:1, height:20, background:"var(--border-strong)"}}></div>
      </div>
      <div style={{display:"flex", justifyContent:"center", marginBottom:4}}>
        <div style={{width:"60%", height:1, background:"var(--border-strong)"}}></div>
      </div>

      {/* Active agents */}
      <div style={{display:"flex", justifyContent:"center", gap:20, marginBottom:16}}>
        {activeAgents.map(agent => (
          <div key={agent.id} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
            <div style={{width:1, height:16, background:"var(--border-strong)"}}></div>
            <div className={`org-agent-node ${agent.status==="needs-approval"?"org-agent-node--needs-approval":""}`}>
              <div className={`agent-avatar agent-avatar--${agent.id}`}>{agent.initials}</div>
              <div className="org-agent-name">{agent.name}</div>
              <div className="org-agent-role">{agent.role}</div>
              <StatusBadge status={agent.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Future agents label */}
      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:12}}>
        <div style={{flex:1, height:1, background:"var(--border)"}}></div>
        <span style={{fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:".1em", color:"var(--t3)"}}>Agentes futuros</span>
        <div style={{flex:1, height:1, background:"var(--border)"}}></div>
      </div>

      {/* Future agents */}
      <div style={{display:"flex", justifyContent:"center", gap:12, flexWrap:"wrap"}}>
        {futureAgents.map(agent => (
          <div key={agent.id} className="org-agent-node org-agent-node--future" style={{width:140}}>
            <div className="agent-avatar agent-avatar--future">{agent.initials}</div>
            <div className="org-agent-name">{agent.name}</div>
            <div className="org-agent-role">{agent.role}</div>
            <span className="badge badge--slate">Futuro</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OfficeView() {
  const [mode, setMode] = React.useState("structure");
  const modes = [
    {id:"structure",    label:"Estructura"},
    {id:"collaboration",label:"Colaboración"},
    {id:"approvals",    label:"Aprobaciones"},
  ];

  return (
    <>
      <AIPageHeader
        eyebrow="Oficina IA"
        title="Organigrama y red multiagente"
        description="Estructura jerárquica, colaboraciones activas y decisiones bloqueadas. Modos: Estructura, Colaboración y Aprobaciones."
        actions={
          <div style={{display:"flex", gap:6, alignItems:"center"}}>
            <div className="kpi" style={{padding:"6px 12px"}}>
              <span style={{fontSize:10, textTransform:"uppercase", letterSpacing:".08em", color:"var(--t3)"}}>Agentes</span>
              <span style={{fontSize:15, fontWeight:700, color:"var(--t1)", marginLeft:6}}>2</span>
            </div>
            <div className="kpi" style={{padding:"6px 12px"}}>
              <span style={{fontSize:10, textTransform:"uppercase", letterSpacing:".08em", color:"var(--t3)"}}>Red</span>
              <span style={{fontSize:15, fontWeight:700, color:"var(--t1)", marginLeft:6}}>{CONNECTIONS.length}</span>
            </div>
          </div>
        }
      />

      {/* Mode tabs bar */}
      <div className="card" style={{padding:"8px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10}}>
        <div className="mode-tabs">
          {modes.map(m => (
            <button key={m.id} className={`mode-tab ${mode===m.id?"mode-tab--active":""}`}
              onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <span style={{fontSize:11, color:"var(--t3)"}}>Lógica completa: Fase 4D</span>
      </div>

      {mode === "structure" && (
        <div className="space-y-3">
          <div className="card">
            <div className="card-header">
              <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Organigrama operativo</div>
              <span className="badge badge--mock">Mock</span>
            </div>
            <div style={{padding:16}}>
              <OrgChart />
            </div>
          </div>
        </div>
      )}

      {mode === "collaboration" && (
        <div className="card">
          <div className="card-header">
            <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Interacciones entre agentes</div>
            <span className="badge badge--mock">Mock</span>
          </div>
          {CONNECTIONS.map(c => (
            <div key={c.id} style={{
              display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
              borderBottom:"1px solid var(--border)",
            }}>
              <div style={{
                width:8, height:8, borderRadius:"50%", flexShrink:0,
                background: c.kind === "supervision" ? "var(--blue)" : "var(--green)",
              }}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12, fontWeight:600, color:"var(--t1)", marginBottom:2}}>
                  {c.from} → {c.to}
                </div>
                <div style={{fontSize:11, color:"var(--t3)"}}>{c.label}</div>
              </div>
              <span className={`badge badge--${c.kind==="supervision"?"blue":"green"}`}>
                {c.kind === "supervision" ? "Supervisión" : "Colaboración"}
              </span>
            </div>
          ))}
        </div>
      )}

      {mode === "approvals" && (
        <div className="card">
          <div className="card-header">
            <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Bloqueos por aprobación pendiente</div>
            <span className="badge badge--orange">{APPROVALS.filter(a=>a.status==="pending").length} pendientes</span>
          </div>
          {APPROVALS.filter(a => a.status === "pending").map(a => (
            <div key={a.id} style={{
              padding:"10px 14px", borderBottom:"1px solid var(--border)",
              borderLeft:`3px solid var(--${a.risk==="critical"?"red":a.risk==="high"?"orange":"amber"})`,
            }}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8}}>
                <div>
                  <div style={{fontSize:12, fontWeight:600, color:"var(--t1)", marginBottom:3}}>{a.title}</div>
                  <div style={{fontSize:11, color:"var(--t2)"}}>{a.summary}</div>
                </div>
                <RiskBadge risk={a.risk} />
              </div>
              <div style={{display:"flex", gap:5, marginTop:8}}>
                <button className="btn btn--success btn--sm">Aprobar</button>
                <button className="btn btn--warning btn--sm">Observar</button>
                <button className="btn btn--danger  btn--sm">Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── BANDEJA (/inbox) ────────────────────────────────────────────────────────

function FindingRow({ f }) {
  const valClass = f.type === "risk" ? "finding-value--risk" :
                   f.type === "warning" ? "finding-value--warning" :
                   f.type === "number"  ? "finding-value--number" : "";
  return (
    <div className="finding-row">
      <span className="finding-label">{f.label}</span>
      <span className={`finding-value ${valClass}`}>{f.value}</span>
    </div>
  );
}

function AgentResponseCard({ response }) {
  const [open, setOpen] = React.useState(true);
  const avatarClass = response.agentId === "ic" ? "agent-avatar--ic" : "agent-avatar--pm";
  return (
    <div className="card">
      {/* Header */}
      <div className="card-header" style={{cursor:"pointer"}} onClick={() => setOpen(o=>!o)}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <div className={`agent-avatar ${avatarClass}`}>{response.initials}</div>
          <div>
            <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>{response.agentName}</div>
            <div style={{fontSize:11, color:"var(--t3)"}}>Confianza: {response.confidence}% · {response.sources} fuente{response.sources>1?"s":""}</div>
          </div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <span className="badge badge--green">Respondido</span>
          {open ? <Icons.chevronUp /> : <Icons.chevronDown />}
        </div>
      </div>

      {open && (
        <>
          {/* Summary */}
          <div style={{padding:"10px 14px", borderBottom:"1px solid var(--border)", background:"var(--bg-muted)"}}>
            <p style={{fontSize:12, color:"var(--t2)", lineHeight:1.5}}>{response.summary}</p>
          </div>

          {/* Findings */}
          <div style={{padding:"10px 14px", borderBottom:"1px solid var(--border)"}}>
            <div style={{fontSize:10, textTransform:"uppercase", letterSpacing:".1em", fontWeight:600, color:"var(--t3)", marginBottom:6}}>Hallazgos</div>
            {response.findings.map((f,i) => <FindingRow key={i} f={f} />)}
          </div>

          {/* Recommendations */}
          <div style={{padding:"10px 14px"}}>
            <div style={{fontSize:10, textTransform:"uppercase", letterSpacing:".1em", fontWeight:600, color:"var(--t3)", marginBottom:6}}>Recomendaciones</div>
            {response.recommendations.map((r, i) => (
              <div key={i} className="rec-item">
                <div className="rec-num">{i+1}</div>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function InboxView() {
  const pendingApprovals = APPROVALS.filter(a => a.status === "pending").length;
  return (
    <>
      <AIPageHeader
        eyebrow="Bandeja Gerencial"
        title="Solicitudes, respuestas y decisiones"
        description="Flujo completo del MVP: solicitud del GG → análisis multiagente → aprobaciones y memoria pendientes."
        actions={
          <div style={{display:"flex", gap:6}}>
            {pendingApprovals > 0 && (
              <div style={{display:"flex", alignItems:"center", gap:5, padding:"4px 10px",
                background:"var(--orange-bg)", border:"1px solid var(--orange-border)",
                borderRadius:"var(--r)", fontSize:12, fontWeight:600, color:"var(--orange-text)"}}>
                <div style={{width:6, height:6, borderRadius:"50%", background:"var(--orange)"}}/>
                {pendingApprovals} pendiente{pendingApprovals>1?"s":""}
              </div>
            )}
            <span className="badge badge--blue badge--dot">
              {MVP_RESPONSES.length} respuestas
            </span>
          </div>
        }
      />

      <div className="space-y-3">
        {/* Request overview */}
        <div className="card">
          <div className="card-header">
            <div>
              <div style={{display:"flex", alignItems:"center", gap:6}}>
                <span style={{fontSize:11, fontFamily:"var(--mono)", color:"var(--t3)"}}>{MVP_REQUEST.id}</span>
                <StatusBadge status={MVP_REQUEST.status} />
                <span className="badge badge--red">Prioridad alta</span>
              </div>
              <div style={{fontSize:14, fontWeight:700, color:"var(--t1)", marginTop:4, lineHeight:1.3}}>
                {MVP_REQUEST.title}
              </div>
            </div>
            <div style={{textAlign:"right", flexShrink:0}}>
              <div style={{fontSize:10, color:"var(--t3)"}}>Asignado a</div>
              <div style={{display:"flex", gap:5, marginTop:3}}>
                {MVP_REQUEST.agents.map(a => <span key={a} className="badge badge--blue">{a}</span>)}
              </div>
            </div>
          </div>
          <div className="card-body">
            <p style={{fontSize:12, color:"var(--t2)", lineHeight:1.6}}>{MVP_REQUEST.description}</p>
          </div>
        </div>

        {/* Responses divider */}
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          <span style={{fontSize:10, textTransform:"uppercase", letterSpacing:".12em", fontWeight:600, color:"var(--t3)"}}>
            Respuestas de agentes
          </span>
          <div style={{flex:1, height:1, background:"var(--border)"}}/>
          <span style={{fontSize:11, color:"var(--t3)"}}>
            {MVP_RESPONSES.length}/{MVP_REQUEST.agents.length}
          </span>
        </div>

        {/* Agent responses */}
        {MVP_RESPONSES.map(r => <AgentResponseCard key={r.id} response={r} />)}

        {/* Flow status summary */}
        <div className="card">
          <div className="card-header">
            <div style={{fontSize:12, fontWeight:600, color:"var(--t2)"}}>Estado del flujo</div>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:0}}>
            {[
              {color:"blue",   label:"Solicitud",    value:"En revisión",     sub:MVP_REQUEST.id},
              {color:"green",  label:"Agentes",       value:`${MVP_RESPONSES.length}/${MVP_REQUEST.agents.length}`, sub:"Respuestas recibidas"},
              {color:"orange", label:"Aprobaciones",  value:`${pendingApprovals} pend.`, sub:"Requieren GG"},
              {color:"blue",   label:"Skills",        value:"1 propuesta",     sub:"Pendiente aprobación"},
            ].map((s,i) => (
              <div key={i} style={{
                padding:"10px 14px",
                borderRight: i < 3 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{fontSize:10, textTransform:"uppercase", letterSpacing:".08em", fontWeight:600, color:`var(--${s.color})`, marginBottom:2}}>{s.label}</div>
                <div style={{fontSize:14, fontWeight:700, color:"var(--t1)"}}>{s.value}</div>
                <div style={{fontSize:11, color:"var(--t3)"}}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{textAlign:"center", padding:"8px 0"}}>
          <span style={{fontSize:11, color:"var(--t3)"}}>
            Los agentes pueden analizar y recomendar, pero no ejecutan decisiones críticas sin aprobación del GG · Datos simulados · MVP mock
          </span>
        </div>
      </div>
    </>
  );
}

// ─── APROBACIONES (/approvals) ───────────────────────────────────────────────

function ApprovalRow({ approval }) {
  const status = (IGStore.get().approvalDecisions[approval.id]) || approval.status;
  const risk = RISK_BADGE[approval.risk] || {label:approval.risk, color:"slate"};
  const borderColor = approval.risk === "critical" ? "var(--red)" :
                      approval.risk === "high"     ? "var(--orange)" :
                      approval.risk === "medium"   ? "var(--amber)"  : "var(--green)";

  const handleAction = (action) => {
    IGActions.decideApproval(approval.id, action, { title: approval.title, summary: approval.summary });
    // Auto-archive decision to vault bitácora
    if (window.archiveApproval) archiveApproval(approval.id, action, { title: approval.title, summary: approval.summary });
  };

  return (
    <div className="approval-item" style={{borderLeft:`3px solid ${borderColor}`}}>
      <div className="approval-main">
        <div style={{flex:1, minWidth:0}}>
          {/* Badges row */}
          <div style={{display:"flex", gap:4, flexWrap:"wrap", marginBottom:5}}>
            <span style={{fontSize:10, fontFamily:"var(--mono)", color:"var(--t3)"}}>{approval.id}</span>
            <span className="badge badge--slate">{CATEGORY_LABEL[approval.category]}</span>
            <span className={`badge badge--${risk.color}`}>{risk.label}</span>
            <StatusBadge status={status} />
          </div>
          {/* Title */}
          <div style={{fontSize:13, fontWeight:600, color:"var(--t1)", marginBottom:4, lineHeight:1.3}}>{approval.title}</div>
          <p style={{fontSize:12, color:"var(--t2)", lineHeight:1.5, marginBottom:6}}>{approval.summary}</p>
          {/* Metadata row */}
          <div style={{display:"flex", gap:12, flexWrap:"wrap"}}>
            <span style={{fontSize:11, color:"var(--t3)"}}>Agente: <b style={{color:"var(--t2)"}}>{approval.agent}</b></span>
            <span style={{fontSize:11, color:"var(--t3)"}}>Proyecto: <b style={{color:"var(--t2)"}}>{approval.project}</b></span>
            <span style={{fontSize:11, color:"var(--t3)"}}>Tipo: <b style={{color:"var(--t2)"}}>{approval.decisionType}</b></span>
            <span style={{fontSize:11, color:"var(--t3)", fontFamily:"var(--mono)"}}>{approval.created}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{flexShrink:0, display:"flex", flexDirection:"column", gap:5, alignItems:"flex-end"}}>
          {status === "pending" ? (
            <>
              <button className="btn btn--success btn--sm" onClick={() => handleAction("approved")}>
                <Icons.check width="12" height="12" /> Aprobar
              </button>
              <button className="btn btn--warning btn--sm" onClick={() => handleAction("observed")}>
                <Icons.eye width="12" height="12" /> Observar
              </button>
              <button className="btn btn--danger btn--sm" onClick={() => handleAction("rejected")}>
                <Icons.x width="12" height="12" /> Rechazar
              </button>
              <span style={{fontSize:10, color:"var(--t3)", textAlign:"center", marginTop:2}}>Solo visual</span>
            </>
          ) : (
            <span className="btn btn--done btn--sm">
              {status === "approved" ? "✓ Aprobada" : status === "observed" ? "~ Observada" : "✗ Rechazada"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ApprovalsView() {
  const [state] = useStore();
  const [filter, setFilter] = React.useState("all");
  const approvals = window.APPROVALS || [];
  const filterTabs = [
    {id:"all",          label:"Todas"},
    {id:"pending",      label:"Pendientes"},
    {id:"skill",        label:"Skills"},
    {id:"memory",       label:"Memoria"},
    {id:"critical-decision", label:"Decisiones críticas"},
  ];
  const decisionOf = (a) => state.approvalDecisions[a.id] || a.status;
  const filtered = filter === "all" ? approvals :
                   filter === "pending" ? approvals.filter(a=>decisionOf(a)==="pending") :
                   approvals.filter(a=>a.category===filter);

  const pendingCount = approvals.filter(a=>decisionOf(a)==="pending").length;

  return (
    <>
      <AIPageHeader
        eyebrow="Aprobaciones"
        title="Cola de decisiones del GG"
        description="Recomendaciones, skills y memorias que requieren decisión explícita antes de ejecutarse."
        actions={
          <div style={{display:"flex", gap:6, alignItems:"center"}}>
            <span className="badge badge--orange">{pendingCount} pendientes</span>
            <span className="badge badge--mock">Acciones visuales</span>
          </div>
        }
      />

      {/* Filter tabs */}
      <div style={{display:"flex", gap:2, marginBottom:10, background:"var(--bg-subtle)", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:3, width:"fit-content"}}>
        {filterTabs.map(f => (
          <button key={f.id} className={`mode-tab ${filter===f.id?"mode-tab--active":""}`}
            onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div style={{padding:"24px 14px", textAlign:"center", color:"var(--t3)", fontSize:12}}>
            Sin aprobaciones en esta categoría.
          </div>
        ) : (
          filtered.map(a => <ApprovalRow key={a.id} approval={a} />)
        )}
      </div>
    </>
  );
}

// ─── PROYECTOS (/projects) ───────────────────────────────────────────────────

function ProjectCard({ project }) {
  const statusCfg  = STATUS_BADGE[project.status]  || {label:project.status,  color:"slate"};
  const riskCfg    = RISK_BADGE[project.risk]       || {label:project.risk,    color:"slate"};
  return (
    <div className="project-card">
      <div className="project-card-id">{project.id}</div>
      <div className="project-card-name">{project.name}</div>
      <div className="project-card-client">{project.client}</div>

      {/* Progress */}
      <div style={{marginBottom:8}}>
        <div style={{display:"flex", justifyContent:"space-between", marginBottom:3}}>
          <span style={{fontSize:10, color:"var(--t3)"}}>Avance</span>
          <span style={{fontSize:11, fontWeight:600, color:"var(--t1)"}}>{project.progress}%</span>
        </div>
        <ProgressFill status={project.status} progress={project.progress} />
      </div>

      {/* Metadata */}
      <div style={{fontSize:11, color:"var(--t2)", marginBottom:8, display:"flex", flexDirection:"column", gap:2}}>
        <div style={{display:"flex", justifyContent:"space-between"}}>
          <span style={{color:"var(--t3)"}}>Fase</span>
          <span style={{fontWeight:500}}>{project.phase}</span>
        </div>
        <div style={{display:"flex", justifyContent:"space-between"}}>
          <span style={{color:"var(--t3)"}}>Costo</span>
          <span style={{fontWeight:500, fontFamily:"var(--mono)"}}>{project.cost}</span>
        </div>
        <div style={{display:"flex", justifyContent:"space-between"}}>
          <span style={{color:"var(--t3)"}}>Próx. hito</span>
          <span style={{fontWeight:500}}>{project.nextMilestone}</span>
        </div>
        <div style={{display:"flex", justifyContent:"space-between"}}>
          <span style={{color:"var(--t3)"}}>Vencimiento</span>
          <span style={{fontWeight:500}}>{project.due}</span>
        </div>
      </div>

      {/* Badges */}
      <div style={{display:"flex", gap:4, flexWrap:"wrap"}}>
        <span className={`badge badge--${statusCfg.color}`}>{statusCfg.label}</span>
        <span className={`badge badge--${riskCfg.color}`}>{riskCfg.label}</span>
        {project.agents.map(a => <span key={a} className="badge badge--blue">{a}</span>)}
      </div>
    </div>
  );
}

function ProjectsView({ viewMode }) {
  const [state] = useStore();
  const [showForm, setShowForm] = React.useState(false);
  const KANBAN_COLS = ["Planificacion", "Ejecucion", "Control", "Cierre"];
  const allProjects = [...(window.PROJECTS||[]), ...state.customProjects];
  const atRisk = allProjects.filter(p => p.status === "at-risk" || p.status === "delayed").length;
  const totalCost = "S/ 4.83 M";

  return (
    <>
      <AIPageHeader
        eyebrow="Proyectos"
        title="Portafolio de proyectos de ingeniería"
        description="Estado, avance, costos y riesgos de cada proyecto. Crea proyectos nuevos; se guardan en memoria local."
        actions={
          <div style={{display:"flex", gap:6, alignItems:"center"}}>
            <div className="kpi" style={{padding:"5px 10px"}}>
              <span style={{fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".07em"}}>Total</span>
              <span style={{fontSize:15, fontWeight:700, marginLeft:6}}>{allProjects.length}</span>
            </div>
            <div className="kpi" style={{padding:"5px 10px"}}>
              <span style={{fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".07em"}}>Riesgo</span>
              <span style={{fontSize:15, fontWeight:700, color:"var(--orange)", marginLeft:6}}>{atRisk}</span>
            </div>
            <button className="btn btn--primary" onClick={() => setShowForm(true)}>
              <Icons.folder width="13" height="13" /> Nuevo proyecto
            </button>
          </div>
        }
      />

      {viewMode === "list" ? (
        /* List view */
        <div className="card">
          <div className="card-header">
            <div style={{fontSize:13, fontWeight:600}}>Proyectos</div>
          </div>
          {allProjects.map(p => (
            <div key={p.id} style={{
              display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
              borderBottom:"1px solid var(--border)",
              borderLeft:`3px solid var(--${p.risk==="critical"?"red":p.risk==="high"?"orange":p.risk==="medium"?"amber":"green"})`,
            }}>
              <div style={{width:60, flexShrink:0}}>
                <span style={{fontSize:10, fontFamily:"var(--mono)", color:"var(--t3)"}}>{p.id}</span>
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:13, fontWeight:600, color:"var(--t1)", marginBottom:1}}>{p.name}</div>
                <div style={{fontSize:11, color:"var(--t3)"}}>{p.client} · {p.column}</div>
              </div>
              <div style={{width:120, flexShrink:0}}>
                <div style={{display:"flex", justifyContent:"space-between", marginBottom:3}}>
                  <span style={{fontSize:10, color:"var(--t3)"}}>Avance</span>
                  <span style={{fontSize:11, fontWeight:600}}>{p.progress}%</span>
                </div>
                <ProgressFill status={p.status} progress={p.progress} />
              </div>
              <div style={{display:"flex", gap:4, flexShrink:0}}>
                <StatusBadge status={p.status} />
                <RiskBadge   risk={p.risk}     />
              </div>
              <div style={{fontSize:12, fontFamily:"var(--mono)", color:"var(--t2)", flexShrink:0}}>{p.cost}</div>
            </div>
          ))}
        </div>
      ) : (
        /* Kanban view */
        <div className="kanban">
          {KANBAN_COLS.map(col => {
            const colProjects = allProjects.filter(p => p.column === col);
            return (
              <div key={col} className="kanban-col">
                <div className="kanban-col-header">
                  <span className="kanban-col-title">{col}</span>
                  <span className="kanban-col-count">{colProjects.length}</span>
                </div>
                {colProjects.map(p => <ProjectCard key={p.id} project={p} />)}
                {colProjects.length === 0 && (
                  <div style={{padding:"16px 8px", textAlign:"center", color:"var(--t3)", fontSize:11, borderRadius:"var(--r)", border:"1px dashed var(--border)"}}>
                    Sin proyectos
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && <ProjectForm onClose={() => setShowForm(false)} />}
    </>
  );
}

// ─── SKILLS (/skills) ────────────────────────────────────────────────────────

const SKILL_TYPE_LABEL = {
  "analysis-workflow":  "Workflow de análisis",
  "review-protocol":    "Protocolo de revisión",
  "coordination-rule":  "Regla de coordinación",
  "knowledge-method":   "Método de conocimiento",
};

function SkillRow({ skill }) {
  const [expanded, setExpanded] = React.useState(false);
  const liveStatus = (IGStore.get().skillStates[skill.id]) || skill.status;
  const statusCfg = STATUS_BADGE[liveStatus] || {label:liveStatus, color:"slate"};
  const riskCfg   = RISK_BADGE[skill.risk]     || {label:skill.risk,   color:"slate"};
  const ggColor   = skill.ggApproval.label.includes("Aprobada") ? "green" :
                    skill.ggApproval.label.includes("Observada") ? "amber" :
                    skill.ggApproval.label.includes("definición") ? "slate" : "blue";

  return (
    <div className="skill-row">
      {/* Main row — clickable */}
      <div className="skill-row-main" onClick={() => setExpanded(e=>!e)}>
        {/* Left: status+info */}
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:"flex", gap:5, flexWrap:"wrap", marginBottom:5, alignItems:"center"}}>
            <span style={{fontSize:10, fontFamily:"var(--mono)", color:"var(--t3)"}}>{skill.id}</span>
            <span className={`badge badge--${statusCfg.color}`}>{statusCfg.label}</span>
            <span className={`badge badge--${riskCfg.color}`}>{riskCfg.label}</span>
            <span className="badge badge--slate">{SKILL_TYPE_LABEL[skill.type]}</span>
            {skill.approvalRequired && <span className="badge badge--orange">Req. GG</span>}
          </div>
          <div style={{fontSize:13, fontWeight:600, color:"var(--t1)", marginBottom:2}}>{skill.name}</div>
          <div style={{fontSize:11, color:"var(--t3)"}}>{skill.trigger}</div>
        </div>

        {/* Right: metadata */}
        <div style={{flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4}}>
          <div style={{display:"flex", gap:6, alignItems:"center"}}>
            <span style={{fontSize:11, color:"var(--t3)"}}>{skill.agent}</span>
            <span style={{fontSize:12, fontWeight:700, fontFamily:"var(--mono)", color:"var(--t1)"}}>{skill.version}</span>
          </div>
          <span className={`badge badge--${ggColor}`}>{skill.ggApproval.label}</span>
          <div style={{display:"flex", alignItems:"center", gap:4}}>
            {expanded ? <Icons.chevronUp /> : <Icons.chevronDown />}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="skill-row-expand">
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10}}>
            <div className="detail-block">
              <div className="detail-block-title">Entradas esperadas</div>
              {skill.inputs.map(i => <div key={i} className="list-item-bullet">{i}</div>)}
            </div>
            <div className="detail-block">
              <div className="detail-block-title">Flujo de trabajo</div>
              {skill.steps.map((s,i) => (
                <div key={i} className="list-item-bullet">
                  <span style={{color:"var(--blue-text)", fontWeight:600, marginRight:2}}>{i+1}.</span>{s}
                </div>
              ))}
            </div>
            <div className="detail-block">
              <div className="detail-block-title">Reglas de seguridad</div>
              {skill.safety.map(s => <div key={s} className="list-item-bullet" style={{color:"var(--orange-text)"}}>{s}</div>)}
            </div>
          </div>

          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
            <div className="detail-block" style={{background:"var(--blue-bg)", borderColor:"var(--blue-border)"}}>
              <div className="detail-block-title" style={{color:"var(--blue-text)"}}>Mejora sugerida</div>
              <div style={{fontSize:11, color:"var(--t2)", lineHeight:1.5}}>{skill.improvement}</div>
            </div>
            <div className="detail-block">
              <div className="detail-block-title">Validación cruzada</div>
              <div style={{fontSize:11, color:"var(--t2)", lineHeight:1.5}}>
                <span style={{fontWeight:600}}>{skill.crossAgents.join(", ")}</span>: {skill.crossPurpose}
              </div>
              <div style={{marginTop:6}}>
                <div className="detail-block-title" style={{marginBottom:3}}>Aprobación GG</div>
                <div style={{fontSize:11, color:"var(--t2)", lineHeight:1.5}}>{skill.ggApproval.scope}</div>
              </div>
            </div>
          </div>

          {/* GG governance actions */}
          <div style={{display:"flex", gap:6, marginTop:10, paddingTop:10, borderTop:"1px solid var(--border)", alignItems:"center"}}>
            <span style={{fontSize:11, color:"var(--t3)", marginRight:"auto"}}>Control del GG:</span>
            {liveStatus !== "active" && (
              <button className="btn btn--success btn--sm" onClick={(e)=>{e.stopPropagation(); IGActions.setSkillState(skill.id, "active");}}>
                <Icons.check width="12" height="12" /> Activar skill
              </button>
            )}
            {liveStatus !== "observed" && (
              <button className="btn btn--warning btn--sm" onClick={(e)=>{e.stopPropagation(); IGActions.setSkillState(skill.id, "observed");}}>
                <Icons.eye width="12" height="12" /> Observar
              </button>
            )}
            {liveStatus === "active" && (
              <button className="btn btn--ghost btn--sm" onClick={(e)=>{e.stopPropagation(); IGActions.setSkillState(skill.id, "deprecated");}}>
                Desactivar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillsView() {
  const [state] = useStore();
  const [filter, setFilter] = React.useState("all");
  const [showForm, setShowForm] = React.useState(false);
  const allSkills = [...(window.SKILLS||[]), ...state.customSkills];
  const liveStatus = (sk) => state.skillStates[sk.id] || sk.status;
  const activeCount   = allSkills.filter(s => liveStatus(s) === "active").length;
  const proposedCount = allSkills.filter(s => liveStatus(s) === "proposed").length;
  const ggCount       = allSkills.filter(s => s.approvalRequired).length;

  const domainTiles = [
    { label:"Agente Costos",           value:"1 activa",               detail:"Análisis de desviación de presupuesto", color:"green"  },
    { label:"Agente PM",               value:"1 propuesta · 1 observada", detail:"Gestión de restricciones y riesgos",   color:"amber"  },
    { label:"Ing. Eléctrico (futuro)", value:"1 propuesta v0.1",        detail:"Criterios de diseño eléctrico",          color:"slate"  },
  ];

  const filtered = filter === "all" ? allSkills : allSkills.filter(s => liveStatus(s) === filter);

  const filterTabs = [
    {id:"all",       label:"Todas"},
    {id:"active",    label:"Activas"},
    {id:"proposed",  label:"Propuestas"},
    {id:"observed",  label:"Observadas"},
  ];

  return (
    <>
      <AIPageHeader
        eyebrow="Skills de agentes IA"
        title="Capacidades operativas versionadas"
        description="Instrucciones, criterios y flujos que definen cómo opera cada agente. Versionadas y aprobadas por el GG antes de activarse."
        actions={
          <div style={{display:"flex", gap:6, alignItems:"center"}}>
            <div className="kpi" style={{padding:"5px 10px"}}>
              <span style={{fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".07em"}}>Activas</span>
              <span style={{fontSize:15, fontWeight:700, color:"var(--green)", marginLeft:6}}>{activeCount}</span>
            </div>
            <div className="kpi" style={{padding:"5px 10px"}}>
              <span style={{fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".07em"}}>Propuestas</span>
              <span style={{fontSize:15, fontWeight:700, color:"var(--blue)", marginLeft:6}}>{proposedCount}</span>
            </div>
            <button className="btn btn--primary" onClick={() => setShowForm(true)}>
              <Icons.sparkle width="13" height="13" /> Proponer skill
            </button>
          </div>
        }
      />

      {/* Domain tiles */}
      <div className="grid-3" style={{marginBottom:12}}>
        {domainTiles.map(t => (
          <div key={t.label} className="card" style={{padding:"10px 14px"}}>
            <div style={{fontSize:10, textTransform:"uppercase", letterSpacing:".08em", fontWeight:600, color:"var(--t3)", marginBottom:3}}>{t.label}</div>
            <div style={{fontSize:13, fontWeight:700, color:`var(--${t.color === "slate"?"t3":t.color})`, marginBottom:2}}>{t.value}</div>
            <div style={{fontSize:11, color:"var(--t3)"}}>{t.detail}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{display:"flex", gap:2, marginBottom:10, background:"var(--bg-subtle)", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:3, width:"fit-content"}}>
        {filterTabs.map(f => (
          <button key={f.id} className={`mode-tab ${filter===f.id?"mode-tab--active":""}`}
            onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Skills registry */}
      <div className="card">
        <div className="card-header">
          <div>
            <div style={{fontSize:10, textTransform:"uppercase", letterSpacing:".1em", fontWeight:600, color:"var(--t3)", marginBottom:1}}>Capacidades versionadas</div>
            <div style={{fontSize:13, fontWeight:600, color:"var(--t1)"}}>Skills operativas de agentes IA</div>
          </div>
          <span className="badge badge--mock">Mock · {filtered.length} skills</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{padding:"20px", textAlign:"center", color:"var(--t3)", fontSize:12}}>Sin skills en esta categoría.</div>
        ) : (
          filtered.map(s => <SkillRow key={s.id} skill={s} />)
        )}
      </div>

      {showForm && <SkillForm onClose={() => setShowForm(false)} />}
    </>
  );
}

Object.assign(window, {
  DashboardView, OfficeView, InboxView, ApprovalsView, ProjectsView, SkillsView,
  StatusBadge, RiskBadge, ProgressFill,
});
