// Re-exports the single shared Supabase client (see lib/supabaseClient.ts)
// to avoid creating a second GoTrueClient instance ("Multiple GoTrueClient
// instances detected" / inconsistent auth state across the app).
export { supabase, getSupabaseClient as getSgpSupabaseClient } from "../supabaseClient";
