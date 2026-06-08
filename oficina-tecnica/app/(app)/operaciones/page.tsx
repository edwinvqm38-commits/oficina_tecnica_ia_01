import Link from "next/link";

export default function OperacionesPage() {
  return (
    <section className="min-w-0">
      <div className="mb-6">
        <p className="page-eyebrow">Operaciones</p>
        <h1 className="page-title">Gestión de Proyectos SGP</h1>
        <p className="page-desc">
          Accede a los módulos de Cotizaciones, Requerimientos y Recursos del sistema SGP.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/cotizaciones"
          className="card block cursor-pointer transition-shadow hover:shadow-md"
        >
          <div className="card-body">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
                <circle cx="8" cy="8" r="6.5" />
                <path d="M8 4.5v7" />
                <path d="M5.5 6.5a2.5 1.5 0 015 0 2.5 1.5 0 01-5 0z" />
                <line x1="5.5" y1="10" x2="10.5" y2="10" />
              </svg>
            </div>
            <h2 className="section-title mb-1">Cotizaciones</h2>
            <p className="text-xs text-stone-500">
              Log de cotizaciones, workspace de propuestas técnicas y gestión de requerimientos asociados.
            </p>
          </div>
        </Link>

        <Link
          href="/requerimientos"
          className="card block cursor-pointer transition-shadow hover:shadow-md"
        >
          <div className="card-body">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
                <polyline points="1.5,8 8,4.5 14.5,8" />
                <polyline points="1.5,11 8,7.5 14.5,11" />
                <polyline points="1.5,5 8,1.5 14.5,5" />
              </svg>
            </div>
            <h2 className="section-title mb-1">Requerimientos</h2>
            <p className="text-xs text-stone-500">
              Gestión de requerimientos de materiales y servicios vinculados a cotizaciones ganadas.
            </p>
          </div>
        </Link>

        <Link
          href="/recursos"
          className="card block cursor-pointer transition-shadow hover:shadow-md"
        >
          <div className="card-body">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
                <path d="M1.5 4.5h4l1.5 2h7a1 1 0 011 1V13a1 1 0 01-1 1h-12a1 1 0 01-1-1V5.5a1 1 0 011-1z" />
              </svg>
            </div>
            <h2 className="section-title mb-1">Recursos</h2>
            <p className="text-xs text-stone-500">
              Catálogo de recursos técnicos: equipos, materiales, herramientas y servicios.
            </p>
          </div>
        </Link>
      </div>
    </section>
  );
}
