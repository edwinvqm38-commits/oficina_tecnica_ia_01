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

export function AIAppShell({
  activeModule,
  context,
  children,
}: AIAppShellProps) {
  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <AISidebar activeModule={activeModule} />
      <div className="min-h-screen lg:pl-60">
        <AITopbar />
        <div className="grid min-h-[calc(100vh-54px)] xl:grid-cols-[minmax(0,1fr)_18.5rem] 2xl:grid-cols-[minmax(0,1fr)_19.5rem]">
          <main className="min-w-0 px-3 py-3.5 sm:px-4 lg:px-5">
            <div className="mx-auto max-w-[1360px]">{children}</div>
          </main>
          <AIContextPanel variant={context} />
        </div>
      </div>
    </div>
  );
}
