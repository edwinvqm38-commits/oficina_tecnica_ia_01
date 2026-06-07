// ig-archivist.js — Vault data layer + Archivist agent logic.
// Loads AFTER ig-store.js, ig-ai.js, ig-agents.js.
// ============================================================================

// ─── Archivist agent persona ─────────────────────────────────────────────────
const ARCHIVIST_PERSONA = {
  name:      "Agente Archivista",
  initials:  "AA",
  role:      "Gestión de bóveda y memoria organizacional",
  color:     "#4338ca",
  persona:
    "Eres el Agente Archivista de la Oficina Técnica. Tu misión es organizar y preservar toda " +
    "la información generada: conversaciones, decisiones del GG, skills, conocimiento validado y " +
    "solicitudes de proyectos. Estructuras la información como notas Markdown en una bóveda " +
    "estilo Obsidian. Cuando alguien te pide algo, señalas exactamente en qué nota está y das " +
    "una síntesis breve. Eres preciso, organizado y empático.",
  expertise: "organización de información, estructura Obsidian, índices MOC, trazabilidad",
};

// ─── Vault note shape ────────────────────────────────────────────────────────
// { path: string, title: string, body: string, ts: number, tags: string[], auto: boolean }

// ─── Path builder ────────────────────────────────────────────────────────────
const VaultPath = {
  agentSkills:  (agentId)       => `/Agentes/${agentId.toUpperCase()}/Skills.md`,
  agentChat:    (agentId, ts)   => `/Agentes/${agentId.toUpperCase()}/Conversaciones/${new Date(ts).toISOString().slice(0,10)}.md`,
  projectReq:   (projectId)     => `/Proyectos/${projectId}/Solicitudes.md`,
  projectResp:  (projectId)     => `/Proyectos/${projectId}/Respuestas.md`,
  knowledge:    (title)         => `/Conocimiento/${title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g,"-").trim()}.md`,
  bitacora:     (ts)            => `/Bitácora/${new Date(ts).toISOString().slice(0,10)}.md`,
  moc:          ()              => `/MOC.md`,
};

// ─── Vault store helpers ──────────────────────────────────────────────────────
const Vault = {
  get() {
    const s = IGStore.get();
    return (s.vault || { notes:{} });
  },

  getNote(path) {
    return this.get().notes[path] || null;
  },

  upsertNote(path, patch) {
    const v = this.get();
    const existing = v.notes[path] || { path, title: path.split("/").pop(), body:"", ts: Date.now(), tags:[], auto:true };
    const updated = { ...existing, ...patch, path, ts: Date.now() };
    IGStore.set({ vault: { ...v, notes: { ...v.notes, [path]: updated } } });
    return updated;
  },

  deleteNote(path) {
    const v = this.get();
    const notes = { ...v.notes };
    delete notes[path];
    IGStore.set({ vault: { ...v, notes } });
  },

  allNotes() {
    return Object.values(this.get().notes).sort((a,b) => b.ts - a.ts);
  },

  // Build folder tree from flat note paths
  buildTree() {
    const notes = this.allNotes();
    const tree = { name:"", children:{}, note:null };
    notes.forEach(note => {
      const parts = note.path.replace(/^\//, "").split("/");
      let node = tree;
      parts.forEach((part, i) => {
        if (!node.children[part]) node.children[part] = { name:part, children:{}, note:null };
        node = node.children[part];
        if (i === parts.length - 1) node.note = note;
      });
    });
    return tree;
  },
};

// ─── Auto-archive: routes app events to vault notes ──────────────────────────
function archiveApproval(approvalId, decision, meta = {}) {
  const date = new Date();
  const path = VaultPath.bitacora(date.getTime());
  const existing = Vault.getNote(path);
  const entry = `\n\n---\n\n## Decisión: ${meta.title || approvalId}\n` +
    `- **Resultado:** ${decision}\n` +
    `- **Hora:** ${date.toLocaleTimeString("es-PE")}\n` +
    `- **ID:** ${approvalId}\n` +
    (meta.summary ? `- **Resumen:** ${meta.summary}\n` : "");
  Vault.upsertNote(path, {
    title: `Bitácora ${date.toISOString().slice(0,10)}`,
    body: (existing?.body || `# Bitácora — ${date.toLocaleDateString("es-PE",{weekday:"long", day:"2-digit", month:"long", year:"numeric"})}\n\nRegistro cronológico de decisiones del GG.`) + entry,
    tags: ["bitacora","decision"],
  });
}

function archiveKnowledge(note) {
  const path = VaultPath.knowledge(note.title);
  Vault.upsertNote(path, {
    title: note.title,
    body: `# ${note.title}\n\n${note.body}\n\n---\n_Validado por GG · ${new Date(note.validatedTs||note.ts).toLocaleDateString("es-PE")}_\n` +
          (note.agentId ? `_Propuesto por: ${note.agentId.toUpperCase()}_\n` : "") +
          (note.project  ? `_Proyecto: ${note.project}_\n` : ""),
    tags: ["conocimiento", "validado", note.agentId||"general"],
  });
}

function archiveSkill(skill) {
  const agentId = skill.agentId || (skill.agent||"").split(" ").pop().toLowerCase() || "general";
  const path = VaultPath.agentSkills(agentId);
  const existing = Vault.getNote(path);
  const header = `# Skills — ${skill.agent || agentId.toUpperCase()}\n\nCapacidades operativas versionadas.\n`;
  const entry  = `\n\n---\n\n## ${skill.name} (${skill.version || "v1.0"})\n` +
    `- **Estado:** ${skill.status}\n` +
    `- **Tipo:** ${skill.type || "—"}\n` +
    `- **Disparador:** ${skill.trigger || "—"}\n` +
    (skill.steps?.length ? `- **Flujo:** ${skill.steps.join(" → ")}\n` : "") +
    (skill.safety?.length ? `- **Reglas:** ${skill.safety.join("; ")}\n` : "") +
    `- **Actualizado:** ${new Date().toLocaleDateString("es-PE")}\n`;
  Vault.upsertNote(path, {
    title: `Skills — ${(skill.agent||agentId).toUpperCase()}`,
    body: (existing?.body?.startsWith("# Skills") ? existing.body : header) + entry,
    tags: ["skills", agentId],
  });
}

function archiveChat(agentId, userText, agentText, projectId) {
  const ts = Date.now();
  const path = VaultPath.agentChat(agentId, ts);
  const existing = Vault.getNote(path);
  const date = new Date(ts);
  const header = `# Conversación — ${AGENT_PERSONAS[agentId]?.name || agentId.toUpperCase()} · ${date.toLocaleDateString("es-PE")}\n\n`;
  const entry  = `\n\n---\n\n**GG (${date.toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}):**\n${userText}\n\n` +
    `**${AGENT_PERSONAS[agentId]?.name || agentId} (respuesta):**\n${agentText}\n` +
    (projectId ? `\n_Contexto: ${projectId}_\n` : "");
  Vault.upsertNote(path, {
    title: `Chat ${agentId.toUpperCase()} — ${date.toISOString().slice(0,10)}`,
    body: existing?.body || header + entry,
    tags: ["conversacion", agentId, projectId||"general"].filter(Boolean),
  });
}

function archiveProjectRequest(projectId, requestText, agentNames, responseText) {
  // Solicitud
  const reqPath = VaultPath.projectReq(projectId);
  const existing = Vault.getNote(reqPath);
  const date = new Date();
  const header = `# Solicitudes — ${projectId}\n\nHistorial de solicitudes y análisis del GG.\n`;
  const entry  = `\n\n---\n\n## Solicitud — ${date.toLocaleDateString("es-PE")} ${date.toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}\n` +
    `**GG:** ${requestText}\n**Agentes:** ${agentNames.join(", ")}\n`;
  Vault.upsertNote(reqPath, {
    title: `Solicitudes — ${projectId}`,
    body: (existing?.body?.startsWith("# Solicitudes") ? existing.body : header) + entry,
    tags: ["proyecto","solicitud",projectId],
  });
  // Respuesta
  if (responseText) {
    const rspPath = VaultPath.projectResp(projectId);
    const existingR = Vault.getNote(rspPath);
    const headerR = `# Respuestas — ${projectId}\n\nAnálisis multiagente por solicitud.\n`;
    const entryR  = `\n\n---\n\n## Análisis — ${date.toLocaleDateString("es-PE")}\n` +
      `**Agentes:** ${agentNames.join(", ")}\n\n${responseText}\n`;
    Vault.upsertNote(rspPath, {
      title: `Respuestas — ${projectId}`,
      body: (existingR?.body?.startsWith("# Respuestas") ? existingR.body : headerR) + entryR,
      tags: ["proyecto","respuesta",projectId],
    });
  }
}

// ─── MOC generator ───────────────────────────────────────────────────────────
function rebuildMOC() {
  const notes = Vault.allNotes();
  const byFolder = {};
  notes.forEach(n => {
    const folder = n.path.replace(/^\//, "").split("/")[0];
    (byFolder[folder] = byFolder[folder]||[]).push(n);
  });
  let body = `# Mapa de Contenido (MOC)\n\n_Actualizado: ${new Date().toLocaleString("es-PE")}_\n\n`;
  Object.entries(byFolder).sort(([a],[b])=>a.localeCompare(b)).forEach(([folder, ns]) => {
    body += `## 📁 ${folder}\n\n`;
    ns.forEach(n => { body += `- [[${n.title}]] — \`${n.path}\`\n`; });
    body += "\n";
  });
  body += `\n---\n_${notes.length} notas · Gestionado por Agente Archivista_\n`;
  Vault.upsertNote(VaultPath.moc(), { title:"MOC — Mapa de Contenido", body, tags:["moc","indice"], auto:true });
}

// ─── AI chat with archivist ───────────────────────────────────────────────────
async function askArchivist(question) {
  const notes = Vault.allNotes().slice(0,20); // recent notes as context
  const context = notes.map(n => `Ruta: ${n.path}\nContenido:\n${n.body.slice(0,300)}`).join("\n\n---\n\n");
  const system = ARCHIVIST_PERSONA.persona + "\n\n" +
    "Bóveda actual (últimas notas):\n\n" + context + "\n\n" +
    "Responde en español. Sé conciso y señala la ruta exacta de la nota cuando sea relevante.";
  return await callClaude(system, question);
}

// ─── Seed default structure ───────────────────────────────────────────────────
function seedVault() {
  const v = Vault.get();
  if (Object.keys(v.notes).length > 0) return; // already seeded

  // Agents
  (window.AGENTS||[]).filter(a=>a.type!=="agent-future").forEach(a => {
    const agentId = a.id;
    Vault.upsertNote(VaultPath.agentSkills(agentId), {
      title: `Skills — ${a.name}`,
      body: `# Skills — ${a.name}\n\nRol: ${a.role}\n\nEste documento registra todas las skills operativas y mejoras validadas por el GG.\n`,
      tags: ["skills", agentId], auto:true,
    });
  });

  // Projects
  (window.PROJECTS||[]).forEach(p => {
    Vault.upsertNote(VaultPath.projectReq(p.id), {
      title: `Solicitudes — ${p.id}`,
      body: `# Solicitudes — ${p.id} · ${p.name}\n\nCliente: ${p.client}\n${p.summary||""}\n\n_Sin solicitudes registradas aún._\n`,
      tags: ["proyecto","solicitud",p.id], auto:true,
    });
  });

  // Knowledge placeholder
  Vault.upsertNote("/Conocimiento/README.md", {
    title: "Conocimiento — README",
    body: "# Base de Conocimiento\n\nCriterios técnicos validados por el GG. Cada nota es un criterio reutilizable que los agentes incorporan en sus respuestas.\n",
    tags: ["conocimiento"], auto:true,
  });

  // Bitácora placeholder
  Vault.upsertNote(VaultPath.bitacora(Date.now()), {
    title: `Bitácora — ${new Date().toISOString().slice(0,10)}`,
    body: `# Bitácora — ${new Date().toLocaleDateString("es-PE",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}\n\nRegistro cronológico de decisiones del GG.\n`,
    tags: ["bitacora"], auto:true,
  });

  rebuildMOC();
}

// ─── Register the archivist as a live agent ───────────────────────────────────
function registerArchivistAgent() {
  if (!window.IGAgents) return;
  const exists = IGAgents.getAll().find(a => a.id === "aa");
  if (!exists) {
    const s = IGStore.get();
    const full = {
      id:"aa", name:"Agente Archivista", initials:"AA", role:"Gestión de bóveda y memoria",
      color:"#4338ca", model:"llama3.2", parentId:"gg", skills:[], type:"agent",
      status:"active", core:false,
      description:"Organiza y preserva toda la información de la oficina técnica en la bóveda Obsidian.",
      tone: ARCHIVIST_PERSONA.persona,
    };
    IGStore.set({ customAgents: [...(s.customAgents||[]), full] });
    syncPersonas && syncPersonas();
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
seedVault();
registerArchivistAgent();

// Subscribe to store events to auto-archive
IGStore.subscribe(() => {
  // Rebuild MOC on every change (debounced in practice)
  setTimeout(rebuildMOC, 800);
});

Object.assign(window, {
  Vault, VaultPath,
  archiveApproval, archiveKnowledge, archiveSkill, archiveChat,
  archiveProjectRequest, rebuildMOC, askArchivist,
  ARCHIVIST_PERSONA,
});
