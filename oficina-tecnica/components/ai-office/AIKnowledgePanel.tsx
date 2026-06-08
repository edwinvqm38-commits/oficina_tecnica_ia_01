export function AIKnowledgePanel() {
  const collections = [
    "Notas ejecutivas mock",
    "Presupuestos simulados",
    "Cronogramas de referencia",
    "Politicas de aprobacion",
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Base de Conocimiento
        </p>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
          Obsidian
        </span>
      </div>
      <h2 className="mt-1 text-xl font-semibold text-slate-950">
        Base de conocimiento futura
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Este panel solo representa el espacio visual donde luego se conectara el
        contexto versionado de cada agente.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {collections.map((collection) => (
          <div
            key={collection}
            className="rounded-md border border-violet-100 bg-violet-50/60 p-3 text-sm font-medium text-slate-700 shadow-sm"
          >
            <span className="mr-2 text-violet-500">#</span>
            {collection}
          </div>
        ))}
      </div>
    </section>
  );
}
