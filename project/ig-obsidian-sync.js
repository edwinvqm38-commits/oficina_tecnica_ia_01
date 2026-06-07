// ig-obsidian-sync.js — Bidirectional sync with Obsidian Local REST API
// Plugin required: https://github.com/coddingtonbear/obsidian-local-rest-api
// API base: https://127.0.0.1:27124   Auth: Bearer <apiKey>
// Loads AFTER ig-archivist.js
// ============================================================================

const ObsidianClient = {
  _baseUrl: "https://127.0.0.1:27124",
  _apiKey:  "",
  _status:  "unknown",  // "unknown" | "online" | "offline" | "no-key"
  _vaultRoot: "",       // optional prefix, e.g. "IA-Gerencial"
  _protocol: "https",   // "https" (27124) | "http" (27123)

  setProtocol(proto) {
    this._protocol = proto;
    this._baseUrl  = proto==="http" ? "http://127.0.0.1:27123" : "https://127.0.0.1:27124";
    IGStore.set({ obsidianProtocol: proto });
  },

  configure(apiKey, vaultRoot="IA-Gerencial") {
    this._apiKey   = apiKey.trim();
    this._vaultRoot = vaultRoot.trim().replace(/^\/|\/$/g,"");
    IGStore.set({ obsidianApiKey:apiKey, obsidianVaultRoot:vaultRoot });
  },

  loadConfig() {
    const s = IGStore.get();
    if (s.obsidianApiKey) this._apiKey    = s.obsidianApiKey;
    if (s.obsidianVaultRoot !== undefined) this._vaultRoot = s.obsidianVaultRoot || "IA-Gerencial";
    if (s.obsidianProtocol) this.setProtocol(s.obsidianProtocol);
  },

  headers() {
    return {
      "Authorization": `Bearer ${this._apiKey}`,
      "Content-Type":  "text/markdown",
      "Accept":        "application/json",
    };
  },

  vaultPath(appPath) {
    // Convert app path "/Proyectos/PRY-001/Solicitudes.md"
    // → Obsidian path "IA-Gerencial/Proyectos/PRY-001/Solicitudes.md"
    const clean = appPath.replace(/^\//, "");
    return this._vaultRoot ? `${this._vaultRoot}/${clean}` : clean;
  },

  // ── Connectivity probe ─────────────────────────────────────────────────────
  async probe() {
    if (!this._apiKey) { this._status = "no-key"; IGStore.set({ obsidianStatus:"no-key" }); return false; }
    try {
      const res = await Promise.race([
        fetch(`${this._baseUrl}/`, { headers:{ Authorization:`Bearer ${this._apiKey}`, Accept:"application/json" } }),
        new Promise((_,r)=>setTimeout(()=>r(new Error("timeout")), 3000)),
      ]);
      if (res.ok || res.status === 200) {
        this._status = "online";
        IGStore.set({ obsidianStatus:"online" });
        return true;
      }
    } catch(e) { console.warn("[Obsidian] probe failed:", e.message); }
    this._status = "offline";
    IGStore.set({ obsidianStatus:"offline" });
    return false;
  },

  isOnline() { return this._status === "online"; },

  // ── Write a note to Obsidian ───────────────────────────────────────────────
  async pushNote(appPath, markdownContent) {
    if (!this.isOnline()) return { ok:false, error:"Obsidian offline o sin clave API" };
    const vPath = encodeURIComponent(this.vaultPath(appPath));
    try {
      const res = await fetch(`${this._baseUrl}/vault/${vPath}`, {
        method:  "PUT",
        headers: this.headers(),
        body:    markdownContent,
      });
      return { ok: res.ok, status: res.status };
    } catch(e) { return { ok:false, error:e.message }; }
  },

  // ── Read a note from Obsidian ──────────────────────────────────────────────
  async pullNote(appPath) {
    if (!this.isOnline()) return null;
    const vPath = encodeURIComponent(this.vaultPath(appPath));
    try {
      const res = await fetch(`${this._baseUrl}/vault/${vPath}`, {
        headers: { Authorization:`Bearer ${this._apiKey}`, Accept:"text/markdown" },
      });
      if (!res.ok) return null;
      return await res.text();
    } catch { return null; }
  },

  // ── List notes in a folder ─────────────────────────────────────────────────
  async listFolder(folderPath="") {
    if (!this.isOnline()) return [];
    const vPath = this._vaultRoot ? `${this._vaultRoot}/${folderPath}` : folderPath;
    try {
      const res = await fetch(
        `${this._baseUrl}/vault/${encodeURIComponent(vPath)}/`,
        { headers:{ Authorization:`Bearer ${this._apiKey}`, Accept:"application/json" } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.files || [];
    } catch { return []; }
  },
};

// ── Load saved config on startup ──────────────────────────────────────────────
ObsidianClient.loadConfig();
ObsidianClient.probe();
setInterval(() => ObsidianClient.probe(), 30_000);

// ── Push queue: batch pending notes every 5s ──────────────────────────────────
let _pushQueue = new Set();
let _pushTimer = null;

function queueObsidianPush(appPath) {
  if (!IGStore.get().obsidianEnabled) return;
  _pushQueue.add(appPath);
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(flushObsidianQueue, 5000);
}

async function flushObsidianQueue() {
  if (!ObsidianClient.isOnline() || _pushQueue.size === 0) return;
  const paths = [..._pushQueue];
  _pushQueue.clear();
  let pushed = 0;
  for (const path of paths) {
    const note = Vault.getNote(path);
    if (!note) continue;
    const res = await ObsidianClient.pushNote(path, note.body);
    if (res.ok) {
      Vault.upsertNote(path, { ...note, exportedAt:Date.now() });
      pushed++;
    }
  }
  if (pushed > 0) {
    IGActions.notify({ kind:"success", title:`Obsidian sync: ${pushed} notas`, body:"Sincronizado automáticamente", route:"vault" });
    IGStore.set({ lastObsidianSyncTs: Date.now() });
  }
}

// ── Subscribe vault changes → auto-push to Obsidian ──────────────────────────
let _prevNoteKeys = new Set();
IGStore.subscribe(() => {
  if (!IGStore.get().obsidianEnabled) return;
  const notes  = Vault.allNotes();
  const newKeys = new Set(notes.map(n=>n.path));
  notes.forEach(n => {
    if (!_prevNoteKeys.has(n.path) || !n.exportedAt || n.exportedAt < n.ts) {
      queueObsidianPush(n.path);
    }
  });
  _prevNoteKeys = newKeys;
});

// ── Pull: agent skills from Obsidian → inject into agent context ──────────────
async function pullAgentSkillsFromObsidian(agentId) {
  const path = VaultPath.agentSkills(agentId);
  const content = await ObsidianClient.pullNote(path);
  if (!content) return null;
  // Update local vault + inject into AGENT_PERSONAS as expertise
  Vault.upsertNote(path, { title:`Skills — ${agentId.toUpperCase()}`, body:content, tags:["skills",agentId] });
  if (window.AGENT_PERSONAS && window.AGENT_PERSONAS[agentId]) {
    window.AGENT_PERSONAS[agentId].expertise =
      `${window.AGENT_PERSONAS[agentId].expertise}\n\n[Obsidian skills]\n${content.slice(0,2000)}`;
  }
  return content;
}

async function pullAllSkillsFromObsidian() {
  const agents = (window.IGAgents ? IGAgents.getAll() : []).filter(a => a.status==="active");
  const results = [];
  for (const a of agents) {
    const c = await pullAgentSkillsFromObsidian(a.id);
    if (c) results.push(a.id);
  }
  if (results.length > 0) {
    IGActions.notify({ kind:"success", title:"Skills importadas de Obsidian", body:`Agentes: ${results.join(", ")}`, route:"memory" });
  }
  return results;
}

// ── Full manual sync ──────────────────────────────────────────────────────────
async function syncAllToObsidian() {
  if (!ObsidianClient.isOnline()) return { pushed:0, error:"Obsidian offline" };
  const notes = Vault.allNotes();
  let pushed = 0, failed = 0;
  for (const note of notes) {
    const res = await ObsidianClient.pushNote(note.path, note.body);
    if (res.ok) { Vault.upsertNote(note.path, { ...note, exportedAt:Date.now() }); pushed++; }
    else failed++;
  }
  IGStore.set({ lastObsidianSyncTs:Date.now() });
  IGActions.logTimeline({ type:"knowledge", title:`Sync completo a Obsidian: ${pushed} notas`, result:"ok" });
  return { pushed, failed };
}


Object.assign(window, {
  ObsidianClient, queueObsidianPush, flushObsidianQueue,
  pullAgentSkillsFromObsidian, pullAllSkillsFromObsidian, syncAllToObsidian,
});
