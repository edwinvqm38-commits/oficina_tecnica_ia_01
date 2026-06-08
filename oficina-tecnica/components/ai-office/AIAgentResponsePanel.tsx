import type { AgentResponse } from "@/lib/ai-office/agentResponseTypes";
import type { SourceReference } from "@/lib/ai-office/sourceReferenceTypes";

const riskConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Riesgo bajo", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  medium: { label: "Riesgo medio", className: "bg-amber-50 text-amber-700 border-amber-200" },
  high: { label: "Riesgo alto", className: "bg-red-50 text-red-700 border-red-200" },
};

const confidencePercent: Record<string, string> = {
  high: "75%",
  medium: "50%",
  low: "25%",
  insufficient: "10%",
};

const confidenceColor: Record<string, string> = {
  high: "#10b981",
  medium: "#3b82f6",
  low: "#f59e0b",
  insufficient: "#ef4444",
};

const confidenceLabel: Record<string, string> = {
  high: "Confianza alta",
  medium: "Confianza media",
  low: "Confianza baja",
  insufficient: "Insuficiente",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  "ready-for-review": { label: "Listo para revisión", className: "bg-blue-50 text-blue-700 border-blue-200" },
  draft: { label: "Borrador", className: "bg-slate-50 text-slate-500 border-slate-200" },
  "needs-clarification": { label: "Requiere aclaración", className: "bg-amber-50 text-amber-700 border-amber-200" },
  final: { label: "Final", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

type Props = {
  response: AgentResponse;
  sources: SourceReference[];
  accentColor?: "blue" | "orange";
};

export function AIAgentResponsePanel({ response, sources, accentColor = "blue" }: Props) {
  const isOrange = accentColor === "orange";
  const borderAccent = isOrange ? "border-l-orange-500" : "border-l-blue-700";
  const summaryBg = isOrange ? "bg-orange-50/60 border-orange-100" : "bg-blue-50/60 border-blue-100";
  const agentTextColor = isOrange ? "text-orange-700" : "text-blue-700";
  const avatarBg = isOrange ? "bg-orange-600" : "bg-blue-700";
  const status = statusConfig[response.status] ?? { label: response.status, className: "bg-slate-50 text-slate-500 border-slate-200" };
  const sourcesMap: Record<string, SourceReference> = {};
  sources.forEach((s) => { sourcesMap[s.id] = s; });

  return (
    <div className={`overflow-hidden rounded-lg border border-l-4 border-slate-200 bg-white shadow-sm ${borderAccent}`}>
      {/* Agent Header */}
      <div className="border-b border-slate-100 px-3.5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-md ${avatarBg} text-[11px] font-bold text-white`}>
              {response.agentId === "cost-engineer" ? "IC" : "PM"}
            </div>
            <div>
              <p className={`text-sm font-semibold ${agentTextColor}`}>{response.agentName}</p>
              <p className="text-xs text-slate-400">{response.createdAtLabel}</p>
            </div>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${status.className}`}>
            {status.label}
          </span>
        </div>

        <div className={`mt-2.5 rounded-md border px-3 py-2 ${summaryBg}`}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Resumen ejecutivo
          </p>
          <p className="text-sm leading-6 text-slate-800">{response.executiveSummary}</p>
        </div>
      </div>

      <div className="space-y-3.5 px-3.5 py-3.5">
        {/* Findings */}
        {response.findings.map((finding) => (
          <div key={finding.id}>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-100" />
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Hallazgo · {finding.title}
              </p>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            <div className="space-y-2">
              {/* Evidence */}
              {finding.evidence.map((ev) => (
                <div key={ev.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Evidencia
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: confidencePercent[ev.confidence] ?? "50%",
                            backgroundColor: confidenceColor[ev.confidence] ?? "#94a3b8",
                          }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">
                        {confidenceLabel[ev.confidence] ?? ev.confidence}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-slate-700 sm:text-sm">{ev.summary}</p>
                  {ev.sourceIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {ev.sourceIds.map((sid) => {
                        const src = sourcesMap[sid];
                        return src ? (
                          <span key={sid} className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500">
                            <span className="text-slate-400">📄</span> {src.title}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              ))}

              {/* Assumptions */}
              {finding.assumptions.map((assump) => (
                <div key={assump.id} className="rounded-md border border-amber-100 bg-amber-50/40 px-3 py-2">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700">Supuesto</p>
                    {assump.requiresValidation && (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                        Requiere validación
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-5 text-slate-700 sm:text-sm">{assump.statement}</p>
                  <p className="text-xs text-slate-500 mt-1.5 italic">Razón: {assump.reason}</p>
                </div>
              ))}

              {/* Interpretation */}
              <div className="rounded-md border border-purple-100 bg-purple-50/30 px-3 py-2">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-purple-700">
                  Interpretación
                </p>
                <p className="text-xs leading-5 text-slate-700 sm:text-sm">
                  {finding.interpretation.statement}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Recommendations */}
        {response.recommendations.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-100" />
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Recomendaciones
              </p>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            <div className="space-y-2">
              {response.recommendations.map((rec) => {
                const risk = riskConfig[rec.riskLevel] ?? { label: rec.riskLevel, className: "bg-slate-50 text-slate-600 border-slate-200" };
                return (
                  <div key={rec.id} className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 flex-1">{rec.summary}</p>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${risk.className}`}>
                          {risk.label}
                        </span>
                        {rec.approvalRequired && (
                          <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                            Requiere aprobación GG
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mb-2 text-xs italic leading-5 text-slate-500">{rec.rationale}</p>
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Próximas acciones
                      </p>
                      <ul className="space-y-1.5">
                        {rec.nextActions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs leading-5 text-slate-600 sm:text-sm">
                            <span className="text-blue-500 font-bold mt-0.5 text-xs flex-shrink-0">{i + 1}.</span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Questions */}
        {response.questions.length > 0 && (
          <div className="rounded-md border border-sky-100 bg-sky-50/40 px-3 py-2.5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-700">
              Preguntas al Gerente General
            </p>
            <div className="space-y-2.5">
              {response.questions.map((q) => (
                <div key={q.id}>
                  <p className="text-sm text-slate-800 leading-relaxed italic">&ldquo;{q.question}&rdquo;</p>
                  <p className="text-xs text-slate-500 mt-1">Razón: {q.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
