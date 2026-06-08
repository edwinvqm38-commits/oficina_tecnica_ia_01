import type { ApprovalRequest } from "@/lib/ai-office/approvalWorkflowTypes";

const riskConfig: Record<string, { label: string; className: string; barColor: string }> = {
  critical: { label: "Riesgo crítico", className: "bg-red-50 text-red-700 border-red-200", barColor: "bg-red-500" },
  high: { label: "Riesgo alto", className: "bg-orange-50 text-orange-700 border-orange-200", barColor: "bg-orange-500" },
  medium: { label: "Riesgo medio", className: "bg-amber-50 text-amber-700 border-amber-200", barColor: "bg-amber-400" },
  low: { label: "Riesgo bajo", className: "bg-emerald-50 text-emerald-700 border-emerald-200", barColor: "bg-emerald-500" },
};

const agentNames: Record<string, string> = {
  "project-management": "Project Management",
  "cost-engineer": "Ing. Costos y Presupuestos",
};

type Props = { approvals: ApprovalRequest[] };

export function AIApprovalWorkflowPanel({ approvals }: Props) {
  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <div>
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Decisión gerencial
          </p>
          <p className="text-sm font-semibold text-slate-800">Aprobaciones pendientes</p>
        </div>
        {pendingCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white">
            {pendingCount}
          </span>
        )}
      </div>

      <div className="space-y-2.5 px-3 py-3">
        {approvals.map((approval) => {
          const risk = riskConfig[approval.riskLevel] ?? { label: approval.riskLevel, className: "bg-slate-50 text-slate-600 border-slate-200", barColor: "bg-slate-400" };
          const isPending = approval.status === "pending";

          return (
            <div key={approval.id} className="overflow-hidden rounded-md border border-orange-100 bg-orange-50/20">
              <div className={`h-1 w-full ${risk.barColor}`} />
              <div className="px-3 py-2.5">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 flex-1">{approval.title}</p>
                  <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${risk.className}`}>
                    {risk.label}
                  </span>
                </div>

                <div className="mb-2 space-y-1.5">
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-600">Solicitado por:</span>{" "}
                    {agentNames[approval.requestedByAgentId] ?? approval.requestedByAgentId}
                  </p>
                    <p className="text-xs leading-relaxed text-slate-500">
                    <span className="font-semibold text-slate-600">Razón:</span> {approval.reason}
                  </p>
                    <p className="text-xs leading-relaxed text-slate-500">
                    <span className="font-semibold text-slate-600">Impacto:</span> {approval.decisionImpact}
                  </p>
                </div>

                <p className="mb-3 text-xs text-slate-400">{approval.createdAtLabel}</p>

                {isPending ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        className="rounded-md bg-blue-700 px-2 py-1.5 text-center text-[11px] font-semibold text-white transition-colors hover:bg-blue-800"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-center text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                      >
                        Observar
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-center text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100"
                      >
                        Rechazar
                      </button>
                    </div>
                    <p className="mt-2 text-center text-xs text-slate-400">
                      Acciones solo visuales · MVP mock
                    </p>
                  </>
                ) : (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500 text-center">
                    Estado: {approval.status}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
