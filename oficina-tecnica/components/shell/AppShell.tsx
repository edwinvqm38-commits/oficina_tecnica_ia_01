"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ContextPanel, CONTEXT_ROUTES } from "./ContextPanel";
import { GlobalSearch, routeIdToPath } from "./GlobalSearch";
import { routeForPath } from "../../lib/routes";
import type { RouteId } from "../../lib/routes";
import { useSession } from "../../lib/auth/useSession";
import { useAccessGate } from "../../lib/auth/useAccessGate";
import { usePendingUserNotifications } from "../../lib/auth/usePendingUserNotifications";
import { useSectionAccess } from "../../lib/auth/useSectionAccess";
import { detectDeviceProfile } from "../../lib/llm/deviceDetection";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const { session, loading, logout } = useSession(true);
  const { checking } = useAccessGate(session);
  usePendingUserNotifications(session?.email);
  const { canAccessRoute, loading: accessLoading } = useSectionAccess(session?.email);

  useEffect(() => {
    detectDeviceProfile(); // silent, saves to localStorage
  }, []);

  useEffect(() => {
    if (loading || checking || accessLoading) return;
    const route = routeForPath(pathname);
    if (!route || route.id === "dashboard") return;
    if (!canAccessRoute(route.id)) router.replace("/");
  }, [loading, checking, accessLoading, pathname, router, canAccessRoute]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (loading || checking) return <div style={{ height: "100vh", background: "var(--bg)" }} />;
  if (!session) return null;

  const route = routeForPath(pathname);
  const activeRoute: RouteId = route?.id || "dashboard";
  const hasCtx = CONTEXT_ROUTES.includes(activeRoute);

  function navigate(routeId: string) {
    router.push(routeIdToPath(routeId));
  }

  return (
    <div className="ig-layout">
      <Topbar onOpenSearch={() => setSearchOpen(true)} userEmail={session.email} onLogout={logout} />
      <div className="ig-body">
        <Sidebar activeRoute={activeRoute} />
        <main className="ig-main">
          <div style={{ width: "100%", maxWidth: "100%" }}>{children}</div>
        </main>
        {hasCtx && <ContextPanel route={activeRoute} />}
      </div>
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} onNavigate={navigate} />}
    </div>
  );
}
