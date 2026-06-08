import type { OrchestrationEvent } from "@/lib/ai-office/orchestrationEventTypes";

const severityConfig: Record<string, { label: string; dotColor: string; borderClass: string; bgClass: string }> = {
  info: {
    label: "Info",
    dotColor: "bg-blue-400",
    borderClass: "border-blue-100",
    bgClass: "bg-blue-50/30",
  },
  notice: {
    label: "Aviso",
    dotColor: "bg-sky-400",
    borderClass: "border-sky-100",
    bgClass: "bg-sky-50/30",
  },
  warning: {
    label: "Advertencia",
    dotColor: "bg-amber-400",
    borderClass: "border-amber-100",
    bgClass: "bg-amber-50/30",
  },
  critical: {
    label: "Crítico",
    dotColor: "bg-red-500",
    borderClass: "border-red-100",
    bgClass: "bg-red-50/30",
  },
};

const modeLabels: Record<string, string> = {
  "manager-to-agent": "Gerencia → Agente",
  "agent-to-agent": "Agente → Agente",
  "joint-review": "Revisión conjunta",
  "approval-gate": "Puerta de aprobación",
  "memory-proposal": "Propuesta de memoria",
  "skill-proposal": "Propuesta de skill",
};

const agentAvatars: Record<string, { initials: string; bgClass: string }> = {
  "project-management": { initials: "PM", bgClass: "bg-orange-600" },
  "cost-engineer": { initials: "IC", bgClass: "bg-blue-700" },
  "general-manager": { initials: "GG", bgClass: "bg-slate-700" },
};

type Props = { events: OrchestrationEvent[] };

export function AIOrchestrationTimeline({ events }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
          Orquestación
        </p>
        <p className="text-sm font-semibold text-slate-800">Timeline de colaboración</p>
      </div>

      <div className="px-5 py-5 space-y-4">
        {events.map((event) => {
          const sev = severityConfig[event.severity] ?? {
            label: event.severity,
            dotColor: "bg-slate-400",
            borderClass: "border-slate-100",
            bgClass: "bg-slate-50",
          };

          return (
            <div key={event.id} className={`rounded-lg border ${sev.borderClass} ${sev.bgClass} overflow-hidden`}>
              {/* Event header */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${sev.dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-slate-800">{event.title}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500 flex-shrink-0">
                        {modeLabels[event.mode] ?? event.mode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{event.summary}</p>
                    <p className="text-xs text-slate-400 mt-1">{event.createdAtLabel}</p>
                  </div>
                </div>
              </div>

              {/* Agent messages */}
              {event.agentMessages.length > 0 && (
                <div className="px-4 pb-4 space-y-2">
                  {event.agentMessages.map((msg) => {
                    const from = agentAvatars[msg.fromAgentId];
                    const to = agentAvatars[msg.toAgentId];

                    return (
                      <div key={msg.id} className="rounded-lg border border-white/80 bg-white px-3 py-3">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-md ${from?.bgClass ?? "bg-slate-500"} text-white text-xs font-bold flex-shrink-0`}>
                            {from?.initials ?? "?"}
                          </div>
                          <span className="text-xs text-slate-400 font-bold">→</span>
                          <div className={`flex h-6 w-6 items-center justify-center rounded-md ${to?.bgClass ?? "bg-slate-500"} text-white text-xs font-bold flex-shrink-0`}>
                            {to?.initials ?? "?"}
                          </div>
                          {msg.requiresManagerReview && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-200">
                              Requiere revisión GG
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed italic">&ldquo;{msg.message}&rdquo;</p>
                        {msg.sourceIds.length > 0 && (
                          <p className="text-xs text-slate-400 mt-1">
                            Fuentes: {msg.sourceIds.join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
