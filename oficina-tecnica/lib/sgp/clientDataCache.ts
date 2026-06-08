import { listCotizaciones, type QuotationsListResult } from "@/lib/sgp/quotationsRepository";
import {
  listRequirementItems,
  listRequirementItemsByRequirementId,
  type RequirementItemsListResult,
} from "@/lib/sgp/requirementItemsRepository";
import { listRequerimientos, type RequirementsListResult } from "@/lib/sgp/requirementsRepository";
import type { AppDataSource } from "@/lib/sgp/dataSourceDiagnostics";

const CLIENT_DATA_TTL_MS = 5 * 60 * 1000;

export type ClientDataCacheStatus = "hit" | "miss" | "inflight";

export type ClientDataLoadReason =
  | "initial-load"
  | "auth-change"
  | "cache-hydration"
  | "manual-refresh"
  | "workspace-open";

export type CoreAppData = {
  cotizaciones: QuotationsListResult;
  requerimientos: RequirementsListResult;
  source: AppDataSource;
  warning: string | null;
  loadedAt: number;
};

export type CoreAppDataResult = CoreAppData & {
  cacheStatus: ClientDataCacheStatus;
  reason: ClientDataLoadReason;
};

export type RequirementItemsDataResult = RequirementItemsListResult & {
  cacheStatus: ClientDataCacheStatus;
  reason: ClientDataLoadReason;
  loadedAt: number;
};

let coreAppDataCache: { value: CoreAppData; expiresAt: number } | null = null;
let inFlightCoreAppData: Promise<CoreAppData> | null = null;
let globalItemsCache: { value: RequirementItemsListResult; loadedAt: number; expiresAt: number } | null = null;
let inFlightGlobalItems: Promise<RequirementItemsListResult> | null = null;
const requirementItemsCache = new Map<string, { value: RequirementItemsListResult; loadedAt: number; expiresAt: number }>();
const inFlightRequirementItems = new Map<string, Promise<RequirementItemsListResult>>();

function isFresh(expiresAt: number, now = Date.now()): boolean {
  return expiresAt > now;
}

function debugClientDataCache(module: string, event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.debug(`[${module}] client-data-cache ${event}`, {
    cacheKey: payload.cacheKey,
    ttlMs: CLIENT_DATA_TTL_MS,
    ...payload,
  });
}

function buildCoreData(cotizaciones: QuotationsListResult, requerimientos: RequirementsListResult): CoreAppData {
  const source = cotizaciones.source === "supabase" && requerimientos.source === "supabase" ? "supabase" : "demo";
  const warning = cotizaciones.warning ?? requerimientos.warning ?? null;
  return {
    cotizaciones,
    requerimientos,
    source,
    warning,
    loadedAt: Date.now(),
  };
}

export function getFreshCoreAppDataCache(): CoreAppData | null {
  return coreAppDataCache && isFresh(coreAppDataCache.expiresAt) ? coreAppDataCache.value : null;
}

export function getFreshRequirementItemsCache(requirementId: string): RequirementItemsListResult | null {
  const cached = requirementItemsCache.get(requirementId);
  return cached && isFresh(cached.expiresAt) ? cached.value : null;
}

export function getFreshGlobalRequirementItemsCache(): RequirementItemsListResult | null {
  return globalItemsCache && isFresh(globalItemsCache.expiresAt) ? globalItemsCache.value : null;
}

export function clearCoreAppDataCache(): void {
  coreAppDataCache = null;
  inFlightCoreAppData = null;
}

export function clearRequirementItemsCache(): void {
  globalItemsCache = null;
  inFlightGlobalItems = null;
  requirementItemsCache.clear();
  inFlightRequirementItems.clear();
}

export async function loadCoreAppData(options: {
  module: string;
  reason: ClientDataLoadReason;
  forceRefresh?: boolean;
}): Promise<CoreAppDataResult> {
  const now = Date.now();
  const cacheKey = "core:cotizaciones+requerimientos";

  if (!options.forceRefresh && coreAppDataCache && isFresh(coreAppDataCache.expiresAt, now)) {
    debugClientDataCache(options.module, "hit", {
      cacheKey,
      reason: options.reason,
      ageMs: now - coreAppDataCache.value.loadedAt,
    });
    return { ...coreAppDataCache.value, cacheStatus: "hit", reason: options.reason };
  }

  if (!options.forceRefresh && inFlightCoreAppData) {
    debugClientDataCache(options.module, "inflight", { cacheKey, reason: options.reason });
    const value = await inFlightCoreAppData;
    return { ...value, cacheStatus: "inflight", reason: options.reason };
  }

  debugClientDataCache(options.module, "miss", {
    cacheKey,
    reason: options.reason,
    forceRefresh: options.forceRefresh === true,
  });

  inFlightCoreAppData = Promise.all([listCotizaciones(), listRequerimientos()])
    .then(([cotizaciones, requerimientos]) => {
      const value = buildCoreData(cotizaciones, requerimientos);
      coreAppDataCache = { value, expiresAt: Date.now() + CLIENT_DATA_TTL_MS };
      return value;
    })
    .finally(() => {
      inFlightCoreAppData = null;
    });

  const value = await inFlightCoreAppData;
  return { ...value, cacheStatus: "miss", reason: options.reason };
}

export async function loadRequirementItemsForRequirement(options: {
  module: string;
  requirementId: string;
  reason: ClientDataLoadReason;
  forceRefresh?: boolean;
}): Promise<RequirementItemsDataResult> {
  const now = Date.now();
  const cacheKey = `rq-items:${options.requirementId}`;
  const cached = requirementItemsCache.get(options.requirementId);

  if (!options.forceRefresh && cached && isFresh(cached.expiresAt, now)) {
    debugClientDataCache(options.module, "hit", {
      cacheKey,
      reason: options.reason,
      ageMs: now - cached.loadedAt,
    });
    return { ...cached.value, cacheStatus: "hit", reason: options.reason, loadedAt: cached.loadedAt };
  }

  const inFlight = inFlightRequirementItems.get(options.requirementId);
  if (!options.forceRefresh && inFlight) {
    debugClientDataCache(options.module, "inflight", { cacheKey, reason: options.reason });
    const value = await inFlight;
    const loadedAt = Date.now();
    return { ...value, cacheStatus: "inflight", reason: options.reason, loadedAt };
  }

  debugClientDataCache(options.module, "miss", {
    cacheKey,
    reason: options.reason,
    forceRefresh: options.forceRefresh === true,
  });

  const request = listRequirementItemsByRequirementId(options.requirementId)
    .then((value) => {
      requirementItemsCache.set(options.requirementId, {
        value,
        loadedAt: Date.now(),
        expiresAt: Date.now() + CLIENT_DATA_TTL_MS,
      });
      return value;
    })
    .finally(() => {
      inFlightRequirementItems.delete(options.requirementId);
    });

  inFlightRequirementItems.set(options.requirementId, request);
  const value = await request;
  return { ...value, cacheStatus: "miss", reason: options.reason, loadedAt: Date.now() };
}

export async function loadGlobalRequirementItems(options: {
  module: string;
  reason: ClientDataLoadReason;
  forceRefresh?: boolean;
}): Promise<RequirementItemsDataResult> {
  const now = Date.now();
  const cacheKey = "rq-items:global";

  if (!options.forceRefresh && globalItemsCache && isFresh(globalItemsCache.expiresAt, now)) {
    debugClientDataCache(options.module, "hit", {
      cacheKey,
      reason: options.reason,
      ageMs: now - globalItemsCache.loadedAt,
    });
    return {
      ...globalItemsCache.value,
      cacheStatus: "hit",
      reason: options.reason,
      loadedAt: globalItemsCache.loadedAt,
    };
  }

  if (!options.forceRefresh && inFlightGlobalItems) {
    debugClientDataCache(options.module, "inflight", { cacheKey, reason: options.reason });
    const value = await inFlightGlobalItems;
    return { ...value, cacheStatus: "inflight", reason: options.reason, loadedAt: Date.now() };
  }

  debugClientDataCache(options.module, "miss", {
    cacheKey,
    reason: options.reason,
    forceRefresh: options.forceRefresh === true,
  });

  inFlightGlobalItems = listRequirementItems()
    .then((value) => {
      globalItemsCache = {
        value,
        loadedAt: Date.now(),
        expiresAt: Date.now() + CLIENT_DATA_TTL_MS,
      };
      return value;
    })
    .finally(() => {
      inFlightGlobalItems = null;
    });

  const value = await inFlightGlobalItems;
  return { ...value, cacheStatus: "miss", reason: options.reason, loadedAt: Date.now() };
}
