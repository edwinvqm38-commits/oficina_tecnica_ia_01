"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listAgentConversationActivity,
  type AgentConversationActivity,
} from "@/lib/ai-office/agentActivityRepository";
import {
  createLocalAgentProfileRepository,
  profileToAgent,
  statusLabelForAgent,
  type AgentProfile,
} from "@/lib/ai-office/agentProfileRepository";
import { AGENTS } from "@/lib/data";
import type { Agent } from "@/lib/types";
import { AIPageHeader } from "./AIPageHeader";

type AgentFilter = "active" | "observer" | "proposed";
const profileRepository = createLocalAgentProfileRepository();

function formatDateTime(value: string | null): string {
  if (!value) return "Sin actividad";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin actividad";
  return parsed.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function filterForAgent(agent: Agent, profile?: AgentProfile): AgentFilter {
  if (profile?.status === "observer") return "observer";
  if (profile?.status === "active") return "active";
  if (profile) return "proposed";
  if (agent.status === "active" && agent.type !== "agent-future") return "active";
  return "proposed";
}

function statusLabel(agent: Agent, profile?: AgentProfile): { label: string; className: string } {
  if (profile) {
    const label = statusLabelForAgent(profile.status);
    if (profile.status === "active") return { label, className: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
    if (profile.status === "observer") return { label, className: "bg-sky-50 text-sky-700 ring-sky-200" };
    if (profile.status === "disabled") return { label, className: "bg-rose-50 text-rose-700 ring-rose-200" };
    if (profile.status === "pending_approval") return { label, className: "bg-amber-50 text-amber-700 ring-amber-200" };
    return { label, className: "bg-blue-50 text-blue-700 ring-blue-200" };
  }
  const filter = filterForAgent(agent);
  if (filter === "active") return { label: "Activo", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  return { label: "Propuesto", className: "bg-slate-50 text-slate-600 ring-slate-200" };
}

function agentKey(agentId: string): string {
  return agentId.toLowerCase();
}

function AgentRow({
  agent,
  profile,
  activity,
}: {
  agent: Agent;
  profile?: AgentProfile;
  activity: AgentConversationActivity | undefined;
}) {
  const status = statusLabel(agent, profile);

  return (
    <article className="grid gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm md:grid-cols-[minmax(180px,1fr)_minmax(220px,1.4fr)_120px_130px_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700">
          {agent.initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">{agent.name}</p>
          <p className="truncate text-xs text-slate-500">{agent.role}</p>
        </div>
      </div>

      <p className="text-xs leading-5 text-slate-600">{agent.focus}</p>

      <div>
        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${status.className}`}>{status.label}</span>
      </div>

      <div className="text-xs text-slate-500">
        <p className="font-semibold text-slate-700">{activity?.interactions ?? 0} interacciones</p>
        <p>{formatDateTime(activity?.lastActivityAt ?? null)}</p>
      </div>

      {filterForAgent(agent, profile) === "active" ? (
        <Link className="btn btn--primary btn--sm justify-center" href="/mesa-trabajo">
          Abrir Mesa
        </Link>
      ) : (
        <span className="text-right text-[11px] font-semibold text-slate-400">Pendiente</span>
      )}
    </article>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function AIVirtualOfficePage() {
  const [filter, setFilter] = useState<AgentFilter>("active");
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [activity, setActivity] = useState<AgentConversationActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setProfiles(profileRepository.listProfiles()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    listAgentConversationActivity()
      .then((result) => {
        if (cancelled) return;
        setActivity(result.source === "supabase" ? result.rows : []);
        setWarning(result.warning);
      })
      .catch(() => {
        if (!cancelled) {
          setActivity([]);
          setWarning("No se pudo leer la actividad real de agentes.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const agents = useMemo(() => {
    const byId = new Map(AGENTS.filter((agent) => agent.type !== "human").map((agent) => [agent.id, agent]));
    profiles.forEach((profile) => byId.set(profile.id, profileToAgent(profile)));
    return Array.from(byId.values());
  }, [profiles]);
  const profilesByAgent = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const activityByAgent = useMemo(() => new Map(activity.map((row) => [agentKey(row.agentId), row])), [activity]);
  const filteredAgents = useMemo(() => agents.filter((agent) => filterForAgent(agent, profilesByAgent.get(agent.id)) === filter), [agents, filter, profilesByAgent]);
  const activeCount = agents.filter((agent) => filterForAgent(agent, profilesByAgent.get(agent.id)) === "active").length;
  const observerCount = agents.filter((agent) => filterForAgent(agent, profilesByAgent.get(agent.id)) === "observer").length;
  const proposedCount = agents.filter((agent) => filterForAgent(agent, profilesByAgent.get(agent.id)) === "proposed").length;
  const interactionCount = activity.reduce((sum, row) => sum + row.interactions, 0);
  const modes: Array<{ id: AgentFilter; label: string; count: number }> = [
    { id: "active", label: "Activos", count: activeCount },
    { id: "observer", label: "Observadores", count: observerCount },
    { id: "proposed", label: "Propuestos", count: proposedCount },
  ];

  return (
    <div className="space-y-3">
      <AIPageHeader
        eyebrow="Oficina IA"
        title="Agentes IA"
        description="Perfiles configurados y actividad real registrada en conversaciones."
        actions={
          <div className="grid min-w-56 grid-cols-3 gap-1.5">
            <HeroMetric label="Activos" value={String(activeCount)} />
            <HeroMetric label="Propuestos" value={String(proposedCount)} />
            <HeroMetric label="Interacciones" value={loading ? "..." : String(interactionCount)} />
          </div>
        }
      />

      {warning && (
        <section className="rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-5 text-amber-800">
          {warning} Las metricas de actividad se muestran en cero.
        </section>
      )}

      <section className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
          {modes.map((mode) => (
            <button
              key={mode.id}
              className={[
                "rounded px-2.5 py-1 text-xs font-semibold",
                filter === mode.id ? "bg-blue-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-800",
              ].join(" ")}
              onClick={() => setFilter(mode.id)}
            >
              {mode.label} ({mode.count})
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Sin datos simulados de confianza, ahorros, tareas o alertas.</p>
      </section>

      <section className="rounded-md border border-slate-200 bg-slate-50 p-2.5 shadow-sm">
        <div className="grid gap-2">
          {filteredAgents.length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-white px-3 py-8 text-center">
              <p className="text-sm font-semibold text-slate-950">Sin agentes en esta categoria</p>
              <p className="mt-1 text-xs text-slate-500">No hay registros configurados o actividad real para mostrar.</p>
            </div>
          ) : (
            filteredAgents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                profile={profilesByAgent.get(agent.id)}
                activity={activityByAgent.get(agentKey(agent.id))}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
