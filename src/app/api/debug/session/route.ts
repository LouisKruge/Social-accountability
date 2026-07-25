import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY diagnostic. Visit while logged in. Compares the session identity the
 * server sees (getUser) against what Postgres sees on a DB call (auth.uid() via
 * the whoami() RPC). If sessionUserId is set but dbSees shows uid=null/role=anon,
 * the user's token isn't reaching PostgREST on server DB calls. No secrets.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: dbSees, error } = await supabase.rpc("whoami");

  return NextResponse.json({
    sessionUserId: user?.id ?? null,
    dbSees: dbSees ?? null,
    rpcError: error?.message ?? null,
  });
}
