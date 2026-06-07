import Link from "next/link";

export type AISidebarModule =
  | "dashboard"
  | "office"
  | "inbox"
  | "approvals"
  | "projects"
  | "pmo"
  | "costs"
  | "engineering"
  | "agents"
  | "skills"
  | "memory"
  | "settings";

type SidebarItem = {
  label: string;
  module: AISidebarModule;
  href: string;
  icon: AISidebarModule;
  badge?: string;
  available: boolean;
};

type SidebarGroup = {
  label: string;
  items: SidebarItem[];
};

type AISidebarProps = {
  activeModule: AISidebarModule;
};

// ── SVG icon set — 16×16, stroke-based, consistent weight ────────
function NavIcon({ name, className }: { name: AISidebarModule; className?: string }) {
  const cls = `h-4 w-4 shrink-0 ${className ?? ""}`;
  const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  const icons: Record<AISidebarModule, React.ReactElement> = {
    dashboard: (
      <svg viewBox="0 0 16 16" className={cls} {...base}>
        <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
        <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
        <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      </svg>
    ),
    office: (
      <svg viewBox="0 0 16 16" className={cls} {...base}>
        <circle cx="8" cy="2.5" r="1.5" />
        <circle cx="3" cy="11" r="1.5" />
        <circle cx="13" cy="11" r="1.5" />
        <path d="M8 4v3M8 7l-5 2.5M8 7l5 2.5" />
      </svg>
    ),
    inbox: (
      <svg viewBox="0 0 16 16" className={cls} {...base}>
        <path d="M1.5 10h3l1.5 3h4l1.5-3h3" />
        <path d="M1.5 3.5h13v9a1 1 0 01-1 1h-11a1 1 0 01-1-1V3.5z" />
        <path d="M8 6v4M6.5 8.5L8 10l1.5-1.5" />
      </svg>
    ),
    approvals: (
      <svg viewBox="0 0 16 16" className={cls} {...base}>
        <circle cx="8" cy="8" r="6.5" />
        <polyline points="5,8.5 7,10.5 11,6" />
      </svg>
    ),
    projects: (
      <svg viewBox="0 0 16 16" className={cls} {...base}>
        <path d="M1.5 5h13v8.5a1 1 0 01-1 1h-11a1 1 0 01-1-1V5z" />
        <path d="M5 5V3.5a1 1 0 011-1h4a1 1 0 011 1V5" />
        <line x1="1.5" y1="9" x2="14.5" y2="9" />
      </svg>
    ),
    pmo: (
      <svg viewBox="0 0 16 16" className={cls} {...base}>
        <rect x="1.5" y="3" width="13" height="11.5" rx="1" />
        <line x1="1.5" y1="7" x2="14.5" y2="7" />
        <line x1="5" y1="1.5" x2="5" y2="4.5" />
        <line x1="11" y1="1.5" x2="11" y2="4.5" />
      </svg>
    ),
    costs: (
      <svg viewBox="0 0 16 16" className={cls} {...base}>
        <circle cx="8" cy="8" r="6.5" />
        <line x1="8" y1="4.5" x2="8" y2="11.5" />
        <path d="M6 6.5a2 1.5 0 014 0 2 1.5 0 01-4 0" />
        <line x1="6" y1="10.5" x2="10" y2="10.5" />
      </svg>
    ),
    engineering: (
      <svg viewBox="0 0 16 16" className={cls} {...base}>
        <circle cx="8" cy="8" r="2.5" />
        <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6L11 5M5 11l-1.4 1.4" />
      </svg>
    ),
    agents: (
      <svg viewBox="0 0 16 16" className={cls} {...base}>
        <circle cx="6" cy="5" r="2.5" />
        <path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
        <circle cx="12" cy="5.5" r="2" />
        <path d="M13.5 10c1.5.5 2.5 2 2.5 3.5" />
      </svg>
    ),
    skills: (
      <svg viewBox="0 0 16 16" className={cls} {...base}>
        <path d="M8 1.5l1.7 4h4l-3.2 2.5 1.5 4.5L8 10l-4 2.5 1.5-4.5L2.3 5.5h4z" />
      </svg>
    ),
    memory: (
      <svg viewBox="0 0 16 16" className={cls} {...base}>
        <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
        <line x1="4.5" y1="5.5" x2="11.5" y2="5.5" />
        <line x1="4.5" y1="8" x2="11.5" y2="8" />
        <line x1="4.5" y1="10.5" x2="8" y2="10.5" />
      </svg>
    ),
    settings: (
      <svg viewBox="0 0 16 16" className={cls} {...base}>
        <circle cx="8" cy="8" r="2.5" />
        <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.5 3.5l1.3 1.3M11.2 11.2l1.3 1.3M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3" />
      </svg>
    ),
  };

  return icons[name] ?? null;
}

const sidebarGroups: SidebarGroup[] = [
  {
    label: "Principal",
    items: [
      { label: "Dashboard",         module: "dashboard", href: "/",            icon: "dashboard", available: true },
      { label: "Oficina IA",        module: "office",    href: "/oficina",     icon: "office",    available: true },
      { label: "Bandeja Gerencial", module: "inbox",     href: "/bandeja",     icon: "inbox",     badge: "1", available: true },
      { label: "Aprobaciones",      module: "approvals", href: "/aprobaciones",icon: "approvals", badge: "5", available: true },
    ],
  },
  {
    label: "Gestión de Proyectos",
    items: [
      { label: "Proyectos",   module: "projects",    href: "/proyectos",  icon: "projects",    badge: "4", available: true  },
      { label: "PMO",         module: "pmo",         href: "/pmo",        icon: "pmo",                     available: false },
      { label: "Costos",      module: "costs",       href: "/costos",     icon: "costs",                   available: false },
      { label: "Ingeniería",  module: "engineering", href: "/ingenieria", icon: "engineering",             available: false },
    ],
  },
  {
    label: "Inteligencia Operativa",
    items: [
      { label: "Agentes",            module: "agents", href: "/agentes", icon: "agents",                  available: false },
      { label: "Skills",             module: "skills", href: "/skills",  icon: "skills",  badge: "4",    available: true  },
      { label: "Memoria / Conoc.",   module: "memory", href: "/memoria", icon: "memory",  badge: "1",    available: false },
    ],
  },
  {
    label: "Sistema",
    items: [
      { label: "Configuración", module: "settings", href: "/configuracion", icon: "settings", available: false },
    ],
  },
];

export function AISidebar({ activeModule }: AISidebarProps) {
  return (
    <aside className="border-b border-slate-800 bg-[#0d1117] text-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-[240px] lg:border-b-0 lg:border-r lg:border-slate-800">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-slate-800 px-3 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-blue-600 text-[11px] font-bold">
            IG
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold leading-tight text-white">IA Gerencial</p>
            <p className="text-[10px] text-slate-500">Plataforma técnica</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex gap-2 overflow-x-auto px-2 py-2 lg:block lg:space-y-3 lg:overflow-y-auto lg:overflow-x-hidden lg:px-2 lg:py-3">
          {sidebarGroups.map((group) => (
            <div key={group.label} className="min-w-40 lg:min-w-0">
              <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.module}
                    item={item}
                    isActive={activeModule === item.module}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer status */}
        <div className="mt-auto hidden border-t border-slate-800 px-2 py-2.5 lg:block">
          <div className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <p className="text-[11px] font-semibold text-emerald-300">Control GG activo</p>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-slate-400">
              Toda acción crítica requiere aprobación gerencial.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SidebarNavItem({
  item,
  isActive,
}: {
  item: SidebarItem;
  isActive: boolean;
}) {
  const cls = [
    "flex h-8 items-center justify-between gap-2 rounded px-2 text-[12px] font-medium transition-colors",
    isActive
      ? "bg-white text-slate-950 shadow-sm"
      : item.available
        ? "text-slate-400 hover:bg-slate-800 hover:text-white"
        : "cursor-not-allowed text-slate-600",
  ].join(" ");

  const iconCls = isActive ? "text-blue-600" : item.available ? "text-slate-500" : "text-slate-700";

  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <NavIcon name={item.icon} className={iconCls} />
        <span className="truncate">{item.label}</span>
      </span>
      {item.badge ? (
        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white">
          {item.badge}
        </span>
      ) : !item.available ? (
        <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
          Próx
        </span>
      ) : null}
    </>
  );

  if (!item.available) {
    return (
      <span className={cls} aria-disabled="true">
        {content}
      </span>
    );
  }

  return (
    <Link href={item.href} className={cls}>
      {content}
    </Link>
  );
}
