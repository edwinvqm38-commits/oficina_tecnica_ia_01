import type {
  AIAgent,
  AIOfficeNode,
} from "@/lib/ai-office/aiOfficeTypes";

const statusClasses = {
  operational: "border-emerald-200 bg-emerald-50 text-emerald-700",
  watch: "border-sky-200 bg-sky-50 text-sky-700",
  "needs-approval": "border-orange-200 bg-orange-50 text-orange-700",
};

const statusLabels = {
  operational: "Operativo",
  watch: "Observacion",
  "needs-approval": "Aprobacion",
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

type AIAgentNodeProps = {
  agent: AIAgent;
  node: AIOfficeNode;
  mode?: "canvas" | "card";
};

export function AIAgentNode({ agent, node, mode = "canvas" }: AIAgentNodeProps) {
  const widthClass = node.size === "leader" ? "w-72" : "w-64";
  const isLeader = node.size === "leader";
  const positionClass =
    mode === "canvas"
      ? `absolute z-10 -translate-x-1/2 -translate-y-1/2 ${widthClass}`
      : "relative w-full";
  const positionStyle =
    mode === "canvas" ? { left: `${node.x}%`, top: `${node.y}%` } : undefined;

  return (
    <article
      className={[
        "rounded-lg border bg-white p-4 shadow-lg shadow-slate-200/70",
        positionClass,
        isLeader
          ? "border-blue-200 ring-4 ring-blue-100/80"
          : "border-slate-200",
      ].join(" ")}
      style={positionStyle}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
              isLeader
                ? "bg-blue-700 text-white shadow-md shadow-blue-200"
                : "bg-slate-100 text-slate-700",
            ].join(" ")}
          >
            {getInitials(agent.name)}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              {agent.role}
            </p>
            <h3 className="mt-2 text-base font-semibold text-slate-950">
              {agent.name}
            </h3>
          </div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[agent.status]}`}
        >
          {statusLabels[agent.status]}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{node.message}</p>
      <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Confianza</span>
          <span className="font-semibold text-blue-700">
            {agent.confidence}%
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-200">
          <div
            className={isLeader ? "h-2 rounded-full bg-blue-700" : "h-2 rounded-full bg-orange-500"}
            style={{ width: `${agent.confidence}%` }}
          />
        </div>
      </div>
    </article>
  );
}
