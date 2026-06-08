import type {
  AIProjectMock,
  AIProjectRiskLevel,
} from "@/lib/ai-office/aiProjectsMock";

type AIProjectPortfolioProps = {
  projects: AIProjectMock[];
};

const columns: AIProjectMock["boardColumn"][] = [
  "Planificacion",
  "Ejecucion",
  "Control",
  "Cierre",
];

const riskConfig: Record<AIProjectRiskLevel, { label: string; className: string }> = {
  low: { label: "Bajo", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  medium: { label: "Medio", className: "border-amber-200 bg-amber-50 text-amber-700" },
  high: { label: "Alto", className: "border-orange-200 bg-orange-50 text-orange-700" },
  critical: { label: "Critico", className: "border-red-200 bg-red-50 text-red-700" },
};

const statusConfig: Record<AIProjectMock["status"], { label: string; className: string }> = {
  "on-track": { label: "En curso", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  "at-risk": { label: "En riesgo", className: "border-orange-200 bg-orange-50 text-orange-700" },
  delayed: { label: "Retrasado", className: "border-red-200 bg-red-50 text-red-700" },
  planning: { label: "Planificacion", className: "border-blue-200 bg-blue-50 text-blue-700" },
};

export function AIProjectPortfolio({ projects }: AIProjectPortfolioProps) {
  return (
    <section className="grid gap-3 xl:grid-cols-4">
      {columns.map((column) => {
        const columnProjects = projects.filter(
          (project) => project.boardColumn === column,
        );

        return (
          <div
            key={column}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Estado operativo
                </p>
                <h2 className="mt-0.5 text-sm font-semibold text-slate-950">
                  {column}
                </h2>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                {columnProjects.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {columnProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ProjectCard({ project }: { project: AIProjectMock }) {
  const risk = riskConfig[project.riskLevel];
  const status = statusConfig[project.status];

  return (
    <article className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {project.id}
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-950">
            {project.name}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{project.client}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-600">{project.summary}</p>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <span>Avance</span>
          <span>{project.progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-blue-700"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-1.5 text-xs text-slate-600">
        <MetaRow label="Disciplina" value={project.mainDiscipline} />
        <MetaRow label="Fase" value={project.phase} />
        <MetaRow label="Costo" value={project.estimatedCost} />
        <MetaRow label="Hito" value={project.nextMilestone} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${risk.className}`}>
          Riesgo {risk.label}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {project.dueLabel}
        </span>
        {project.assignedAgents.map((agent) => (
          <span
            key={agent}
            className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700"
          >
            {agent}
          </span>
        ))}
      </div>
    </article>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1">
      <span className="text-slate-400">{label}</span>
      <span className="truncate font-semibold text-slate-700">{value}</span>
    </div>
  );
}
