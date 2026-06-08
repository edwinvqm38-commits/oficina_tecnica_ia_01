import { aiApprovalsQueueMock } from "@/lib/ai-office/aiApprovalsQueueMock";
import { AIApprovalQueue } from "./AIApprovalQueue";
import { AIPageHeader } from "./AIPageHeader";

export function AIApprovalsPage() {
  const pendingCount = aiApprovalsQueueMock.filter(
    (approval) => approval.status === "pending",
  ).length;
  const highRiskCount = aiApprovalsQueueMock.filter(
    (approval) => approval.risk === "high" || approval.risk === "critical",
  ).length;

  return (
    <div className="space-y-3">
      <AIPageHeader
        eyebrow="Centro de Aprobaciones"
        title="Decisiones, memoria y skills pendientes del Gerente General."
        description="Cola mock para revisar recomendaciones, memoria operativa propuesta, skills versionadas y decisiones criticas. Ningun boton ejecuta acciones reales."
        actions={
          <div className="grid min-w-56 grid-cols-2 gap-1.5">
            <HeaderMetric label="Pendientes" value={String(pendingCount)} />
            <HeaderMetric label="Riesgo alto" value={String(highRiskCount)} />
          </div>
        }
      />

      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryTile label="Recomendaciones" value="1" tone="blue" />
          <SummaryTile label="Memoria" value="1" tone="violet" />
          <SummaryTile label="Skills" value="2" tone="sky" />
          <SummaryTile label="Criticas" value="1" tone="orange" />
        </div>
        <AIApprovalQueue approvals={aiApprovalsQueueMock} />
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

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "violet" | "sky" | "orange";
}) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50/60 text-blue-700",
    violet: "border-violet-100 bg-violet-50/60 text-violet-700",
    sky: "border-sky-100 bg-sky-50/60 text-sky-700",
    orange: "border-orange-100 bg-orange-50/60 text-orange-700",
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2.5 shadow-sm ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
