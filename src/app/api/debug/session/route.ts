import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Decode the `role` claim of a Supabase JWT key without verifying it. */
function keyRole(jwt: string): string {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString());
    return String(payload.role ?? "unknown");
  } catch {
    return "not-a-jwt";
  }
}

/**
 * TEMPORARY diagnostic (no secret values). Reports:
 *  - anonKeyRole: the role claim of NEXT_PUBLIC_SUPABASE_ANON_KEY (should be "anon"!)
 *  - authCookies: names of Supabase auth cookies the server route can see
 *  - sessionUserId vs dbSees: whether the session reaches getUser and Postgres
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: dbSees, error } = await supabase.rpc("whoami");

  const authCookies = cookies()
    .getAll()
    .map((c) => c.name)
    .filter((n) => n.startsWith("sb-") || n.includes("auth-token"));

  return NextResponse.json({
    anonKeyRole: keyRole(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
    serviceKeyPresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    authCookies,
    sessionUserId: user?.id ?? null,
    dbSees: dbSees ?? null,
    rpcError: error?.message ?? null,
  });
}
