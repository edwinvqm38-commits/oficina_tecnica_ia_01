// Persistence adapter for application state.
//
// Strategy: state is always cached in localStorage for instant load and
// offline resilience. When Supabase credentials are configured (see
// lib/supabase/client.ts and supabase/schema.sql), the same state is
// synced to a `workspace_state` row keyed by the signed-in user, so the
// platform survives across browsers/devices instead of living only in
// one machine's localStorage.
//
// If Supabase isn't configured, everything still works — it just stays local.

import { getSupabaseClient } from "../supabase/client";
import { AppState, mergeWithSeed, pickSharedChats, redactProviderKeys, seedState, stripAttachmentData } from "./types";

const LOCAL_KEY = "oficina-tecnica:state:v1";
const WORKSPACE_ID = "default"; // single shared workspace for this deployment

function logPersistence(operation: "workspace-read" | "workspace-write", category: "network" | "ok", detail?: string) {
  const payload = { category, operation, ...(detail ? { detail } : {}) };
  if (category === "network") console.warn("[persistence]", payload);
  else console.debug("[persistence]", payload);
}

export function loadLocal(): AppState {
  if (typeof window === "undefined") return seedState();
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return seedState();
    return mergeWithSeed(JSON.parse(raw));
  } catch {
    return seedState();
  }
}

export function saveLocal(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded or blocked — local cache is best-effort
  }
}

export async function loadRemote(): Promise<AppState | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("workspace_state")
      .select("state")
      .eq("id", WORKSPACE_ID)
      .maybeSingle();
    if (error) {
      logPersistence("workspace-read", "network", error.message);
      return null;
    }
    if (!data) return null;
    return mergeWithSeed(data.state as Partial<AppState>);
  } catch (err) {
    logPersistence("workspace-read", "network", err instanceof Error ? err.message : "unknown");
    return null;
  }
}

let pendingSync: ReturnType<typeof setTimeout> | null = null;
// Avoids re-sending an identical payload (e.g. an immediate realtime echo of
// our own last write) — every skipped write is one less round trip to Supabase.
let lastSyncedPayload: string | null = null;

/**
 * Persists state to the shared `workspace_state` row. Before upserting,
 * `chats` is reduced to only the shared threads (private "Chat privado"
 * threads and legacy unscoped agent threads stay local-only), attachment
 * data URLs are stripped (only extracted text needs to be shared), and any
 * provider API keys are redacted — none of those should ever leave this
 * browser via the shared backend. `onSettled` (if given) is called with
 * whether the write succeeded, once the debounced write actually runs (or
 * immediately with `true` if the write was skipped as a no-op duplicate).
 */
export function saveRemote(state: AppState, onSettled?: (ok: boolean) => void) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  if (pendingSync) clearTimeout(pendingSync);
  // Debounce writes so rapid local interactions don't flood the database.
  pendingSync = setTimeout(() => {
    const syncable: AppState = {
      ...state,
      chats: stripAttachmentData(pickSharedChats(state.chats)),
      modelConnections: redactProviderKeys(state.modelConnections),
    };
    const payload = JSON.stringify(syncable);
    if (payload === lastSyncedPayload) {
      onSettled?.(true);
      return;
    }
    void supabase
      .from("workspace_state")
      .upsert({ id: WORKSPACE_ID, state: syncable, updated_at: new Date().toISOString() })
      .then(
        ({ error }) => {
          if (error) {
            logPersistence("workspace-write", "network", error.message);
          } else {
            lastSyncedPayload = payload;
          }
          onSettled?.(!error);
        },
        (err) => {
          logPersistence("workspace-write", "network", err instanceof Error ? err.message : "unknown");
          onSettled?.(false);
        }
      );
  }, 1500);
}

export function isRemoteConfigured(): boolean {
  return getSupabaseClient() !== null;
}

/**
 * Subscribes to live updates of the shared workspace row (e.g. another
 * user posting in Mesa de trabajo) and invokes `onChange` with the merged
 * remote state. Returns an unsubscribe function.
 */
export function subscribeRemote(onChange: (state: AppState) => void): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`workspace_state:${WORKSPACE_ID}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "workspace_state", filter: `id=eq.${WORKSPACE_ID}` },
      (payload) => {
        const newState = (payload.new as { state?: Partial<AppState> } | null)?.state;
        if (newState) onChange(mergeWithSeed(newState));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
