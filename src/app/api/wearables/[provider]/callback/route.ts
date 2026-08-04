import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROVIDERS, type Provider } from "@/lib/wearables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_URL: Record<Exclude<Provider, "apple_health">, string> = {
  fitbit: "https://api.fitbit.com/oauth2/token",
  google_fit: "https://oauth2.googleapis.com/token",
};

const KEYS: Record<Exclude<Provider, "apple_health">, [string, string]> = {
  fitbit: ["FITBIT_CLIENT_ID", "FITBIT_CLIENT_SECRET"],
  google_fit: ["GOOGLE_FIT_CLIENT_ID", "GOOGLE_FIT_CLIENT_SECRET"],
};

/** Constant-time compare, so the state check leaks nothing through timing. */
function sameState(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Finish an OAuth connection.
 *
 * The user comes from the SESSION, never from the state parameter — anything
 * that travelled through the browser is attacker-controlled. The state cookie
 * is compared only to prove this callback belongs to a flow this browser
 * started.
 *
 * Tokens are written with the ADMIN client, because `wearable_credentials` is
 * deny-all to every client including the owner's own session. That is the point
 * of the table; see the migration header.
 */
export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider as Provider;
  const def = PROVIDERS.find((p) => p.key === provider);
  if (!def || !def.pull) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 404 });
  }

  const back = (q: string) => NextResponse.redirect(new URL(`/you/devices?${q}`, req.nextUrl.origin));

  const url = req.nextUrl;
  if (url.searchParams.get("error")) {
    // The user pressed "deny", which is a legitimate outcome and not an error
    // worth a stack trace.
    return back("connected=cancelled");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = req.cookies.get(`wearable_state_${provider}`)?.value;
  if (!code || !state || !cookie || !sameState(state, cookie)) {
    return back("connected=badstate");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const [idKey, secretKey] = KEYS[provider as Exclude<Provider, "apple_health">];
  const clientId = process.env[idKey];
  const clientSecret = process.env[secretKey];
  if (!clientId || !clientSecret) return back("connected=nocreds");

  const redirectUri = new URL(`/api/wearables/${provider}/callback`, url.origin).toString();
  const res = await fetch(TOKEN_URL[provider as Exclude<Provider, "apple_health">], {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
    }),
  });

  if (!res.ok) return back("connected=exchangefailed");

  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    user_id?: string;
  };
  if (!body.access_token) return back("connected=notoken");

  const db = createAdminClient();

  const { data: conn, error: connError } = await db
    .from("wearable_connections")
    .upsert(
      {
        user_id: user.id,
        provider,
        status: "active",
        scope: body.scope ?? def.scopeBlurb,
        last_error: null,
      },
      { onConflict: "user_id,provider" },
    )
    .select("id")
    .single();

  if (connError || !conn) return back("connected=savefailed");

  const { error: credError } = await db.from("wearable_credentials").upsert(
    {
      connection_id: conn.id,
      user_id: user.id,
      access_token: body.access_token,
      refresh_token: body.refresh_token ?? null,
      expires_at: body.expires_in
        ? new Date(Date.now() + body.expires_in * 1000).toISOString()
        : null,
      provider_user_id: body.user_id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_id" },
  );

  if (credError) return back("connected=savefailed");

  const done = back("connected=ok");
  done.cookies.delete(`wearable_state_${provider}`);
  return done;
}
