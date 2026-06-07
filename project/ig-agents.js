// ig-agents.js — Dynamic agent registry. Seeds the 4 base agents, merges
// custom agents from the store, keeps window.AGENT_PERSONAS in sync so the AI
// engine + chat + roundtable work for any agent. CRUD lives here.
// Loads AFTER ig-ai.js (needs AGENT_PERSONAS) and ig-store.js.
// ============================================================================

const AGENT_COLORS = ["#1a50d6","#1e293b","#374151","#0f766e","#7c3aed","#b45309","#be123c","#0e7490","#4338ca","#15803d"];

// Free local models (populated for the builder; Phase 5 adds recommendations)
const BASE_MODELS = [
  { id:"llama3.2",  label:"Llama 3.2 (3B)",  size:"2.0 GB", good:["general","chat","redacción"] },
  { id:"qwen2.5",   label:"Qwen 2.5 (7B)",   size:"4.7 GB", good:["análisis","cálculo","costos"] },
  { id:"mistral",   label:"Mistral (7B)",    size:"4.1 GB", good:["general","razonamiento"] },
  { id:"phi3",      label:"Phi-3 mini",      size:"2.3 GB", good:["rápido","ligero"] },
  { id:"gemma2",    label:"Gemma 2 (9B)",    size:"5.4 GB", good:["análisis","técnico"] },
];

// Base agents — derive persona/expertise from AGENT_PERSONAS (already loaded)
function defaultAgents() {
  const P = window.AGENT_PERSONAS || {};
  return [
    { id:"gg", name:"Gerente General",   role:"Supervisión y decisión", initials:"GG", color:"#1a50d6", model:"qwen2.5",
      parentId:null, skills:[], type:"human", status:"active", core:true,
      description:"Autoridad central. Aprueba toda acción crítica y sintetiza al equipo.",
      tone:(P.gg||{}).persona, expertise:(P.gg||{}).expertise },
    { id:"ic", name:"Ing. de Costos",    role:"Costos y Presupuestos", initials:"IC", color:"#1e293b", model:"qwen2.5",
      parentId:"gg", skills:["SK-IC-001"], type:"agent", status:"active", core:true,
      description:"Presupuestos, valorizaciones, desviaciones y adicionales de obra.",
      tone:(P.ic||{}).persona, expertise:(P.ic||{}).expertise },
    { id:"pm", name:"Project Management", role:"Gestión de Proyectos", initials:"PM", color:"#374151", model:"qwen2.5",
      parentId:"gg", skills:["SK-PM-001","SK-PM-002"], type:"agent", status:"active", core:true,
      description:"Cronograma, ruta crítica, riesgos y restricciones.",
      tone:(P.pm||{}).persona, expertise:(P.pm||{}).expertise },
    { id:"ie", name:"Ing. Eléctrico",    role:"Ingeniería Eléctrica", initials:"IE", color:"#0e7490", model:"gemma2",
      parentId:"gg", skills:["SK-IE-001"], type:"agent-future", status:"future", core:true,
      description:"Diseño eléctrico normativo (CNE, IEC, IEEE). Agente futuro.",
      tone:(P.ie||{}).persona, expertise:(P.ie||{}).expertise },
  ];
}

const IGAgents = {
  getAll() {
    const s = IGStore.get();
    const overrides = s.agentOverrides || {};
    const base = defaultAgents().map(a => overrides[a.id] ? { ...a, ...overrides[a.id] } : a);
    const custom = (s.customAgents || []);
    return [...base, ...custom];
  },
  get(id) { return this.getAll().find(a => a.id === id) || null; },
  children(id) { return this.getAll().filter(a => a.parentId === id); },

  add(agent) {
    const s = IGStore.get();
    const full = {
      id: IGActions.uid("AG"), type:"agent", status:"active", core:false, skills:[],
      color: AGENT_COLORS[(s.customAgents||[]).length % AGENT_COLORS.length],
      ...agent,
    };
    if (!full.initials) full.initials = full.name.split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
    IGStore.set({ customAgents: [...(s.customAgents||[]), full] });
    syncPersonas();
    IGActions.logTimeline({ type:"project", title:"Agente creado", detail:`${full.name} — ${full.role}`, result:"ok" });
    IGActions.notify({ kind:"success", title:"Nuevo agente", body:`${full.name} se unió al equipo`, route:"agents" });
    return full;
  },

  update(id, patch) {
    const s = IGStore.get();
    const isCustom = (s.customAgents||[]).some(a => a.id === id);
    if (isCustom) {
      IGStore.set({ customAgents: s.customAgents.map(a => a.id === id ? { ...a, ...patch } : a) });
    } else {
      IGStore.set({ agentOverrides: { ...(s.agentOverrides||{}), [id]: { ...(s.agentOverrides||{})[id], ...patch } } });
    }
    syncPersonas();
    IGActions.logTimeline({ type:"project", title:"Agente actualizado", detail:(this.get(id)||{}).name, result:"ok" });
  },

  remove(id) {
    const s = IGStore.get();
    // reparent children to this agent's parent
    const agent = this.get(id);
    const newParent = agent ? agent.parentId : "gg";
    let customAgents = (s.customAgents||[]).filter(a => a.id !== id)
      .map(a => a.parentId === id ? { ...a, parentId:newParent } : a);
    IGStore.set({ customAgents });
    syncPersonas();
    IGActions.logTimeline({ type:"project", title:"Agente eliminado", detail:agent?agent.name:id, result:"rejected" });
  },
};

// Keep AGENT_PERSONAS live so ig-ai.js / chat / roundtable know every agent
function syncPersonas() {
  if (!window.AGENT_PERSONAS) window.AGENT_PERSONAS = {};
  IGAgents.getAll().forEach(a => {
    window.AGENT_PERSONAS[a.id] = {
      name: a.name, role: a.role,
      persona: a.tone || `Eres ${a.name}, ${a.role}. ${a.description||""}`,
      expertise: a.expertise || a.description || a.role,
    };
  });
}

// avatar helper: known core ids use CSS class; customs use inline color
const CORE_AVATAR_CLASS = { gg:"agent-avatar--gg", ic:"agent-avatar--ic", pm:"agent-avatar--pm", ie:"agent-avatar--future" };
function agentAvatarAttrs(id, size) {
  const a = IGAgents.get(id);
  const cls = CORE_AVATAR_CLASS[id];
  const style = {};
  if (size) { style.width = size; style.height = size; style.fontSize = Math.round(size*0.36); }
  if (!cls && a) { style.background = a.color || "#4b5563"; style.color = "#fff"; }
  // emoji override
  const initials = a?.emoji ? a.emoji : (a ? a.initials : (id||"?").toUpperCase().slice(0,2));
  if (a?.emoji) { style.fontSize = Math.round((size||32)*0.62); style.background = style.background||"var(--bg-subtle)"; style.color = "initial"; }
  return { className: `agent-avatar ${cls||""}`.trim(), style, initials };
}

// initialize
syncPersonas();
IGStore.subscribe(() => syncPersonas());

Object.assign(window, { IGAgents, BASE_MODELS, AGENT_COLORS, syncPersonas, agentAvatarAttrs });
