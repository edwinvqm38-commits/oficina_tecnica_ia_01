// AIAgentResponsePanel — paleta reducida: sin purple, sin sky.
// Interpretación → slate. Preguntas → blue. Todo sobrio.
import type { AgentResponse } from "@/lib/ai-office/agentResponseTypes";
import type { SourceReference } from "@/lib/ai-office/sourceReferenceTypes";

const riskBadge: Record<string, string> = {
  low:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50  text-amber-700  border-amber-200",
  high:   "bg-red-50    text-red-700    border-red-200",
};

const confidencePercent: Record<string, string> = {
  high: "75%", medium: "50%", low: "25%", insufficient: "10%",
};
const confidenceColor: Record<string, string> = {
  high: "#047857", medium: "#1d4ed8", low: "#b45309", insufficient: "#b91c1c",
};
const confidenceLabel: Record<string, string> = {
  high: "Alta", medium: "Media", low: "Baja", insufficient: "Insuf.",
};

const statusBadge: Record<string, string> = {
  "ready-for-review":    "bg-blue-50   text-blue-700   border-blue-200",
  draft:                 "bg-slate-50  text-slate-500  border-slate-200",
  "needs-clarification": "bg-amber-50  text-amber-700  border-amber-200",
  final:                 "bg-emerald-50 text-emerald-700 border-emerald-200",
};

type Props = {
  response: AgentResponse;
  sources: SourceReference[];
  accentColor?: "blue" | "orange";
};

export function AIAgentResponsePanel({ response, sources, accentColor = "blue" }: Props) {
  const isOrange    = accentColor === "orange";
  const borderL     = isOrange ? "border-l-orange-400" : "border-l-blue-600";
  const summaryBg   = isOrange ? "bg-orange-50/60 border-orange-100" : "bg-blue-50/60 border-blue-100";
  const agentColor  = isOrange ? "text-orange-700"  : "text-blue-700";
  const avatarBg    = isOrange ? "bg-orange-600"    : "bg-blue-700";
  const statusCls   = statusBadge[response.status] ?? "bg-slate-50 text-slate-500 border-slate-200";
  const statusLabel = {
    "ready-for-review": "Listo para revisión",
    draft: "Borrador",
    "needs-clarification": "Req. aclaración",
    final: "Final",
  }[response.status] ?? response.status;

  const srcMap: Record<string, SourceReference> = {};
  sources.forEach((s) => { srcMap[s.id] = s; });

  return (
    <div className={`overflow-hidden rounded-lg border border-l-4 border-slate-200 bg-white shadow-sm ${borderL}`}>
      {/* Agent header */}
      <div className="border-b border-slate-100 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-7 w-7 items-center justify-center rounded ${avatarBg} text-[10px] font-bold text-white`}>
              {response.agentId === "cost-engineer" ? "IC" : "PM"}
            </div>
            <div>
              <p className={`text-[12px] font-semibold ${agentColor}`}>{response.agentName}</p>
              <p className="text-[10px] text-slate-400">{response.createdAtLabel}</p>
            </div>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusCls}`}>
            {statusLabel}
          </span>
        </div>

        <div className={`mt-2 rounded border px-2.5 py-2 ${summaryBg}`}>
          <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Resumen ejecutivo
          </p>
          <p className="text-[12px] leading-5 text-slate-800">{response.executiveSummary}</p>
        </div>
      </div>

      <div className="space-y-3 px-3.5 py-3">
        {/* Findings */}
        {response.findings.map((finding) => (
          <div key={finding.id}>
            <Divider label={`Hallazgo · ${finding.title}`} />
            <div className="space-y-2">
              {finding.evidence.map((ev) => (
                <div key={ev.id} className="rounded border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">Evidencia</p>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full" style={{ width: confidencePercent[ev.confidence] ?? "50%", backgroundColor: confidenceColor[ev.confidence] ?? "#94a3b8" }} />
                      </div>
                      <span className="text-[10px] text-slate-400">{confidenceLabel[ev.confidence] ?? ev.confidence}</span>
                    </div>
                  </div>
                  <p className="text-[11px] leading-5 text-slate-700">{ev.summary}</p>
                  {ev.sourceIds.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {ev.sourceIds.map((sid) => {
                        const src = srcMap[sid];
                        return src ? (
                          <span key={sid} className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500">
                            📄 {src.title}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              ))}

              {finding.assumptions.map((a) => (
                <div key={a.id} className="rounded border border-amber-100 bg-amber-50/50 px-3 py-2">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-700">Supuesto</p>
                    {a.requiresValidation && (
                      <span className="rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                        Req. validación
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] leading-5 text-slate-700">{a.statement}</p>
                  <p className="mt-1 text-[10px] italic text-slate-500">Razón: {a.reason}</p>
                </div>
              ))}

              {/* Interpretation — slate, not purple */}
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">Interpretación</p>
                <p className="text-[11px] leading-5 text-slate-700">{finding.interpretation.statement}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Recommendations */}
        {response.recommendations.length > 0 && (
          <div>
            <Divider label="Recomendaciones" />
            <div className="space-y-2">
              {response.recommendations.map((rec) => {
                const risk = riskBadge[rec.riskLevel] ?? "bg-slate-50 text-slate-600 border-slate-200";
                return (
                  <div key={rec.id} className="rounded border border-slate-200 bg-white px-3 py-2.5">
                    <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                      <p className="flex-1 text-[12px] font-semibold text-slate-800">{rec.summary}</p>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${risk}`}>
                          {rec.riskLevel}
                        </span>
                        {rec.approvalRequired && (
                          <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                            Req. aprobación GG
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mb-1.5 text-[10px] italic leading-5 text-slate-400">{rec.rationale}</p>
                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Próximas acciones</p>
                    <ul className="space-y-1">
                      {rec.nextActions.map((action, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] leading-5 text-slate-600">
                          <span className="shrink-0 text-[10px] font-bold text-blue-600">{i + 1}.</span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Questions — blue, not sky */}
        {response.questions.length > 0 && (
          <div className="rounded border border-blue-100 bg-blue-50/50 px-3 py-2.5">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-blue-700">
              Preguntas al Gerente General
            </p>
            <div className="space-y-2">
              {response.questions.map((q) => (
                <div key={q.id}>
                  <p className="text-[11px] italic leading-5 text-slate-800">"{q.question}"</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">Razón: {q.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="h-px flex-1 bg-slate-100" />
      <p className="px-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <div className="h-px flex-1 bg-slate-100" />
    </div>
  );
}
