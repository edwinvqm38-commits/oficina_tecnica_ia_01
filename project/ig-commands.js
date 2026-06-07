// ig-commands.js — Command system for Mesa de trabajo + Chat
// /help, /menu, /resumen, /presupuesto, /riesgo, /hito, etc.
// @agent mentions parsed here too.
// Loads after ig-agents.js
// ============================================================================

// ─── Command registry ─────────────────────────────────────────────────────────
const COMMANDS = [
  {
    cmd:"/help",    alias:["/menu","/comandos"],
    desc:"Muestra todos los comandos disponibles",
    category:"sistema",
    run: (_args, _ctx) => null, // handled in UI
  },
  {
    cmd:"/resumen", alias:["/r"],
    desc:"Resumen ejecutivo del proyecto activo",
    category:"proyecto",
    prompt: (args, ctx) =>
      `Genera un resumen ejecutivo del proyecto ${args||ctx.projectId}. ` +
      `Incluye: estado, avance, costo, riesgos principales y próximo hito. Sé conciso.`,
    agents: ["gg"],
  },
  {
    cmd:"/presupuesto", alias:["/budget","/costo"],
    desc:"Análisis de presupuesto o solicitud de estimación",
    category:"costos",
    prompt: (args, ctx) =>
      `Realiza un análisis de presupuesto${args ? " para: " + args : " del proyecto " + ctx.projectId}. ` +
      `Identifica desviaciones, adicionales y recomienda acción correctiva.`,
    agents: ["ic"],
  },
  {
    cmd:"/riesgo",  alias:["/risk"],
    desc:"Análisis de riesgos del proyecto",
    category:"pm",
    prompt: (args, ctx) =>
      `Realiza un análisis de riesgos${args ? " para: " + args : " del proyecto " + ctx.projectId}. ` +
      `Clasifica por impacto/probabilidad y propone acciones de mitigación.`,
    agents: ["pm"],
  },
  {
    cmd:"/hito",    alias:["/milestone"],
    desc:"Estado de hitos del cronograma",
    category:"pm",
    prompt: (args, ctx) =>
      `Revisa el estado de hitos${args ? " para: " + args : " del proyecto " + ctx.projectId}. ` +
      `Identifica retrasos en ruta crítica y propone recuperación.`,
    agents: ["pm"],
  },
  {
    cmd:"/norma",   alias:["/cne","/iec"],
    desc:"Consulta normativa técnica eléctrica",
    category:"ingeniería",
    prompt: (args) =>
      `Consulta normativa: ${args||"CNE, IEC 60364 o IEEE applicable"}. ` +
      `Indica la norma exacta, artículo y criterio de diseño aplicable.`,
    agents: ["ie"],
  },
  {
    cmd:"/aprobar", alias:["/ok"],
    desc:"Registrar aprobación de la última recomendación",
    category:"decisión",
    prompt: (args) =>
      `El GG aprueba: ${args||"la última recomendación de los agentes"}. Confirma la decisión y registra en bitácora.`,
    agents: ["gg"],
  },
  {
    cmd:"/skills",  alias:["/capacidades"],
    desc:"Listar las skills activas de un agente",
    category:"sistema",
    prompt: (args) => {
      const agentId = args?.trim().replace("@","") || "ic";
      const agent   = AGENT_PERSONAS[agentId] || { name: agentId };
      const s       = IGStore.get();
      const allSkills = [...(window.SKILLS||[]), ...(s.customSkills||[])];
      const agentSkills = allSkills.filter(sk => sk.status==="active" &&
        (sk.agentId===agentId || (sk.agent||"").toLowerCase().includes(agentId)));
      if (!agentSkills.length) return `No hay skills activas para ${agent.name}.`;
      return `Skills activas de ${agent.name}:\n` +
        agentSkills.map((sk,i) => `${i+1}. **${sk.name}** (${sk.version})\n   Disparador: ${sk.trigger}\n   Flujo: ${(sk.steps||[]).join(" → ")}`).join("\n\n");
    },
    agents: [], // returns text directly, no AI
    directText: true,
  },
  {
    cmd:"/bonjour", alias:["/hola","/hey","/hi"],
    desc:"Saludo al equipo",
    category:"social",
    prompt: () =>
      `El GG entra a la sala. Salúdalo de forma natural, cálida y con personalidad. ` +
      `Menciona en qué estás trabajando hoy si tienes contexto.`,
    agents: ["ic","pm"],
    social: true,
  },
  {
    cmd:"/estado",  alias:["/status"],
    desc:"Estado rápido de todos los proyectos",
    category:"proyecto",
    prompt: (_args, ctx) => {
      const projects = [...(window.PROJECTS||[]), ...(IGStore.get().customProjects||[])];
      const list = projects.map(p => `- ${p.id} ${p.name}: ${p.status}, avance ${p.progress}%, riesgo ${p.risk}`).join("\n");
      return `Estado actual del portafolio:\n${list}\n\nDa un diagnóstico ejecutivo en 3 puntos clave.`;
    },
    agents: ["gg"],
  },
  {
    cmd:"/memoria", alias:["/kb"],
    desc:"Listar conocimiento validado",
    category:"sistema",
    prompt: () => {
      const notes = IGStore.get().knowledge.filter(k=>k.status==="validated");
      if (!notes.length) return "No hay conocimiento validado aún.";
      return `Conocimiento validado (${notes.length} notas):\n` +
        notes.map(n=>`- **${n.title}**: ${n.body.slice(0,80)}`).join("\n");
    },
    agents: [],
    directText: true,
  },
];

// ─── Parse command from input ─────────────────────────────────────────────────
function parseCommand(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const parts = trimmed.split(/\s+/);
  const cmdStr = parts[0].toLowerCase();
  const args   = parts.slice(1).join(" ");
  const cmd = COMMANDS.find(c =>
    c.cmd === cmdStr || (c.alias||[]).includes(cmdStr)
  );
  return cmd ? { cmd, args } : null;
}

// ─── Auto-complete suggestions for "/" ────────────────────────────────────────
function getCommandSuggestions(text) {
  const lower = text.toLowerCase();
  if (!lower.startsWith("/")) return [];
  return COMMANDS.filter(c =>
    c.cmd.startsWith(lower) || (c.alias||[]).some(a=>a.startsWith(lower))
  ).slice(0, 8);
}

// ─── Detect social/casual tone ────────────────────────────────────────────────
const SOCIAL_PATTERNS = [
  /^hola\b/i, /^hey\b/i, /^buenos\b/i, /^buenas\b/i, /^qué tal/i,
  /^cómo est/i, /^todo bien/i, /^jaja/i, /😄|😂|🙌|👋|🎉/,
  /^gracias/i, /^perfecto/i, /^excelente/i, /^genial/i, /^ok|^okey/i,
];
const COMPLEX_PATTERNS = [
  /presupuesto|valoriz|adicional|apu|metrado/i,
  /cronograma|ruta crítica|retraso|hito/i,
  /norma|cálculo|diseño|cne|iec|ieee/i,
  /analiz|evalú|compara|detalladamente/i,
];

function detectTone(text) {
  if (SOCIAL_PATTERNS.some(p => p.test(text.trim()))) return "social";
  if (COMPLEX_PATTERNS.some(p => p.test(text)))       return "technical";
  return "neutral";
}

// ─── Social system prompt modifier ────────────────────────────────────────────
function socialPromptModifier(tone) {
  if (tone === "social") {
    return "\n\nEl GG tiene un tono casual ahora. Responde de forma breve, cálida y humana. " +
      "Si hay emojis en el mensaje, entiéndelos y úsalos con moderación en tu respuesta. " +
      "Puedes hacer bromas leves si el contexto lo permite. Máximo 2-3 oraciones.";
  }
  if (tone === "technical") {
    return "\n\nEsta es una consulta técnica seria. Sé riguroso, estructurado y cita fuentes cuando aplique.";
  }
  return "";
}

// ─── Patch AGENT_PERSONAS with social memory ─────────────────────────────────
function injectSocialMemory(agentId, systemPrompt, recentMessages) {
  const emojisUsed = recentMessages.filter(m=>m.role==="user")
    .map(m=>m.content).join(" ").match(/[\p{Emoji}]/gu) || [];
  const laughs = recentMessages.filter(m=>m.role==="user")
    .map(m=>m.content.toLowerCase())
    .some(t => /jaja|lol|😂|🤣/.test(t));
  const friendly = recentMessages.length > 4;

  let social = "";
  if (emojisUsed.length > 0) social += "\nEl GG usa emojis con frecuencia — úsalos con moderación.";
  if (laughs) social += "\nEl GG tiene sentido del humor — puedes ser levemente gracioso si el momento lo permite.";
  if (friendly) social += "\nTienen una relación de trabajo establecida — sé más cercano y directo.";
  return systemPrompt + social;
}

Object.assign(window, {
  COMMANDS, parseCommand, getCommandSuggestions, detectTone,
  socialPromptModifier, injectSocialMemory,
});
