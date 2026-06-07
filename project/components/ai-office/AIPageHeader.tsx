import type { ReactNode } from "react";

type AIPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

// Compacto: sin card wrapper, título 15px, padding reducido
export function AIPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: AIPageHeaderProps) {
  return (
    <section className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">
          {eyebrow}
        </p>
        <h1 className="mt-0.5 text-[15px] font-semibold leading-snug tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-0.5 max-w-2xl text-[11px] leading-5 text-slate-500">
          {description}
        </p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </section>
  );
}
