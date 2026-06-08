import { aiApprovalsMock } from "@/lib/ai-office/aiApprovalsMock";
import type { AIApproval } from "@/lib/ai-office/aiOfficeTypes";

const riskStyles: Record<AIApproval["risk"], string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-orange-200 bg-orange-50 text-orange-700",
  high: "border-red-200 bg-red-50 text-red-700",
};

export function AIApprovalPanel() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
        Aprobaciones pendientes
      </p>
      <h2 className="mt-1 text-xl font-semibold text-slate-950">
        Nada critico sin autorizacion
      </h2>
      <div className="mt-5 space-y-3">
        {aiApprovalsMock.map((approval) => (
          <article
            key={approval.id}
            className={[
              "rounded-md border p-4 transition hover:shadow-md",
              approval.risk === "high"
                ? "border-red-200 bg-red-50/30"
                : "border-slate-200 bg-white",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{approval.title}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Solicitante: {approval.requester}
                </p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${riskStyles[approval.risk]}`}
              >
                {approval.risk}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {approval.impact}
            </p>
            <div className="mt-4 flex gap-2">
              <button className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 hover:shadow-sm">
                Revisar
              </button>
              <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                Posponer
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
