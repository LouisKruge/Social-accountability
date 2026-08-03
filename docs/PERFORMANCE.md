# Measuring Ascend

Two performance fixes were shipped by reasoning about the code rather than
measuring the running system, because this build environment cannot reach
Supabase. "Seventeen round trips became twelve" is a real claim about the source
and *not* the same claim as "it got faster". This is how to find out.

---

## The finding that mattered most

**Vercel functions ran in `iad1` (Washington DC). Supabase is in `eu-west-3`
(Paris).** Every query was a transatlantic round trip — roughly 80–100ms each,
before Postgres did any work at all.

The first real measurement was `wall_ms: 681.9` to load an account holding
**one** stake and two open challenges. That is not a query problem; there is
almost nothing to query. It is ~12 round trips × the Atlantic.

`vercel.json` now pins functions to `cdg1` (Paris), the same city as the
database. That shortens both legs at once for a South African user:

| leg | before | after |
|---|---|---|
| browser (ZA) → function | ~230ms to Washington | ~150ms to Paris |
| function → database | ~85ms **per query** | ~1–5ms per query |

**If you ever move the Supabase project, move `vercel.json` with it.** A region
mismatch is invisible in code review, survives every optimisation, and costs
more than all of them combined.

## The second finding: server code in the client bundle

Adding `node:async_hooks` to the timing module broke the build — and that break
was a symptom, not the problem. Two **client** components imported *values* from
server-loader modules:

- `exchange-shell.tsx` → `MODULES` from `lib/exchange.ts`
- `profile-form.tsx` → `GOAL_LABEL` from `lib/elevate.ts`

Both files also export loaders that open a database connection. Importing one
constant dragged the whole server graph toward the browser bundle. It had been
doing that silently; the `node:` import merely made it loud.

The constants now live in `lib/modules.ts` and `lib/studios.ts`, which import
nothing server-side. Every server module carries `import "server-only"`, so the
same mistake is now a **build failure that names the culprit** rather than
silent bundle weight.

## The endpoint

Signed in, in production:

```
GET /api/debug/timing              # the Commit exchange
GET /api/debug/timing?load=elevate # the Elevate studios
```

It runs the **real loaders** against the **real database** from the **real
region** and reports what each query cost.

```json
{
  "wall_ms": 214.8,
  "db_total_ms": 1186.2,
  "parallelism": 5.52,
  "round_trips": 13,
  "slowest": { "name": "rpc.wallet_positions", "ms": 104.6 },
  "by_name": [
    { "name": "rpc.cohort_progress", "calls": 3, "totalMs": 282.2 },
    { "name": "rpc.wallet_positions", "calls": 1, "totalMs": 104.6 }
  ],
  "result_shape": { "active_positions": 1, "open_challenges": 3 }
}
```

### Reading it

- **`wall_ms`** is what the user waits.
- **`db_total_ms`** is the sum of every span, so it *exceeds* wall time whenever
  queries ran in parallel. That is expected and desirable.
- **`parallelism`** is the ratio. Around 1.0 means everything ran in series —
  a waterfall, and the most valuable thing to fix. Above 4 means the parallel
  burst is working.
- **`by_name`** is sorted by total cost, which is what makes an N+1 visible: ten
  fast queries outrank one slow one, exactly as they should.
- **`result_shape`** distinguishes "slow" from "slow because it returned four
  thousand rows".

### On a phone, with no tooling

The response also carries a `Server-Timing` header, which browsers render
natively in the Network panel's Timing tab. Same numbers, no JSON.

---

## Why it is safe to ship

- **Authenticated.** Anonymous callers get a 401.
- **RLS-bound.** It uses the ordinary anon-key client, so it can only exercise
  the caller's own data — exactly as the page would.
- **It returns no data.** Only span names, durations and row *counts*. No
  amount, no photograph, no name, no id appears in the response or the header.

---

## Continuous logging

Set `ASCEND_TRACE=1` and every exchange/elevate load writes one structured JSON
line for a log drain. Off by default — otherwise it writes a line per request in
production forever.

---

## What to look at first

1. **`parallelism` near 1.0** — something is awaiting in series. This is the
   pattern that caused the original slowness.
2. **A high `calls` count in `by_name`** — an N+1. `rpc.cohort_progress` is the
   known candidate: it runs once per cohort the user is in. Three cohorts is
   fine; thirty would not be, and the fix is a single RPC taking an array of
   cohort ids.
3. **`auth.getUser` over ~100ms** — that is a round trip to Supabase Auth. The
   middleware no longer makes one, but every page still does.

---

## What is already measured, and what is not

| | Measured | How |
|---|---|---|
| Client scroll jank | Yes | 0 long tasks at 6× CPU throttle, 20 scroll steps |
| First contentful paint | Yes | 652ms at 6× throttle |
| Middleware redirect | Yes | ~4ms after dropping the auth round trip |
| Query round-trip count | Yes | static — one query site per table |
| **Real query latency** | **Partly** | first measurement: 682ms wall for a near-empty account, which is what exposed the region mismatch |
