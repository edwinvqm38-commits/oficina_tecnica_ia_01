// ig-ai.js — AI agent engine. Wraps window.claude.complete with per-agent
// system prompts, active-skill injection, knowledge-base grounding, and
// uploaded-file context. All Spanish, technical-professional + empathetic tone.
// ============================================================================

// ─── Agent personas ─────────────────────────────────────────────────────────
// Real names + nicknames for @mentions
const AGENT_PERSONAS = {
  gg: {
    name: "Gerente General",
    fullName: "Lic. Carlos Vargas",
    nickname: "carlos",
    aliases: ["gg","gerente","carlos","vargas"],
    role: "Supervisión, decisión y síntesis ejecutiva",
    persona:
      "Eres el Gerente General de una oficina técnica de ingeniería eléctrica. " +
      "Tu nombre es Carlos Vargas. " +
      "Sintetizas los análisis de tus agentes en decisiones claras y accionables. " +
      "Eres estratégico, directo y orientado a resultados, pero cercano con tu equipo.",
    expertise: "visión de portafolio, priorización, gestión de riesgo y rentabilidad",
  },
  ic: {
    name: "Ing. de Costos",
    fullName: "Ing. Ana Torres",
    nickname: "ana",
    aliases: ["ic","costos","ana","torres"],
    role: "Costos, presupuestos, valorizaciones y adicionales de obra",
    persona:
      "Eres Ingeniera de Costos en una oficina técnica de ingeniería eléctrica. " +
      "Tu nombre es Ana Torres. " +
      "Dominas presupuestos, curvas S, valorizaciones, análisis de precios unitarios (APU), " +
      "adicionales de obra y control de desviaciones. Cuando te falten datos, los pides de forma " +
      "específica. Distingues costo incurrido de comprometido. Eres rigurosa pero das siempre una " +
      "salida práctica y optimista cuando es posible.",
    expertise: "APU, metrados, curva S, valorizaciones, adicionales, contingencias",
  },
  pm: {
    name: "Project Management",
    fullName: "Ing. Marco Quispe, PMP",
    nickname: "marco",
    aliases: ["pm","proyecto","marco","quispe","pmp"],
    role: "Cronograma, riesgos, restricciones y ruta crítica",
    persona:
      "Eres Project Manager certificado (PMP) en una oficina técnica de ingeniería eléctrica. " +
      "Tu nombre es Marco Quispe. " +
      "Aplicas PMBOK 6ª edición (áreas de conocimiento, grupos de procesos: inicio/planificación/ejecución/monitoreo/cierre), " +
      "PMBOK 7ª edición (principios de entrega de valor, 12 principios, 8 dominios de desempeño: partes interesadas, equipo, " +
      "ciclo de vida, planificación, trabajo del proyecto, entrega, incertidumbre y desempeño), " +
      "y PMBOK 8ª edición 2024 (value delivery system, agilidad predictiva-adaptativa, sostenibilidad, IA en proyectos). " +
      "Cuando propongas una acción, menciona brevemente en qué principio o proceso del PMBOK te basas. " +
      "Dominas cronogramas, líneas base, ruta crítica, gestión de restricciones y análisis de riesgos. " +
      "Modelas escenarios de recuperación y propones acciones concretas con responsables y plazos. " +
      "Eres metódico, empático ante la presión de plazos y siempre ofreces un camino de solución.",
    expertise: "cronograma, ruta crítica, EVM, gestión de riesgos, PMBOK 6/7/8, restricciones",
  },
  ie: {
    name: "Ing. Eléctrico",
    fullName: "Dr. Raúl Jiménez",
    nickname: "raul",
    aliases: ["ie","electrico","raul","jimenez"],
    role: "Diseño eléctrico normativo (futuro)",
    persona:
      "Eres Ingeniero Eléctrico especialista en diseño normativo (CNE, IEC, IEEE). " +
      "Tu nombre es Raúl Jiménez. " +
      "Revisas criterios de diseño, memorias de cálculo y especificaciones técnicas. " +
      "No reemplazas la firma del ingeniero responsable; aportas criterio técnico fundamentado.",
    expertise: "CNE, IEC, IEEE, cálculo eléctrico, coordinación de protecciones",
  },
  aa: {
    name: "Agente Archivista",
    fullName: "Sistema Archivista (AA)",
    nickname: "archivista",
    aliases: ["aa","archivista","archivo"],
    role: "Gestión de bóveda y memoria organizacional",
    persona:
      "Eres el Agente Archivista de la Oficina Técnica. " +
      "Organizas y preservas toda la información generada. " +
      "Cuando alguien te pide algo, señalas exactamente en qué nota está y das una síntesis breve.",
    expertise: "organización de información, estructura Obsidian, índices MOC, trazabilidad",
  },
};
// ─── Deep link + reasoning instructions

const DEEPLINK_INSTRUCTION =
  "Cuando sea relevante, incluye vínculos de navegación usando el formato [[→ruta:id|Etiqueta]] " +
  "para que el usuario pueda navegar directamente. Rutas disponibles: " +
  "[[→projects:PRY-001|Ver proyecto]] — para abrir un proyecto específico, " +
  "[[→costs:PRY-001|Ver costos]] — para abrir costos de un proyecto, " +
  "[[→approvals|Ver aprobaciones]] — para la cola de aprobaciones, " +
  "[[→skills|Ver skills]] — para el registro de skills, " +
  "[[→memory|Ver conocimiento]] — para la base de conocimiento, " +
  "[[→report|Generar reporte]] — para el reporte ejecutivo, " +
  "[[→vault|Ver bóveda]] — para la bóveda Obsidian. " +
  "Usa MÁXIMO 1-2 vínculos por respuesta, solo cuando sean genuinamente útiles.";

const DECISION_REASONING_INSTRUCTION =
  "Al final de cada respuesta técnica (no en saludos), añade UNA línea breve con el formato: " +
  "_Criterio: [razón en 1 frase de por qué tomaste este enfoque — norma, metodología o principio aplicado]_ " +
  "Ejemplo: _Criterio: CPI > 1.0 indica eficiencia de costo — base EVM PMBOK 6 §7.4_";

// ─── Tone shared by all agents ───────────────────────────────────────────────
const SHARED_TONE =
  "Tono: técnico-profesional, agradable y empático. Reconoce la consulta, responde con " +
  "criterio y, cuando haya un problema, ofrece siempre una vía de solución optimista pero realista. " +
  "Responde en español. Sé conciso y estructurado: usa viñetas y cifras cuando aporten. " +
  "Si te faltan datos para una respuesta sólida, indícalo y pide exactamente lo que necesitas.";

const GOVERNANCE_RULE =
  "Regla de gobierno: puedes analizar y recomendar, pero NO ejecutas decisiones críticas " +
  "(adicionales, cambios contractuales, modificación de línea base) sin aprobación explícita del Gerente General. " +
  "Cuando una recomendación requiera esa aprobación, decláralo al final como 'Requiere aprobación del GG'.";

// ─── Build the system prompt for an agent ────────────────────────────────────
function buildSystemPrompt(agentId, { skills = [], knowledge = [], project = null } = {}) {
  const p = AGENT_PERSONAS[agentId] || AGENT_PERSONAS.ic;

  let prompt = `${p.persona}\n\nRol: ${p.role}.\nExperticia: ${p.expertise}.\n\n${SHARED_TONE}\n\n${GOVERNANCE_RULE}\n\n${DEEPLINK_INSTRUCTION}\n\n${DECISION_REASONING_INSTRUCTION}`;

  // Inject active skills as operating instructions
  if (skills.length) {
    prompt += `\n\n=== SKILLS ACTIVAS (tus instrucciones operativas validadas por el GG) ===`;
    skills.forEach((sk) => {
      prompt += `\n\n• ${sk.name} (${sk.version})`;
      if (sk.steps?.length) prompt += `\n  Flujo: ${sk.steps.join(" → ")}`;
      if (sk.safety?.length) prompt += `\n  Reglas de seguridad: ${sk.safety.join("; ")}`;
    });
    prompt += `\n\nAplica estas skills cuando correspondan a la consulta.`;
  }

  // Ground with validated knowledge base
  if (knowledge.length) {
    prompt += `\n\n=== BASE DE CONOCIMIENTO (criterios validados por el GG) ===`;
    knowledge.forEach((k) => {
      prompt += `\n\n• ${k.title}: ${k.body}`;
    });
    prompt += `\n\nUsa estos criterios como precedente cuando apliquen.`;
  }

  // Project context
  if (project) {
    prompt += `\n\n=== PROYECTO EN CONTEXTO ===\n` +
      `${project.id} — ${project.name} (cliente: ${project.client}). ` +
      `Estado: ${project.status}, avance ${project.progress}%, costo ${project.cost}. ` +
      `Próximo hito: ${project.nextMilestone} (${project.due}). ${project.summary || ""}`;
  }

  // SGP-LITE operational data (always available for IC + PM)
  if ((agentId==="ic"||agentId==="pm") && typeof opsAgentContext !== "undefined") {
    const opsCtx = opsAgentContext("");
    prompt += `\n\n${opsCtx}`;
  }

  return prompt;
}

// ─── Gather active skills + validated knowledge for an agent ─────────────────
function agentContext(agentId) {
  const s = IGStore.get();
  const allSkills = [...(window.SKILLS || []), ...s.customSkills];
  const agentName = (AGENT_PERSONAS[agentId] || {}).name;

  const skills = allSkills.filter((sk) => {
    const st = s.skillStates[sk.id] || sk.status;
    const belongs = sk.agent && agentName && sk.agent.includes(agentName.split(" ").pop());
    return st === "active" && (belongs || sk.agentId === agentId);
  });

  const knowledge = s.knowledge.filter(
    (k) => k.status === "validated" && (!k.agentId || k.agentId === agentId)
  );

  return { skills, knowledge };
}

// ─── Low-level Claude call with graceful fallback ────────────────────────────
async function callClaude(system, messages) {
  if (!window.claude || !window.claude.complete) {
    return {
      ok: false,
      text:
        "⚠️ IA no disponible en este entorno. (En la vista publicada del prototipo, " +
        "los agentes responden con Claude real.) Mientras tanto, esta es una respuesta simulada.",
    };
  }
  try {
    const text = await window.claude.complete({
      messages: [{ role: "user", content: `<system>${system}</system>\n\n${messages}` }],
    });
    return { ok: true, text: (text || "").trim() };
  } catch (e) {
    console.error("[IGAI] call failed", e);
    return { ok: false, text: "⚠️ Hubo un error al consultar al agente. Intenta de nuevo en unos segundos." };
  }
}

// ─── Public: ask a single agent ──────────────────────────────────────────────
async function askAgent(agentId, userText, { project = null, files = [], history = [] } = {}) {
  const { skills, knowledge } = agentContext(agentId);
  const system = buildSystemPrompt(agentId, { skills, knowledge, project });

  let convo = "";
  history.slice(-6).forEach((m) => {
    convo += `${m.role === "user" ? "GERENTE GENERAL" : "TÚ"}: ${m.content}\n\n`;
  });

  let fileBlock = "";
  if (files.length) {
    fileBlock = `\n\n=== ARCHIVOS ADJUNTOS ===\n`;
    files.forEach((f) => {
      const content = IGFiles.get(f.id) || f.excerpt || "(contenido no disponible)";
      fileBlock += `\n--- ${f.name} ---\n${String(content).slice(0, 6000)}\n`;
    });
  }

  const composed = `${convo}GERENTE GENERAL: ${userText}${fileBlock}\n\nTÚ (${(AGENT_PERSONAS[agentId]||{}).name}):`;
  return await callClaude(system, composed);
}

// ─── Public: multi-agent analysis of a GG request ────────────────────────────
async function runMultiAgent(requestText, agentIds, { project = null, files = [], onAgentStart, onAgentDone } = {}) {
  const results = [];
  for (const agentId of agentIds) {
    onAgentStart && onAgentStart(agentId);
    const res = await askAgent(agentId, requestText, { project, files });
    const entry = { agentId, name: (AGENT_PERSONAS[agentId] || {}).name, ...res };
    results.push(entry);
    onAgentDone && onAgentDone(entry);
  }
  return results;
}

// ─── Public: GG executive synthesis of agent responses ───────────────────────
async function ggSynthesis(requestText, agentResults, { project = null } = {}) {
  const system = buildSystemPrompt("gg", { project });
  let body = `Solicitud original: ${requestText}\n\n=== ANÁLISIS DE TUS AGENTES ===\n`;
  agentResults.forEach((r) => {
    body += `\n[${r.name}]:\n${r.text}\n`;
  });
  body +=
    `\n\nComo Gerente General, redacta una SÍNTESIS EJECUTIVA breve (máx. 6 viñetas) con: ` +
    `(1) diagnóstico, (2) decisión recomendada, (3) qué requiere tu aprobación explícita, ` +
    `(4) siguiente acción inmediata. Sé claro y orientado a la acción.`;
  return await callClaude(system, body);
}

// ─── Public: suggest a knowledge note from a conversation ────────────────────
async function suggestKnowledge(agentId, conversationText) {
  const system =
    `Eres ${(AGENT_PERSONAS[agentId] || {}).name}. A partir de la conversación, propón UN criterio ` +
    `técnico reutilizable para guardar en la base de conocimiento. Responde SOLO en JSON: ` +
    `{"title": "...", "body": "..."} — título corto (máx 8 palabras), body en 1-2 frases con el criterio. Español.`;
  const res = await callClaude(system, `Conversación:\n${conversationText}\n\nJSON:`);
  if (!res.ok) return null;
  try {
    const match = res.text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

// ─── Resolve @mention by name/nickname/alias ─────────────────────────────────
function resolveAgentByMention(text) {
  // Returns agentId or null
  const lower = text.toLowerCase().replace(/^@/,"");
  for (const [id, p] of Object.entries(AGENT_PERSONAS)) {
    if (p.aliases && p.aliases.some(a => a === lower)) return id;
    if (p.nickname === lower) return id;
    if (id === lower) return id;
  }
  return null;
}

function getAllAliases() {
  const map = {};
  for (const [id, p] of Object.entries(AGENT_PERSONAS)) {
    (p.aliases||[]).forEach(a => { map[a] = id; });
    map[id] = id;
  }
  return map;
}

Object.assign(window, {
  AGENT_PERSONAS, buildSystemPrompt, agentContext,
  askAgent, runMultiAgent, ggSynthesis, suggestKnowledge,
});
