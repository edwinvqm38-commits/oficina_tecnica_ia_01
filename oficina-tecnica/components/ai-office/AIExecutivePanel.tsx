export function AIExecutivePanel() {
  return (
    <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-md shadow-blue-100/60">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
        Panel ejecutivo
      </p>
      <h2 className="mt-1 text-xl font-semibold text-slate-950">
        Control gerencial
      </h2>
      <div className="mt-5 space-y-4">
        <div className="rounded-md bg-blue-700 p-4 text-white">
          <p className="text-sm text-blue-100">Prioridad del dia</p>
          <p className="mt-1 text-lg font-semibold">
            Mantener decisiones criticas bajo aprobacion humana.
          </p>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-100">
              <span>Salud operacional</span>
              <span>92%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-blue-500">
              <div className="h-2 w-[92%] rounded-full bg-white" />
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Salud" value="92%" />
          <Metric label="Riesgo" value="Medio" />
          <Metric label="Bloqueos" value="1" />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
