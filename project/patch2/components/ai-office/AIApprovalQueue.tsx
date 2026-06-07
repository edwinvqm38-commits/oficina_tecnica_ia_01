import type {
  AIApprovalQueueItem,
  AIApprovalQueueRisk,
  AIApprovalQueueStatus,
} from "@/lib/ai-office/aiApprovalsQueueMock";

type AIApprovalQueueProps = {
  approvals: AIApprovalQueueItem[];
};

// Paleta sobria: riesgo = borde izquierdo semántico, no badges de colores dispersos
const riskBorder: Record<AIApprovalQueueRisk, string> = {
  low:      "border-l-emerald-400",
  medium:   "border-l-amber-400",
  high:     "border-l-orange-500",
  critical: "border-l-red-500",
};

const riskLabel: Record<AIApprovalQueueRisk, string> = {
  low:      "Bajo",
  medium:   "Medio",
  high:     "Alto",
  critical: "Crítico",
};

const riskBadge: Record<AIApprovalQueueRisk, string> = {
  low:      "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium:   "border-amber-200  bg-amber-50  text-amber-700",
  high:     "border-orange-200 bg-orange-50 text-orange-700",
  critical: "border-red-200    bg-red-50    text-red-700",
};

const statusConfig: Record<AIApprovalQueueStatus, { label: string; className: string }> = {
  pending:  { label: "Pendiente", className: "border-blue-200    bg-blue-50    text-blue-700"    },
  observed: { label: "Observada", className: "border-amber-200   bg-amber-50   text-amber-700"   },
  approved: { label: "Aprobada",  className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rechazada", className: "border-red-200     bg-red-50     text-red-700"     },
};

const categoryLabel: Record<AIApprovalQueueItem["category"], string> = {
  recommendation:     "Recomendación",
  memory:             "Memoria",
  skill:              "Skill",
  "critical-decision":"Decisión crítica",
};

export function AIApprovalQueue({ approvals }: AIApprovalQueueProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">
            Cola transversal
          </p>
          <h2 className="text-[13px] font-semibold text-slate-950">
            Decisiones pendientes del GG
          </h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          Acciones visuales
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {approvals.map((approval) => {
          const status = statusConfig[approval.status];
          return (
            <article
              key={approval.id}
              className={`grid gap-3 border-l-4 px-3.5 py-3 lg:grid-cols-[minmax(0,1fr)_13rem] ${riskBorder[approval.risk]}`}
            >
              {/* Main info */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] text-slate-400">{approval.id}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {categoryLabel[approval.category]}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskBadge[approval.risk]}`}>
                    Riesgo {riskLabel[approval.risk]}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <h3 className="mt-1.5 text-[13px] font-semibold text-slate-950">{approval.title}</h3>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">{approval.summary}</p>

                {/* Metadata — plain flex, no background boxes */}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                  <span><b className="text-slate-600">Origen:</b> {approval.origin}</span>
                  <span><b className="text-slate-600">Agente:</b> {approval.requestedByAgent}</span>
                  <span><b className="text-slate-600">Proyecto:</b> {approval.projectLabel}</span>
                  <span><b className="text-slate-600">Tipo:</b> {approval.decisionType}</span>
                </div>
              </div>

              {/* Decision panel */}
              <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Decisión GG
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{approval.createdAtLabel}</p>
                <div className="mt-2 grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    className="rounded bg-blue-700 px-1.5 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-800"
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    className="rounded border border-amber-200 bg-amber-50 px-1.5 py-1.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    Observar
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-200 bg-red-50 px-1.5 py-1.5 text-[10px] font-semibold text-red-700 hover:bg-red-100"
                  >
                    Rechazar
                  </button>
                </div>
                <p className="mt-1.5 text-center text-[9px] text-slate-400">Solo visual · sin acción real</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
