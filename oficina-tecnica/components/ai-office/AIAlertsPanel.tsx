import { aiAlertsMock } from "@/lib/ai-office/aiAlertsMock";
import type { AIAlert } from "@/lib/ai-office/aiOfficeTypes";

const severityStyles: Record<AIAlert["severity"], string> = {
  critical: "border-red-200 bg-red-50 text-red-700",
  warning: "border-orange-200 bg-orange-50 text-orange-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

const severityBorders: Record<AIAlert["severity"], string> = {
  critical: "border-l-red-500",
  warning: "border-l-orange-500",
  info: "border-l-blue-500",
};

const severitySymbols: Record<AIAlert["severity"], string> = {
  critical: "!",
  warning: "?",
  info: "i",
};

const severityLabels: Record<AIAlert["severity"], string> = {
  critical: "Critica",
  warning: "Advertencia",
  info: "Informativa",
};

export function AIAlertsPanel() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Alertas
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Senales para gerencia
          </h2>
        </div>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
          {aiAlertsMock.length} activas
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {aiAlertsMock.map((alert) => (
          <article
            key={alert.id}
            className={`rounded-md border border-l-4 border-slate-200 p-3 ${severityBorders[alert.severity]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${severityStyles[alert.severity]}`}
                >
                  {severitySymbols[alert.severity]}
                </span>
                <div>
                  <p className="font-semibold text-slate-950">{alert.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {alert.message}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${severityStyles[alert.severity]}`}
                >
                  {severityLabels[alert.severity]}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  {alert.owner}
                </span>
              </div>
            </div>
            <p className="mt-2 pl-10 text-xs text-slate-400">{alert.time}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
