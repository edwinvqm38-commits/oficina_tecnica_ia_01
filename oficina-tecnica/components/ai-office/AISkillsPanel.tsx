import { aiSkillsMock } from "@/lib/ai-office/aiSkillsMock";

function getSkillColor(agent: string) {
  if (agent.includes("Costos")) {
    return "bg-orange-500";
  }

  if (agent.includes("Project")) {
    return "bg-sky-500";
  }

  return "bg-blue-700";
}

export function AISkillsPanel() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
        Skills en mejora continua
      </p>
      <h2 className="mt-1 text-xl font-semibold text-slate-950">
        Capacidades versionadas mock
      </h2>
      <div className="mt-5 space-y-4">
        {aiSkillsMock.map((skill) => (
          <article key={skill.id}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold text-slate-950">{skill.name}</p>
                <p className="mt-1 text-slate-500">{skill.agent}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {skill.version}
                </span>
                <span className="font-semibold text-blue-700">
                  {skill.progress}%
                </span>
              </div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full ${getSkillColor(skill.agent)}`}
                style={{ width: `${skill.progress}%` }}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
