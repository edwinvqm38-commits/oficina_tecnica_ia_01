import { aiSkillRegistryMock } from "@/lib/ai-office/aiSkillRegistryMock";
import { AIPageHeader } from "./AIPageHeader";
import { AISkillRegistry } from "./AISkillRegistry";

export function AISkillsRegistryPage() {
  const activeCount = aiSkillRegistryMock.filter(
    (skill) => skill.status === "active",
  ).length;
  const proposedCount = aiSkillRegistryMock.filter(
    (skill) => skill.status === "proposed",
  ).length;
  const approvalRequiredCount = aiSkillRegistryMock.filter(
    (skill) => skill.approvalRequired,
  ).length;

  return (
    <div className="space-y-3">
      <AIPageHeader
        eyebrow="Skills de agentes IA"
        title="Capacidades operativas versionadas para mejorar agentes IA."
        description="Registro mock de instrucciones, criterios, flujos y reglas que permiten mejorar el desempeno de cada agente. Las versiones nuevas nacen de respuestas, observaciones, dialogo entre agentes y aprobacion del GG."
        actions={
          <div className="grid min-w-64 grid-cols-3 gap-1.5">
            <HeaderMetric label="Activas" value={String(activeCount)} />
            <HeaderMetric label="Propuestas" value={String(proposedCount)} />
            <HeaderMetric label="Requieren GG" value={String(approvalRequiredCount)} />
          </div>
        }
      />

      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <DomainTile
            label="Agente Costos"
            value="1 activa"
            detail="Revision de presupuesto electromecanico"
          />
          <DomainTile
            label="Agente PM"
            value="1 propuesta · 1 observada"
            detail="Retrasos, riesgos y restricciones"
          />
          <DomainTile
            label="Agente Electrico futuro"
            value="1 futura"
            detail="Criterios de diseno electrico bajo aprobacion GG"
          />
        </div>
        <AISkillRegistry skills={aiSkillRegistryMock} />
      </div>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function DomainTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
      <p className="mt-0.5 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}
