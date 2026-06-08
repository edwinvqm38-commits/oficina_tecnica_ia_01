import type { AIAgent } from "@/lib/ai-office/aiOfficeTypes";

const statusStyles = {
  operational: "border-emerald-200 bg-emerald-50 text-emerald-700",
  watch: "border-sky-200 bg-sky-50 text-sky-700",
  "needs-approval": "border-orange-200 bg-orange-50 text-orange-700",
};

const statusLabels = {
  operational: "Operativo",
  watch: "En observacion",
  "needs-approval": "Requiere aprobacion",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

type AIAgentCardProps = {
  agent: AIAgent;
  variant?: "leader" | "agent";
};

export function AIAgentCard({ agent, variant = "agent" }: AIAgentCardProps) {
  const isLeader = variant === "leader";

  return (
    <article
      className={[
        "relative overflow-hidden rounded-lg border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        isLeader
          ? "border-blue-200 p-5 shadow-md shadow-blue-100 ring-1 ring-blue-100"
          : "border-slate-200 p-4",
      ].join(" ")}
    >
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-orange-100/70" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div
            className={[
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold",
              isLeader
                ? "bg-blue-700 text-white shadow-md shadow-blue-200"
                : "bg-slate-100 text-slate-700",
            ].join(" ")}
          >
            {getInitials(agent.name)}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              {agent.role}
            </p>
            <h3
              className={[
                "mt-2 font-semibold text-slate-950",
                isLeader ? "text-xl" : "text-lg",
              ].join(" ")}
            >
              {agent.name}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {agent.focus}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[agent.status]}`}
        >
          {statusLabels[agent.status]}
        </span>
      </div>

      <div className="relative mt-5 rounded-md bg-slate-50 p-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
          Tarea actual
        </p>
        <p className="mt-1 text-sm font-medium text-slate-800">
          {agent.currentTask}
        </p>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3">
        {agent.kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-md border border-slate-100 p-3">
            <p className="text-xs text-slate-500">{kpi.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="relative mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{agent.autonomyLevel}</span>
          <span className="font-semibold text-blue-700">
            {agent.confidence}%
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div
            className={isLeader ? "h-2 rounded-full bg-blue-700" : "h-2 rounded-full bg-orange-500"}
            style={{ width: `${agent.confidence}%` }}
          />
        </div>
      </div>
    </article>
  );
}
