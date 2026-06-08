import type { ReactNode } from "react";

type AIPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function AIPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: AIPageHeaderProps) {
  return (
    <section className="mb-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3 shadow-sm sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">
            {eyebrow}
          </p>
          <h1 className="mt-0.5 max-w-4xl text-lg font-semibold tracking-tight text-slate-950">
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            {description}
          </p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </section>
  );
}
