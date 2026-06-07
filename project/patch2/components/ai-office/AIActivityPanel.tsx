// AIActivityPanel — compacto, sin heading oversized
import { aiActivitiesMock } from "@/lib/ai-office/aiActivitiesMock";

function getActorDotClass(actor: string) {
  if (actor.includes("Gerencia")) return "bg-blue-700";
  if (actor.includes("Costos"))   return "bg-slate-600";
  if (actor.includes("Project"))  return "bg-slate-500";
  return "bg-slate-400";
}

export function AIActivityPanel() {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3.5 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">
          Actividad reciente
        </p>
        <h2 className="text-[13px] font-semibold text-slate-950">Registro operacional mock</h2>
      </div>

      <div className="relative space-y-0 divide-y divide-slate-100 pl-0">
        {aiActivitiesMock.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 px-3.5 py-2.5">
            <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${getActorDotClass(activity.actor)}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-700">
                <span className="font-semibold text-slate-900">{activity.actor}</span>{" "}
                {activity.action} {activity.target}.
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
