// ig-export.js — Incremental export manager + localStorage rotation + storage monitor
// Loads AFTER ig-store.js, ig-archivist.js
// ============================================================================

// ─── Config ──────────────────────────────────────────────────────────────────
const EXPORT_CONFIG = {
  rotateAfterDays:   30,    // archive notes older than this
  maxLocalStorageMB: 3.5,   // warn/rotate if localStorage exceeds this
  maxChatMessages:   50,    // max messages per chat thread before compressing
  summaryKeep:       5,     // keep last N messages after compression
};

// ─── Storage size helper ─────────────────────────────────────────────────────
function getStorageSizeKB() {
  try {
    let total = 0;
    for (const key in localStorage) {
      if (!localStorage.hasOwnProperty(key)) continue;
      total += (localStorage[key].length + key.length) * 2; // UTF-16
    }
    return Math.round(total / 1024);
  } catch { return 0; }
}

function getStoragePercent() {
  const used = getStorageSizeKB();
  const limit = EXPORT_CONFIG.maxLocalStorageMB * 1024;
  return Math.min(100, Math.round((used / limit) * 100));
}

// ─── Pending export tracker ───────────────────────────────────────────────────
const ExportManager = {
  // Get notes that haven't been exported yet (or modified since last export)
  getPending() {
    return Vault.allNotes().filter(n => !n.exportedAt || n.exportedAt < n.ts);
  },

  // Mark notes as exported
  markExported(paths) {
    const now = Date.now();
    const vault = Vault.get();
    const notes = { ...vault.notes };
    paths.forEach(p => {
      if (notes[p]) notes[p] = { ...notes[p], exportedAt: now };
    });
    IGStore.set({ vault: { ...vault, notes } });
  },

  // Export only pending notes as downloadable .md zip (text)
  exportIncremental() {
    const pending = this.getPending();
    if (pending.length === 0) return { count: 0 };

    const lines = [
      `# EXPORTACIÓN INCREMENTAL — OFICINA TÉCNICA`,
      `# Fecha: ${new Date().toLocaleString("es-PE")}`,
      `# Notas nuevas o modificadas: ${pending.length}`,
      `# Para importar en Obsidian: arrastra este archivo a tu bóveda\n`,
    ];

    pending.forEach(n => {
      lines.push(`${"=".repeat(60)}`);
      lines.push(`# ARCHIVO: ${n.path}`);
      lines.push(`# Tags: ${(n.tags||[]).join(", ")}`);
      lines.push(`# Actualizado: ${new Date(n.ts).toLocaleString("es-PE")}`);
      lines.push(`${"=".repeat(60)}\n`);
      lines.push(n.body);
      lines.push("\n");
    });

    const blob = new Blob([lines.join("\n")], { type:"text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `obsidian-delta-${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);

    // Mark as exported
    this.markExported(pending.map(n => n.path));
    IGActions.logTimeline({
      type:   "knowledge",
      title:  `Exportación incremental: ${pending.length} notas`,
      detail: `Delta exportado a Obsidian`,
      result: "ok",
    });
    IGActions.notify({ kind:"success", title:"Exportación completada", body:`${pending.length} notas enviadas a Obsidian`, route:"vault" });

    return { count: pending.length, paths: pending.map(n=>n.path) };
  },

  // Rotate old notes: compress chats, archive old notes
  rotate() {
    const now       = Date.now();
    const cutoffMs  = EXPORT_CONFIG.rotateAfterDays * 24 * 60 * 60 * 1000;
    const vault     = Vault.get();
    const notes     = { ...vault.notes };
    let rotated     = 0;

    Object.keys(notes).forEach(path => {
      const note = notes[path];
      const age  = now - (note.ts || 0);
      // Only rotate if: exported, older than cutoff, not MOC, not Skills
      if (
        note.exportedAt &&
        age > cutoffMs &&
        !path.endsWith("MOC.md") &&
        !path.includes("Skills.md") &&
        !path.includes("README.md")
      ) {
        // Replace with summary stub
        notes[path] = {
          ...note,
          body: `# ${note.title}\n\n_Archivado el ${new Date().toLocaleDateString("es-PE")}. Ver bóveda Obsidian para contenido completo._\n\n**Tags:** ${(note.tags||[]).join(", ")}\n`,
          rotated: true,
          ts: note.ts, // preserve original timestamp
        };
        rotated++;
      }
    });

    if (rotated > 0) {
      IGStore.set({ vault: { ...vault, notes } });
      IGActions.notify({ kind:"info", title:"Memoria rotada", body:`${rotated} notas antiguas comprimidas (ver Obsidian)`, route:"vault" });
    }
    return rotated;
  },

  // Compress long chat threads
  compressChats() {
    const s    = IGStore.get();
    const chats = { ...s.chats };
    let compressed = 0;

    Object.keys(chats).forEach(agentId => {
      const thread = chats[agentId] || [];
      if (thread.length > EXPORT_CONFIG.maxChatMessages) {
        const keep    = thread.slice(-EXPORT_CONFIG.summaryKeep);
        const dropped = thread.length - keep.length;
        // Archive dropped messages to vault before removing
        const summary = `_${dropped} mensajes anteriores archivados en bóveda._`;
        chats[agentId] = [{ role:"system", content:summary, ts:Date.now() }, ...keep];
        compressed++;
      }
    });

    if (compressed > 0) {
      IGStore.set({ chats });
      IGActions.notify({ kind:"info", title:"Chats comprimidos", body:`${compressed} conversaciones rotadas`, route:"vault" });
    }
    return compressed;
  },

  // Full health check: returns status object
  healthCheck() {
    const sizeKB    = getStorageSizeKB();
    const pct       = getStoragePercent();
    const pending   = this.getPending().length;
    const allNotes  = Vault.allNotes().length;
    const s         = IGStore.get();
    const chatMsgs  = Object.values(s.chats||{}).reduce((t,th)=>t+(th?.length||0), 0);

    return {
      sizeKB, pct, pending, allNotes, chatMsgs,
      warning: pct > 70,
      critical: pct > 90,
      needsRotation: allNotes > 80 || chatMsgs > 200,
      lastExport: s.lastExportTs ? new Date(s.lastExportTs).toLocaleString("es-PE") : "Nunca",
    };
  },
};

// ─── Archivista monitor — runs every 60s in background ───────────────────────
let _monitorInterval = null;

function startArchivistMonitor() {
  if (_monitorInterval) return;
  _monitorInterval = setInterval(() => {
    const h = ExportManager.healthCheck();

    // Auto-compress chats if needed
    if (h.chatMsgs > EXPORT_CONFIG.maxChatMessages * 2) {
      ExportManager.compressChats();
    }

    // Warn if storage critical
    if (h.critical) {
      IGActions.notify({
        kind:  "danger",
        title: "⚠️ Memoria crítica",
        body:  `Almacenamiento al ${h.pct}%. Exporta a Obsidian y rota.`,
        route: "vault",
      });
    } else if (h.warning && h.pending > 5) {
      IGActions.notify({
        kind:  "warning",
        title: "Exportación pendiente",
        body:  `${h.pending} notas nuevas listas para Obsidian`,
        route: "vault",
      });
    }
  }, 60_000);
}

startArchivistMonitor();

Object.assign(window, { ExportManager, getStorageSizeKB, getStoragePercent, startArchivistMonitor });
