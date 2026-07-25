import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseUrl } from "./env";

/**
 * SERVICE-ROLE Supabase client. BYPASSES Row Level Security.
 *
 * ⚠️  Confined to trusted server-side code ONLY: the ranking-compute job, the
 * share-card renderer, and the Paystack webhook. The `server-only` import above
 * makes the build fail if this module is ever pulled into a client bundle.
 *
 * The service role key must NEVER be exposed to the browser or to any n8n
 * workflow reachable by untrusted webhook input (see the project's
 * non-negotiable engineering rules).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — refusing to create an admin client.",
    );
  }
  return createSupabaseClient<Database>(supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
