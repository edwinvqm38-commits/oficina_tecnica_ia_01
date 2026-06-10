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
import { AppState, mergeWithSeed, seedState } from "./types";

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

export async function loadRemote(): Promise<AppState | null> {
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

export function saveRemote(state: AppState) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  if (pendingSync) clearTimeout(pendingSync);
  // Debounce writes so rapid local interactions don't flood the database.
  pendingSync = setTimeout(() => {
    void supabase
      .from("workspace_state")
      .upsert({ id: WORKSPACE_ID, state, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.warn("[store] remote sync failed", error.message);
      });
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
export function subscribeRemote(onChange: (state: AppState) => void): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`workspace_state:${WORKSPACE_ID}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "workspace_state", filter: `id=eq.${WORKSPACE_ID}` },
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
