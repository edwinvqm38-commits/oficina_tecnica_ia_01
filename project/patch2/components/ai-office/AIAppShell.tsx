// AIAppShell — matches prototype layout exactly:
// flex h-screen overflow-hidden → topbar (48px fixed) → body (flex-1 flex overflow-hidden)
// → sidebar (fixed width, flex column) → main (flex-1 overflow-y-auto) → context panel

import type { ReactNode } from "react";
import { AIContextPanel } from "./AIContextPanel";
import { AISidebar, type AISidebarModule } from "./AISidebar";
import { AITopbar } from "./AITopbar";

type AIAppShellProps = {
  activeModule: AISidebarModule;
  context:
    | "dashboard"
    | "office"
    | "inbox"
    | "approvals"
    | "projects"
    | "skills";
  children: ReactNode;
};

export function AIAppShell({ activeModule, context, children }: AIAppShellProps) {
  return (
    // Full-viewport flex column — no scroll on root
    <div className="flex h-screen flex-col overflow-hidden bg-[#f3f4f7] text-slate-950">

      {/* Topbar — fixed height 48px */}
      <AITopbar />

      {/* Body — sidebar + main + context */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar — hidden on mobile, fixed-width column on desktop */}
        <div className="hidden lg:block lg:w-[240px] lg:shrink-0">
          <AISidebar activeModule={activeModule} />
        </div>

        {/* Main content — scrollable */}
        <main className="flex-1 overflow-y-auto px-4 py-4 min-w-0">
          <div className="mx-auto max-w-[1200px]">
            {children}
          </div>
        </main>

        {/* Context panel — fixed-width, scrollable */}
        <div className="hidden xl:block xl:w-[272px] xl:shrink-0 xl:overflow-y-auto border-l border-slate-200 bg-slate-50">
          <AIContextPanel variant={context} />
        </div>

      </div>
    </div>
  );
}
