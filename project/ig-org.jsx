// ig-org.jsx — Organigrama interactivo y editable
// Click nodo → panel de edición. "Mover" → clic en nuevo jefe. Añadir sub-agente. Asignar proyecto.
// Layout automático de árbol multinivel. SVG para líneas.

// ─── Estructura real de la empresa (Oficina Técnica) ──────────────────────────
const ORG_EMPRESA = [
  { id:"co-gg",      name:"Gerencia General",            role:"Dirección ejecutiva",        parentId:null,        status:"active" },

  // Área de Proyectos y Operaciones
  { id:"co-proyops", name:"Proyectos y Operaciones",     role:"Área",                       parentId:"co-gg",     status:"active" },
  { id:"co-pm",      name:"Project Management",          role:"Gestión de proyectos",       parentId:"co-proyops",status:"active" },
  { id:"co-oftec",   name:"Oficina Técnica",             role:"Coordinación técnica",       parentId:"co-proyops",status:"active" },
  { id:"co-ctrldoc", name:"Control Documentario",        role:"Trazabilidad de docs",       parentId:"co-oftec",  status:"active" },
  { id:"co-planea",  name:"Planeamiento",                role:"Programación",               parentId:"co-oftec",  status:"active" },
  { id:"co-ctrlav",  name:"Control de Avance",           role:"Seguimiento",                parentId:"co-oftec",  status:"active" },
  { id:"co-opssgp",  name:"Operaciones SGP",             role:"Módulo operativo",           parentId:"co-oftec",  status:"active" },
  { id:"co-ops-cot", name:"Cotizaciones",                role:"",                           parentId:"co-opssgp", status:"active" },
  { id:"co-ops-rq",  name:"Requerimientos",              role:"",                           parentId:"co-opssgp", status:"active" },
  { id:"co-ops-det", name:"Detalle RQ",                  role:"",                           parentId:"co-opssgp", status:"active" },
  { id:"co-ops-rec", name:"Recursos",                    role:"",                           parentId:"co-opssgp", status:"active" },
  { id:"co-ops-pro", name:"Propuestas Técnicas",         role:"",                           parentId:"co-opssgp", status:"active" },
  { id:"co-superv",  name:"Supervisión / Ejecución",     role:"Obra y campo",               parentId:"co-proyops",status:"active" },

  // Ingeniería
  { id:"co-ing",     name:"Ingeniería",                  role:"Área",                       parentId:"co-gg",     status:"active" },
  { id:"co-ing-ele",name:"Ingeniería Eléctrica",        role:"Disciplina",                 parentId:"co-ing",    status:"active" },
  { id:"co-ing-mec",name:"Ingeniería Mecánica",         role:"Pendiente",                  parentId:"co-ing",    status:"future" },
  { id:"co-ing-civ",name:"Ingeniería Civil",            role:"Pendiente",                  parentId:"co-ing",    status:"future" },
  { id:"co-ing-est",name:"Estudios y Memorias",         role:"Memorias técnicas",          parentId:"co-ing",    status:"active" },

  // Costos y Presupuestos
  { id:"co-cost",    name:"Costos y Presupuestos",       role:"Área",                       parentId:"co-gg",     status:"active" },
  { id:"co-cost-met",name:"Metrados",                   role:"",                           parentId:"co-cost",   status:"active" },
  { id:"co-cost-apu",name:"APU",                        role:"Análisis P. Unitarios",      parentId:"co-cost",   status:"active" },
  { id:"co-cost-pre",name:"Presupuestos",               role:"",                           parentId:"co-cost",   status:"active" },
  { id:"co-cost-val",name:"Valorizaciones",             role:"",                           parentId:"co-cost",   status:"active" },

  // Comercial y Propuestas
  { id:"co-com",     name:"Comercial y Propuestas",      role:"Área",                       parentId:"co-gg",     status:"active" },
  { id:"co-com-lic", name:"Licitaciones",                role:"",                           parentId:"co-com",    status:"active" },
  { id:"co-com-cot", name:"Cotizaciones",                role:"",                           parentId:"co-com",    status:"active" },
  { id:"co-com-prt", name:"Propuestas Técnicas",         role:"",                           parentId:"co-com",    status:"active" },
  { id:"co-com-pre", name:"Propuestas Económicas",       role:"",                           parentId:"co-com",    status:"active" },

  // Calidad, Seguridad y Medio Ambiente
  { id:"co-qsa",     name:"Calidad, Seguridad y MA",     role:"Área",                       parentId:"co-gg",     status:"active" },
  { id:"co-qsa-cal", name:"Calidad / Dossier",           role:"",                           parentId:"co-qsa",    status:"active" },
  { id:"co-qsa-seg", name:"Seguridad",                   role:"",                           parentId:"co-qsa",    status:"active" },
  { id:"co-qsa-amb", name:"Medio Ambiente",              role:"",                           parentId:"co-qsa",    status:"active" },

  // Áreas pendientes
  { id:"co-log",     name:"Logística y Almacén",         role:"Pendiente",                  parentId:"co-gg",     status:"future" },
  { id:"co-fin",     name:"Administración y Finanzas",   role:"Pendiente",                  parentId:"co-gg",     status:"future" },
  { id:"co-rrhh",    name:"Recursos Humanos",            role:"Pendiente",                  parentId:"co-gg",     status:"future" },
].map(n => ({ ...n, initials: n.name.split(/[\s/]+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase(), core:true }));

// ─── Layout engine ───────────────────────────────────────────────────────────
const NODE_W = 168;
const NODE_H = 72;
const H_GAP  = 20;
const V_GAP  = 64;

function buildTree(agents) {
  // Build adjacency: parentId → children[]
  const map = {};
  agents.forEach(a => { map[a.id] = { ...a, children:[] }; });
  const roots = [];
  agents.forEach(a => {
    if (a.parentId && map[a.parentId]) map[a.parentId].children.push(map[a.id]);
    else roots.push(map[a.id]);
  });
  // Separate GG to be first root
  const gg = roots.find(r => r.id === "gg");
  const others = roots.filter(r => r.id !== "gg");
  const orderedRoots = gg ? [gg, ...others] : roots;
  return orderedRoots;
}

function measureSubtreeWidth(node) {
  if (!node.children || node.children.length === 0) return NODE_W;
  const childWidths = node.children.map(measureSubtreeWidth);
  const total = childWidths.reduce((s, w) => s + w, 0) + H_GAP * (node.children.length - 1);
  return Math.max(NODE_W, total);
}

function layoutTree(roots) {
  const positions = {};
  let rootOffset = 0;

  function place(node, depth, left) {
    const subtreeW = measureSubtreeWidth(node);
    const cx = left + subtreeW / 2;
    positions[node.id] = { x: cx - NODE_W / 2, y: depth * (NODE_H + V_GAP), cx, cy: depth * (NODE_H + V_GAP) + NODE_H / 2 };
    if (node.children && node.children.length > 0) {
      let childLeft = left;
      node.children.forEach(child => {
        const cw = measureSubtreeWidth(child);
        place(child, depth + 1, childLeft);
        childLeft += cw + H_GAP;
      });
    }
  }

  roots.forEach(root => {
    const sw = measureSubtreeWidth(root);
    place(root, 0, rootOffset);
    rootOffset += sw + H_GAP * 2;
  });

  return positions;
}

function computeEdges(agents, positions) {
  const edges = [];
  agents.forEach(a => {
    if (a.parentId && positions[a.id] && positions[a.parentId]) {
      const from = positions[a.parentId];
      const to   = positions[a.id];
      edges.push({
        id:   `${a.parentId}→${a.id}`,
        x1: from.cx,
        y1: from.y + NODE_H,
        x2: to.cx,
        y2: to.y,
      });
    }
  });
  return edges;
}

function canvasBounds(positions) {
  let maxX = 0, maxY = 0;
  Object.values(positions).forEach(p => {
    maxX = Math.max(maxX, p.x + NODE_W);
    maxY = Math.max(maxY, p.y + NODE_H);
  });
  return { w: maxX + 40, h: maxY + 40 };
}

// ─── Avatar helper ────────────────────────────────────────────────────────────
const CORE_BG = { gg:"#1a50d6", ic:"#1e293b", pm:"#374151", ie:"#0e7490", "co-gg":"#141820" };

function OrgAvatar({ agent, size=32 }) {
  const bg = CORE_BG[agent.id] || agent.color || "#4b5563";
  const future = agent.status === "future" || agent.type === "agent-future";
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%", flexShrink:0,
      background: future ? "var(--bg-subtle)" : bg,
      color: future ? "var(--t3)" : "#fff",
      border: future ? "2px dashed var(--border)" : "none",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize: Math.round(size * 0.34), fontWeight:700,
    }}>
      {agent.initials || agent.name.slice(0,2).toUpperCase()}
    </div>
  );
}

// ─── Org node component ───────────────────────────────────────────────────────
function OrgNode({ agent, pos, isSelected, isPickTarget, isMoving, onSelect, onPickParent }) {
  const future = agent.status === "future" || agent.type === "agent-future";
  const isGG   = agent.id === "gg" || agent.id === "co-gg";

  let border = "1px solid var(--border)";
  let bg     = "var(--bg-card)";
  let shadow = "var(--shadow)";
  if (isSelected)   { border = "2px solid var(--blue)"; shadow = "var(--shadow-md)"; }
  if (isPickTarget)  { border = "2px solid var(--green)"; bg = "var(--green-bg)"; }
  if (isGG)          { bg = "#141820"; border = "1px solid #1e2436"; }

  return (
    <div
      onClick={() => isMoving && !isSelected ? onPickParent(agent.id) : onSelect(agent.id)}
      style={{
        position:"absolute", left:pos.x, top:pos.y,
        width:NODE_W, height:NODE_H,
        background:bg, border, borderRadius:"var(--r-lg)",
        boxShadow:shadow, padding:"10px 11px",
        display:"flex", flexDirection:"column", gap:5,
        cursor:"pointer", transition:"box-shadow .12s, border-color .12s, transform .1s",
        transform: isSelected ? "translateY(-2px)" : "none",
        opacity: future ? .7 : 1,
      }}
    >
      <div style={{display:"flex", alignItems:"center", gap:8}}>
        <OrgAvatar agent={agent} size={28} />
        <div style={{minWidth:0, flex:1}}>
          <div style={{
            fontSize:11.5, fontWeight:700, lineHeight:1.25,
            color: isGG ? "#fff" : "var(--t1)",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          }}>{agent.name}</div>
          <div style={{
            fontSize:10, color: isGG ? "rgba(255,255,255,.5)" : "var(--t3)",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          }}>{agent.role}</div>
        </div>
      </div>
      <div style={{display:"flex", gap:4, alignItems:"center", flexWrap:"wrap"}}>
        <span className={`badge badge--${agent.status==="active"?"green":agent.status==="future"?"slate":"amber"}`}>
          {agent.status==="active"?"Activo":agent.status==="future"?"Futuro":"Req. aprob."}
        </span>
        {isPickTarget && (
          <span className="badge badge--green" style={{fontSize:9}}>← mover aquí</span>
        )}
        {isGG && (
          <span style={{fontSize:9, color:"rgba(255,255,255,.4)", fontFamily:"var(--mono)"}}>GG</span>
        )}
      </div>
    </div>
  );
}

// ─── Edit panel ───────────────────────────────────────────────────────────────
function OrgEditPanel({ agent, onClose, onMove, onAdd, onDelete, onUpdate, isMoving, onCancelMove }) {
  const [state] = useStore();
  const allAgents = IGAgents.getAll().filter(a => a.id !== agent.id);
  const allProjects = [...(window.PROJECTS||[]), ...state.customProjects];
  const [name, setName] = React.useState(agent.name);
  const [role, setRole] = React.useState(agent.role);

  function save() { onUpdate(agent.id, { name, role }); }

  return (
    <div style={{
      position:"absolute", right:0, top:0, bottom:0, width:248,
      background:"var(--bg-card)", borderLeft:"1px solid var(--border)",
      display:"flex", flexDirection:"column", zIndex:10,
    }}>
      <div style={{padding:"10px 12px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <OrgAvatar agent={agent} size={26} />
          <span style={{fontSize:12.5, fontWeight:700, color:"var(--t1)"}}>{agent.name}</span>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onClose}><Icons.x width="12" height="12"/></button>
      </div>

      <div style={{flex:1, overflowY:"auto", padding:"10px 12px", display:"flex", flexDirection:"column", gap:10}}>
        {/* Quick edit */}
        <div className="detail-block">
          <div className="detail-block-title">Edición rápida</div>
          <div className="field" style={{margin:"6px 0 0"}}>
            <label className="field-label">Nombre</label>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} />
          </div>
          <div className="field" style={{margin:"6px 0 0"}}>
            <label className="field-label">Rol</label>
            <input className="input" value={role} onChange={e=>setRole(e.target.value)} />
          </div>
          <button className="btn btn--primary btn--sm" style={{marginTop:8}} onClick={save}>
            <Icons.check width="11" height="11"/> Guardar
          </button>
        </div>

        {/* Move / hierarchy */}
        <div className="detail-block">
          <div className="detail-block-title">Jerarquía</div>
          {agent.parentId && (
            <div style={{fontSize:11, color:"var(--t2)", marginBottom:6}}>
              Reporta a: <b>{IGAgents.get(agent.parentId)?.name}</b>
            </div>
          )}
          {!isMoving ? (
            <button className="btn btn--ghost btn--sm w-full" onClick={onMove} style={{justifyContent:"flex-start"}} disabled={agent.id==="gg"}>
              <Icons.arrowRight width="12" height="12"/> Mover nodo (clic en nuevo jefe)
            </button>
          ) : (
            <div>
              <div style={{fontSize:11, color:"var(--blue-text)", fontWeight:600, marginBottom:6}}>
                Haz clic en el nuevo jefe directo del organigrama
              </div>
              <button className="btn btn--ghost btn--sm" onClick={onCancelMove}>Cancelar</button>
            </div>
          )}
        </div>

        {/* Add sub-agent */}
        <div className="detail-block">
          <div className="detail-block-title">Sub-agentes</div>
          <div style={{fontSize:11, color:"var(--t2)", marginBottom:6}}>
            {IGAgents.children(agent.id).length} sub-agente{IGAgents.children(agent.id).length!==1?"s":""} directo{IGAgents.children(agent.id).length!==1?"s":""}
          </div>
          <button className="btn btn--ghost btn--sm w-full" onClick={onAdd} style={{justifyContent:"flex-start"}}>
            <Icons.agents width="12" height="12"/> Añadir sub-agente
          </button>
        </div>

        {/* Assign project */}
        <div className="detail-block">
          <div className="detail-block-title">Asignar a proyecto</div>
          <select className="select" defaultValue="" onChange={(e) => {
            if (!e.target.value) return;
            IGActions.logTimeline({ type:"project", title:`${agent.name} asignado a ${e.target.value}`, detail:"Desde organigrama", result:"ok" });
            IGActions.notify({ kind:"success", title:"Agente asignado", body:`${agent.name} → ${e.target.value}`, route:"org" });
          }}>
            <option value="">— Seleccionar proyecto —</option>
            {allProjects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
          </select>
        </div>

        {/* Delete */}
        {!agent.core && (
          <button className="btn btn--danger btn--sm" onClick={() => onDelete(agent.id)}>
            <Icons.x width="12" height="12"/> Eliminar agente
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main OrgChartView ────────────────────────────────────────────────────────
function OrgChartView() {
  const [, force] = React.useReducer(x=>x+1, 0);
  const [mode, setMode] = React.useState("empresa"); // "empresa" | "agentes"
  const [selectedId, setSelectedId] = React.useState(null);
  const [isMoving, setIsMoving] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const containerRef = React.useRef(null);

  IGStore.subscribe(force);

  const isEmpresa  = mode === "empresa";
  const agents     = isEmpresa ? ORG_EMPRESA : IGAgents.getAll();
  const roots      = buildTree(agents);
  const positions  = layoutTree(roots);
  const edges      = computeEdges(agents, positions);
  const bounds     = canvasBounds(positions);
  const selected   = (!isEmpresa && selectedId) ? IGAgents.get(selectedId) : null;

  function handleSelect(id) {
    if (isEmpresa) return; // company structure is read-only
    if (id === selectedId) { setSelectedId(null); setIsMoving(false); return; }
    setSelectedId(id);
    setIsMoving(false);
  }

  function handlePickParent(newParentId) {
    if (!selectedId || newParentId === selectedId) return;
    IGAgents.update(selectedId, { parentId: newParentId });
    setIsMoving(false); setSelectedId(null); force();
  }

  function handleMove() { setIsMoving(true); }
  function handleCancelMove() { setIsMoving(false); }

  function handleAdd() {
    setShowForm(true);
  }

  function handleDelete(id) {
    if (confirm(`¿Eliminar ${IGAgents.get(id)?.name}? Sus sub-agentes pasarán a su jefe.`)) {
      IGAgents.remove(id); setSelectedId(null); force();
    }
  }

  function handleUpdate(id, patch) { IGAgents.update(id, patch); force(); }

  return (
    <>
      <AIPageHeader
        eyebrow="Organigrama"
        title={isEmpresa ? "Estructura de la empresa" : "Equipo IA — jerarquía editable"}
        description={isEmpresa
          ? "Estructura organizacional de la Oficina Técnica. Las áreas en gris (Logística, Finanzas, RR.HH., Ing. Mecánica/Civil) están pendientes de implementar."
          : "Clic en un nodo para seleccionarlo y editar. Usa 'Mover nodo' para reasignar jerarquía. Añade sub-agentes desde el panel lateral."}
        actions={
          <div style={{display:"flex", gap:6, alignItems:"center"}}>
            <div style={{display:"flex", gap:2, background:"var(--bg-subtle)", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:3}}>
              {[{v:"empresa",l:"Estructura empresa"},{v:"agentes",l:"Agentes IA"}].map(o=>(
                <button key={o.v} className={`mode-tab ${mode===o.v?"mode-tab--active":""}`} onClick={()=>{setMode(o.v);setSelectedId(null);setIsMoving(false);}}>{o.l}</button>
              ))}
            </div>
            {!isEmpresa && (
              <button className="btn btn--primary" onClick={()=>{ setSelectedId(null); setShowForm(true); }}>
                <Icons.agents width="13" height="13"/> Nuevo agente
              </button>
            )}
          </div>
        }
      />

      {isMoving && (
        <div style={{
          padding:"8px 14px", marginBottom:10, borderRadius:"var(--r)",
          background:"var(--blue-bg)", border:"1px solid var(--blue-border)",
          fontSize:12, fontWeight:600, color:"var(--blue-text)",
          display:"flex", alignItems:"center", gap:8,
        }}>
          <Icons.arrowRight width="14" height="14"/>
          Haz clic en el nodo que será el nuevo jefe de <b>{selected?.name}</b>
          <button className="btn btn--ghost btn--sm" onClick={handleCancelMove} style={{marginLeft:"auto"}}>Cancelar</button>
        </div>
      )}

      <div style={{position:"relative", display:"flex"}}>
        {/* Canvas */}
        <div
          ref={containerRef}
          style={{
            flex:1, position:"relative",
            overflowX:"auto", overflowY:"auto",
            background:"var(--bg-muted)",
            border:"1px solid var(--border)",
            borderRadius:"var(--r-lg)",
            minHeight: Math.max(400, bounds.h + 40),
          }}
        >
          {/* SVG edges */}
          <svg
            style={{ position:"absolute", top:20, left:20, overflow:"visible", pointerEvents:"none" }}
            width={bounds.w} height={bounds.h}
          >
            {edges.map(e => (
              <path key={e.id}
                d={`M${e.x1},${e.y1} C${e.x1},${e.y1+V_GAP*.5} ${e.x2},${e.y2-V_GAP*.5} ${e.x2},${e.y2}`}
                fill="none" stroke="var(--border-strong)" strokeWidth="1.5"
              />
            ))}
          </svg>

          {/* Nodes */}
          <div style={{ position:"relative", top:20, left:20, width:bounds.w, height:bounds.h }}>
            {agents.map(agent => {
              const pos = positions[agent.id];
              if (!pos) return null;
              const isPickTarget = isMoving && agent.id !== selectedId;
              return (
                <OrgNode
                  key={agent.id}
                  agent={agent}
                  pos={pos}
                  isSelected={selectedId === agent.id}
                  isPickTarget={isPickTarget}
                  isMoving={isMoving}
                  onSelect={handleSelect}
                  onPickParent={handlePickParent}
                />
              );
            })}
          </div>
        </div>

        {/* Edit panel */}
        {selected && (
          <OrgEditPanel
            agent={selected}
            isMoving={isMoving}
            onClose={() => { setSelectedId(null); setIsMoving(false); }}
            onMove={handleMove}
            onCancelMove={handleCancelMove}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        )}
      </div>

      {/* Legend */}
      <div style={{display:"flex", gap:12, marginTop:10, flexWrap:"wrap"}}>
        {[
          {color:"var(--green)", label:"Activo"},
          {color:"var(--blue)", label:"GG / Supervisor"},
          {color:"var(--t3)", label:"Futuro"},
          {color:"var(--amber)", label:"Req. aprobación"},
        ].map(l => (
          <div key={l.label} style={{display:"flex", alignItems:"center", gap:5, fontSize:11, color:"var(--t2)"}}>
            <span style={{width:8, height:8, borderRadius:"50%", background:l.color, flexShrink:0}}/>
            {l.label}
          </div>
        ))}
        <span style={{fontSize:11, color:"var(--t3)", marginLeft:"auto"}}>
          {agents.length} agentes · {edges.length} conexiones
        </span>
      </div>

      {showForm && (
        <AgentForm
          agent={selectedId && selected?.id !== "gg" ? { parentId: selectedId } : null}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  );
}

Object.assign(window, { OrgChartView });
