// Single shared Supabase browser client for the whole app.
//
// Previously `lib/supabaseClient.ts`, `lib/sgp/supabaseClient.ts` and
// `lib/supabase/client.ts` each called `createClient(...)` with the same
// URL/key, which created multiple independent GoTrueClient instances
// sharing the same localStorage auth-token key — triggering the "Multiple
// GoTrueClient instances detected" warning and inconsistent auth state
// across the app. The other two modules now re-export from here.
//
// Returns a no-op/demo client when NEXT_PUBLIC_SUPABASE_URL /
// NEXT_PUBLIC_SUPABASE_ANON_KEY aren't set, so the rest of the app can
// degrade gracefully instead of throwing at module load.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null | undefined;

function createSupabaseSingleton(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

export function getSupabaseClient(): SupabaseClient | null {
  if (_client === undefined) _client = createSupabaseSingleton();
  return _client;
}

const DEMO_ERROR = "Supabase no configurado — modo demo activo.";

// Proxy so existing call sites can keep doing `supabase.from(...)` /
// `supabase.auth...` without checking for null, while still resolving the
// underlying client lazily (env vars are read at call time, not at import).
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      if (prop === "from" || prop === "rpc" || prop === "storage") {
        return () => ({
          select: () => ({ data: null, error: new Error(DEMO_ERROR) }),
          insert: () => ({ data: null, error: new Error(DEMO_ERROR) }),
          update: () => ({ data: null, error: new Error(DEMO_ERROR) }),
          delete: () => ({ data: null, error: new Error(DEMO_ERROR) }),
          upsert: () => ({ data: null, error: new Error(DEMO_ERROR) }),
        });
      }
      if (prop === "auth") {
        return {
          getSession: async () => ({ data: { session: null }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithPassword: async () => ({ data: null, error: new Error(DEMO_ERROR) }),
          signUp: async () => ({ data: null, error: new Error(DEMO_ERROR) }),
          signOut: async () => ({ error: null }),
        };
      }
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
