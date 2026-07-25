# Weekly ranking job — scheduling

The ranking calculation lives in the app (`/api/rankings/compute`, backed by the
pure logic in `src/lib/ranking.ts`). The **schedule** should live close to the
database, per the project's design intent. Two supported options:

## Option A — Supabase `pg_cron` + `pg_net` (recommended, ALREADY LIVE)

Keeps the trigger in Postgres. `pg_net` makes the outbound HTTP POST to the
compute endpoint with the bearer secret (both read from **Supabase Vault**, so
no secret is ever inlined); the endpoint recomputes the **previous**
(just-closed) period for every group/category and fans out to n8n.

This has been applied to the live `ascend` project as job
`ascend-weekly-ranking` (Mondays 06:00 UTC / 08:00 SAST). The Vault entries are:
`ascend_ranking_job_secret` (the bearer token) and `ascend_compute_url` (your
deployed base URL). After deploying the app, point the job at your URL:

```sql
-- one line: set the deployed base URL (no trailing slash, no /api path)
update vault.secrets
set secret = 'https://YOUR-VERCEL-URL'
where name = 'ascend_compute_url';
```

For reference, the job was created like this (secrets pulled from Vault at run
time — never hard-coded):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- select vault.create_secret('<RANKING_JOB_SECRET>', 'ascend_ranking_job_secret');
-- select vault.create_secret('https://YOUR-VERCEL-URL', 'ascend_compute_url');

select cron.schedule('ascend-weekly-ranking', '0 6 * * 1', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='ascend_compute_url') || '/api/rankings/compute',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='ascend_ranking_job_secret')
    ),
    body := jsonb_build_object('period','previous','notify',true)
  );
$$);
```

Inspect runs with `select * from cron.job_run_details order by start_time desc;`.

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
