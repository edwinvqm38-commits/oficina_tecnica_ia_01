"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  listAgentKnowledge,
  listAgentPerformanceSummary,
  listAgentSkillVersions,
  updateAgentKnowledgeStatus,
  type AgentKnowledgeItem,
  type AgentKnowledgeStatus,
  type AgentPerformanceSummary,
  type AgentSkillVersion,
} from "@/lib/ai-office/agentIntelligenceRepository";
import { useAuth } from "@/components/sgp/auth/AuthContext";

type PanelTab = "knowledge" | "performance" | "needs";
type KnowledgeFilter = AgentKnowledgeStatus | "all";

const STATUS_LABEL: Record<AgentKnowledgeStatus, string> = {
  proposed: "Propuesto",
  approved: "Aprobado",
  rejected: "Rechazado",
  archived: "Archivado",
};

function statusClass(status: AgentKnowledgeStatus): string {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "archived") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function excerpt(value: string, limit = 280): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}...`;
}

function groupByAgent<T extends { agentId: string }>(rows: T[]): Array<{ agentId: string; rows: T[] }> {
  const byAgent = new Map<string, T[]>();
  rows.forEach((row) => byAgent.set(row.agentId, [...(byAgent.get(row.agentId) ?? []), row]));
  return Array.from(byAgent.entries()).map(([agentId, agentRows]) => ({ agentId, rows: agentRows }));
}

function KnowledgeCard({
  row,
  canEdit,
  processing,
  onStatus,
}: {
  row: AgentKnowledgeItem;
  canEdit: boolean;
  processing: boolean;
  onStatus: (id: string, status: Exclude<AgentKnowledgeStatus, "proposed">) => void;
}) {
  const skillKey = typeof row.metadata.skill_key === "string" ? row.metadata.skill_key : null;
  const conversationId = typeof row.metadata.conversation_id === "string" ? row.metadata.conversation_id : null;
  const version = typeof row.metadata.version === "string" ? row.metadata.version : null;
  return (
    <article className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(row.status)}`}>{STATUS_LABEL[row.status]}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{row.knowledgeType}</span>
            <span className="text-[11px] text-slate-400">Imp. {row.importance ?? "-"}/5</span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-slate-950">{row.title}</h3>
        </div>
        {canEdit && row.status === "proposed" ? (
          <div className="flex gap-2">
            <button type="button" disabled={processing} onClick={() => onStatus(row.id, "approved")} className="h-7 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Aprobar</button>
            <button type="button" disabled={processing} onClick={() => onStatus(row.id, "rejected")} className="h-7 rounded-md border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 hover:bg-rose-100">Rechazar</button>
          </div>
        ) : null}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{excerpt(row.content)}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400">
        <span>Agente: {row.agentId.toUpperCase()}</span>
        <span>Origen: {row.source ?? "No registrado"}</span>
        <span>Creado: {formatDate(row.createdAt)}</span>
        <span>Modificado: {formatDate(row.updatedAt)}</span>
        {row.projectId ? <span>Proyecto: {row.projectId}</span> : null}
        {row.proposedBy ? <span>Propuesto por: {row.proposedBy}</span> : null}
        {row.approvedBy ? <span>Aprobado por: {row.approvedBy}</span> : null}
        {row.approvedAt ? <span>Aprobado: {formatDate(row.approvedAt)}</span> : null}
        {skillKey ? <span>Skill asociada: {skillKey}</span> : null}
        {conversationId ? <span>Conversación: {conversationId}</span> : null}
        {version ? <span>Versión: {version}</span> : null}
        {row.tags.length ? <span>Tags: {row.tags.join(", ")}</span> : null}
      </div>
    </article>
  );
}

function AgentNeedCard({
  row,
  approvedKnowledge,
  activeSkills,
  pendingProposals,
}: {
  row: AgentPerformanceSummary;
  approvedKnowledge: number;
  activeSkills: number;
  pendingProposals: number;
}) {
  const needs: string[] = [];
  if (row.negativeSignals > 0) needs.push(`${row.negativeSignals} correcciones o señales negativas registradas.`);
  if (row.groundedAnswers > 0 && approvedKnowledge === 0) needs.push("Tiene respuestas con datos reales, pero no conocimiento aprobado asociado.");
  if (activeSkills === 0 && row.answers > 0) needs.push("Tiene respuestas registradas sin skills activas asociadas.");
  if (pendingProposals > 0) needs.push(`${pendingProposals} propuestas pendientes de gobierno.`);

  return (
    <article className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{row.agentId.toUpperCase()}</h3>
          <p className="mt-1 text-xs text-slate-500">Señales derivadas de eventos y registros aprobables. No es diagnóstico automático.</p>
        </div>
        <Link href={`/chat?agent=${row.agentId}`} className="text-xs font-semibold text-blue-700">Abrir Chat</Link>
      </div>
      {needs.length ? (
        <div className="mt-3 grid gap-2">
          {needs.map((need) => <div key={need} className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">{need}</div>)}
        </div>
      ) : (
        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">Sin carencias detectables con los datos actuales.</div>
      )}
      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] leading-5 text-slate-600">
        Consulta preparada: “Según tus interacciones recientes y datos reales disponibles, identifica en qué temas has tenido falta de contexto, errores, correcciones o necesidad de apoyo. No inventes carencias.”
      </div>
    </article>
  );
}

function PerformanceCard({ row }: { row: AgentPerformanceSummary }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{row.agentId.toUpperCase()}</h3>
          <p className="mt-1 text-xs text-slate-500">Última actividad: {formatDate(row.lastEventAt)}</p>
        </div>
        <Link href={`/linea-tiempo?agent=${row.agentId}`} className="text-xs font-semibold text-blue-700">Ver timeline</Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-4">
        <span>Eventos: <b>{row.totalEvents}</b></span>
        <span>Respuestas: <b>{row.answers}</b></span>
        <span>Con datos reales: <b>{row.groundedAnswers}</b></span>
        <span>Correcciones/señales -: <b>{row.negativeSignals}</b></span>
        <span>Conoc. propuesto: <b>{row.knowledgeProposals}</b></span>
        <span>Conoc. aprobado: <b>{row.knowledgeApproved}</b></span>
        <span>Skills propuestas: <b>{row.skillProposals}</b></span>
        <span>Skills aprobadas: <b>{row.skillApproved}</b></span>
      </div>
    </article>
  );
}

export function AIKnowledgePanel() {
  const { isAdmin, user } = useAuth();
  const searchParams = useSearchParams();
  const agentFilter = searchParams.get("agent")?.trim() ?? "";
  const [tab, setTab] = useState<PanelTab>("knowledge");
  const [filter, setFilter] = useState<KnowledgeFilter>("approved");
  const [knowledge, setKnowledge] = useState<AgentKnowledgeItem[]>([]);
  const [skills, setSkills] = useState<AgentSkillVersion[]>([]);
  const [performance, setPerformance] = useState<AgentPerformanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  function applyLoadedData() {
    setLoading(true);
    Promise.all([listAgentKnowledge(), listAgentSkillVersions(), listAgentPerformanceSummary()])
      .then(([knowledgeResult, skillsResult, performanceResult]) => {
        setKnowledge(knowledgeResult.source === "supabase" ? knowledgeResult.rows : []);
        setSkills(skillsResult.source === "supabase" ? skillsResult.rows : []);
        setPerformance(performanceResult.source === "supabase" ? performanceResult.rows : []);
        setWarning([knowledgeResult.warning, skillsResult.warning, performanceResult.warning].filter(Boolean).join(" ") || null);
      })
      .catch(() => {
        setKnowledge([]);
        setSkills([]);
        setPerformance([]);
        setWarning("No se pudieron cargar las fuentes reales de conocimiento/desempeño.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAgentKnowledge(), listAgentSkillVersions(), listAgentPerformanceSummary()])
      .then(([knowledgeResult, skillsResult, performanceResult]) => {
        if (cancelled) return;
        setKnowledge(knowledgeResult.source === "supabase" ? knowledgeResult.rows : []);
        setSkills(skillsResult.source === "supabase" ? skillsResult.rows : []);
        setPerformance(performanceResult.source === "supabase" ? performanceResult.rows : []);
        setWarning([knowledgeResult.warning, skillsResult.warning, performanceResult.warning].filter(Boolean).join(" ") || null);
      })
      .catch(() => {
        if (cancelled) return;
        setKnowledge([]);
        setSkills([]);
        setPerformance([]);
        setWarning("No se pudieron cargar las fuentes reales de conocimiento/desempeño.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredKnowledge = useMemo(
    () => knowledge.filter((row) => (!agentFilter || row.agentId === agentFilter) && (filter === "all" || row.status === filter)),
    [agentFilter, filter, knowledge],
  );
  const knowledgeGroups = useMemo(() => groupByAgent(filteredKnowledge), [filteredKnowledge]);
  const activeSkillsByAgent = useMemo(() => groupByAgent(skills.filter((skill) => skill.status === "active")), [skills]);
  const counts = useMemo(() => ({
    approved: knowledge.filter((row) => (!agentFilter || row.agentId === agentFilter) && row.status === "approved").length,
    proposed: knowledge.filter((row) => (!agentFilter || row.agentId === agentFilter) && row.status === "proposed").length,
    rejected: knowledge.filter((row) => (!agentFilter || row.agentId === agentFilter) && row.status === "rejected").length,
    activeSkills: skills.filter((skill) => (!agentFilter || skill.agentId === agentFilter) && skill.status === "active").length,
  }), [agentFilter, knowledge, skills]);
  const visiblePerformance = useMemo(
    () => performance.filter((row) => !agentFilter || row.agentId === agentFilter),
    [agentFilter, performance],
  );

  function handleKnowledgeStatus(id: string, status: Exclude<AgentKnowledgeStatus, "proposed">) {
    setProcessingId(id);
    updateAgentKnowledgeStatus(id, status, user.email)
      .then(applyLoadedData)
      .catch(() => setWarning("No se pudo guardar la decisión sobre el conocimiento."))
      .finally(() => setProcessingId(null));
  }

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Conocimiento IA</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950">Base de conocimiento / memoria gobernada</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              El conocimiento aprobado permite reutilizar decisiones, criterios, documentos y aprendizajes validados en futuras consultas. No reentrena el modelo.
            </p>
          </div>
          <button type="button" onClick={applyLoadedData} className="h-8 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Actualizar</button>
        </div>
      </div>

      {warning ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{warning}</div> : null}

      <div className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-slate-50 p-1">
        <button type="button" onClick={() => setTab("knowledge")} className={`rounded px-3 py-1.5 text-xs font-semibold ${tab === "knowledge" ? "bg-blue-700 text-white" : "text-slate-600"}`}>Conocimiento</button>
        <button type="button" onClick={() => setTab("performance")} className={`rounded px-3 py-1.5 text-xs font-semibold ${tab === "performance" ? "bg-blue-700 text-white" : "text-slate-600"}`}>Desempeño</button>
        <button type="button" onClick={() => setTab("needs")} className={`rounded px-3 py-1.5 text-xs font-semibold ${tab === "needs" ? "bg-blue-700 text-white" : "text-slate-600"}`}>Necesidades</button>
      </div>

      {tab === "knowledge" ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="kpi"><div className="kpi-label">Aprobado</div><div className="kpi-value">{counts.approved}</div><div className="kpi-sub">agent_knowledge</div></div>
            <div className="kpi"><div className="kpi-label">Propuesto</div><div className="kpi-value">{counts.proposed}</div><div className="kpi-sub">pendiente revisión</div></div>
            <div className="kpi"><div className="kpi-label">Rechazado</div><div className="kpi-value">{counts.rejected}</div><div className="kpi-sub">registro real</div></div>
            <div className="kpi"><div className="kpi-label">Skills activas</div><div className="kpi-value">{counts.activeSkills}</div><div className="kpi-sub">agent_skill_versions</div></div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ["approved", "Aprobado"],
              ["proposed", "Propuesto"],
              ["rejected", "Rechazado"],
              ["all", "Todo"],
            ].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFilter(id as KnowledgeFilter)} className={`h-8 rounded-md border px-3 text-xs font-semibold ${filter === id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{label}</button>
            ))}
          </div>

          <div className="grid gap-3">
            {loading ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Cargando conocimiento...</div>
            ) : knowledgeGroups.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No hay conocimiento real para este filtro.</div>
            ) : (
              knowledgeGroups.map((group) => {
                const activeForAgent = activeSkillsByAgent.find((item) => item.agentId === group.agentId)?.rows.length ?? 0;
                const lastUpdate = group.rows.map((row) => row.updatedAt).filter(Boolean).sort().at(-1) ?? null;
                return (
                  <section key={group.agentId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-950">{group.agentId.toUpperCase()}</h2>
                        <p className="text-xs text-slate-500">Conocimiento: {group.rows.length} · Skills activas: {activeForAgent} · Última actualización: {formatDate(lastUpdate)}</p>
                      </div>
                      <Link href={`/organigrama?agent=${group.agentId}`} className="text-xs font-semibold text-blue-700">Ver agente</Link>
                    </div>
                    <div className="grid gap-2">
                      {group.rows.map((row) => (
                        <KnowledgeCard key={row.id} row={row} canEdit={isAdmin} processing={processingId === row.id} onStatus={handleKnowledgeStatus} />
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </>
      ) : tab === "performance" ? (
        <div className="space-y-3">
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
            Estas métricas son conteos directos de <b>v_agent_performance_summary</b>, derivada de <b>agent_performance_events</b>. No miden inteligencia ni calidad global del modelo.
          </div>
          {loading ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Cargando desempeño...</div>
          ) : visiblePerformance.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Sin eventos reales de desempeño registrados.</div>
          ) : (
            visiblePerformance.map((row) => <PerformanceCard key={row.agentId} row={row} />)
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            Necesidades usa señales reales disponibles. No inventa temas faltantes ni genera evaluación automática de calidad.
          </div>
          {loading ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Cargando señales...</div>
          ) : visiblePerformance.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Sin señales suficientes para detectar necesidades.</div>
          ) : (
            visiblePerformance.map((row) => (
              <AgentNeedCard
                key={row.agentId}
                row={row}
                approvedKnowledge={knowledge.filter((item) => item.agentId === row.agentId && item.status === "approved").length}
                activeSkills={skills.filter((skill) => skill.agentId === row.agentId && skill.status === "active").length}
                pendingProposals={
                  knowledge.filter((item) => item.agentId === row.agentId && item.status === "proposed").length +
                  skills.filter((skill) => skill.agentId === row.agentId && (skill.effectiveStatus === "proposed" || skill.effectiveStatus === "draft")).length
                }
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
