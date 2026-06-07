"use client";

import type { ReactNode } from "react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

type EditablePropertyGridProps = {
  rows: Array<{
    label: string;
    control: ReactNode;
    fullWidth?: boolean;
  }>;
  className?: string;
  compact?: boolean;
};

export function EditablePropertyGrid({ rows, className, compact = false }: EditablePropertyGridProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {rows.map((row) => (
        <Fragment key={row.label}>
          <div
            className={cn(
              "grid items-center gap-x-2",
              row.fullWidth ? "grid-cols-1" : "grid-cols-[150px_1fr]",
              compact && !row.fullWidth ? "grid-cols-[125px_1fr]" : "",
            )}
          >
            <p className={cn("text-xs text-muted", !row.fullWidth ? "py-1" : "mb-1")}>{row.label}</p>
            <div>{row.control}</div>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
