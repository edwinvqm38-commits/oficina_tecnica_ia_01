"use client";

import { useEffect, useState } from "react";
import { aiAgentsMock } from "@/lib/ai-office/aiAgentsMock";
import { AIAgentCard } from "./AIAgentCard";
import type { AIAgent } from "@/lib/ai-office/aiOfficeTypes";

const CUSTOM_AGENTS_KEY = "ot:org:custom-agents";

function readCustomAgents(): AIAgent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_AGENTS_KEY);
    return raw ? JSON.parse(raw) as AIAgent[] : [];
  } catch {
    return [];
  }
}

export function AIAgentOrgChart() {
  const [manager, ...baseAgents] = aiAgentsMock;
  const [customAgents, setCustomAgents] = useState<AIAgent[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", role: "", focus: "" });
  const agents = [...baseAgents, ...customAgents];
  const connectorColumns = `repeat(${Math.max(agents.length, 1)}, minmax(0, 1fr))`;

  useEffect(() => {
    setCustomAgents(readCustomAgents());
  }, []);

  function saveCustomAgents(next: AIAgent[]) {
    setCustomAgents(next);
    localStorage.setItem(CUSTOM_AGENTS_KEY, JSON.stringify(next));
  }

  function addAgentProposal() {
    const name = draft.name.trim();
    const role = draft.role.trim();
    const focus = draft.focus.trim();
    if (!name || !role || !focus) return;
    const next: AIAgent = {
      id: `custom-${Date.now().toString(36)}`,
      name,
      role,
      focus,
      status: "needs-approval",
      autonomyLevel: "Propuesta pendiente",
      currentTask: "Pendiente de prompt, permisos y activacion en chat",
      confidence: 40,
      kpis: [
        { label: "Estado", value: "Propuesto" },
        { label: "Chat", value: "Pendiente" },
      ],
    };
    saveCustomAgents([...customAgents, next]);
    setDraft({ name: "", role: "", focus: "" });
    setOpen(false);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Organigrama IA
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Supervision ejecutiva con agentes subordinados
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Esta vista define jerarquia y propuestas. Para revisar estado operativo, alertas y capacidades activas usa la pestaña Agentes.
          </p>
        </div>
        <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 sm:inline-flex">
          Autonomia supervisada
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          + Agregar agente
        </button>
      </div>

      <div className="mx-auto max-w-3xl">
        <AIAgentCard agent={manager} variant="leader" />
      </div>

      <div className="relative mx-auto mt-2 hidden max-w-3xl px-8 lg:block">
        <div className="mx-auto h-10 w-px bg-slate-300" />
        <div className="mx-auto h-px w-5/6 bg-slate-300" />
        <div className="grid" style={{ gridTemplateColumns: connectorColumns }}>
          {agents.map((agent) => (
            <div key={agent.id} className="mx-auto h-8 w-px bg-slate-300" />
          ))}
        </div>
      </div>

      <div className="mx-auto h-8 w-px bg-slate-300 lg:hidden" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {agents.map((agent) => (
          <AIAgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-950">Proponer nuevo agente</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Se agrega al organigrama como propuesta. Para activarlo en chat se debe crear su prompt y permisos.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-900">
                Cerrar
              </button>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Nombre
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Ej. Ingeniero Civil"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Rol
                <input
                  value={draft.role}
                  onChange={(event) => setDraft((prev) => ({ ...prev, role: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Ej. Agente especialista"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Enfoque
                <textarea
                  value={draft.focus}
                  onChange={(event) => setDraft((prev) => ({ ...prev, focus: event.target.value }))}
                  className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Describe qué revisará, cuándo debe alertar y con qué módulos se relaciona."
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">
                Cancelar
              </button>
              <button type="button" onClick={addAgentProposal} className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white">
                Guardar propuesta
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
