"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { RouteId } from "@/lib/routes";

const ADMIN_EMAIL = "edwin.qm@outlook.com";

/**
 * Maps sidebar routes to their admin_module_permissions module_key.
 * Routes not listed here have no per-user access toggle (e.g. admin-only
 * routes already gated elsewhere, or sub-pages without their own entry).
 */
export const ROUTE_MODULE_KEYS: Partial<Record<RouteId, string>> = {
  dashboard: "dashboard",
  office: "office",
  roundtable: "roundtable",
  chat: "chat",
  inbox: "inbox",
  approvals: "approvals",
  cotizaciones: "cotizaciones",
  requerimientos: "requerimientos",
  recursos: "recursos",
  datos: "datos",
  agents: "agents",
  org: "org",
  skills: "skills",
  memory: "memory",
  timeline: "timeline",
};

export type SectionAccessMap = Record<string, boolean>;

/**
 * Loads the current user's per-section access map from
 * admin_module_permissions (module_key -> can_view). Sections without an
 * explicit row default to allowed (admins are always allowed everything).
 */
export function useSectionAccess(email: string | undefined) {
  const [accessMap, setAccessMap] = useState<SectionAccessMap>({});
  const [loading, setLoading] = useState(true);

  const isAdmin = (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    if (!email || isAdmin) {
      setAccessMap({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from("admin_module_permissions")
      .select("module_key,can_view")
      .ilike("user_email", email)
      .then(({ data }) => {
        if (cancelled) return;
        const map: SectionAccessMap = {};
        for (const row of data ?? []) {
          map[row.module_key as string] = Boolean(row.can_view);
        }
        setAccessMap(map);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email, isAdmin]);

  function canAccessModule(moduleKey: string | undefined): boolean {
    if (isAdmin || !moduleKey) return true;
    if (!(moduleKey in accessMap)) return true;
    return accessMap[moduleKey];
  }

  function canAccessRoute(routeId: string): boolean {
    return canAccessModule(ROUTE_MODULE_KEYS[routeId as RouteId]);
  }

  return { accessMap, loading, canAccessModule, canAccessRoute };
}
