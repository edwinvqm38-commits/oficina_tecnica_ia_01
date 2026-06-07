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

const riskBadge: Record<AIProjectRiskLevel, string> = {
  low:      "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium:   "border-amber-200  bg-amber-50  text-amber-700",
  high:     "border-orange-200 bg-orange-50 text-orange-700",
  critical: "border-red-200    bg-red-50    text-red-700",
};

const riskLabel: Record<AIProjectRiskLevel, string> = {
  low: "Bajo", medium: "Medio", high: "Alto", critical: "Crítico",
};

const statusConfig: Record<AIProjectMock["status"], { label: string; className: string }> = {
  "on-track": { label: "En curso",       className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  "at-risk":  { label: "En riesgo",      className: "border-orange-200 bg-orange-50 text-orange-700"   },
  delayed:    { label: "Retrasado",      className: "border-red-200    bg-red-50    text-red-700"       },
  planning:   { label: "Planificación",  className: "border-blue-200   bg-blue-50   text-blue-700"     },
};

// Semantic progress bar color based on status
const progressClass: Record<AIProjectMock["status"], string> = {
  "on-track": "progress-on-track",
  "at-risk":  "progress-at-risk",
  delayed:    "progress-delayed",
  planning:   "progress-planning",
};

export function AIProjectPortfolio({ projects }: AIProjectPortfolioProps) {
  return (
    <section className="grid gap-3 xl:grid-cols-4">
      {columns.map((column) => {
        const colProjects = projects.filter((p) => p.boardColumn === column);
        return (
          <div
            key={column}
            className="rounded-lg border border-slate-200 bg-slate-50 p-2.5"
          >
            {/* Column header */}
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h2 className="text-[12px] font-semibold text-slate-700">{column}</h2>
              <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {colProjects.length}
              </span>
            </div>

            <div className="space-y-2">
              {colProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
              {colProjects.length === 0 && (
                <p className="rounded border border-dashed border-slate-200 py-4 text-center text-[10px] text-slate-400">
                  Sin proyectos
                </p>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ProjectCard({ project }: { project: AIProjectMock }) {
  const status = statusConfig[project.status];
  return (
    <article className="rounded-md border border-slate-200 bg-white p-2.5 shadow-sm transition hover:shadow-md">
      {/* ID + name */}
      <p className="font-mono text-[9px] text-slate-400">{project.id}</p>
      <h3 className="mt-0.5 text-[12px] font-semibold leading-snug text-slate-950">{project.name}</h3>
      <p className="mt-0.5 text-[10px] text-slate-400">{project.client}</p>

      {/* Progress bar — semantic colour */}
      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
          <span>Avance</span>
          <span className="font-semibold">{project.progress}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${progressClass[project.status]}`}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Metadata — clean rows, no box per pair */}
      <div className="mt-2 space-y-0.5 text-[10px]">
        <MetaRow label="Costo"  value={project.estimatedCost} />
        <MetaRow label="Hito"   value={project.nextMilestone} />
        <MetaRow label="Vence"  value={project.dueLabel} />
      </div>

      {/* Badges */}
      <div className="mt-2 flex flex-wrap gap-1">
        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${status.className}`}>
          {status.label}
        </span>
        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${riskBadge[project.riskLevel]}`}>
          {riskLabel[project.riskLevel]}
        </span>
        {project.assignedAgents.map((agent) => (
          <span
            key={agent}
            className="rounded-full border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700"
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
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className="truncate font-medium text-slate-700">{value}</span>
    </div>
  );
}
