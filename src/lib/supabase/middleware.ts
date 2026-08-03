import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

const PUBLIC_PATHS = ["/login", "/signup", "/share", "/auth", "/api/share-card", "/design-preview"];

/**
 * Refreshes the Supabase auth session and gates private routes.
 *
 * ── WHY getSession() AND NOT getUser() ───────────────────────────────────────
 * `getUser()` makes a NETWORK CALL to Supabase's auth server to verify the JWT.
 * This middleware runs on every navigation, so that was a round trip to another
 * host before any page code started — and then the page called `getUser()`
 * again. Two sequential auth round trips ahead of every single click.
 *
 * `getSession()` reads and parses the cookie locally, and only reaches the
 * network when the token has actually expired and needs refreshing. For most
 * clicks that is zero network calls.
 *
 * THE SECURITY REASONING, because this swap is only safe for a specific reason:
 * `getSession()` does NOT verify the token signature server-side, so it must
 * never be the basis of an authorization decision. It isn't one here. This
 * middleware decides one thing — whether to redirect to /login — which is a
 * convenience, not a boundary. Every page still calls the verified `getUser()`,
 * and Postgres RLS is the actual boundary: a forged cookie gets you a login
 * page you did not need, and nothing else. It cannot read a row.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Fail open: if Supabase env is misconfigured, don't 500 every route —
  // treat the request as unauthenticated and let public routes render.
  let user = null;
  try {
    const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    // Local cookie read; refreshes over the network only when actually expired.
    const { data } = await supabase.auth.getSession();
    user = data.session?.user ?? null;
  } catch (err) {
    console.error("[middleware] Supabase session refresh failed:", err);
  }

  const { pathname } = request.nextUrl;
  const isPublic =
    // API routes authenticate themselves (bearer secret, webhook signature) and
    // must never be redirected to the login page.
    pathname.startsWith("/api/") ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
