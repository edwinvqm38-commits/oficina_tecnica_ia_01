import { aiAgentsMock } from "@/lib/ai-office/aiAgentsMock";
import { AIAgentCard } from "./AIAgentCard";

export function AIAgentOrgChart() {
  const [manager, ...agents] = aiAgentsMock;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Organigrama IA
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Supervision ejecutiva con agentes subordinados
          </h2>
        </div>
        <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 sm:inline-flex">
          Autonomia supervisada
        </span>
      </div>

      <div className="mx-auto max-w-3xl">
        <AIAgentCard agent={manager} variant="leader" />
      </div>

      <div className="relative mx-auto mt-2 hidden max-w-3xl px-8 lg:block">
        <div className="mx-auto h-10 w-px bg-slate-300" />
        <div className="mx-auto h-px w-2/3 bg-slate-300" />
        <div className="grid grid-cols-2">
          <div className="mx-auto h-8 w-px bg-slate-300" />
          <div className="mx-auto h-8 w-px bg-slate-300" />
        </div>
      </div>

      <div className="mx-auto h-8 w-px bg-slate-300 lg:hidden" />

      <div className="grid gap-4 lg:grid-cols-2">
        {agents.map((agent) => (
          <AIAgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </section>
  );
}
