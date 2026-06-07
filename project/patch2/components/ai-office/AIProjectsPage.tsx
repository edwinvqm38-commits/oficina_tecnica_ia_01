// AIProjectsPage — clean tiles, no text-lg/text-xl in mini-tiles, semantic colours
import { aiProjectsMock } from "@/lib/ai-office/aiProjectsMock";
import { AIAppShell } from "./AIAppShell";
import { AIPageHeader } from "./AIPageHeader";
import { AIProjectPortfolio } from "./AIProjectPortfolio";

export function AIProjectsPage() {
  const totalProjects    = aiProjectsMock.length;
  const atRiskCount      = aiProjectsMock.filter((p) => p.status === "at-risk" || p.status === "delayed").length;
  const averageProgress  = Math.round(
    aiProjectsMock.reduce((sum, p) => sum + p.progress, 0) / totalProjects,
  );
  const totalCost = "S/ 4.83 M";

  return (
    <AIAppShell activeModule="projects" context="projects">
      <AIPageHeader
        eyebrow="Portafolio de Proyectos"
        title="Tablero mock de gestión e ingeniería multidisciplina."
        description="Vista operativa de proyectos, fases, riesgos, costos, próximos hitos y agentes asignados. Datos simulados."
        actions={
          <div className="flex flex-wrap gap-1.5">
            <MetricChip label="Proyectos" value={String(totalProjects)} />
            <MetricChip label="En riesgo"  value={String(atRiskCount)}  accent />
            <MetricChip label="Avance"     value={`${averageProgress}%`} />
          </div>
        }
      />

      <div className="space-y-3">
        {/* Portfolio summary tiles */}
        <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
          <SummaryTile label="Costo estimado"  value={totalCost}  detail="Consolidado visual, no financiero" />
          <SummaryTile label="Disciplinas"     value="E / C / M"  detail="Eléctrica, civil y mecánica mock"  />
          <SummaryTile label="Próximo foco"    value="Control"    detail="Desviación costo-plazo y cierre"   />
        </div>

        <AIProjectPortfolio projects={aiProjectsMock} />
      </div>
    </AIAppShell>
  );
}

function MetricChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${accent ? "border-orange-200 bg-orange-50" : "border-slate-200 bg-white shadow-sm"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className={`mt-0.5 text-[16px] font-bold ${accent ? "text-orange-700" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}

function SummaryTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-1 text-[14px] font-semibold text-slate-950">{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{detail}</p>
    </div>
  );
}
