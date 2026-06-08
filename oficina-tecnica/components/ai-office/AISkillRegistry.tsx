import type {
  AISkillRegistryItem,
  AISkillRegistryRisk,
  AISkillRegistryStatus,
  AISkillType,
} from "@/lib/ai-office/aiSkillRegistryMock";

type AISkillRegistryProps = {
  skills: AISkillRegistryItem[];
};

const statusConfig: Record<AISkillRegistryStatus, { label: string; className: string }> = {
  active: { label: "Activa", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  proposed: { label: "Propuesta", className: "border-blue-200 bg-blue-50 text-blue-700" },
  observed: { label: "Observada", className: "border-amber-200 bg-amber-50 text-amber-700" },
  deprecated: { label: "Deprecada", className: "border-slate-200 bg-slate-50 text-slate-500" },
};

const riskConfig: Record<AISkillRegistryRisk, { label: string; className: string }> = {
  low: { label: "Bajo", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  medium: { label: "Medio", className: "border-amber-200 bg-amber-50 text-amber-700" },
  high: { label: "Alto", className: "border-red-200 bg-red-50 text-red-700" },
};

const typeConfig: Record<AISkillType, string> = {
  "analysis-workflow": "Workflow de analisis",
  "review-protocol": "Protocolo de revision",
  "coordination-rule": "Regla de coordinacion",
  "knowledge-method": "Metodo de conocimiento",
};

export function AISkillRegistry({ skills }: AISkillRegistryProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">
            Capacidades versionadas
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-slate-950">
            Skills operativas de agentes IA
          </h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <RegistryChip label="Activas" value={countByStatus(skills, "active")} />
          <RegistryChip label="Propuestas" value={countByStatus(skills, "proposed")} />
          <RegistryChip label="Observadas" value={countByStatus(skills, "observed")} />
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
  const risk = riskConfig[skill.risk];

  return (
    <article className="grid gap-3 px-3.5 py-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>{skill.id}</Badge>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
            {status.label}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${risk.className}`}>
            Riesgo {risk.label}
          </span>
          <Badge>{typeConfig[skill.skillType]}</Badge>
          {skill.ggApproval.required ? (
            <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
              GG decide
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-950">{skill.name}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {skill.activationTrigger}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          <ListBlock title="Entradas esperadas" items={skill.expectedInputs} />
          <ListBlock title="Flujo resumido" items={skill.workflowSteps} />
        </div>

        <div className="mt-2 grid gap-2 lg:grid-cols-3">
          <CompactBlock
            title="Reglas de seguridad"
            body={skill.safetyRules.join(" ")}
            tone="orange"
          />
          <CompactBlock
            title="Mejora sugerida"
            body={skill.suggestedImprovement}
            tone="blue"
          />
          <CompactBlock
            title="Validacion cruzada"
            body={`${skill.crossAgentValidation.agents.join(" + ")}: ${skill.crossAgentValidation.purpose}`}
            tone="violet"
          />
        </div>
      </div>

      <aside className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Propiedad y aprobacion
        </p>
        <div className="mt-2 space-y-1.5 text-xs text-slate-600">
          <InfoLine label="Agente" value={skill.ownerAgent} />
          <InfoLine label="Disciplina" value={skill.discipline} />
          <InfoLine label="Version" value={skill.version} />
          <InfoLine label="Fecha" value={skill.dateLabel} />
        </div>
        <div className="mt-2 rounded-md border border-orange-100 bg-orange-50/50 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-orange-700">
            Aprobacion GG
          </p>
          <p className="mt-1 text-xs font-semibold text-orange-900">
            {skill.ggApproval.statusLabel}
          </p>
          <p className="mt-1 text-xs leading-5 text-orange-700">
            {skill.ggApproval.decisionScope}
          </p>
        </div>
      </aside>
    </article>
  );
}

function RegistryChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
      {label}: {value}
    </span>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
      {children}
    </span>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {title}
      </p>
      <ul className="mt-1.5 space-y-1 text-xs leading-5 text-slate-600">
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

function CompactBlock({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "orange" | "blue" | "violet";
}) {
  const toneClass = {
    orange: "border-orange-100 bg-orange-50/50 text-orange-700",
    blue: "border-blue-100 bg-blue-50/50 text-blue-700",
    violet: "border-violet-100 bg-violet-50/50 text-violet-700",
  }[tone];

  return (
    <div className={`rounded-md border px-2.5 py-2 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em]">
        {title}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{body}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1">
      <span className="text-slate-400">{label}</span>
      <span className="truncate text-right font-semibold text-slate-700">{value}</span>
    </p>
  );
}

function countByStatus(
  skills: AISkillRegistryItem[],
  status: AISkillRegistryStatus,
) {
  return skills.filter((skill) => skill.status === status).length;
}
