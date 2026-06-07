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
  variant: "dashboard" | "office" | "inbox" | "approvals" | "projects" | "skills";
};

const contextTitle: Record<AIContextPanelProps["variant"], string> = {
  dashboard: "Pulso gerencial",
  office:    "Contexto de agente",
  inbox:     "Decisión activa",
  approvals: "Centro de decisión",
  projects:  "Proyecto activo",
  skills:    "Lifecycle de skills",
};

export function AIContextPanel({ variant }: AIContextPanelProps) {
  return (
    <aside className="border-t border-slate-200 bg-slate-50 px-2.5 py-3 xl:sticky xl:top-[48px] xl:h-[calc(100vh-48px)] xl:overflow-y-auto xl:border-l xl:border-t-0">
      {/* Panel header */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-[12px] font-semibold text-slate-700">{contextTitle[variant]}</h2>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-400">
          Mock
        </span>
      </div>

      <div className="space-y-2">
        {variant === "dashboard"  ? <DashboardContext  /> : null}
        {variant === "office"     ? <OfficeContext     /> : null}
        {variant === "inbox"      ? <InboxContext      /> : null}
        {variant === "approvals"  ? <ApprovalsContext  /> : null}
        {variant === "projects"   ? <ProjectsContext   /> : null}
        {variant === "skills"     ? <SkillsContext     /> : null}
      </div>
    </aside>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────
function DashboardContext() {
  const pendingApprovals = mvpApprovalRequestsMock.filter((a) => a.status === "pending").length;
  return (
    <>
      <CtxCard title="Pulso operativo">
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Alertas"       value={String(aiAlertsMock.length)} />
          <Metric label="Aprobaciones"  value={String(pendingApprovals)} />
          <Metric label="Agentes"       value={String(aiAgentsMock.length - 1)} />
          <Metric label="Actividad"     value={String(aiActivitiesMock.length)} />
        </div>
      </CtxCard>

      <CtxCard title="Atención del GG">
        <div className="space-y-1.5">
          {aiAlertsMock.slice(0, 3).map((alert) => (
            <div key={alert.id} className="rounded border border-slate-100 bg-white p-2">
              <p className="text-[11px] font-semibold text-slate-800">{alert.title}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{alert.message}</p>
            </div>
          ))}
        </div>
      </CtxCard>
    </>
  );
}

// ── Office ─────────────────────────────────────────────────────────
function OfficeContext() {
  const selectedAgent = aiAgentsMock.find((a) => a.id === "general-manager");
  const collabCount   = aiOfficeConnectionsMock.filter((c) => c.kind === "collaboration").length;
  const pending       = mvpApprovalRequestsMock.filter((a) => a.status === "pending").length;
  return (
    <>
      <CtxCard title={selectedAgent?.name ?? "Gerente General"}>
        <p className="text-[11px] leading-5 text-slate-500">
          Rol central de supervisión y aprobación. Los agentes analizan y elevan decisiones sensibles.
        </p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <Metric label="Estado" value="Activo" />
          <Metric label="Rol"    value="GG" />
        </div>
      </CtxCard>

      <CtxCard title="Red multiagente">
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Conexiones"  value={String(aiOfficeConnectionsMock.length)} />
          <Metric label="Colaboración" value={String(collabCount)} />
        </div>
        <div className="mt-1.5 space-y-1">
          {aiOfficeConnectionsMock.slice(0, 3).map((c) => (
            <div key={c.id} className="rounded border border-slate-100 bg-white px-2 py-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">{c.kind}</p>
              <p className="text-[11px] text-slate-600">{c.label}</p>
            </div>
          ))}
        </div>
      </CtxCard>

      <CtxCard title="Bloqueos">
        <div className="rounded border border-orange-100 bg-orange-50 px-2 py-1.5">
          <p className="text-[11px] font-semibold text-orange-800">{pending} decisión pendiente</p>
          <p className="mt-0.5 text-[10px] leading-4 text-orange-600">
            Ninguna acción crítica se ejecuta sin aprobación del GG.
          </p>
        </div>
      </CtxCard>
    </>
  );
}

// ── Inbox ──────────────────────────────────────────────────────────
function InboxContext() {
  return (
    <>
      <AIApprovalWorkflowPanel approvals={mvpApprovalRequestsMock} />
      <AIMemoryPreviewPanel    notes={mvpMemoryNotesMock} />
      <AISkillProposalPanel    proposals={mvpSkillProposalsMock} />
    </>
  );
}

// ── Approvals ──────────────────────────────────────────────────────
function ApprovalsContext() {
  const pendingCount  = aiApprovalsQueueMock.filter((a) => a.status === "pending").length;
  const highRiskCount = aiApprovalsQueueMock.filter((a) => a.risk === "high" || a.risk === "critical").length;
  const skillCount    = aiApprovalsQueueMock.filter((a) => a.category === "skill").length;
  const first         = aiApprovalsQueueMock[0];
  return (
    <>
      <CtxCard title="Carga de aprobaciones">
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Pendientes"  value={String(pendingCount)} />
          <Metric label="Riesgo alto" value={String(highRiskCount)} />
          <Metric label="Skills"      value={String(skillCount)} />
          <Metric label="Memoria"     value="1" />
        </div>
      </CtxCard>

      <CtxCard title="Siguiente revisión">
        <div className="rounded border border-orange-100 bg-orange-50 px-2 py-1.5">
          <p className="text-[11px] font-semibold text-orange-800">{first.title}</p>
          <p className="mt-0.5 text-[10px] leading-4 text-orange-600">{first.summary}</p>
        </div>
      </CtxCard>

      <CtxCard title="Control humano">
        <p className="text-[11px] leading-5 text-slate-500">
          Las acciones de aprobar, observar y rechazar son visuales. Ninguna decisión crítica
          se ejecuta sin aprobación real del GG.
        </p>
      </CtxCard>
    </>
  );
}

// ── Projects ───────────────────────────────────────────────────────
function ProjectsContext() {
  const active      = aiProjectsMock[0];
  const atRiskCount = aiProjectsMock.filter((p) => p.status === "at-risk" || p.status === "delayed").length;
  return (
    <>
      <CtxCard title="Portafolio">
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Proyectos"  value={String(aiProjectsMock.length)} />
          <Metric label="En riesgo"  value={String(atRiskCount)} />
          <Metric label="Costo mock" value="S/ 4.83 M" />
          <Metric label="Disciplinas" value="3" />
        </div>
      </CtxCard>

      <CtxCard title={active.name}>
        <p className="text-[11px] leading-5 text-slate-500">{active.summary}</p>
        <div className="mt-1.5 rounded border border-slate-100 bg-white px-2 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Próximo hito</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-800">{active.nextMilestone}</p>
          <p className="text-[10px] text-slate-400">{active.dueLabel}</p>
        </div>
      </CtxCard>

      <CtxCard title="Agentes asignados">
        <div className="flex flex-wrap gap-1">
          {active.assignedAgents.map((a) => (
            <span key={a} className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              {a}
            </span>
          ))}
        </div>
      </CtxCard>
    </>
  );
}

// ── Skills ─────────────────────────────────────────────────────────
function SkillsContext() {
  const selected         = aiSkillRegistryMock[1];
  const activeCount      = aiSkillRegistryMock.filter((s) => s.status === "active").length;
  const proposedCount    = aiSkillRegistryMock.filter((s) => s.status === "proposed").length;
  const observedCount    = aiSkillRegistryMock.filter((s) => s.status === "observed").length;
  const ggRequiredCount  = aiSkillRegistryMock.filter((s) => s.approvalRequired).length;
  return (
    <>
      <CtxCard title="Estado de skills">
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Activas"     value={String(activeCount)} />
          <Metric label="Propuestas"  value={String(proposedCount)} />
          <Metric label="Observadas"  value={String(observedCount)} />
          <Metric label="Req. GG"     value={String(ggRequiredCount)} />
        </div>
      </CtxCard>

      <CtxCard title={selected.name}>
        <p className="text-[11px] leading-5 text-slate-500">{selected.activationTrigger}</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <Metric label="Versión" value={selected.version} />
          <Metric label="Riesgo"  value={selected.risk} />
        </div>
      </CtxCard>

      <CtxCard title="Sin autoactivación">
        <p className="text-[11px] leading-5 text-slate-500">
          Una skill propuesta no queda activa hasta que el GG apruebe versión, alcance,
          riesgos, entradas y salida esperada.
        </p>
      </CtxCard>
    </>
  );
}

// ── Primitives ─────────────────────────────────────────────────────
function CtxCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-2.5 py-2">
        <p className="text-[11px] font-semibold text-slate-700">{title}</p>
      </div>
      <div className="p-2.5">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-900">{value}</p>
    </div>
  );
}
