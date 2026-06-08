import { aiAgentsMock } from "@/lib/ai-office/aiAgentsMock";
import { aiAlertsMock } from "@/lib/ai-office/aiAlertsMock";
import { aiOfficeConnectionsMock } from "@/lib/ai-office/aiOfficeLayoutMock";
import { AIOfficeCanvas } from "./AIOfficeCanvas";
import { AIPageHeader } from "./AIPageHeader";

export function AIVirtualOfficePage() {
  const subordinateAgents = aiAgentsMock.filter(
    (agent) => agent.id !== "general-manager",
  );
  const collaborationCount = aiOfficeConnectionsMock.filter(
    (connection) => connection.kind === "collaboration",
  ).length;

  return (
    <div className="space-y-3">
      <AIPageHeader
        eyebrow="Oficina IA"
        title="Organigrama operativo y red de agentes IA."
        description="Vista compacta de agentes, responsabilidades y conexiones mock. Prepara los modos de estructura, colaboracion y aprobaciones."
        actions={
          <div className="grid min-w-56 grid-cols-3 gap-1.5">
            <HeroMetric label="Agentes" value={String(subordinateAgents.length)} />
            <HeroMetric label="Alertas" value={String(aiAlertsMock.length)} />
            <HeroMetric label="Red" value={String(collaborationCount)} />
          </div>
        }
      />

      <div className="space-y-3">
        <OfficeModeTabs />
        <AIOfficeCanvas />
        <CollaborationPanel />
      </div>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function OfficeModeTabs() {
  const modes = [
    { label: "Estructura", active: true },
    { label: "Colaboracion", active: false },
    { label: "Aprobaciones", active: false },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
        {modes.map((mode) => (
          <span
            key={mode.label}
            className={[
              "rounded px-2.5 py-1 text-xs font-semibold",
              mode.active
                ? "bg-blue-700 text-white shadow-sm"
                : "text-slate-500",
            ].join(" ")}
          >
            {mode.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Modo mock. La logica real se implementara en Fase 4D.
      </p>
    </div>
  );
}

function CollaborationPanel() {
  const agentNamesById = new Map(
    aiAgentsMock.map((agent) => [agent.id, agent.name]),
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">
            Colaboracion entre agentes
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-slate-950">
            Interacciones modeladas desde datos
          </h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">
          Mock
        </span>
      </div>
      <div className="mt-3 grid gap-2.5 md:grid-cols-2">
        {aiOfficeConnectionsMock.map((connection) => (
          <article
            key={connection.id}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5"
          >
            <p className="text-xs font-semibold text-slate-950">
              {connection.kind === "supervision"
                ? "Relacion de supervision"
                : "Relacion colaborativa"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {agentNamesById.get(connection.fromAgentId)} {"->"}{" "}
              {agentNamesById.get(connection.toAgentId)}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-600">
              {connection.label}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
