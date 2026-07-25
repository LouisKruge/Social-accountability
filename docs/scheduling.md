# Weekly ranking job — scheduling

The ranking calculation lives in the app (`/api/rankings/compute`, backed by the
pure logic in `src/lib/ranking.ts`). The **schedule** should live close to the
database, per the project's design intent. Two supported options:

## Option A — Supabase `pg_cron` + `pg_net` (recommended)

Keeps the trigger in Postgres. `pg_net` makes the outbound HTTP POST to the
compute endpoint with the bearer secret; the endpoint recomputes the **previous**
(just-closed) period for every group/category and fans out to n8n.

Run once in the Supabase SQL editor (values in `vault`/settings, never inline):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the endpoint + secret as database settings (or use Supabase Vault).
-- alter database postgres set app.compute_url = 'https://YOUR_APP/api/rankings/compute';
-- alter database postgres set app.ranking_job_secret = 'YOUR_RANKING_JOB_SECRET';

-- Every Monday 06:00 UTC (08:00 SAST): close last week, rank, notify.
select cron.schedule(
  'weekly-ranking',
  '0 6 * * 1',
  $$
    select net.http_post(
      url     := current_setting('app.compute_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.ranking_job_secret')
      ),
      body    := jsonb_build_object('period', 'previous', 'notify', true)
    );
  $$
);
```

## Option B — Supabase Edge Function on a cron trigger

Create an Edge Function (Deno) whose only job is to POST to the same endpoint
with the bearer secret, and attach a cron schedule to it in the dashboard. Use
this if you'd rather not enable `pg_net`.

## Option C — Vercel Cron (fallback)

Vercel Cron issues a **GET** with `Authorization: Bearer $CRON_SECRET`. The
compute route is POST-only by design (so only the trusted scheduler triggers it),
so to use Vercel Cron add a GET handler that checks `CRON_SECRET` and calls the
same job. Prefer Option A to keep the ranking schedule next to the data.

## Manual / dev trigger

```bash
curl -X POST "$SITE/api/rankings/compute" \
  -H "Authorization: Bearer $RANKING_JOB_SECRET" \
  -H "content-type: application/json" \
  -d '{"period":"current","notify":false}'
```

Group owners can also press **Recompute now** on a leaderboard during
development — that runs the same job for the current period without needing the
secret (it's authorized as the owner server-side).
