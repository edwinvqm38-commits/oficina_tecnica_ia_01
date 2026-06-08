import { aiAgentsMock } from "@/lib/ai-office/aiAgentsMock";
import {
  aiOfficeConnectionsMock,
  aiOfficeNodesMock,
} from "@/lib/ai-office/aiOfficeLayoutMock";
import { AIAgentConnection } from "./AIAgentConnection";
import { AIAgentNode } from "./AIAgentNode";

const agentsById = new Map(aiAgentsMock.map((agent) => [agent.id, agent]));
const nodesByAgentId = new Map(
  aiOfficeNodesMock.map((node) => [node.agentId, node]),
);

export function AIOfficeCanvas() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">
            Mapa multiagente
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-slate-950">
            Organigrama operativo
          </h2>
        </div>
        <div className="flex gap-1.5 text-[11px] font-semibold">
          <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
            Supervision
          </span>
          <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-700">
            Colaboracion
          </span>
        </div>
      </div>

      <div className="relative mt-3 hidden min-h-[460px] overflow-hidden rounded-md border border-slate-200 bg-slate-50 shadow-inner lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(0deg,rgba(148,163,184,0.14)_1px,transparent_1px)] bg-[size:36px_36px]" />
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Conexiones entre agentes IA"
        >
          {aiOfficeConnectionsMock.map((connection) => {
            const fromNode = nodesByAgentId.get(connection.fromAgentId);
            const toNode = nodesByAgentId.get(connection.toAgentId);

            if (!fromNode || !toNode) {
              return null;
            }

            return (
              <AIAgentConnection
                key={connection.id}
                connection={connection}
                fromNode={fromNode}
                toNode={toNode}
              />
            );
          })}
        </svg>
        {aiOfficeNodesMock.map((node) => {
          const agent = agentsById.get(node.agentId);

          if (!agent) {
            return null;
          }

          return <AIAgentNode key={node.id} agent={agent} node={node} />;
        })}
      </div>

      <div className="mt-3 grid gap-3 lg:hidden">
        {aiOfficeNodesMock.map((node) => {
          const agent = agentsById.get(node.agentId);

          if (!agent) {
            return null;
          }

          return (
            <div key={node.id} className="rounded-md border border-slate-200 p-2.5">
              <AIAgentNode agent={agent} node={node} mode="card" />
            </div>
          );
        })}
      </div>
    </section>
  );
}
