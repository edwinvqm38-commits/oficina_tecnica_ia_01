import type { HTMLAttributes } from "react";
import { cn } from "@/lib/sgp/utils";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  dot?: boolean;
};

const badgeClass: Record<BadgeTone, string> = {
  neutral: "badge--slate",
  info: "badge--blue",
  success: "badge--green",
  warning: "badge--amber",
  danger: "badge--red",
};

const statusTone: Record<string, BadgeTone> = {
  activo: "success",
  activa: "success",
  active: "success",
  aprobado: "success",
  aprobada: "success",
  approved: "success",
  pendiente: "info",
  pending: "info",
  "en revision": "info",
  "en revisión": "info",
  review: "info",
  observed: "warning",
  observado: "warning",
  observada: "warning",
  rejected: "danger",
  rechazado: "danger",
  rechazada: "danger",
  disabled: "neutral",
  deshabilitado: "neutral",
  deshabilitada: "neutral",
  vacant: "neutral",
  vacante: "neutral",
  proposed: "info",
  propuesto: "info",
  propuesta: "info",
};

function normalizeStatus(value: string): string {
  return value.trim().toLowerCase();
}

export function Badge({ className, tone = "neutral", dot = false, ...props }: BadgeProps) {
  return <span className={cn("badge", badgeClass[tone], dot && "badge--dot", className)} {...props} />;
}

export function StatusBadge({
  status,
  label,
  className,
  ...props
}: BadgeProps & { status: string; label?: string }) {
  const text = label ?? status;
  const tone = statusTone[normalizeStatus(status)] ?? "neutral";
  return (
    <Badge className={cn("status-badge", `status-badge--${tone}`, className)} tone={tone} {...props}>
      {text}
    </Badge>
  );
}
