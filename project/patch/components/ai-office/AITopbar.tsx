// Topbar: min-h 48px (era 54px), sin iconos Unicode, chips sobrios

const systemBadges = ["Mock", "Sin backend", "Sin LLM real"];

export function AITopbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-[48px] items-center justify-between gap-2 px-3 py-1 sm:px-4">

        {/* Left */}
        <div className="flex min-w-0 items-center gap-2">
          {/* Project selector */}
          <div className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-400">
              {/* folder icon */}
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                <path d="M1.5 4.5h4l1.5 2h7a1 1 0 011 1V13a1 1 0 01-1 1h-12a1 1 0 01-1-1V5.5a1 1 0 011-1z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-slate-900">
                Proyecto Demo Ingeniería
              </p>
              <p className="text-[10px] text-slate-400">PRY-001 · PRY-002 · PRY-003</p>
            </div>
          </div>

          {/* System badges */}
          <div className="hidden items-center gap-1 md:flex">
            {systemBadges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500"
              >
                {badge}
              </span>
            ))}
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              IA: Simulado
            </span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5">
          {/* Alert indicator */}
          <div className="flex items-center gap-1.5 rounded border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            3 alertas
          </div>

          {/* GG user chip */}
          <div className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-700 text-[10px] font-bold text-white">
              GG
            </div>
            <div className="hidden sm:block">
              <p className="text-[12px] font-semibold leading-tight text-slate-900">Gerente General</p>
              <p className="text-[10px] text-slate-400">Aprobador</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
