"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/sgp/supabaseClient";
import { useAuth } from "@/components/sgp/auth/AuthContext";

type KnowledgeStatus = "proposed" | "approved" | "rejected" | "archived";

type AgentKnowledgeRow = {
  id: string;
  agent_id: string;
  project_id: string | null;
  title: string;
  content: string;
  knowledge_type: string;
  status: KnowledgeStatus;
  source: string;
  importance: number;
  proposed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

type AgentSkillVersionRow = {
  id: string;
  agent_id: string;
  skill_key: string;
  name: string;
  version: string;
  status: "draft" | "proposed" | "active" | "observed" | "rejected" | "archived";
  discipline: string | null;
  skill_type: string | null;
  summary: string;
  trigger_text: string | null;
  updated_at: string;
};

type AgentPerformanceSummaryRow = {
  agent_id: string;
  total_events: number;
  score: number;
  answers: number;
  grounded_answers: number;
  knowledge_proposals: number;
  knowledge_approved: number;
  skill_proposals: number;
  skill_approved: number;
  negative_signals: number;
  useful_clarifications: number;
  last_event_at: string | null;
  level_label: string;
  confidence_score: number;
};

const STATUS_LABEL: Record<KnowledgeStatus, string> = {
  proposed: "Propuesto",
  approved: "Aprobado",
  rejected: "Rechazado",
  archived: "Archivado",
};

const SKILL_STATUS_LABEL: Record<AgentSkillVersionRow["status"], string> = {
  draft: "Borrador",
  proposed: "Propuesta",
  active: "Activa",
  observed: "Observada",
  rejected: "Rechazada",
  archived: "Archivada",
};

const AGENT_LABEL: Record<string, string> = {
  ic: "Ing. de Costos",
  pm: "Project Management",
  ie: "Ing. Eléctrico",
  gg: "Gerencia",
};

function statusClass(status: KnowledgeStatus): string {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "archived") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function skillStatusClass(status: AgentSkillVersionRow["status"]): string {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "observed") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "archived") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export function AIKnowledgePanel() {
  const { isAdmin, user } = useAuth();
  const [rows, setRows] = useState<AgentKnowledgeRow[]>([]);
  const [skills, setSkills] = useState<AgentSkillVersionRow[]>([]);
  const [performance, setPerformance] = useState<AgentPerformanceSummaryRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<KnowledgeStatus | "all">("proposed");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [skillsMessage, setSkillsMessage] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setSkillsMessage(null);
    let query = supabase
      .from("agent_knowledge")
      .select("id,agent_id,project_id,title,content,knowledge_type,status,source,importance,proposed_by,approved_by,approved_at,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(120);

    if (!isAdmin) query = query.eq("status", "approved");

    const { data, error } = await query;
    if (error) {
      setRows([]);
      setMessage(
        error.message.includes("agent_knowledge")
          ? "Aún falta ejecutar supabase/sql/180_agent_memory_layers.sql para activar conocimiento permanente."
          : `No se pudo cargar conocimiento: ${error.message}`,
      );
      setLoading(false);
      return;
    }

    setRows((data ?? []) as AgentKnowledgeRow[]);

    const [skillsResult, performanceResult] = await Promise.all([
      supabase
        .from("agent_skill_versions")
        .select("id,agent_id,skill_key,name,version,status,discipline,skill_type,summary,trigger_text,updated_at")
        .order("updated_at", { ascending: false })
        .limit(80),
      supabase
        .from("v_agent_performance_summary")
        .select("agent_id,total_events,score,answers,grounded_answers,knowledge_proposals,knowledge_approved,skill_proposals,skill_approved,negative_signals,useful_clarifications,last_event_at,level_label,confidence_score")
        .order("score", { ascending: false }),
    ]);

    if (skillsResult.error || performanceResult.error) {
      setSkills([]);
      setPerformance([]);
      setSkillsMessage("Ejecuta supabase/sql/190_agent_skills_and_performance.sql para activar skills versionables e indicadores.");
    } else {
      setSkills((skillsResult.data ?? []) as AgentSkillVersionRow[]);
      setPerformance((performanceResult.data ?? []) as AgentPerformanceSummaryRow[]);
    }

    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(
    () => rows.filter((row) => statusFilter === "all" || row.status === statusFilter),
    [rows, statusFilter],
  );

  const counts = useMemo(
    () => ({
      proposed: rows.filter((row) => row.status === "proposed").length,
      approved: rows.filter((row) => row.status === "approved").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
      all: rows.length,
    }),
    [rows],
  );

  async function updateStatus(row: AgentKnowledgeRow, status: KnowledgeStatus) {
    if (!isAdmin) return;
    setMessage(null);
    const patch: Partial<AgentKnowledgeRow> = {
      status,
      approved_by: status === "approved" ? user.email : row.approved_by,
      approved_at: status === "approved" ? new Date().toISOString() : row.approved_at,
    };
    const { error } = await supabase.from("agent_knowledge").update(patch).eq("id", row.id);
    if (error) {
      setMessage(`No se pudo actualizar: ${error.message}`);
      return;
    }
    if (status === "approved") {
      await supabase.from("agent_performance_events").insert({
        agent_id: row.agent_id,
        project_id: row.project_id,
        conversation_scope: "system",
        event_type: "knowledge_approved",
        score_delta: 8,
        source: "knowledge_panel",
        message: row.title,
        created_by: user.email,
        metadata: { knowledge_id: row.id, knowledge_type: row.knowledge_type },
      });
    }
    await loadRows();
  }

  async function updateSkillStatus(row: AgentSkillVersionRow, status: AgentSkillVersionRow["status"]) {
    if (!isAdmin) return;
    setSkillsMessage(null);
    const patch = {
      status,
      approved_by: status === "active" ? user.email : null,
      approved_at: status === "active" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("agent_skill_versions").update(patch).eq("id", row.id);
    if (error) {
      setSkillsMessage(`No se pudo actualizar skill: ${error.message}`);
      return;
    }

    if (status === "active") {
      await supabase.from("agent_performance_events").insert({
        agent_id: row.agent_id,
        conversation_scope: "system",
        event_type: "skill_approved",
        score_delta: 8,
        source: "knowledge_panel",
        message: `${row.name} ${row.version}`,
        created_by: user.email,
        metadata: { skill_key: row.skill_key, version: row.version },
      });
    }
    await loadRows();
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Indicadores IA</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Nivel y desempeno por agente</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              El nivel sube con respuestas utiles, uso de datos reales, conocimiento aprobado y skills activas; baja con correcciones o senales negativas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadRows()}
            className="h-8 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Actualizar
          </button>
        </div>

        {skillsMessage ? <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{skillsMessage}</div> : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {performance.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 md:col-span-2 xl:col-span-4">
              Sin eventos de desempeno todavia. Apareceran despues de conversar con los agentes y ejecutar el SQL 190.
            </div>
          ) : (
            performance.map((row) => (
              <article key={row.agent_id} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{AGENT_LABEL[row.agent_id] ?? row.agent_id.toUpperCase()}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.level_label}</div>
                  </div>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {row.confidence_score}/100
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${row.confidence_score}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <span>Score: <b>{row.score}</b></span>
                  <span>Eventos: <b>{row.total_events}</b></span>
                  <span>Con datos: <b>{row.grounded_answers}</b></span>
                  <span>Senales -: <b>{row.negative_signals}</b></span>
                </div>
                <div className="mt-3 text-[11px] text-slate-400">Ultimo: {formatDate(row.last_event_at)}</div>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Skills versionables</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Capacidades aprobables</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Cada skill tiene version, estado y alcance. Las propuestas se revisan antes de convertirse en comportamiento estable del agente.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">{skills.length} skills</span>
        </div>

        <div className="mt-4 grid gap-3">
          {skills.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Sin skills versionables registradas.
            </div>
          ) : (
            skills.map((skill) => (
              <article key={skill.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${skillStatusClass(skill.status)}`}>
                        {SKILL_STATUS_LABEL[skill.status]}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {AGENT_LABEL[skill.agent_id] ?? skill.agent_id.toUpperCase()}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">{skill.version}</span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-slate-950">{skill.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{skill.summary}</p>
                    {skill.trigger_text ? <p className="mt-2 text-xs text-slate-500">Dispara cuando: {skill.trigger_text}</p> : null}
                  </div>
                  {isAdmin && skill.status !== "active" ? (
                    <button
                      type="button"
                      onClick={() => void updateSkillStatus(skill, "active")}
                      className="h-7 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Activar
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Conocimiento IA</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Memoria permanente aprobada</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Las reglas que los agentes aprenden quedan primero como propuestas. Solo lo aprobado se usa como conocimiento estable.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRows()}
          className="h-8 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Actualizar
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ["proposed", `Propuestos ${counts.proposed}`],
          ["approved", `Aprobados ${counts.approved}`],
          ["rejected", `Rechazados ${counts.rejected}`],
          ["all", `Todos ${counts.all}`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key as KnowledgeStatus | "all")}
            className={`h-8 rounded-md border px-3 text-xs font-semibold ${
              statusFilter === key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message ? <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</div> : null}

      <div className="mt-4 grid gap-3">
        {loading ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Cargando conocimiento...</div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            No hay registros para este filtro.
          </div>
        ) : (
          filteredRows.map((row) => (
            <article key={row.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(row.status)}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {AGENT_LABEL[row.agent_id] ?? row.agent_id.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-slate-400">Imp. {row.importance}/5</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-slate-950">{row.title}</h3>
                </div>
                {isAdmin && row.status === "proposed" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void updateStatus(row, "approved")}
                      className="h-7 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStatus(row, "rejected")}
                      className="h-7 rounded-md border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Rechazar
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{row.content}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400">
                <span>Creado: {formatDate(row.created_at)}</span>
                {row.project_id ? <span>Proyecto: {row.project_id}</span> : null}
                {row.proposed_by ? <span>Propuesto por: {row.proposed_by}</span> : null}
                {row.approved_by ? <span>Aprobado por: {row.approved_by}</span> : null}
              </div>
            </article>
          ))
        )}
      </div>
      </div>
    </section>
  );
}
