// AISkillsRegistryPage — clean domain tiles, no oversized text
import { aiSkillRegistryMock } from "@/lib/ai-office/aiSkillRegistryMock";
import { AIAppShell } from "./AIAppShell";
import { AIPageHeader } from "./AIPageHeader";
import { AISkillRegistry } from "./AISkillRegistry";

export function AISkillsRegistryPage() {
  const activeCount         = aiSkillRegistryMock.filter((s) => s.status === "active").length;
  const proposedCount       = aiSkillRegistryMock.filter((s) => s.status === "proposed").length;
  const observedCount       = aiSkillRegistryMock.filter((s) => s.status === "observed").length;
  const approvalRequired    = aiSkillRegistryMock.filter((s) => s.approvalRequired).length;

  const domainTiles = [
    { label: "Agente Costos",          value: `${activeCount} activa`,              detail: "Revisión de presupuesto electromecánico" },
    { label: "Agente PM",             value: `${proposedCount} propuesta · ${observedCount} observada`, detail: "Retrasos, riesgos y restricciones" },
    { label: "Agente Eléctrico (fut.)", value: "1 futura",                           detail: "Criterios de diseño eléctrico — pendiente GG" },
  ];

  return (
    <AIAppShell activeModule="skills" context="skills">
      <AIPageHeader
        eyebrow="Skills de agentes IA"
        title="Capacidades operativas versionadas para mejorar agentes IA."
        description="Registro de instrucciones, criterios, flujos y reglas que permiten mejorar el desempeño de cada agente. Las versiones nuevas requieren aprobación del GG."
        actions={
          <div className="flex flex-wrap gap-1.5">
            <StatusChip label="Activas"    value={String(activeCount)}      color="green"  />
            <StatusChip label="Propuestas" value={String(proposedCount)}    color="blue"   />
            <StatusChip label="Req. GG"    value={String(approvalRequired)} color="orange" />
          </div>
        }
      />

      <div className="space-y-3">
        {/* Domain tiles — clean, no dispersed colours */}
        <div className="grid gap-2 md:grid-cols-3">
          {domainTiles.map((t) => (
            <DomainTile key={t.label} label={t.label} value={t.value} detail={t.detail} />
          ))}
        </div>

        <AISkillRegistry skills={aiSkillRegistryMock} />
      </div>
    </AIAppShell>
  );
}

function StatusChip({ label, value, color }: { label: string; value: string; color: "green" | "blue" | "orange" }) {
  const cls = {
    green:  "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue:   "border-blue-200   bg-blue-50   text-blue-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
  }[color];
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em]">{label}</p>
      <p className="mt-0.5 text-[16px] font-bold text-slate-950">{value}</p>
    </div>
  );
}

function DomainTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-1 text-[13px] font-semibold text-slate-950">{value}</p>
      <p className="mt-0.5 text-[10px] leading-4 text-slate-400">{detail}</p>
    </div>
  );
}
