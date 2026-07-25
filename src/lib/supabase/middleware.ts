import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

const PUBLIC_PATHS = ["/login", "/signup", "/share", "/auth", "/api/share-card"];

/**
 * Refreshes the Supabase auth session on every request and gates private routes.
 * Unauthenticated users hitting a private path are redirected to /login.
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
    user = (await supabase.auth.getUser()).data.user;
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
