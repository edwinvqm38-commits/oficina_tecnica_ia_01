// AIApprovalsPage — clean: no violet/sky/purple tiles, unified slate/semantic palette
import { aiApprovalsQueueMock } from "@/lib/ai-office/aiApprovalsQueueMock";
import { AIAppShell } from "./AIAppShell";
import { AIApprovalQueue } from "./AIApprovalQueue";
import { AIPageHeader } from "./AIPageHeader";

export function AIApprovalsPage() {
  const pendingCount    = aiApprovalsQueueMock.filter((a) => a.status === "pending").length;
  const highRiskCount   = aiApprovalsQueueMock.filter((a) => a.risk === "high" || a.risk === "critical").length;
  const skillCount      = aiApprovalsQueueMock.filter((a) => a.category === "skill").length;
  const decisionCount   = aiApprovalsQueueMock.filter((a) => a.category === "critical-decision").length;
  const memoryCount     = aiApprovalsQueueMock.filter((a) => a.category === "memory").length;
  const recommendCount  = aiApprovalsQueueMock.filter((a) => a.category === "recommendation").length;

  return (
    <AIAppShell activeModule="approvals" context="approvals">
      <AIPageHeader
        eyebrow="Centro de Aprobaciones"
        title="Decisiones, memoria y skills pendientes del Gerente General."
        description="Cola de revisión para recomendaciones, memoria operativa propuesta, skills versionadas y decisiones críticas. Ningún botón ejecuta acciones reales."
        actions={
          <div className="flex flex-wrap gap-1.5">
            <KpiChip label="Pendientes"  value={String(pendingCount)}   color="orange" />
            <KpiChip label="Riesgo alto" value={String(highRiskCount)}  color="red"    />
          </div>
        }
      />

      <div className="space-y-3">
        {/* Summary row — 4 clean tiles, no violet/sky */}
        <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
          <SummaryTile label="Recomendaciones" value={String(recommendCount)} />
          <SummaryTile label="Memoria"         value={String(memoryCount)}    />
          <SummaryTile label="Skills"          value={String(skillCount)}     />
          <SummaryTile label="Críticas"        value={String(decisionCount)}  accent />
        </div>

        <AIApprovalQueue approvals={aiApprovalsQueueMock} />
      </div>
    </AIAppShell>
  );
}

function KpiChip({ label, value, color }: { label: string; value: string; color: "orange" | "red" }) {
  const cls = {
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    red:    "border-red-200    bg-red-50    text-red-700",
  }[color];
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em]">{label}</p>
      <p className="mt-0.5 text-[18px] font-bold text-slate-950">{value}</p>
    </div>
  );
}

function SummaryTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 shadow-sm ${accent ? "border-orange-100 bg-orange-50/60" : "border-slate-200 bg-white"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className={`mt-1 text-[18px] font-bold ${accent ? "text-orange-700" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}
