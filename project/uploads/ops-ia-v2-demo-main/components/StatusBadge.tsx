import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: "Pendiente" | "Adjudicado" | "Cancelado" | "No adjudicado" | string;
};

const styleMap: Record<string, string> = {
  Borrador: "bg-slate-100 text-slate-700",
  Adjudicado: "bg-emerald-100 text-emerald-700",
  Cancelado: "bg-rose-100 text-rose-700",
  "No adjudicado": "bg-amber-100 text-amber-700",
  Pendiente: "bg-stone-100 text-stone-600",
  "En proceso": "bg-blue-100 text-blue-700",
  Atendido: "bg-emerald-100 text-emerald-700",
  Activo: "bg-emerald-100 text-emerald-700",
  Inactivo: "bg-stone-200 text-stone-700",
  "Por revisar": "bg-amber-100 text-amber-700",
  Material: "bg-slate-100 text-slate-700",
  Equipo: "bg-blue-100 text-blue-700",
  Herramienta: "bg-cyan-100 text-cyan-700",
  Consumible: "bg-orange-100 text-orange-700",
  Servicio: "bg-purple-100 text-purple-700",
  EPP: "bg-teal-100 text-teal-700",
  Subcontrato: "bg-rose-100 text-rose-700",
  Otro: "bg-stone-100 text-stone-700",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        styleMap[status] ?? "bg-stone-100 text-stone-700",
      )}
    >
      {status}
    </span>
  );
}
