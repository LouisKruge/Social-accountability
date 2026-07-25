# n8n WhatsApp fan-out workflow

n8n owns **messaging fan-out** — never data logic, and it never receives the
Supabase service-role key. After the ranking job writes the week's leaderboard,
the app POSTs a safe, derived payload to the n8n webhook
(`N8N_RANKINGS_WEBHOOK_URL`). n8n turns that into WhatsApp Business API messages
and requests share-card generation for the top 1–3 per category.

## Webhook payload (app → n8n)

`POST <N8N_RANKINGS_WEBHOOK_URL>` with header `x-webhook-secret: <N8N_WEBHOOK_SECRET>`:

```json
{
  "event": "rankings.computed",
  "period": { "start": "2026-07-13", "end": "2026-07-19" },
  "site_url": "https://your-app",
  "rankings": [
    {
      "group_id": "…", "category_id": "…", "category_name": "Steps", "unit": "steps",
      "period_start": "2026-07-13", "period_end": "2026-07-19",
      "user_id": "…", "display_name": "Thabo",
      "phone_number": "+27821234567", "notify_whatsapp": true,
      "pct_change": 12.5, "is_absolute": false, "rank": 2
    }
  ]
}
```

The payload contains only the **safe derived view** (name, rank, % change) plus
each participant's phone + notify preference — no raw values, no baselines, no
service-role key.

## Suggested workflow

1. **Webhook** node — verify `x-webhook-secret` matches; reject otherwise.
2. **Filter** — keep rows where `notify_whatsapp = true` and `phone_number` is set.
3. **Function** — build the message per row, e.g.
   `You're #{{rank}} in {{category_name}} this week — {{pct_change > 0 ? 'up' : 'down'}} {{abs(pct_change)}}%. See the board: {{site_url}}/groups/{{group_id}}`.
4. **WhatsApp Business API** node — send each message.
5. **Top 1–3 branch** — for rows with `rank <= 3`, call
   `{{site_url}}/api/share-card/<rankingId>` (or create a share card first) and
   attach the PNG to a celebratory message.

## Reminder workflow (separate schedule)

A second n8n workflow (e.g. Thursday) reminds users who haven't logged the
current period. Feed it from a lightweight app endpoint or a Supabase view that
lists `(user, category)` pairs with no entry for the current `period_start`, then
message those users. Keep the "who hasn't logged" query in the database/app; n8n
only sends.

## Security notes

- The webhook is the **only** thing n8n receives. It must never be given the
  Supabase service-role key or direct DB access.
- Treat `x-webhook-secret` as a shared secret and rotate it if leaked.
