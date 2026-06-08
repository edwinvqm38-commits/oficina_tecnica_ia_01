import { aiActivitiesMock } from "@/lib/ai-office/aiActivitiesMock";

function getActorDotClass(actor: string) {
  if (actor.includes("Gerencia")) {
    return "bg-blue-700 ring-blue-100";
  }

  if (actor.includes("Costos")) {
    return "bg-orange-500 ring-orange-100";
  }

  if (actor.includes("Project")) {
    return "bg-sky-500 ring-sky-100";
  }

  return "bg-slate-500 ring-slate-100";
}

export function AIActivityPanel() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
        Actividad reciente
      </p>
      <h2 className="mt-1 text-xl font-semibold text-slate-950">
        Registro operacional mock
      </h2>
      <div className="relative mt-5 space-y-5 pl-5">
        <div className="absolute left-[9px] top-1 h-[calc(100%-0.5rem)] w-px bg-slate-200" />
        {aiActivitiesMock.map((activity) => (
          <div key={activity.id} className="relative flex gap-3">
            <div
              className={`absolute -left-5 mt-1.5 h-3 w-3 rounded-full ring-4 ${getActorDotClass(activity.actor)}`}
            />
            <div className="rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2">
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-950">
                  {activity.actor}
                </span>{" "}
                {activity.action} {activity.target}.
              </p>
              <p className="mt-1 text-xs text-slate-400">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
