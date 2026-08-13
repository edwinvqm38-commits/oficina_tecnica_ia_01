"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  activateAgentSkillVersion,
  approveAgentSkillVersion,
  listAgentSkillVersions,
  updateAgentSkillStatus,
  type AgentSkillEffectiveStatus,
  type AgentSkillStatus,
  type AgentSkillVersion,
} from "@/lib/ai-office/agentIntelligenceRepository";
import { useAuth } from "@/components/sgp/auth/AuthContext";
import { PageHeader } from "../shell/PageHeader";
import { Icons } from "../../lib/icons";

type SkillFilter = "all" | "active" | "approved" | "review" | "proposed" | "history";
type SkillDialog = { kind: "approve" | "compare"; skill: AgentSkillVersion } | null;

const STATUS_LABEL: Record<AgentSkillEffectiveStatus, string> = {
  draft: "BORRADOR",
  proposed: "PROPUESTA",
  review: "EN REVISIÓN",
  approved: "APROBADA",
  active: "ACTIVA",
  observed: "OBSERVADA",
  rejected: "RECHAZADA",
  archived: "OBSOLETA",
};

const STATUS_HELP: Record<AgentSkillEffectiveStatus, string> = {
  draft: "Versión en elaboración; aún no entra a revisión.",
  proposed: "Versión enviada a gobierno; requiere decisión.",
  review: "Versión en revisión de gobierno; requiere aprobar, observar o rechazar.",
  approved: "GG autorizó esta versión, pero todavía no está activa en el agente.",
  active: "Esta versión ya está disponible para el agente.",
  observed: "La propuesta requiere ajustes antes de aprobarse.",
  rejected: "La propuesta fue rechazada.",
  archived: "Versión obsoleta o desactivada.",
};

const LIFECYCLE = ["Borrador", "Propuesta", "En revisión", "Aprobada", "Activa", "Nueva versión / Obsoleta"];

function statusClass(status: AgentSkillEffectiveStatus): string {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "approved") return "border-teal-200 bg-teal-50 text-teal-700";
  if (status === "review") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "observed") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "archived") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function versionNumber(value: string): number {
  const match = value.match(/(\d+(?:\.\d+){0,2})/);
  if (!match) return 0;
  return match[1].split(".").reduce((total, part, index) => total + Number(part) / Math.pow(100, index), 0);
}

function previousVersionFor(skill: AgentSkillVersion, skills: AgentSkillVersion[]): AgentSkillVersion | null {
  return skills
    .filter((candidate) => candidate.skillKey === skill.skillKey && candidate.id !== skill.id)
    .filter((candidate) => versionNumber(candidate.version) <= versionNumber(skill.version))
    .sort((a, b) => versionNumber(b.version) - versionNumber(a.version))[0] ?? null;
}

function changedClass(before: string, after: string): string {
  return before.trim() !== after.trim() ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white";
}

function SkillStatusBadge({ status }: { status: AgentSkillEffectiveStatus }) {
  return (
    <span title={STATUS_HELP[status]} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(status)}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function originLabel(skill: AgentSkillVersion): string {
  const source = String(skill.source ?? "").toLowerCase();
  if (source.includes("base") || source.includes("role")) return "Base de rol";
  if (source.includes("manual")) return "Manual";
  if (source.includes("agent")) return "Propuesta por agente";
  if (source.includes("system")) return "Propuesta por sistema";
  if (source.includes("feedback")) return "Mejora por feedback";
  return skill.source ?? "No registrado";
}

function AgentSummary({ agentId, skills }: { agentId: string; skills: AgentSkillVersion[] }) {
  const agentSkills = skills.filter((skill) => skill.agentId === agentId);
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-xs font-semibold text-slate-950">{agentId.toUpperCase()}</p>
      <p className="mt-1 text-[11px] text-slate-500">
        Activas: <b>{agentSkills.filter((skill) => skill.effectiveStatus === "active").length}</b> · Aprobadas: <b>{agentSkills.filter((skill) => skill.effectiveStatus === "approved").length}</b> · Pendientes: <b>{agentSkills.filter((skill) => skill.effectiveStatus === "proposed" || skill.effectiveStatus === "draft" || skill.effectiveStatus === "review").length}</b>
      </p>
    </div>
  );
}

function SkillRow({
  skill,
  expanded,
  previous,
  onToggle,
  onDialog,
  onStatus,
  onActivate,
  canEdit,
  processing,
}: {
  skill: AgentSkillVersion;
  expanded: boolean;
  previous: AgentSkillVersion | null;
  onToggle: () => void;
  onDialog: (dialog: SkillDialog) => void;
  onStatus: (id: string, status: AgentSkillStatus) => void;
  onActivate: (skill: AgentSkillVersion) => void;
  canEdit: boolean;
  processing: boolean;
}) {
  const status = skill.effectiveStatus;
  const canApprove = canEdit && (status === "proposed" || status === "review");
  const canActivate = canEdit && status === "approved";
  const canDeactivate = canEdit && status === "active";

  return (
    <div className="skill-row">
      <button type="button" className="skill-row-main" onClick={onToggle} style={{ width: "100%", textAlign: "left" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 5, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--t3)" }}>{skill.skillKey}</span>
            <SkillStatusBadge status={status} />
            <span className="badge badge--slate">{skill.skillType ?? "Tipo no registrado"}</span>
            <span className="badge badge--blue">Origen: {originLabel(skill)}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 2 }}>{skill.name}</div>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>{skill.summary}</div>
        </div>

        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>{skill.agentId.toUpperCase()}</span>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--t1)" }}>{skill.version}</span>
          </div>
          <span style={{ fontSize: 10, color: "var(--t3)" }}>{formatDate(skill.updatedAt)}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{expanded ? <Icons.chevronUp /> : <Icons.chevronDown />}</div>
        </div>
      </button>

      {expanded ? (
        <div className="skill-row-expand">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginBottom: 10 }}>
            <div className="detail-block">
              <div className="detail-block-title">¿Qué hace?</div>
              <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>{skill.summary || "Sin descripción funcional registrada."}</div>
            </div>
            <div className="detail-block">
              <div className="detail-block-title">¿Cuándo se activa?</div>
              <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>{skill.triggerText ?? "Sin trigger registrado."}</div>
            </div>
            <div className="detail-block">
              <div className="detail-block-title">Gobierno</div>
              <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>
                Origen: <b>{originLabel(skill)}</b><br />
                Propuesto por: <b>{skill.proposedBy ?? "No registrado"}</b><br />
                Aprobador: <b>{skill.approvedBy ?? "No registrado"}</b><br />
                Aprobado: <b>{formatDate(skill.approvedAt)}</b>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
            <div className="detail-block"><div className="detail-block-title">Entradas</div>{skill.inputs.length ? skill.inputs.map((item) => <div key={item} className="list-item-bullet">{item}</div>) : <div style={{ fontSize: 11, color: "var(--t3)" }}>Sin entradas registradas.</div>}</div>
            <div className="detail-block"><div className="detail-block-title">Workflow</div>{skill.workflow.length ? skill.workflow.map((item, index) => <div key={item} className="list-item-bullet"><b>{index + 1}.</b> {item}</div>) : <div style={{ fontSize: 11, color: "var(--t3)" }}>Sin workflow registrado.</div>}</div>
            <div className="detail-block"><div className="detail-block-title">Restricciones / riesgo</div>{skill.safetyRules.length ? skill.safetyRules.map((item) => <div key={item} className="list-item-bullet">{item}</div>) : <div style={{ fontSize: 11, color: "var(--t3)" }}>Sin reglas de seguridad registradas.</div>}</div>
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--t3)", marginRight: "auto" }}>{previous ? `Versión anterior: ${previous.version}` : "Sin versión anterior registrada."}</span>
            <button className="btn btn--ghost btn--sm" onClick={() => onDialog({ kind: "compare", skill })}>Comparar cambios</button>
            <Link href={`/conocimiento?agent=${skill.agentId}`} className="btn btn--ghost btn--sm">Conocimiento</Link>
            <Link href={`/linea-tiempo?skill=${skill.skillKey}`} className="btn btn--ghost btn--sm">Historial</Link>
            {status === "draft" ? <button className="btn btn--ghost btn--sm" disabled title="Requiere editor persistente">Editar</button> : null}
            {status === "draft" ? <button className="btn btn--primary btn--sm" disabled={processing} onClick={() => onStatus(skill.id, "review")}>Enviar a revisión</button> : null}
            {canApprove ? <button className="btn btn--success btn--sm" disabled={processing} onClick={() => onDialog({ kind: "approve", skill })}><Icons.check width={12} height={12} /> Aprobar</button> : null}
            {canActivate ? <button className="btn btn--success btn--sm" disabled={processing} onClick={() => onActivate(skill)}>Activar</button> : null}
            {canEdit && (status === "proposed" || status === "review") ? <button className="btn btn--warning btn--sm" disabled={processing} onClick={() => onStatus(skill.id, "observed")}><Icons.eye width={12} height={12} /> Observar</button> : null}
            {canEdit && (status === "proposed" || status === "review") ? <button className="btn btn--danger btn--sm" disabled={processing} onClick={() => onStatus(skill.id, "rejected")}><Icons.x width={12} height={12} /> Rechazar</button> : null}
            {status === "observed" ? <button className="btn btn--ghost btn--sm" disabled title="Requiere editor persistente">Editar propuesta</button> : null}
            {canEdit && status === "observed" ? <button className="btn btn--primary btn--sm" disabled={processing} onClick={() => onStatus(skill.id, "review")}>Reenviar</button> : null}
            {status === "rejected" ? <button className="btn btn--ghost btn--sm" disabled title="No hay motivo estructurado en agent_skill_versions">Ver motivo</button> : null}
            {status === "rejected" ? <button className="btn btn--ghost btn--sm" disabled title="Requiere flujo persistente de nueva versión">Crear nueva versión</button> : null}
            {canDeactivate ? <button className="btn btn--ghost btn--sm" disabled={processing} onClick={() => onStatus(skill.id, "archived")}>Desactivar</button> : null}
            {status === "active" ? <button className="btn btn--ghost btn--sm" disabled title="Requiere flujo de propuesta persistente">Proponer nueva versión</button> : null}
            {status === "active" ? <span className="badge badge--green">Esta skill está siendo utilizada actualmente por el agente.</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SkillDialogModal({
  dialog,
  skills,
  processing,
  onClose,
  onApprove,
  onObserve,
}: {
  dialog: SkillDialog;
  skills: AgentSkillVersion[];
  processing: boolean;
  onClose: () => void;
  onApprove: (skill: AgentSkillVersion) => void;
  onObserve: (id: string) => void;
}) {
  if (!dialog) return null;
  const skill = dialog.skill;
  const previous = previousVersionFor(skill, skills);
  const before = previous ?? null;
  const rows = [
    { label: "Descripción", before: before?.summary ?? "Sin versión anterior", after: skill.summary },
    { label: "Triggers", before: before?.triggerText ?? "Sin versión anterior", after: skill.triggerText ?? "Sin trigger registrado" },
    { label: "Inputs", before: before?.inputs.join("; ") || "Sin versión anterior", after: skill.inputs.join("; ") || "Sin inputs" },
    { label: "Workflow", before: before?.workflow.join("; ") || "Sin versión anterior", after: skill.workflow.join("; ") || "Sin workflow" },
    { label: "Restricciones", before: before?.safetyRules.join("; ") || "Sin versión anterior", after: skill.safetyRules.join("; ") || "Sin restricciones" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="max-h-[86vh] w-full max-w-4xl overflow-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-950">{dialog.kind === "approve" ? "Aprobar versión de skill" : "Comparar cambios"}</h3>
            <p className="mt-1 text-sm text-slate-500">{skill.name} · {skill.agentId.toUpperCase()} · {skill.version}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">Cerrar</button>
        </div>

        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs"><b>Estado</b><br />{STATUS_LABEL[skill.effectiveStatus]}</div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs"><b>Origen</b><br />{originLabel(skill)}</div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs"><b>Evidencia</b><br />No existe evidencia automática asociada.</div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs"><b>Versión anterior</b><br />{previous?.version ?? "No registrada"}</div>
        </div>

        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.label} className={`grid gap-2 rounded-md border p-2 md:grid-cols-[120px_1fr_1fr] ${changedClass(row.before, row.after)}`}>
              <div className="text-xs font-semibold text-slate-500">{row.label}</div>
              <div className="text-xs leading-5 text-slate-600"><b>Antes:</b><br />{row.before}</div>
              <div className="text-xs leading-5 text-slate-800"><b>Nueva versión:</b><br />{row.after}</div>
            </div>
          ))}
        </div>

        {dialog.kind === "approve" ? (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-xs leading-5 text-slate-500">Aprobar no activa automáticamente. Quedará como APROBADA hasta pulsar Activar.</p>
            <div className="flex gap-2">
              <button type="button" disabled={processing} onClick={() => onClose()} className="btn btn--ghost">Cancelar</button>
              <button type="button" disabled={processing} onClick={() => onObserve(skill.id)} className="btn btn--warning">Observar</button>
              <button type="button" disabled={processing} onClick={() => onApprove(skill)} className="btn btn--success">Aprobar versión</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SkillsView() {
  const { isAdmin, user } = useAuth();
  const searchParams = useSearchParams();
  const initialAgentFilter = searchParams.get("agent")?.trim() ?? "";
  const [skills, setSkills] = useState<AgentSkillVersion[]>([]);
  const [agentFilter, setAgentFilter] = useState(initialAgentFilter);
  const [filter, setFilter] = useState<SkillFilter>(initialAgentFilter ? "all" : "active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<SkillDialog>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    listAgentSkillVersions()
      .then((result) => {
        setSkills(result.source === "supabase" ? result.rows : []);
        setWarning(result.warning);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    listAgentSkillVersions()
      .then((result) => {
        if (cancelled) return;
        setSkills(result.source === "supabase" ? result.rows : []);
        setWarning(result.warning);
      })
      .catch(() => {
        if (!cancelled) {
          setSkills([]);
          setWarning("No se pudieron cargar skills reales.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleBase = useMemo(
    () => (agentFilter ? skills.filter((skill) => skill.agentId === agentFilter) : skills),
    [agentFilter, skills],
  );
  const counts = useMemo(() => ({
    all: visibleBase.length,
    active: visibleBase.filter((skill) => skill.effectiveStatus === "active").length,
    approved: visibleBase.filter((skill) => skill.effectiveStatus === "approved").length,
    review: visibleBase.filter((skill) => skill.effectiveStatus === "review" || skill.effectiveStatus === "observed").length,
    proposed: visibleBase.filter((skill) => skill.effectiveStatus === "proposed" || skill.effectiveStatus === "draft").length,
    history: visibleBase.filter((skill) => skill.effectiveStatus === "rejected" || skill.effectiveStatus === "archived").length,
  }), [visibleBase]);
  const filtered = useMemo(() => {
    if (filter === "all") return visibleBase;
    if (filter === "active") return visibleBase.filter((skill) => skill.effectiveStatus === "active");
    if (filter === "approved") return visibleBase.filter((skill) => skill.effectiveStatus === "approved");
    if (filter === "review") return visibleBase.filter((skill) => skill.effectiveStatus === "review" || skill.effectiveStatus === "observed");
    if (filter === "proposed") return visibleBase.filter((skill) => skill.effectiveStatus === "proposed" || skill.effectiveStatus === "draft");
    return visibleBase.filter((skill) => skill.effectiveStatus === "rejected" || skill.effectiveStatus === "archived");
  }, [filter, visibleBase]);
  const agentIds = useMemo(() => Array.from(new Set(skills.map((skill) => skill.agentId))).sort(), [skills]);

  function handleStatus(id: string, status: AgentSkillStatus) {
    setProcessingId(id);
    updateAgentSkillStatus(id, status, user.email)
      .then(refresh)
      .catch(() => setWarning("No se pudo guardar el estado de la skill."))
      .finally(() => setProcessingId(null));
  }

  function handleObserve(id: string) {
    setDialog(null);
    handleStatus(id, "observed");
  }

  function handleApprove(skill: AgentSkillVersion) {
    setProcessingId(skill.id);
    approveAgentSkillVersion(skill, user.email)
      .then(() => {
        setDialog(null);
        refresh();
        setWarning("Versión aprobada. Falta activar para que el agente la use.");
      })
      .catch(() => setWarning("No se pudo aprobar la versión."))
      .finally(() => setProcessingId(null));
  }

  function handleActivate(skill: AgentSkillVersion) {
    setProcessingId(skill.id);
    activateAgentSkillVersion(skill, user.email)
      .then(refresh)
      .catch(() => setWarning("No se pudo activar la skill."))
      .finally(() => setProcessingId(null));
  }

  const tabs: Array<{ id: SkillFilter; label: string; count: number }> = [
    { id: "all", label: "Todas", count: counts.all },
    { id: "active", label: "Activas", count: counts.active },
    { id: "approved", label: "Aprobadas", count: counts.approved },
    { id: "review", label: "En revisión", count: counts.review },
    { id: "proposed", label: "Propuestas", count: counts.proposed },
    { id: "history", label: "Historial", count: counts.history },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Skills"
        title="Capacidades operativas versionadas de los agentes"
        description="Una skill modifica cómo trabaja un agente mediante instrucciones, reglas, herramientas o workflows. No reentrena el modelo."
        actions={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div className="kpi" style={{ padding: "5px 10px" }}><span style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase" }}>Activas</span><span style={{ fontSize: 15, fontWeight: 700, color: "var(--green)", marginLeft: 6 }}>{counts.active}</span></div>
            <div className="kpi" style={{ padding: "5px 10px" }}><span style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase" }}>Aprobadas</span><span style={{ fontSize: 15, fontWeight: 700, color: "var(--blue)", marginLeft: 6 }}>{counts.approved}</span></div>
          </div>
        }
      />

      <div className="card" style={{ marginBottom: 12, padding: "10px 14px" }}>
        <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: 8 }}>Una skill es una capacidad operativa versionada. APROBADA significa autorizada por GG; ACTIVA significa que el agente ya la tiene disponible.</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{LIFECYCLE.map((step, index) => <div key={step} style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="badge badge--slate">{step}</span>{index < LIFECYCLE.length - 1 ? <span style={{ color: "var(--t3)" }}>→</span> : null}</div>)}</div>
      </div>

      {agentIds.length > 0 ? <div className="grid-3" style={{ marginBottom: 12 }}>{agentIds.map((agentId) => <AgentSummary key={agentId} agentId={agentId} skills={skills} />)}</div> : null}

      {warning ? <div className="card" style={{ marginBottom: 12, padding: "10px 14px", borderColor: "var(--amber-border)", background: "var(--amber-bg)" }}><div style={{ fontSize: 12, color: "var(--amber-text)", lineHeight: 1.5 }}>{warning}</div></div> : null}

      <div style={{ display: "flex", gap: 2, marginBottom: 10, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 3, width: "fit-content", flexWrap: "wrap" }}>
        <label className="mode-tab" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Agente:
          <select value={agentFilter} onChange={(event) => { setAgentFilter(event.target.value); setFilter("all"); }} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "3px 6px", fontSize: 12 }}>
            <option value="">Todos</option>
            {agentIds.map((agentId) => <option key={agentId} value={agentId}>{agentId.toUpperCase()}</option>)}
          </select>
        </label>
        {tabs.map((tab) => <button key={tab.id} className={`mode-tab ${filter === tab.id ? "mode-tab--active" : ""}`} onClick={() => setFilter(tab.id)}>{tab.label} ({tab.count})</button>)}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600, color: "var(--t3)", marginBottom: 1 }}>Registro real</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{agentFilter ? `agent_skill_versions · ${agentFilter.toUpperCase()}` : "agent_skill_versions"}</div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={refresh}>Actualizar</button>
        </div>
        {loading ? <div style={{ padding: 20, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>Cargando skills...</div> : null}
        {!loading && filtered.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>Sin skills reales en esta categoría.</div> : null}
        {!loading && filtered.map((skill) => <SkillRow key={skill.id} skill={skill} expanded={expandedId === skill.id} previous={previousVersionFor(skill, skills)} onToggle={() => setExpandedId((current) => current === skill.id ? null : skill.id)} onDialog={setDialog} onStatus={handleStatus} onActivate={handleActivate} canEdit={isAdmin} processing={processingId === skill.id} />)}
      </div>

      <SkillDialogModal dialog={dialog} skills={skills} processing={Boolean(processingId)} onClose={() => setDialog(null)} onApprove={handleApprove} onObserve={handleObserve} />
    </>
  );
}
