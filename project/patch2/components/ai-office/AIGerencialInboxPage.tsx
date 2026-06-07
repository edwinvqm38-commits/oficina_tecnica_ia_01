// AIGerencialInboxPage — remove violet, unify flow status boxes to slate/blue/green/orange
import { AIAppShell } from "./AIAppShell";
import { AIRequestOverview } from "./AIRequestOverview";
import { AIAgentResponsePanel } from "./AIAgentResponsePanel";
import { AIPageHeader } from "./AIPageHeader";
import {
  mvpAgentRequestMock,
  mvpAgentResponsesMock,
  mvpSourceReferencesMock,
  mvpApprovalRequestsMock,
  mvpSkillProposalsMock,
} from "@/lib/ai-office/mvpMockData";

export function AIGerencialInboxPage() {
  const pendingApprovals = mvpApprovalRequestsMock.filter((a) => a.status === "pending").length;

  return (
    <AIAppShell activeModule="inbox" context="inbox">
      <AIPageHeader
        eyebrow="Bandeja Gerencial"
        title="Solicitudes, respuestas y decisiones del GG."
        description="Revisión compacta de análisis multiagente con evidencia, supuestos, recomendaciones y aprobaciones pendientes. Todo el flujo usa datos mock."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {pendingApprovals > 0 && (
              <div className="flex items-center gap-1.5 rounded border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[11px] font-semibold text-orange-700">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                {pendingApprovals} pendiente{pendingApprovals !== 1 ? "s" : ""}
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              {mvpAgentResponsesMock.length} respuestas
            </div>
          </div>
        }
      />

      <div className="space-y-3">
        <AIRequestOverview request={mvpAgentRequestMock} />

        {/* Responses divider */}
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Respuestas de agentes
          </p>
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[10px] font-semibold text-slate-400">
            {mvpAgentResponsesMock.length} de {mvpAgentRequestMock.assignedAgentIds.length}
          </span>
        </div>

        {mvpAgentResponsesMock.map((response, index) => (
          <AIAgentResponsePanel
            key={response.id}
            response={response}
            sources={mvpSourceReferencesMock}
            accentColor={index === 0 ? "blue" : "orange"}
          />
        ))}

        {/* Flow status — clean 4-col, no violet */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-3.5 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Estado general del flujo
            </p>
          </div>
          <div className="grid grid-cols-2 gap-0 md:grid-cols-4 divide-x divide-slate-100">
            <FlowBox
              label="Solicitud"
              value="En revisión"
              sub={mvpAgentRequestMock.id}
              color="blue"
            />
            <FlowBox
              label="Agentes"
              value={`${mvpAgentResponsesMock.length}/${mvpAgentRequestMock.assignedAgentIds.length}`}
              sub="Respuestas recibidas"
              color="green"
            />
            <FlowBox
              label="Aprobaciones"
              value={`${pendingApprovals} pendiente${pendingApprovals !== 1 ? "s" : ""}`}
              sub="Requieren decisión GG"
              color="orange"
            />
            <FlowBox
              label="Skills"
              value={`${mvpSkillProposalsMock.length} propuesta${mvpSkillProposalsMock.length !== 1 ? "s" : ""}`}
              sub="Pendiente aprobación"
              color="slate"
            />
          </div>
        </div>

        <p className="text-center text-[10px] leading-relaxed text-slate-400">
          Los agentes analizan y recomiendan, pero no ejecutan decisiones críticas sin aprobación del Gerente General. · Datos simulados · MVP mock
        </p>
      </div>
    </AIAppShell>
  );
}

type FlowColor = "blue" | "green" | "orange" | "slate";

function FlowBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: FlowColor }) {
  const labelCls: Record<FlowColor, string> = {
    blue:   "text-blue-600",
    green:  "text-emerald-600",
    orange: "text-orange-600",
    slate:  "text-slate-500",
  };
  return (
    <div className="px-3.5 py-3">
      <p className={`text-[10px] font-semibold uppercase tracking-[0.1em] mb-0.5 ${labelCls[color]}`}>{label}</p>
      <p className="text-[14px] font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-400">{sub}</p>
    </div>
  );
}
