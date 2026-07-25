import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

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
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
