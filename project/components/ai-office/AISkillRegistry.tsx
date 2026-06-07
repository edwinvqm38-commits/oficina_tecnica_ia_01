import type {
  AISkillRegistryItem,
  AISkillRegistryRisk,
  AISkillRegistryStatus,
  AISkillType,
} from "@/lib/ai-office/aiSkillRegistryMock";

type AISkillRegistryProps = {
  skills: AISkillRegistryItem[];
};

// Paleta reducida: solo verde (activa), azul (propuesta), amber (observada), slate (resto)
const statusConfig: Record<AISkillRegistryStatus, { label: string; className: string }> = {
  active:     { label: "Activa",     className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  proposed:   { label: "Propuesta",  className: "border-blue-200   bg-blue-50   text-blue-700"     },
  observed:   { label: "Observada",  className: "border-amber-200  bg-amber-50  text-amber-700"    },
  deprecated: { label: "Deprecada",  className: "border-slate-200  bg-slate-50  text-slate-500"    },
};

const riskConfig: Record<AISkillRegistryRisk, { label: string; className: string }> = {
  low:    { label: "Bajo",   className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  medium: { label: "Medio",  className: "border-amber-200  bg-amber-50  text-amber-700"    },
  high:   { label: "Alto",   className: "border-orange-200 bg-orange-50 text-orange-700"   },
};

const typeLabel: Record<AISkillType, string> = {
  "analysis-workflow":  "Workflow de análisis",
  "review-protocol":    "Protocolo de revisión",
  "coordination-rule":  "Regla de coordinación",
  "knowledge-method":   "Método de conocimiento",
};

function countByStatus(skills: AISkillRegistryItem[], status: AISkillRegistryStatus) {
  return skills.filter((s) => s.status === status).length;
}

export function AISkillRegistry({ skills }: AISkillRegistryProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">
            Capacidades versionadas
          </p>
          <h2 className="text-[13px] font-semibold text-slate-950">
            Skills operativas de agentes IA
          </h2>
        </div>
        <div className="flex gap-1.5">
          <Chip label="Activas"    value={countByStatus(skills, "active")}   color="emerald" />
          <Chip label="Propuestas" value={countByStatus(skills, "proposed")} color="blue"    />
          <Chip label="Observadas" value={countByStatus(skills, "observed")} color="amber"   />
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {skills.map((skill) => (
          <SkillRow key={skill.id} skill={skill} />
        ))}
      </div>
    </section>
  );
}

function SkillRow({ skill }: { skill: AISkillRegistryItem }) {
  const status = statusConfig[skill.status];
  const risk   = riskConfig[skill.risk];

  return (
    <article className="grid gap-3 px-3.5 py-3 xl:grid-cols-[minmax(0,1fr)_17rem]">
      {/* Left */}
      <div className="min-w-0">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[9px] text-slate-400">{skill.id}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
            {status.label}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${risk.className}`}>
            {risk.label}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {typeLabel[skill.skillType]}
          </span>
          {skill.ggApproval.required && (
            <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
              GG decide
            </span>
          )}
        </div>

        {/* Name + trigger */}
        <h3 className="mt-1.5 text-[13px] font-semibold text-slate-950">{skill.name}</h3>
        <p className="mt-0.5 text-[11px] leading-5 text-slate-500">{skill.activationTrigger}</p>

        {/* Inputs + Steps — two columns, slate background only */}
        <div className="mt-2.5 grid gap-2 lg:grid-cols-2">
          <ListBlock title="Entradas esperadas" items={skill.expectedInputs} />
          <ListBlock title="Flujo resumido"     items={skill.workflowSteps} />
        </div>

        {/* Safety + Improvement + Cross validation — unified slate, no multi-color */}
        <div className="mt-2 grid gap-2 lg:grid-cols-3">
          <InfoBlock title="Reglas de seguridad">
            {skill.safetyRules.join(" ")}
          </InfoBlock>
          <InfoBlock title="Mejora sugerida">
            {skill.suggestedImprovement}
          </InfoBlock>
          <InfoBlock title="Validación cruzada">
            {skill.crossAgentValidation.agents.join(" + ")}: {skill.crossAgentValidation.purpose}
          </InfoBlock>
        </div>
      </div>

      {/* Right — ownership panel */}
      <aside className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Propiedad y aprobación
        </p>
        <div className="mt-1.5 space-y-1">
          <MetaLine label="Agente"     value={skill.ownerAgent}  />
          <MetaLine label="Disciplina" value={skill.discipline}  />
          <MetaLine label="Versión"    value={skill.version}     />
          <MetaLine label="Fecha"      value={skill.dateLabel}   />
        </div>
        {/* GG approval block — amber only */}
        <div className="mt-2 rounded border border-amber-100 bg-amber-50 px-2.5 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-700">
            Aprobación GG
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-amber-900">
            {skill.ggApproval.statusLabel}
          </p>
          <p className="mt-0.5 text-[10px] leading-4 text-amber-700">
            {skill.ggApproval.decisionScope}
          </p>
        </div>
      </aside>
    </article>
  );
}

// ── Primitives ──────────────────────────────────────────────────────
function Chip({ label, value, color }: { label: string; value: number; color: "emerald" | "blue" | "amber" }) {
  const cls = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue:    "border-blue-200   bg-blue-50   text-blue-700",
    amber:   "border-amber-200  bg-amber-50  text-amber-700",
  }[color];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}: {value}
    </span>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded border border-slate-100 bg-slate-50 px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">{title}</p>
      <ul className="mt-1 space-y-0.5 text-[11px] leading-5 text-slate-600">
        {items.slice(0, 4).map((item) => (
          <li key={item} className="flex gap-1.5">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: string }) {
  return (
    <div className="rounded border border-slate-100 bg-slate-50 px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-600">{children}</p>
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-slate-400">{label}</span>
      <span className="truncate text-right font-medium text-slate-700">{value}</span>
    </div>
  );
}
