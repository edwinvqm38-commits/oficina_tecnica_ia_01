import type { ReactNode } from "react";
import { aiActivitiesMock } from "@/lib/ai-office/aiActivitiesMock";
import { aiAlertsMock } from "@/lib/ai-office/aiAlertsMock";
import { aiAgentsMock } from "@/lib/ai-office/aiAgentsMock";
import { aiApprovalsQueueMock } from "@/lib/ai-office/aiApprovalsQueueMock";
import { aiOfficeConnectionsMock } from "@/lib/ai-office/aiOfficeLayoutMock";
import { aiProjectsMock } from "@/lib/ai-office/aiProjectsMock";
import { aiSkillRegistryMock } from "@/lib/ai-office/aiSkillRegistryMock";
import {
  mvpApprovalRequestsMock,
  mvpMemoryNotesMock,
  mvpSkillProposalsMock,
} from "@/lib/ai-office/mvpMockData";
import { AIApprovalWorkflowPanel } from "./AIApprovalWorkflowPanel";
import { AIMemoryPreviewPanel } from "./AIMemoryPreviewPanel";
import { AISkillProposalPanel } from "./AISkillProposalPanel";

type AIContextPanelProps = {
  variant:
    | "dashboard"
    | "office"
    | "inbox"
    | "approvals"
    | "projects"
    | "skills";
};

export function AIContextPanel({ variant }: AIContextPanelProps) {
  const contextTitle = {
    dashboard: "Pulso gerencial",
    office: "Contexto de agente",
    inbox: "Decision activa",
    approvals: "Centro de decision",
    projects: "Proyecto activo",
    skills: "Lifecycle de skills",
  }[variant];

  return (
    <aside className="border-t border-slate-200 bg-slate-50/90 px-3 py-3 sm:px-4 xl:sticky xl:top-[54px] xl:h-[calc(100vh-54px)] xl:overflow-y-auto xl:border-l xl:border-t-0 xl:px-3">
      <div className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Inspector contextual
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-950">{contextTitle}</h2>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            Mock
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {variant === "dashboard" ? <DashboardContext /> : null}
        {variant === "office" ? <OfficeContext /> : null}
        {variant === "inbox" ? <InboxContext /> : null}
        {variant === "approvals" ? <ApprovalsContext /> : null}
        {variant === "projects" ? <ProjectsContext /> : null}
        {variant === "skills" ? <SkillsContext /> : null}
      </div>
    </aside>
  );
}

function DashboardContext() {
  const pendingApprovals = mvpApprovalRequestsMock.filter(
    (approval) => approval.status === "pending",
  ).length;

  return (
    <>
      <ContextSection eyebrow="Resumen ejecutivo" title="Pulso operativo">
        <div className="grid grid-cols-2 gap-2">
          <ContextMetric label="Alertas" value={String(aiAlertsMock.length)} />
          <ContextMetric label="Aprobaciones" value={String(pendingApprovals)} />
          <ContextMetric label="Agentes" value={String(aiAgentsMock.length - 1)} />
          <ContextMetric label="Actividad" value={String(aiActivitiesMock.length)} />
        </div>
      </ContextSection>

      <ContextSection eyebrow="Alertas" title="Atencion del GG">
        <div className="space-y-2">
          {aiAlertsMock.slice(0, 3).map((alert) => (
            <div key={alert.id} className="rounded-md border border-slate-200 bg-white p-2.5">
              <p className="text-xs font-semibold text-slate-900">{alert.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{alert.message}</p>
            </div>
          ))}
        </div>
      </ContextSection>

      <ContextSection eyebrow="Proximos pasos" title="Fase 4B.1">
        <ol className="space-y-1.5 text-xs text-slate-600">
          <li className="rounded-md bg-slate-50 px-2.5 py-1.5">1. Validar densidad visual.</li>
          <li className="rounded-md bg-slate-50 px-2.5 py-1.5">2. Mantener datos mock.</li>
          <li className="rounded-md bg-slate-50 px-2.5 py-1.5">3. Preparar modos reales.</li>
        </ol>
      </ContextSection>
    </>
  );
}

function OfficeContext() {
  const selectedAgent = aiAgentsMock.find((agent) => agent.id === "general-manager");
  const collaborationCount = aiOfficeConnectionsMock.filter(
    (connection) => connection.kind === "collaboration",
  ).length;
  const pendingApprovals = mvpApprovalRequestsMock.filter(
    (approval) => approval.status === "pending",
  ).length;

  return (
    <>
      <ContextSection eyebrow="Agente seleccionado" title={selectedAgent?.name ?? "Gerente General"}>
        <div className="space-y-2">
          <p className="text-xs leading-5 text-slate-600">
            Rol central de supervision y aprobacion. Los agentes subordinados
            analizan, recomiendan y elevan decisiones sensibles.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ContextMetric label="Estado" value="Activo" />
            <ContextMetric label="Rol" value="GG" />
          </div>
        </div>
      </ContextSection>

      <ContextSection eyebrow="Colaboracion" title="Red multiagente">
        <div className="grid grid-cols-2 gap-2">
          <ContextMetric label="Conexiones" value={String(aiOfficeConnectionsMock.length)} />
          <ContextMetric label="Colaboracion" value={String(collaborationCount)} />
        </div>
        <div className="mt-2 space-y-1.5">
          {aiOfficeConnectionsMock.slice(0, 3).map((connection) => (
            <div key={connection.id} className="rounded-md bg-slate-50 px-2.5 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                {connection.kind}
              </p>
              <p className="mt-0.5 text-xs text-slate-700">{connection.label}</p>
            </div>
          ))}
        </div>
      </ContextSection>

      <ContextSection eyebrow="Aprobaciones" title="Bloqueos gerenciales">
        <div className="rounded-md border border-orange-200 bg-orange-50 p-2.5">
          <p className="text-xs font-semibold text-orange-800">
            {pendingApprovals} decision pendiente
          </p>
          <p className="mt-1 text-xs leading-5 text-orange-700">
            Ninguna accion critica se ejecuta sin aprobacion explicita del GG.
          </p>
        </div>
      </ContextSection>
    </>
  );
}

function InboxContext() {
  return (
    <>
      <AIApprovalWorkflowPanel approvals={mvpApprovalRequestsMock} />
      <AIMemoryPreviewPanel notes={mvpMemoryNotesMock} />
      <AISkillProposalPanel proposals={mvpSkillProposalsMock} />
    </>
  );
}

function ApprovalsContext() {
  const pendingCount = aiApprovalsQueueMock.filter(
    (approval) => approval.status === "pending",
  ).length;
  const highRiskCount = aiApprovalsQueueMock.filter(
    (approval) => approval.risk === "high" || approval.risk === "critical",
  ).length;
  const skillCount = aiApprovalsQueueMock.filter(
    (approval) => approval.category === "skill",
  ).length;

  return (
    <>
      <ContextSection eyebrow="Decision" title="Carga de aprobaciones">
        <div className="grid grid-cols-2 gap-2">
          <ContextMetric label="Pendientes" value={String(pendingCount)} />
          <ContextMetric label="Riesgo alto" value={String(highRiskCount)} />
          <ContextMetric label="Skills" value={String(skillCount)} />
          <ContextMetric label="Memoria" value="1" />
        </div>
      </ContextSection>

      <ContextSection eyebrow="Prioridad" title="Siguiente revision">
        <div className="rounded-md border border-orange-200 bg-orange-50 p-2.5">
          <p className="text-xs font-semibold text-orange-800">
            {aiApprovalsQueueMock[0].title}
          </p>
          <p className="mt-1 text-xs leading-5 text-orange-700">
            {aiApprovalsQueueMock[0].summary}
          </p>
        </div>
      </ContextSection>

      <ContextSection eyebrow="Regla" title="Control humano">
        <p className="text-xs leading-5 text-slate-600">
          Las acciones de aprobar, observar y rechazar son visuales. Ninguna
          decision critica se ejecuta sin aprobacion real del GG.
        </p>
      </ContextSection>
    </>
  );
}

function ProjectsContext() {
  const activeProject = aiProjectsMock[0];
  const atRiskCount = aiProjectsMock.filter(
    (project) => project.status === "at-risk" || project.status === "delayed",
  ).length;

  return (
    <>
      <ContextSection eyebrow="Portafolio" title="Pulso de proyectos">
        <div className="grid grid-cols-2 gap-2">
          <ContextMetric label="Proyectos" value={String(aiProjectsMock.length)} />
          <ContextMetric label="En riesgo" value={String(atRiskCount)} />
          <ContextMetric label="Costo mock" value="S/ 4.83 M" />
          <ContextMetric label="Disciplinas" value="3" />
        </div>
      </ContextSection>

      <ContextSection eyebrow="Proyecto foco" title={activeProject.name}>
        <div className="space-y-2">
          <p className="text-xs leading-5 text-slate-600">
            {activeProject.summary}
          </p>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Proximo hito
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-800">
              {activeProject.nextMilestone}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{activeProject.dueLabel}</p>
          </div>
        </div>
      </ContextSection>

      <ContextSection eyebrow="Agentes" title="Asignacion mock">
        <div className="flex flex-wrap gap-1.5">
          {activeProject.assignedAgents.map((agent) => (
            <span
              key={agent}
              className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700"
            >
              {agent}
            </span>
          ))}
        </div>
      </ContextSection>
    </>
  );
}

function SkillsContext() {
  const selectedSkill = aiSkillRegistryMock[1];
  const approvalRequiredCount = aiSkillRegistryMock.filter(
    (skill) => skill.approvalRequired,
  ).length;
  const activeCount = aiSkillRegistryMock.filter(
    (skill) => skill.status === "active",
  ).length;
  const proposedCount = aiSkillRegistryMock.filter(
    (skill) => skill.status === "proposed",
  ).length;
  const observedCount = aiSkillRegistryMock.filter(
    (skill) => skill.status === "observed",
  ).length;

  return (
    <>
      <ContextSection eyebrow="Registry" title="Estado de skills">
        <div className="grid grid-cols-2 gap-2">
          <ContextMetric label="Activas" value={String(activeCount)} />
          <ContextMetric label="Propuestas" value={String(proposedCount)} />
          <ContextMetric label="Observadas" value={String(observedCount)} />
          <ContextMetric label="Requieren GG" value={String(approvalRequiredCount)} />
        </div>
      </ContextSection>

      <ContextSection eyebrow="Version foco" title={selectedSkill.name}>
        <div className="space-y-2">
          <p className="text-xs leading-5 text-slate-600">
            {selectedSkill.activationTrigger}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ContextMetric label="Version" value={selectedSkill.version} />
            <ContextMetric label="Riesgo" value={selectedSkill.risk} />
          </div>
        </div>
      </ContextSection>

      <ContextSection eyebrow="Mejora" title="Dialogo entre agentes">
        <p className="text-xs leading-5 text-slate-600">
          {selectedSkill.crossAgentValidation.agents.join(" + ")} contrastan
          evidencia para proponer mejoras, pero no activan versiones sin GG.
        </p>
        <p className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-2 text-xs leading-5 text-blue-700">
          {selectedSkill.suggestedImprovement}
        </p>
      </ContextSection>

      <ContextSection eyebrow="Restriccion" title="Sin autoactivacion">
        <p className="text-xs leading-5 text-slate-600">
          Una skill propuesta no queda activa hasta que el GG apruebe version,
          alcance, riesgos, entradas y salida esperada.
        </p>
      </ContextSection>
    </>
  );
}

function ContextSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {eyebrow}
      </p>
      <h2 className="mt-0.5 text-sm font-semibold text-slate-950">{title}</h2>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function ContextMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
