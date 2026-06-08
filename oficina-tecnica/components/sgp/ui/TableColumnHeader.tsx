"use client";

import { FieldLabelIcon, type IconName } from "@/components/sgp/ui/FieldLabelIcon";

type TableColumnHeaderProps = {
  icon: IconName;
  label: string;
};

export function TableColumnHeader({ icon, label }: TableColumnHeaderProps) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted">
      <FieldLabelIcon icon={icon} label={label} className="text-[11px]" />
    </span>
  );
}
