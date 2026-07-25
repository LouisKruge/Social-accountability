import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/** The concrete, RLS-bound server client type (anon key + cookie session). */
export type ServerClient = ReturnType<typeof createClient>;

/**
 * Server Supabase client for Server Components, Route Handlers, and Server
 * Actions. Reads/writes the auth session from cookies. Still uses the anon key
 * and is bound by RLS — this is NOT the service role.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` called from a Server Component — safe to ignore when
            // middleware is refreshing the session.
          }
        },
      },
    },
  );
}
