import type { IconName } from "./icons";

export type RouteId =
  | "dashboard"
  | "office"
  | "roundtable"
  | "chat"
  | "inbox"
  | "approvals"
  | "projects"
  | "operaciones"
  | "cotizaciones"
  | "requerimientos"
  | "recursos"
  | "datos"
  | "administrador"
  | "report"
  | "costs"
  | "engineering"
  | "agents"
  | "org"
  | "skills"
  | "memory"
  | "timeline"
  | "connections"
  | "wiki-ia"
  | "admin-users"
  | "settings";

export type RouteDef = {
  id: RouteId;
  label: string;
  path: string;
  icon: IconName;
  children?: RouteDef[];
  disabled?: boolean;
};

export type SidebarGroup = {
  label: string;
  items: RouteDef[];
};

export const ROUTE_GROUPS: SidebarGroup[] = [
  {
    label: "Principal",
    items: [
      { id: "dashboard", label: "Dashboard", path: "/", icon: "dashboard" },
      { id: "office", label: "Oficina IA", path: "/oficina", icon: "office" },
      { id: "roundtable", label: "Mesa de trabajo", path: "/mesa-trabajo", icon: "agents" },
      { id: "chat", label: "Chat privado", path: "/chat", icon: "user" },
      { id: "inbox", label: "Bandeja Gerencial", path: "/bandeja", icon: "inbox" },
      { id: "approvals", label: "Aprobaciones", path: "/aprobaciones", icon: "approvals" },
    ],
  },
  {
    label: "Gestión de Proyectos",
    items: [
      { id: "projects", label: "Proyectos", path: "/proyectos", icon: "projects" },
      {
        id: "operaciones",
        label: "Operaciones SGP",
        path: "/operaciones",
        icon: "folder",
        children: [
          { id: "cotizaciones", label: "Cotizaciones", path: "/cotizaciones", icon: "costs" },
          { id: "requerimientos", label: "Requerimientos", path: "/requerimientos", icon: "layers" },
          { id: "recursos", label: "Recursos", path: "/recursos", icon: "folder" },
          { id: "datos", label: "Datos", path: "/datos", icon: "memory" },
          { id: "administrador", label: "Administrador", path: "/administrador", icon: "settings" },
        ],
      },
      { id: "report", label: "Reporte ejecutivo", path: "/reporte", icon: "layers", disabled: true },
      { id: "costs", label: "Costos", path: "/costos", icon: "costs", disabled: true },
      { id: "engineering", label: "Ingeniería", path: "/ingenieria", icon: "engineering", disabled: true },
    ],
  },
  {
    label: "Inteligencia Operativa",
    items: [
      { id: "agents", label: "Agentes", path: "/agentes", icon: "agents" },
      { id: "org", label: "Organigrama", path: "/organigrama", icon: "office" },
      { id: "skills", label: "Skills", path: "/skills", icon: "skills" },
      { id: "memory", label: "Conocimiento", path: "/conocimiento", icon: "memory" },
      { id: "timeline", label: "Línea de tiempo", path: "/linea-tiempo", icon: "clock" },
      { id: "connections", label: "Conexiones de modelos", path: "/conexiones", icon: "link" },
      { id: "wiki-ia", label: "Wiki IA · Proveedores", path: "/wiki-ia", icon: "memory" },
      { id: "admin-users", label: "Usuarios · Acceso", path: "/admin-usuarios", icon: "user" },
    ],
  },
  {
    label: "Sistema",
    items: [{ id: "settings", label: "Estado / Respaldo", path: "/ajustes", icon: "settings", disabled: true }],
  },
];

function flattenRoutes(items: RouteDef[]): RouteDef[] {
  return items.flatMap((item) =>
    item.children ? [item, ...flattenRoutes(item.children)] : [item],
  );
}

export const ROUTES: RouteDef[] = flattenRoutes(ROUTE_GROUPS.flatMap((g) => g.items));

export function routeForPath(pathname: string): RouteDef | undefined {
  if (pathname === "/") return ROUTES.find((r) => r.path === "/");
  return ROUTES.find((r) => r.path !== "/" && pathname.startsWith(r.path));
}
