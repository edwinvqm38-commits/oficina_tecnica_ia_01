"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FieldLabelIcon, type IconName } from "@/components/ui/FieldLabelIcon";
import { useAuth } from "@/components/auth/AuthContext";
import { readDataSourceSnapshot, subscribeToDataSourceSnapshot } from "@/lib/dataSourceDiagnostics";

const items = [
  { label: "Cotizaciones", href: "/cotizaciones", icon: "badge-dollar-sign" as IconName },
  { label: "Requerimientos", href: "/requerimientos", icon: "list-checks" as IconName },
  { label: "Detalle RQ", href: "/detalle-rq", icon: "table" as IconName },
  { label: "Recursos", href: "/recursos", icon: "package" as IconName },
  { label: "Datos", href: "/datos", icon: "layout-grid" as IconName },
  { label: "Administrador", href: "/administrador", icon: "settings2" as IconName },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { profile, user, isAdmin, signOut } = useAuth();
  const [workspaceLabel, setWorkspaceLabel] = useState("Workspace local");
  const displayName = profile.full_name || user.email || "Usuario";
  const displayRole = profile.role || "consulta";
  const visibleItems = items.filter((item) => item.href !== "/administrador" || isAdmin);

  useEffect(() => {
    setWorkspaceLabel(readDataSourceSnapshot()?.source === "supabase" ? "Workspace Supabase" : "Demo local");
    return subscribeToDataSourceSnapshot((snapshot) => {
      setWorkspaceLabel(snapshot?.source === "supabase" ? "Workspace Supabase" : "Demo local");
    });
  }, []);

  return (
    <aside className="w-44 shrink-0 basis-44 border-r border-stone-200/80 bg-stone-50/70 p-3">
      <div className="mb-3 rounded-lg border border-stone-200 bg-white px-2.5 py-2">
        <p className="text-sm font-bold text-stone-800">SGP-LITE</p>
        <p className="text-[11px] text-stone-500">Gestión operativa</p>
      </div>
      <nav className="space-y-1.5">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-8 items-center rounded-md border border-transparent px-2.5 text-sm font-bold text-stone-700 transition hover:border-stone-200 hover:bg-white hover:text-stone-900",
              pathname === item.href && "border-stone-200 bg-white text-stone-900 shadow-sm",
            )}
          >
            <FieldLabelIcon
              icon={item.icon}
              label={item.label}
              className="font-bold text-current [&_svg]:text-current [&_svg]:[stroke-width:2]"
            />
          </Link>
        ))}
      </nav>
      <div className="mt-4 rounded-lg border border-stone-200 bg-white px-2.5 py-2">
        <p className="truncate text-[11px] font-semibold text-stone-700">{displayName}</p>
        <p className="text-[10px] uppercase tracking-wide text-stone-500">{displayRole}</p>
        <button
          onClick={() => void signOut()}
          className="mt-2 inline-flex h-7 w-full items-center justify-center rounded-md border border-stone-300 bg-white px-2 text-[11px] font-semibold text-stone-700 transition hover:border-stone-400 hover:text-stone-900"
        >
          Cerrar sesión
        </button>
      </div>
      <div className="mt-4 rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[11px] text-stone-500">
        {workspaceLabel}
      </div>
    </aside>
  );
}
