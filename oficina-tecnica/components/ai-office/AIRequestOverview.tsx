import type { AgentRequest } from "@/lib/ai-office/agentRequestTypes";

const priorityConfig: Record<string, { label: string; className: string }> = {
  critical: { label: "Crítico", className: "bg-red-50 text-red-700 border-red-200" },
  high: { label: "Alto", className: "bg-orange-50 text-orange-700 border-orange-200" },
  medium: { label: "Medio", className: "bg-amber-50 text-amber-700 border-amber-200" },
  low: { label: "Bajo", className: "bg-slate-50 text-slate-600 border-slate-200" },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  "in-review": { label: "En revisión", className: "bg-blue-50 text-blue-700 border-blue-200" },
  submitted: { label: "Enviada", className: "bg-slate-50 text-slate-600 border-slate-200" },
  triaged: { label: "Triada", className: "bg-purple-50 text-purple-700 border-purple-200" },
  answered: { label: "Respondida", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  approved: { label: "Aprobada", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rechazada", className: "bg-red-50 text-red-700 border-red-200" },
  draft: { label: "Borrador", className: "bg-slate-50 text-slate-500 border-slate-200" },
  "waiting-for-manager": { label: "Espera gerencia", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

const agentLabels: Record<string, { label: string; initials: string }> = {
  "cost-engineer": { label: "Ing. Costos y Presupuestos", initials: "IC" },
  "project-management": { label: "Project Management", initials: "PM" },
};

type Props = { request: AgentRequest };

export function AIRequestOverview({ request }: Props) {
  const priority = priorityConfig[request.priority] ?? { label: request.priority, className: "bg-slate-50 text-slate-600 border-slate-200" };
  const status = statusConfig[request.status] ?? { label: request.status, className: "bg-slate-50 text-slate-500 border-slate-200" };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-3.5 py-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">
            Solicitud Gerencial · {request.id}
          </p>
          <h2 className="text-sm font-semibold text-slate-950 sm:text-base">{request.title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {request.organization} · {request.projectLabel}
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${priority.className}`}>
            Prioridad {priority.label}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${status.className}`}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 px-3.5 py-3 lg:grid-cols-3">
        <div className="space-y-2.5 lg:col-span-2">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Solicitud del Gerente General
            </p>
            <p className="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm italic leading-6 text-slate-800">
              &ldquo;{request.question}&rdquo;
            </p>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Resultado esperado
            </p>
            <p className="text-xs leading-5 text-slate-600 sm:text-sm">{request.expectedOutcome}</p>
          </div>
        </div>

        <div className="space-y-2.5">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Agentes asignados
            </p>
            <div className="space-y-1.5">
              {request.assignedAgentIds.map((id) => {
                const agent = agentLabels[id];
                return (
                  <div key={id} className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-blue-700 text-[11px] font-bold text-white">
                      {agent?.initials ?? id.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-slate-700">{agent?.label ?? id}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Notas de contexto
            </p>
            <ul className="space-y-1.5">
              {request.contextNotes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                  <span className="text-slate-300 mt-0.5 font-bold">·</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-400">Creado: {request.createdAtLabel}</p>
        </div>
      </div>
    </div>
  );
}
