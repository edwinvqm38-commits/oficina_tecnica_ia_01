import type { ReactNode } from "react";

type TopbarProps = {
  title: string;
  action?: ReactNode;
};

export function Topbar({ title, action }: TopbarProps) {
  return (
    <header className="mb-4 flex items-center justify-between rounded-xl border border-border bg-panel px-4 py-3">
      <h1 className="text-base font-semibold">{title}</h1>
      {action}
    </header>
  );
}
