"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listAgentTimelineEvents,
  type AgentTimelineEvent,
} from "@/lib/ai-office/agentIntelligenceRepository";

type TypeFilter = "all" | AgentTimelineEvent["type"];

const TYPE_LABEL: Record<AgentTimelineEvent["type"], string> = {
  conversation: "Conversación",
  knowledge: "Conocimiento",
  skill: "Skill",
  approval: "Aprobación",
  performance: "Desempeño",
};

function typeClass(type: AgentTimelineEvent["type"]): string {
  if (type === "approval") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (type === "skill") return "border-blue-200 bg-blue-50 text-blue-700";
  if (type === "knowledge") return "border-amber-200 bg-amber-50 text-amber-700";
  if (type === "performance") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function formatDateTime(value: string | null): string {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function entityHref(entity: string | null): string | null {
  if (!entity) return null;
  if (/^RQ-/i.test(entity)) return `/requerimientos?rqCode=${encodeURIComponent(entity)}`;
  if (/^(FOR-|COT-|Q-)/i.test(entity)) return `/cotizaciones?quotationCode=${encodeURIComponent(entity)}`;
  return null;
}

function TimelineRow({ event }: { event: AgentTimelineEvent }) {
  const href = entityHref(event.relatedEntity);
  return (
    <div className="relative grid gap-2 border-l border-slate-200 pl-4 md:grid-cols-[145px_1fr]">
      <div className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full bg-blue-600" />
      <div className="text-xs font-semibold text-slate-500">{formatDateTime(event.occurredAt)}</div>
      <article className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeClass(event.type)}`}>{TYPE_LABEL[event.type]}</span>
          <span className="text-xs font-semibold text-slate-600">{event.sourceAgentId?.toUpperCase() ?? "Sistema"}</span>
          {event.targetAgentId ? <span className="text-xs text-slate-400">→ {event.targetAgentId.toUpperCase()}</span> : null}
          {event.status ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{event.status}</span> : null}
        </div>
        <p className="text-sm leading-6 text-slate-800">{event.summary}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
          <span>Fuente: {event.source}</span>
          {event.relatedEntity ? (
            href ? <Link href={href} className="font-semibold text-blue-700">{event.relatedEntity}</Link> : <span>Entidad: {event.relatedEntity}</span>
          ) : null}
        </div>
      </article>
    </div>
  );
}

export function AIOrchestrationTimeline() {
  const [events, setEvents] = useState<AgentTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [agentFilter, setAgentFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  function refreshEvents() {
    setLoading(true);
    listAgentTimelineEvents()
      .then((result) => {
        setEvents(result.source === "supabase" ? result.rows : []);
        setWarning(result.warning);
      })
      .catch(() => {
        setEvents([]);
        setWarning("No se pudieron cargar eventos reales de trazabilidad.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    listAgentTimelineEvents()
      .then((result) => {
        if (cancelled) return;
        setEvents(result.source === "supabase" ? result.rows : []);
        setWarning(result.warning);
      })
      .catch(() => {
        if (cancelled) return;
        setEvents([]);
        setWarning("No se pudieron cargar eventos reales de trazabilidad.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const agentOptions = useMemo(
    () => Array.from(new Set(events.map((event) => event.sourceAgentId).filter((value): value is string => Boolean(value)))).sort(),
    [events],
  );

  const filtered = useMemo(() => {
    const entity = entityFilter.trim().toLowerCase();
    return events.filter((event) => {
      if (typeFilter !== "all" && event.type !== typeFilter) return false;
      if (agentFilter && event.sourceAgentId !== agentFilter && event.targetAgentId !== agentFilter) return false;
      if (entity && !`${event.relatedEntity ?? ""} ${event.summary}`.toLowerCase().includes(entity)) return false;
      return true;
    });
  }, [agentFilter, entityFilter, events, typeFilter]);

  const typeOptions: Array<{ id: TypeFilter; label: string }> = [
    { id: "all", label: "Todos" },
    { id: "conversation", label: "Conversación" },
    { id: "knowledge", label: "Conocimiento" },
    { id: "skill", label: "Skill" },
    { id: "approval", label: "Aprobación" },
    { id: "performance", label: "Desempeño" },
  ];

  return (
    <section className="space-y-3">
      <div className="page-header">
        <div className="page-header-left">
          <p className="page-eyebrow">Trazabilidad</p>
          <h1 className="page-title">Línea de tiempo de la Oficina IA</h1>
          <p className="page-desc">Eventos reales derivados de conversaciones, conocimiento, skills y desempeño registrados.</p>
        </div>
        <button type="button" onClick={refreshEvents} className="btn btn--ghost btn--sm">Actualizar</button>
      </div>

      {warning ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{warning}</div> : null}

      <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700">
            {typeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)} className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700">
            <option value="">Todos los agentes</option>
            {agentOptions.map((agent) => <option key={agent} value={agent}>{agent.toUpperCase()}</option>)}
          </select>
          <input value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)} placeholder="Proyecto / RQ / Cotización" className="h-8 min-w-56 rounded-md border border-slate-300 px-2 text-xs text-slate-700" />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">
        {loading ? (
          <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">Cargando eventos...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Aún no existen eventos de colaboración registrados.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((event) => <TimelineRow key={event.id} event={event} />)}
          </div>
        )}
      </div>
    </section>
  );
}
