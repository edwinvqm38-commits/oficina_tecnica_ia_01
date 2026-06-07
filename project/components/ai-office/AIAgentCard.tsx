import type { AIAgent } from "@/lib/ai-office/aiOfficeTypes";

// Compact: removed decorative orange circle, smaller avatar, tighter padding
const statusStyles = {
  operational:       "border-emerald-200 bg-emerald-50 text-emerald-700",
  watch:             "border-amber-200  bg-amber-50  text-amber-700",
  "needs-approval":  "border-orange-200 bg-orange-50 text-orange-700",
};

const statusLabels = {
  operational:      "Operativo",
  watch:            "En observación",
  "needs-approval": "Req. aprobación",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
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
        "rounded-lg border bg-white shadow-sm transition hover:shadow-md",
        isLeader
          ? "border-blue-200 p-3.5 ring-1 ring-blue-100"
          : "border-slate-200 p-3",
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
              isLeader
                ? "bg-blue-700 text-white"
                : "bg-slate-100 text-slate-700",
            ].join(" ")}
          >
            {getInitials(agent.name)}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600">
              {agent.role}
            </p>
            <h3 className="text-[13px] font-semibold text-slate-950 leading-tight">
              {agent.name}
            </h3>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyles[agent.status]}`}
        >
          {statusLabels[agent.status]}
        </span>
      </div>

      {/* Focus */}
      <p className="mt-2 text-[11px] leading-5 text-slate-500">{agent.focus}</p>

      {/* Current task */}
      <div className="mt-2 rounded border border-slate-100 bg-slate-50 px-2.5 py-1.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          Tarea actual
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-slate-700">{agent.currentTask}</p>
      </div>

      {/* KPIs */}
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {agent.kpis.map((kpi) => (
          <div key={kpi.label} className="rounded border border-slate-100 px-2 py-1.5">
            <p className="text-[10px] text-slate-400">{kpi.label}</p>
            <p className="mt-0.5 text-[12px] font-semibold text-slate-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Confidence bar */}
      <div className="mt-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">{agent.autonomyLevel}</span>
          <span className="font-semibold text-blue-700">{agent.confidence}%</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={isLeader ? "h-full rounded-full bg-blue-700" : "h-full rounded-full bg-slate-500"}
            style={{ width: `${agent.confidence}%` }}
          />
        </div>
      </div>
    </article>
  );
}
