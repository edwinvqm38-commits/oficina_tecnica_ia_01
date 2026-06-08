import type {
  AIApprovalQueueItem,
  AIApprovalQueueRisk,
  AIApprovalQueueStatus,
} from "@/lib/ai-office/aiApprovalsQueueMock";

type AIApprovalQueueProps = {
  approvals: AIApprovalQueueItem[];
};

const riskConfig: Record<AIApprovalQueueRisk, { label: string; className: string }> = {
  low: { label: "Bajo", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  medium: { label: "Medio", className: "border-amber-200 bg-amber-50 text-amber-700" },
  high: { label: "Alto", className: "border-orange-200 bg-orange-50 text-orange-700" },
  critical: { label: "Critico", className: "border-red-200 bg-red-50 text-red-700" },
};

const statusConfig: Record<AIApprovalQueueStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "border-blue-200 bg-blue-50 text-blue-700" },
  observed: { label: "Observada", className: "border-sky-200 bg-sky-50 text-sky-700" },
  approved: { label: "Aprobada", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rechazada", className: "border-red-200 bg-red-50 text-red-700" },
};

const categoryLabel: Record<AIApprovalQueueItem["category"], string> = {
  recommendation: "Recomendacion",
  memory: "Memoria",
  skill: "Skill",
  "critical-decision": "Decision critica",
};

export function AIApprovalQueue({ approvals }: AIApprovalQueueProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">
            Cola transversal
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-slate-950">
            Decisiones pendientes del GG
          </h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
          Acciones visuales
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {approvals.map((approval) => {
          const risk = riskConfig[approval.risk];
          const status = statusConfig[approval.status];

          return (
            <article
              key={approval.id}
              className="grid gap-3 px-3.5 py-3 lg:grid-cols-[minmax(0,1fr)_14rem]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {approval.id}
                  </span>
                  <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    {categoryLabel[approval.category]}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${risk.className}`}>
                    Riesgo {risk.label}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <h3 className="mt-2 text-sm font-semibold text-slate-950">
                  {approval.title}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {approval.summary}
                </p>

                <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                  <InfoLine label="Origen" value={approval.origin} />
                  <InfoLine label="Agente" value={approval.requestedByAgent} />
                  <InfoLine label="Proyecto" value={approval.projectLabel} />
                  <InfoLine label="Tipo" value={approval.decisionType} />
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Decision GG
                </p>
                <p className="mt-1 text-xs text-slate-500">{approval.createdAtLabel}</p>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    className="rounded-md bg-blue-700 px-2 py-1.5 text-[11px] font-semibold text-white"
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800"
                  >
                    Observar
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-700"
                  >
                    Rechazar
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  Solo visual · sin accion real
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="truncate rounded-md bg-slate-50 px-2.5 py-1.5">
      <span className="font-semibold text-slate-700">{label}:</span> {value}
    </p>
  );
}
