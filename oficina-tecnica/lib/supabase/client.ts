// Re-exports the single shared Supabase client (see lib/supabaseClient.ts)
// to avoid creating a second GoTrueClient instance ("Multiple GoTrueClient
// instances detected" / inconsistent auth state across the app).
//
// Returns null when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// aren't set, so callers (e.g. lib/store/persistence.ts) can degrade
// gracefully to local-only persistence.
export { getSupabaseClient } from "../supabaseClient";
