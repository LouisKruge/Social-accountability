import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { PROVIDERS, type Provider } from "@/lib/wearables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Begin an OAuth connection.
 *
 * ── ON `state` ───────────────────────────────────────────────────────────────
 * The CSRF token is random per attempt and stored in an httpOnly cookie, then
 * compared in the callback. Without it, an attacker can complete an OAuth flow
 * against their OWN provider account in a victim's session, and the victim's
 * challenge silently starts reading the attacker's step count — which in a
 * product where steps are worth money is not a theoretical attack.
 *
 * The user id is deliberately NOT in the state parameter. It travels through
 * the browser and back, so it is attacker-controlled by definition; the
 * callback reads the session instead.
 */
const AUTHORIZE: Record<Exclude<Provider, "apple_health">, string> = {
  fitbit: "https://www.fitbit.com/oauth2/authorize",
  google_fit: "https://accounts.google.com/o/oauth2/v2/auth",
};

const SCOPES: Record<Exclude<Provider, "apple_health">, string> = {
  fitbit: "activity",
  google_fit: "https://www.googleapis.com/auth/fitness.activity.read",
};

const CLIENT_ID_KEY: Record<Exclude<Provider, "apple_health">, string> = {
  fitbit: "FITBIT_CLIENT_ID",
  google_fit: "GOOGLE_FIT_CLIENT_ID",
};

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider as Provider;
  const def = PROVIDERS.find((p) => p.key === provider);
  if (!def) return NextResponse.json({ error: "Unknown provider." }, { status: 404 });

  if (!def.pull) {
    // Apple Health. There is nothing to authorize against — see the header of
    // src/lib/wearables.ts. Saying so beats a redirect to a page that 404s.
    return NextResponse.json(
      {
        error:
          "Apple Health has no server API. It is connected from the iPhone app, which pushes to /api/wearables/push.",
      },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const clientId = process.env[CLIENT_ID_KEY[provider as Exclude<Provider, "apple_health">]];
  if (!clientId) {
    return NextResponse.json(
      {
        error: `${CLIENT_ID_KEY[provider as Exclude<Provider, "apple_health">]} is not set.`,
        detail: "This is a credentials gap, not a code gap. See docs/WEARABLES.md.",
      },
      { status: 503 },
    );
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = new URL(`/api/wearables/${provider}/callback`, req.nextUrl.origin).toString();

  const authorize = new URL(AUTHORIZE[provider as Exclude<Provider, "apple_health">]);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", SCOPES[provider as Exclude<Provider, "apple_health">]);
  authorize.searchParams.set("state", state);
  if (provider === "google_fit") {
    // Without both of these Google returns no refresh token on a repeat
    // connection, and the integration silently dies at the first expiry.
    authorize.searchParams.set("access_type", "offline");
    authorize.searchParams.set("prompt", "consent");
  }

  const res = NextResponse.redirect(authorize.toString());
  res.cookies.set(`wearable_state_${provider}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
