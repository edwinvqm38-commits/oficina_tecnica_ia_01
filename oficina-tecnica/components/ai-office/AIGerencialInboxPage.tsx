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
    <div className="space-y-3">
      <AIPageHeader
        eyebrow="Bandeja Gerencial"
        title="Solicitudes, respuestas y decisiones del GG."
        description="Revision compacta de analisis multiagente con evidencia, supuestos, recomendaciones y aprobaciones pendientes. Todo el flujo usa datos mock."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {pendingApprovals > 0 && (
              <div className="flex items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-700">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                {pendingApprovals} pendiente
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {mvpAgentResponsesMock.length} respuestas
            </div>
          </div>
        }
      />

      <div className="space-y-3">
        <AIRequestOverview request={mvpAgentRequestMock} />

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Respuestas de agentes
            </p>
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-semibold text-slate-400">
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
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
          <div className="mb-2.5 flex items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Estado general del flujo
            </p>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <div className="rounded-md border border-blue-100 bg-blue-50/40 px-3 py-2">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-blue-600">Solicitud</p>
              <p className="text-sm font-bold text-slate-900">En revision</p>
              <p className="text-xs text-slate-500">{mvpAgentRequestMock.id}</p>
            </div>
            <div className="rounded-md border border-emerald-100 bg-emerald-50/40 px-3 py-2">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-600">Agentes</p>
              <p className="text-sm font-bold text-slate-900">{mvpAgentResponsesMock.length}/{mvpAgentRequestMock.assignedAgentIds.length}</p>
              <p className="text-xs text-slate-500">Respuestas recibidas</p>
            </div>
            <div className="rounded-md border border-orange-100 bg-orange-50/40 px-3 py-2">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-orange-600">Aprobaciones</p>
              <p className="text-sm font-bold text-slate-900">{pendingApprovals} pendiente{pendingApprovals !== 1 ? "s" : ""}</p>
              <p className="text-xs text-slate-500">Requieren decision GG</p>
            </div>
            <div className="rounded-md border border-violet-100 bg-violet-50/40 px-3 py-2">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-600">Skills</p>
              <p className="text-sm font-bold text-slate-900">{mvpSkillProposalsMock.length} propuesta{mvpSkillProposalsMock.length !== 1 ? "s" : ""}</p>
              <p className="text-xs text-slate-500">Pendiente aprobacion</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-white px-3.5 py-2.5">
          <p className="text-center text-xs leading-relaxed text-slate-400">
            Los agentes pueden analizar y recomendar, pero no ejecutan decisiones críticas sin aprobación del Gerente General. · Todos los datos de esta pantalla son simulados · MVP mock
          </p>
        </div>

      </div>
    </div>
  );
}
