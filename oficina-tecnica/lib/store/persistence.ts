// Persistence adapter for application state.
//
// Strategy: state is always cached in localStorage for instant load and
// offline resilience. Syncing this UI/chat state to Supabase is optional:
// enable it only with NEXT_PUBLIC_ENABLE_WORKSPACE_SYNC=true. Keeping it
// off by default avoids turning Supabase into a high-egress localStorage
// mirror, especially when chats contain attachment metadata.
//
// If Supabase isn't configured, everything still works — it just stays local.

import { getSupabaseClient } from "../supabase/client";
import { AppState, mergeWithSeed, pickSharedChats, redactProviderKeys, seedState } from "./types";

const LOCAL_KEY = "oficina-tecnica:state:v1";
const WORKSPACE_ID = "default"; // single shared workspace for this deployment

function workspaceSyncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_WORKSPACE_SYNC === "true";
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
  if (!workspaceSyncEnabled()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("workspace_state")
    .select("state")
    .eq("id", WORKSPACE_ID)
    .maybeSingle();
  if (error || !data) return null;
  return mergeWithSeed(data.state as Partial<AppState>);
}

let pendingSync: ReturnType<typeof setTimeout> | null = null;
let lastRemotePayload = "";

/**
 * Persists state to the shared `workspace_state` row. Before upserting,
 * `chats` is reduced to only the shared threads (private "Chat privado"
 * threads and legacy unscoped agent threads stay local-only) and any
 * provider API keys are redacted — neither should ever leave this browser
 * via the shared backend. `onSettled` (if given) is called with whether the
 * write succeeded, once the debounced write actually runs.
 */
export function saveRemote(state: AppState, onSettled?: (ok: boolean) => void) {
  if (!workspaceSyncEnabled()) {
    onSettled?.(true);
    return;
  }
  const supabase = getSupabaseClient();
  if (!supabase) return;
  if (pendingSync) clearTimeout(pendingSync);
  // Debounce writes so rapid local interactions don't flood the database.
  pendingSync = setTimeout(() => {
    const syncable: AppState = {
      ...state,
      chats: pickSharedChats(state.chats),
      modelConnections: redactProviderKeys(state.modelConnections),
    };
    const payload = JSON.stringify(syncable);
    if (payload === lastRemotePayload) {
      onSettled?.(true);
      return;
    }
    lastRemotePayload = payload;
    void supabase
      .from("workspace_state")
      .upsert({ id: WORKSPACE_ID, state: syncable, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.warn("[store] remote sync failed", error.message);
        if (error) lastRemotePayload = "";
        onSettled?.(!error);
      });
  }, 800);
}

export function isRemoteConfigured(): boolean {
  return workspaceSyncEnabled() && getSupabaseClient() !== null;
}

/**
 * Subscribes to live updates of the shared workspace row (e.g. another
 * user posting in Mesa de trabajo) and invokes `onChange` with the merged
 * remote state. Returns an unsubscribe function.
 */
export function subscribeRemote(onChange: (state: AppState) => void): () => void {
  if (!workspaceSyncEnabled()) return () => {};
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
