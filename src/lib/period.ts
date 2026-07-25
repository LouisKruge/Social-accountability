// Weekly period helpers. A period runs Monday → Sunday (ISO week), which maps
// cleanly onto the "weekly leaderboard reset" model. All dates are handled as
// UTC calendar dates (YYYY-MM-DD) to stay stable across the SA timezone.

export interface Period {
  start: string; // YYYY-MM-DD (Monday)
  end: string; // YYYY-MM-DD (Sunday)
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday (00:00 UTC) of the week containing `date`. */
export function weekStart(date: Date = new Date()): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export function currentPeriod(date: Date = new Date()): Period {
  const start = weekStart(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: toISODate(start), end: toISODate(end) };
}

/** The period immediately before the one containing `date` (the one that just closed). */
export function previousPeriod(date: Date = new Date()): Period {
  const start = weekStart(date);
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: toISODate(start), end: toISODate(end) };
}

export function formatPeriod({ start, end }: Period): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}
