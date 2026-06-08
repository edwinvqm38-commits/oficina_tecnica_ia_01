import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Returns null when Supabase env vars are not set, allowing demo mode fallback.
function createSgpClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
    },
  });
}

// Exported as a getter to allow lazy evaluation (env vars are read at call time, not at module load).
let _client: SupabaseClient | null | undefined;

export function getSgpSupabaseClient(): SupabaseClient | null {
  if (_client !== undefined) return _client;
  _client = createSgpClient();
  return _client;
}

// Legacy named export for compatibility with copied SGP files.
// This is a proxy object that delegates all calls to getSgpSupabaseClient().
// When env vars are missing, operations will throw gracefully or return null.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSgpSupabaseClient();
    if (!client) {
      // Return a no-op function for any method call when not configured
      if (prop === "from" || prop === "rpc" || prop === "auth" || prop === "storage") {
        return () => ({
          select: () => ({ data: null, error: new Error("Supabase no configurado — modo demo activo.") }),
          insert: () => ({ data: null, error: new Error("Supabase no configurado — modo demo activo.") }),
          update: () => ({ data: null, error: new Error("Supabase no configurado — modo demo activo.") }),
          delete: () => ({ data: null, error: new Error("Supabase no configurado — modo demo activo.") }),
          upsert: () => ({ data: null, error: new Error("Supabase no configurado — modo demo activo.") }),
        });
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
