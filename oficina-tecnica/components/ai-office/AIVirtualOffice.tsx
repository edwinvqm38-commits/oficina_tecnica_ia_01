import { aiAgentsMock } from "@/lib/ai-office/aiAgentsMock";

export function AIVirtualOffice() {
  const [manager, costAgent, pmAgent] = aiAgentsMock;

  return (
    <section className="rounded-lg border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-slate-100 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Oficina virtual
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Vista operativa isometrica mock
          </h2>
        </div>
        <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-medium text-blue-700">
          3 roles
        </span>
      </div>

      <div className="mt-6 grid gap-4">
        <OfficeRoom
          title={manager.name}
          subtitle="Oficina central superior"
          accent="bg-blue-700"
          large
        />
        <div className="grid gap-4 md:grid-cols-2">
          <OfficeRoom
            title={costAgent.name}
            subtitle="Control presupuestal"
            accent="bg-orange-500"
          />
          <OfficeRoom
            title={pmAgent.name}
            subtitle="Gestion de cronograma"
            accent="bg-sky-500"
          />
        </div>
      </div>
    </section>
  );
}

type OfficeRoomProps = {
  title: string;
  subtitle: string;
  accent: string;
  large?: boolean;
};

function OfficeRoom({ title, subtitle, accent, large = false }: OfficeRoomProps) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-lg border border-white bg-white/85 p-4 shadow-sm",
        large ? "min-h-44" : "min-h-36",
      ].join(" ")}
    >
      <div className="absolute inset-x-6 bottom-5 h-10 skew-x-[-18deg] rounded-md bg-slate-200/80" />
      <div className="absolute right-5 top-5 h-14 w-20 skew-y-[-10deg] rounded-md border border-slate-200 bg-slate-50" />
      <div className="relative z-10 flex h-full min-h-28 flex-col justify-between">
        <span className={`h-2 w-16 rounded-full ${accent}`} />
        <div>
          <p className="text-sm font-medium text-slate-500">{subtitle}</p>
          <h3 className="mt-2 max-w-md text-lg font-semibold text-slate-950">
            {title}
          </h3>
        </div>
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-slate-300" />
          <span className="h-3 w-10 rounded-full bg-slate-200" />
          <span className="h-3 w-6 rounded-full bg-orange-200" />
        </div>
      </div>
    </div>
  );
}
