// AIVirtualOfficePage — clean mode tabs, collaboration panel without orange label
import { aiAgentsMock } from "@/lib/ai-office/aiAgentsMock";
import { aiAlertsMock } from "@/lib/ai-office/aiAlertsMock";
import { aiOfficeConnectionsMock } from "@/lib/ai-office/aiOfficeLayoutMock";
import { AIAppShell } from "./AIAppShell";
import { AIOfficeCanvas } from "./AIOfficeCanvas";
import { AIPageHeader } from "./AIPageHeader";

export function AIVirtualOfficePage() {
  const subordinateAgents  = aiAgentsMock.filter((a) => a.id !== "general-manager");
  const collaborationCount = aiOfficeConnectionsMock.filter((c) => c.kind === "collaboration").length;
  const agentNamesById     = new Map(aiAgentsMock.map((a) => [a.id, a.name]));

  return (
    <AIAppShell activeModule="office" context="office">
      <AIPageHeader
        eyebrow="Oficina IA"
        title="Organigrama operativo y red de agentes IA."
        description="Vista compacta de agentes, responsabilidades y conexiones mock. Prepara los modos de estructura, colaboración y aprobaciones."
        actions={
          <div className="flex flex-wrap gap-1.5">
            <HeaderChip label="Agentes" value={String(subordinateAgents.length)} />
            <HeaderChip label="Alertas" value={String(aiAlertsMock.length)}      />
            <HeaderChip label="Red"     value={String(collaborationCount)}        />
          </div>
        }
      />

      <div className="space-y-3">
        {/* Mode tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center gap-1 rounded border border-slate-100 bg-slate-50 p-1">
            {["Estructura", "Colaboración", "Aprobaciones"].map((label, i) => (
              <span
                key={label}
                className={[
                  "rounded px-2.5 py-1 text-[12px] font-semibold transition-colors",
                  i === 0 ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                {label}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">Lógica completa: Fase 4D</p>
        </div>

        {/* Org canvas */}
        <AIOfficeCanvas />

        {/* Collaboration panel */}
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">Colaboración entre agentes</p>
              <h2 className="text-[13px] font-semibold text-slate-950">Interacciones modeladas</h2>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-400">Mock</span>
          </div>
          <div className="grid gap-0 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
            {aiOfficeConnectionsMock.map((connection) => (
              <div key={connection.id} className="flex items-start gap-3 px-3.5 py-3">
                <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${connection.kind === "supervision" ? "bg-blue-600" : "bg-emerald-500"}`} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-800">
                    {connection.kind === "supervision" ? "Supervisión" : "Colaboración"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {agentNamesById.get(connection.fromAgentId)} → {agentNamesById.get(connection.toAgentId)}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em]">{connection.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AIAppShell>
  );
}

function HeaderChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-0.5 text-[15px] font-bold text-slate-950">{value}</p>
    </div>
  );
}
