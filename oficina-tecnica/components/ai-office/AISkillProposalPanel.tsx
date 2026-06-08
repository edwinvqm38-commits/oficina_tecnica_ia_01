import type { SkillProposal } from "@/lib/ai-office/skillWorkflowTypes";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Borrador", className: "bg-slate-50 text-slate-500 border-slate-200" },
  "pending-approval": { label: "Pendiente aprobación", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Aprobada", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  observed: { label: "Observada", className: "bg-sky-50 text-sky-700 border-sky-200" },
  rejected: { label: "Rechazada", className: "bg-red-50 text-red-700 border-red-200" },
  deprecated: { label: "Deprecada", className: "bg-slate-50 text-slate-400 border-slate-200" },
};

const agentNames: Record<string, string> = {
  "project-management": "Project Management",
  "cost-engineer": "Ing. Costos y Presupuestos",
};

type Props = { proposals: SkillProposal[] };

export function AISkillProposalPanel({ proposals }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2.5">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Capacidades nuevas
        </p>
        <p className="text-sm font-semibold text-slate-800">Skills propuestas</p>
      </div>

      <div className="space-y-2.5 px-3 py-3">
        {proposals.map((proposal) => {
          const status = statusConfig[proposal.status] ?? { label: proposal.status, className: "bg-slate-50 text-slate-500 border-slate-200" };

          return (
            <div key={proposal.id} className="overflow-hidden rounded-md border border-sky-100 bg-sky-50/20">
              <div className="h-1 w-full bg-sky-500" />
              <div className="px-3 py-2.5">
                <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 flex-1">{proposal.name}</p>
                  <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <p className="mb-2 text-xs text-slate-400">
                  {agentNames[proposal.ownerAgentId] ?? proposal.ownerAgentId} · {proposal.proposedVersion.label}
                </p>

                <div className="space-y-2.5">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Problema que resuelve
                    </p>
                    <p className="text-xs leading-relaxed text-slate-600">{proposal.problemSolved}</p>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Pasos del workflow
                    </p>
                    <ul className="space-y-1">
                      {proposal.workflowSteps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <span className="flex-shrink-0 font-bold text-blue-500">{i + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Resultado esperado
                    </p>
                    <p className="text-xs leading-relaxed text-slate-600">{proposal.expectedOutput}</p>
                  </div>

                  {proposal.riskNotes.length > 0 && (
                    <div className="rounded-md border border-red-100 bg-red-50/40 px-3 py-2">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-red-600">
                        Notas de riesgo
                      </p>
                      <ul className="space-y-1">
                        {proposal.riskNotes.map((risk, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                            <span className="flex-shrink-0 font-bold text-red-400">!</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    className="w-full rounded-md bg-sky-600 px-3 py-1.5 text-center text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    Aprobar skill propuesta
                  </button>
                  <p className="mt-1.5 text-center text-xs text-slate-400">
                    Acción solo visual · MVP mock
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
