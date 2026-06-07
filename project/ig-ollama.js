// ig-ollama.js — Smart model router: Ollama (real) → Claude (fallback)
// Loads AFTER ig-ai.js. Replaces window.callClaude with ig_callModel.
// ============================================================================

const OllamaClient = {
  baseUrl:  "http://localhost:11434",
  _status:  "unknown",  // "unknown" | "online" | "offline"
  _models:  [],

  // ── Connectivity probe ────────────────────────────────────────────────────
  async probe() {
    try {
      const res = await Promise.race([
        fetch(`${this.baseUrl}/api/tags`, { method:"GET" }),
        new Promise((_,r) => setTimeout(()=>r(new Error("timeout")), 2500)),
      ]);
      if (res.ok) {
        const data = await res.json();
        this._models  = (data.models || []).map(m => m.name);
        this._status  = "online";
        IGStore.set({ ollamaStatus:"online", ollamaModels: this._models });
        return true;
      }
    } catch {}
    this._status = "offline";
    IGStore.set({ ollamaStatus:"offline" });
    return false;
  },

  isOnline()  { return this._status === "online"; },
  getModels() { return this._models; },

  // ── Streaming-free chat ───────────────────────────────────────────────────
  async chat(model, system, userText) {
    const res = await Promise.race([
      fetch(`${this.baseUrl}/api/chat`, {
        method:  "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role:"system", content: system  },
            { role:"user",   content: userText },
          ],
          stream: false,
          options: { temperature: 0.7, num_predict: 1024 },
        }),
      }),
      new Promise((_,r) => setTimeout(()=>r(new Error("timeout 30s")), 30000)),
    ]);
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.message?.content || "").trim();
  },

  // ── List local models ─────────────────────────────────────────────────────
  async listModels() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      const data = await res.json();
      return (data.models||[]).map(m => ({ id:m.name, label:m.name, size: m.size, downloaded:true }));
    } catch { return []; }
  },
};

// ── Smart router: Ollama → Claude fallback ────────────────────────────────────
async function ig_callModel(system, userText, agentId) {
  const useOllama = IGStore.get().ollamaEnabled && OllamaClient.isOnline();

  if (useOllama) {
    const modelId = ModelStore.getAgentModel(agentId) || IGStore.get().activeModelId || "llama3.2";
    // Prefer the exact model name from Ollama's list
    const available = OllamaClient.getModels();
    const model = available.find(m => m.startsWith(modelId)) || modelId;
    try {
      const text = await OllamaClient.chat(model, system, userText);
      IGStore.set({ lastModelUsed: model, lastModelSource:"ollama" });
      return { ok:true, text, source:"ollama", model };
    } catch (e) {
      console.warn("[Ollama] error, falling back to Claude:", e.message);
      IGActions.notify({ kind:"warning", title:"Ollama falló, usando Claude", body:e.message, route:"settings" });
    }
  }

  // Fallback to Claude
  const res = await callClaude(system, userText);
  return { ...res, source:"claude", model:"claude" };
}

// Override the global callClaude used by askAgent / ig-ai.js
// ig-ai.js calls window.callClaude — we swap it here
const _originalCallClaude = window.callClaude;
window.callClaude = async (system, messages) => {
  if (IGStore.get().ollamaEnabled && OllamaClient.isOnline()) {
    try {
      const modelId = IGStore.get().activeModelId || "llama3.2";
      const available = OllamaClient.getModels();
      const model = available.find(m => m.startsWith(modelId)) || modelId;
      const text = await OllamaClient.chat(model, system, messages);
      return { ok:true, text };
    } catch(e) {
      console.warn("[Ollama] callClaude override failed, falling back:", e.message);
    }
  }
  return _originalCallClaude(system, messages);
};

// ── Auto-probe on load + every 30s ───────────────────────────────────────────
OllamaClient.probe();
setInterval(() => OllamaClient.probe(), 30_000);


Object.assign(window, { OllamaClient, ig_callModel });
