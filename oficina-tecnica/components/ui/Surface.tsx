import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/sgp/utils";

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "article" | "div" | "aside";
  muted?: boolean;
};

export function Surface({ as: Tag = "div", muted = false, className, ...props }: SurfaceProps) {
  return <Tag className={cn("ui-surface", muted && "ui-surface--muted", className)} {...props} />;
}

export function Card({ as: Tag = "article", className, ...props }: SurfaceProps) {
  return <Tag className={cn("ui-card", className)} {...props} />;
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  ...props
}: SurfaceProps & {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("ui-section", className)} {...props}>
      {(title || description || actions) ? (
        <div className="ui-section-header">
          <div className="min-w-0">
            {title ? <h2 className="text-subsection-title">{title}</h2> : null}
            {description ? <p className="text-caption text-2">{description}</p> : null}
          </div>
          {actions ? <div className="page-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="ui-section-body">{children}</div>
    </section>
  );
}
