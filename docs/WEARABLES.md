# Wearables — Fitbit, Google Fit, Apple Health

---

## 1. The three providers are not one problem

Most step integrations are built as if they were, and the result is a design
that cannot work for one of them.

| Provider | Transport | Ascend can pull? |
|---|---|---|
| **Fitbit** | OAuth 2 + server-to-server REST | Yes |
| **Google Fit** | OAuth 2 + REST aggregate API | Yes |
| **Apple Health** | **No server API exists** | **No** |

**HealthKit data never leaves the device** except through an app the user
installs. There is nothing to OAuth against and nothing to poll. A "Connect
Apple Health" button is a button that cannot work.

So Apple Health is modelled as what it is: `pull: false`, no connect button, an
explanation on the devices screen saying why, and a push endpoint the iPhone app
posts to. Google Fit is additionally deprecated in favour of Health Connect on
Android — the adapter is split so the transport can be swapped without touching
the normalisation.

---

## 2. Credentials are the gap, not code

Ascend does not have Fitbit or Google client credentials. Everything else is
built.

- `availableProviders(env)` returns only providers whose env vars are **all**
  present. A half-configured provider is not available — it would fail at the
  redirect, after the user had already tapped connect.
- The devices screen renders no connect button for an unavailable provider, and
  says so: *"This deployment has no Fitbit credentials yet. We don't show a
  button that would fail after you tapped it."*
- If a route is somehow reached anyway, the error **names the missing variable**
  rather than saying "something went wrong" — the same pattern as
  `createAdminClient()`.

To enable, set: `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`,
`GOOGLE_FIT_CLIENT_ID`, `GOOGLE_FIT_CLIENT_SECRET`, `WEARABLE_JOB_SECRET`.
Redirect URIs are `/api/wearables/<provider>/callback`.

---

## 3. Tokens live where nobody can read them

Two tables, and the split is the point.

```
wearable_connections   provider, status, last sync, last error   owner-readable
wearable_credentials   access + refresh tokens                   DENY-ALL
```

The obvious design is one table holding tokens too, owner-only under RLS. That
design is wrong: **"owner-only" means readable with the owner's anon key, from
the browser.** A single XSS anywhere in the app then exfiltrates a live Fitbit
access token and a refresh token that outlives the session. A UI bug becomes a
third-party account compromise.

`wearable_credentials` carries an explicit `USING (false) WITH CHECK (false)`
policy rather than no policy at all. A table with zero policies is already
closed, but it reads as an omission — the kind of thing a later migration
"fixes" by adding an owner-select policy that looks consistent with everything
around it. The deny-all says the quiet part in SQL: nobody gets in, and it was
not forgotten.

The SQL suite asserts it directly, and the assertion that matters is not the
usual two-tenant one:

> `PASS: A CANNOT read her OWN OAuth tokens`

plus: unreachable by exact-value filter, unwritable by any client,
`my_wearables()` carries no token column, and disconnecting cascades the tokens
away rather than orphaning them.

**Known debt:** the tokens are plain columns. Before scale they belong in
Supabase Vault or pgsodium, exactly like `payout_destinations.account_number`.

---

## 4. OAuth details that decide whether it works

**`state` is a random per-attempt CSRF token** in an httpOnly cookie, compared
in constant time. Without it, an attacker can complete an OAuth flow against
*their own* Fitbit account inside a victim's session, and the victim's challenge
silently starts reading the attacker's step count. In a product where steps are
worth money that is not theoretical.

**The user id is deliberately NOT in `state`.** It travels through the browser
and back, so it is attacker-controlled by definition. The callback reads the
session.

**Google needs `access_type=offline` and `prompt=consent`.** Without both, a
repeat connection returns no refresh token and the integration silently dies at
the first expiry.

**Refresh tokens rotate.** Keeping the old one after a rotation makes the *next*
refresh fail with a revoked-connection error that is entirely self-inflicted, so
the new one replaces it when present.

**Refresh runs a minute early** (`TOKEN_SKEW_MS`). A token that expires *during*
the request that used it produces a 401 the sync reports as a failure, and the
next run repeats it identically.

---

## 5. Normalisation, and two traps

`normaliseFitbit` / `normaliseGoogleFit` / `normaliseAppleHealth` → `DailySteps[]`.
All pure, all tested against real payload shapes and against junk.

**Fitbit sends `value` as a string.** Without the cast, the first `+` is string
concatenation: `"8423" + "1012"` is `84231012`, and it looks plausible enough to
ship.

**A Google Fit bucket with no points is a day with no data, which is not a day
with zero steps.** Recording a false zero reads as a missed day and costs
somebody their streak. Empty buckets are dropped; a genuine zero that *has* a
point is kept.

Apple Health payloads are shaped by Ascend, and are validated exactly as
strictly as the third-party ones. "We wrote the client" is an assumption about a
binary running on somebody else's phone, not an integrity guarantee.

---

## 6. Sanity bounds at the boundary

The 120,000-step ceiling the integrity engine already uses is applied **here
too**, before the write. A value that only gets flagged downstream has still
been written, and a written number is one somebody has to explain later.

Also rejected: negative counts, and **future-dated days** — a wrong device clock
or a hand-made payload, and either way not evidence of effort already made.

---

## 7. The merge rule

Both naive versions are wrong:

- *"Device always wins"* lets a phone left on a desk overwrite a watch's real
  count with a lower one, taking away effort the person actually made.
- *"Never overwrite"* means the first partial sync of a day freezes it at
  whatever the count was at 9am.

So:

| Existing | Incoming | Decision |
|---|---|---|
| nothing | any | **insert** |
| manual | any device | **skip** — a typed figure is a claim; silently replacing it is the app arguing without saying so |
| same source, lower | higher | **update** |
| same source, higher | lower | **skip** |
| different source | any | **skip** — the integrity engine's `device_switch` signal wants to see both |

The sync window is 30 days on a first connection so an existing challenge is not
empty, and 7 days afterwards because providers backfill late — a watch synced on
Monday can change Saturday's total.

---

## 8. The push endpoint is not a back door

`/api/wearables/push` authenticates with **the caller's own session**, exactly
like every other write in the app. It is deliberately *not* a shared push
secret: a shared secret in a shipped binary is a secret every user has, and it
would let anybody post steps as anybody.

The payload goes through the **identical** `sanitise → merge → write` path as a
pulled sync. A push endpoint with its own shortcut write is how one source ends
up exempt from the ceiling.

Capped at 120 samples per request — beyond that it is a dump, not a sync.

---

## 9. Failure is per-connection

`/api/wearables/sync` always returns 200 with per-connection outcomes. One
revoked Fitbit must not stop everybody else's steps syncing, and a cron
scheduler retrying the whole batch because of one 500 makes that worse.

Every run is recorded in `wearable_sync_runs` with a message written **to be
shown to the person**: *"The connection was revoked at the provider. Reconnect
to keep syncing"* is an answer; *"sync failed"* is not. The response body
carries messages only — never a token, never a provider user id.

---

## 10. Privacy

Step totals only. Not sleep, not heart rate, not weight, not location — the
requested scopes are the narrowest each provider offers, and the granted scope
is stored verbatim so the consent screen and the settings screen cannot drift
from what was actually agreed.

Disconnecting stops the sync immediately and cascades the stored authorisation
away. **The verified days stay**, because deleting them would rewrite challenges
that have already settled — a worse outcome than a settled record mentioning a
device the person no longer uses. The devices screen says this rather than
leaving it to be discovered.

---

## 11. Files

| Path | What |
|---|---|
| `src/lib/wearables.ts` | Pure — providers, normalisation, bounds, merge, tokens |
| `src/lib/wearables.test.ts` | 37 unit tests, no network |
| `src/lib/wearableSync.ts` | HTTP, refresh, writes (service role) |
| `src/app/api/wearables/[provider]/start` | OAuth start + CSRF cookie |
| `src/app/api/wearables/[provider]/callback` | Token exchange |
| `src/app/api/wearables/push` | Apple Health, session-authenticated |
| `src/app/api/wearables/sync` | Bearer-gated daily pull |
| `src/app/you/devices` | Connect, disconnect, sync state |
| `supabase/migrations/20260801000000_wearables.sql` | Schema + RLS, in one file |
