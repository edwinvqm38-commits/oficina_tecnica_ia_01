import { aiProjectsMock } from "@/lib/ai-office/aiProjectsMock";
import { AIPageHeader } from "./AIPageHeader";
import { AIProjectPortfolio } from "./AIProjectPortfolio";

export function AIProjectsPage() {
  const totalProjects = aiProjectsMock.length;
  const atRiskCount = aiProjectsMock.filter(
    (project) => project.status === "at-risk" || project.status === "delayed",
  ).length;
  const averageProgress = Math.round(
    aiProjectsMock.reduce((sum, project) => sum + project.progress, 0) /
      totalProjects,
  );

  return (
    <div className="space-y-3">
      <AIPageHeader
        eyebrow="Portafolio de Proyectos"
        title="Tablero mock de gestion e ingenieria multidisciplina."
        description="Vista operativa para representar proyectos, fases, riesgos, costos, proximos hitos y agentes asignados. Todo permanece simulado."
        actions={
          <div className="grid min-w-64 grid-cols-3 gap-1.5">
            <HeaderMetric label="Proyectos" value={String(totalProjects)} />
            <HeaderMetric label="Riesgo" value={String(atRiskCount)} />
            <HeaderMetric label="Avance" value={`${averageProgress}%`} />
          </div>
        }
      />

      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <PortfolioTile
            label="Disciplinas"
            value="E/C/M"
            detail="Electrica, civil y mecanica mock"
          />
          <PortfolioTile
            label="Costo estimado"
            value="S/ 4.83 M"
            detail="Consolidado visual no financiero"
          />
          <PortfolioTile
            label="Proximo foco"
            value="Control"
            detail="Desviacion costo-plazo y cierre"
          />
        </div>
        <AIProjectPortfolio projects={aiProjectsMock} />
      </div>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function PortfolioTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
