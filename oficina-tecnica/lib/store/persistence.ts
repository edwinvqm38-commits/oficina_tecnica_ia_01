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
import {
  persistenceFailure,
  persistenceSuccess,
  type PersistenceIssue,
  type PersistenceResult,
} from "../supabase/persistenceErrors";
import { AppState, mergeWithSeed, pickSharedChats, redactProviderKeys, seedState } from "./types";

const LOCAL_KEY = "oficina-tecnica:state:v1";
const WORKSPACE_ID = "default"; // single shared workspace for this deployment

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

export async function loadRemote(): Promise<PersistenceResult<AppState | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return persistenceSuccess(null);

  try {
    const { data, error } = await supabase
      .from("workspace_state")
      .select("state")
      .eq("id", WORKSPACE_ID)
      .maybeSingle();
    if (error) return persistenceFailure("workspace-read", error);
    if (!data) return persistenceSuccess(null);
    return persistenceSuccess(mergeWithSeed(data.state as Partial<AppState>));
  } catch (error) {
    return persistenceFailure("workspace-read", error);
  }
}

let pendingSync: ReturnType<typeof setTimeout> | null = null;

export function cancelPendingRemoteSave() {
  if (!pendingSync) return;
  clearTimeout(pendingSync);
  pendingSync = null;
}

/**
 * Persists state to the shared `workspace_state` row. Before upserting,
 * `chats` is reduced to only the shared threads (private "Chat privado"
 * threads and legacy unscoped agent threads stay local-only) and any
 * provider API keys are redacted — neither should ever leave this browser
 * via the shared backend. `onSettled` (if given) is called with whether the
 * write succeeded, once the debounced write actually runs.
 */
export function saveRemote(
  state: AppState,
  onSettled?: (result: PersistenceResult<void>) => void
) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    onSettled?.(persistenceSuccess(undefined));
    return;
  }
  if (pendingSync) clearTimeout(pendingSync);
  // Debounce writes so rapid local interactions don't flood the database.
  pendingSync = setTimeout(async () => {
    pendingSync = null;
    const syncable: AppState = {
      ...state,
      chats: pickSharedChats(state.chats),
      modelConnections: redactProviderKeys(state.modelConnections),
    };
    try {
      const { error } = await supabase
        .from("workspace_state")
        .upsert({ id: WORKSPACE_ID, state: syncable, updated_at: new Date().toISOString() });
      onSettled?.(
        error
          ? persistenceFailure("workspace-write", error)
          : persistenceSuccess(undefined)
      );
    } catch (error) {
      onSettled?.(persistenceFailure("workspace-write", error));
    }
  }, 800);
}

export function isRemoteConfigured(): boolean {
  return getSupabaseClient() !== null;
}

/**
 * Subscribes to live updates of the shared workspace row (e.g. another
 * user posting in Mesa de trabajo) and invokes `onChange` with the merged
 * remote state. Returns an unsubscribe function.
 */
export function subscribeRemote(
  onChange: (state: AppState) => void,
  onIssue?: (issue: PersistenceIssue) => void
): () => void {
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
    .subscribe((status, error) => {
      if (status !== "CHANNEL_ERROR" && status !== "TIMED_OUT") return;
      const result = persistenceFailure<void>("workspace-realtime", error ?? status);
      if (!result.ok) onIssue?.(result.issue);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
