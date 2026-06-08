import type { SourceReference } from "@/lib/ai-office/sourceReferenceTypes";

const sourceTypeLabels: Record<string, string> = {
  budget: "Presupuesto",
  schedule: "Cronograma",
  "meeting-note": "Acta",
  "technical-report": "Informe técnico",
  "management-note": "Nota gerencial",
  policy: "Política",
  "mock-document": "Documento mock",
};

const confidenceConfig: Record<string, { label: string; className: string }> = {
  high: { label: "Confianza alta", className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  medium: { label: "Confianza media", className: "text-blue-700 bg-blue-50 border-blue-200" },
  low: { label: "Confianza baja", className: "text-amber-700 bg-amber-50 border-amber-200" },
  insufficient: { label: "Insuficiente", className: "text-red-700 bg-red-50 border-red-200" },
};

type Props = { sources: SourceReference[] };

export function AISourceCitationPanel({ sources }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
          Documentación
        </p>
        <p className="text-sm font-semibold text-slate-800">
          Fuentes referenciadas
        </p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {sources.map((src) => {
          const conf = confidenceConfig[src.confidence] ?? { label: src.confidence, className: "text-slate-500 bg-slate-50 border-slate-200" };
          const typeLabel = sourceTypeLabels[src.sourceType] ?? src.sourceType;

          return (
            <div key={src.id} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {typeLabel}
                  </span>
                  {src.simulated && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-100 text-violet-700">
                      Simulada
                    </span>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${conf.className}`}>
                  {conf.label}
                </span>
              </div>

              <p className="text-sm font-medium text-slate-700 mb-0.5">{src.title}</p>
              <p className="text-xs text-slate-400 font-mono mb-1.5">{src.locationHint}</p>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-slate-400">{src.owner}</span>
                <span className="text-xs text-slate-400">{src.dateLabel}</span>
              </div>
            </div>
          );
        })}

        <p className="text-xs text-slate-400 text-center pt-1 border-t border-slate-100">
          Fuentes simuladas · No citar como documentos reales de EKA MINING SAC
        </p>
      </div>
    </div>
  );
}
