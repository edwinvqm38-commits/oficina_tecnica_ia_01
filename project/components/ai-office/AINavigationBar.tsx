import Link from "next/link";

type AINavigationBarProps = {
  activeView?: "overview" | "office" | "bandeja";
};

const navItems = [
  { href: "/", label: "Vista General", key: "overview" },
  { href: "/oficina", label: "Oficina Virtual", key: "office" },
  { href: "/bandeja", label: "Bandeja Gerencial", key: "bandeja" },
] as const;

export function AINavigationBar({
  activeView = "overview",
}: AINavigationBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 shadow-sm shadow-slate-200/50 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white shadow-md shadow-blue-200">
            IG
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              IA Gerencial
            </p>
            <h1 className="text-xl font-semibold text-slate-950">
              Oficina Virtual Multiagente
            </h1>
          </div>
        </div>
        <nav className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-sm font-medium text-slate-600 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={[
                "rounded-full px-4 py-2 transition",
                activeView === item.key
                  ? "bg-blue-700 text-white shadow-sm"
                  : "hover:bg-white hover:text-slate-950",
              ].join(" ")}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 sm:flex">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-300" />
            Sistema activo
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-sm font-bold text-blue-700 shadow-sm">
            GG
          </div>
        </div>
      </div>
    </header>
  );
}
