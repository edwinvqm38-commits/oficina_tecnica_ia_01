import { AIActivityPanel } from "./AIActivityPanel";
import { AIAgentOrgChart } from "./AIAgentOrgChart";
import { AIExecutivePanel } from "./AIExecutivePanel";
import { AIKnowledgePanel } from "./AIKnowledgePanel";
import { AIAppShell } from "./AIAppShell";
import { AIPageHeader } from "./AIPageHeader";
import { AISkillsPanel } from "./AISkillsPanel";
import { AIStatusSummary } from "./AIStatusSummary";

export function AIOfficeDashboard() {
  return (
    <AIAppShell activeModule="dashboard" context="dashboard">
      <AIPageHeader
        eyebrow="Dashboard ejecutivo"
        title="Consola gerencial de gestion, ingenieria y agentes IA."
        description="Vista mock compacta para coordinar agentes de costos y project management bajo control del Gerente General. Sin backend, sin LLM real y sin acciones criticas automatizadas."
        actions={
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
              Control humano
            </p>
            <p className="mt-0.5 text-xs font-semibold text-emerald-900">
              GG aprueba decisiones
            </p>
          </div>
        }
      />

      <AIStatusSummary />

      <div className="mt-3 space-y-3">
        <div className="grid gap-3 2xl:grid-cols-[0.9fr_1.1fr]">
          <AIExecutivePanel />
          <AIAgentOrgChart />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <AIKnowledgePanel />
          <AISkillsPanel />
          <AIActivityPanel />
        </div>
      </div>
    </AIAppShell>
  );
}
