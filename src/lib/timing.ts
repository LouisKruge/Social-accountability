import * as React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// SERVER TIMING
//
// Built because the last two performance fixes were reasoned about rather than
// measured in production. Static analysis said "seventeen round trips became
// twelve"; nobody could say what those trips actually COST against the real
// database, from the real region, on a real request. This closes that.
//
// ── WHAT IT RECORDS ──────────────────────────────────────────────────────────
// One span per query, per loader, per render — name and duration only. It
// deliberately records NO values, NO user id and NO row contents, so a timing
// report can be logged, forwarded to a log drain, or read over the wire without
// carrying anybody's money or photographs with it. The most it will say about
// data is how many rows came back, because "slow" and "slow because it returned
// 4 000 rows" are different bugs.
//
// ── COST WHEN IDLE ───────────────────────────────────────────────────────────
// Two `performance.now()` calls and an array push per span. That is real but
// negligible next to a network round trip, which is the only thing being
// measured. It is always on, because instrumentation you have to remember to
// enable is instrumentation that is off during the incident.
// ─────────────────────────────────────────────────────────────────────────────

export interface Span {
  name: string;
  /** Milliseconds, to one decimal. */
  ms: number;
  /** Rows returned, where the span wrapped a query. */
  rows?: number;
}

/**
 * Request-scoped span collector.
 *
 * `cache` ships in the React canary Next vendors for the App Router, not in
 * stable react 18.3 — same situation as src/lib/queries.ts.
 *
 * The fallback must return the SAME array every call. The obvious-looking
 * `() => []` returns a fresh one, so every `record()` writes into a throwaway
 * and the module silently collects nothing — which is precisely how
 * instrumentation ends up reporting an empty report and being believed. A
 * module-level singleton is the right degradation outside a request: there is
 * no request to scope to, and a test can clear it.
 */
const fallbackSpans: Span[] = [];
const collector: () => Span[] =
  (React as { cache?: <T extends () => unknown>(fn: T) => T }).cache?.(() => [] as Span[]) ??
  (() => fallbackSpans);

export function spans(): Span[] {
  return collector();
}

/** Time an async operation. Records the span even when it throws. */
export async function timed<T>(
  name: string,
  fn: () => Promise<T>,
  countRows?: (result: T) => number,
): Promise<T> {
  const t0 = performance.now();
  try {
    const result = await fn();
    record(name, performance.now() - t0, countRows?.(result));
    return result;
  } catch (err) {
    // A failed query is usually the slow one. Losing its span at exactly the
    // moment you need it would be the worst possible time.
    record(`${name}!error`, performance.now() - t0);
    throw err;
  }
}

export function record(name: string, ms: number, rows?: number): void {
  spans().push({ name, ms: Math.round(ms * 10) / 10, rows });
}

export interface TimingReport {
  totalMs: number;
  /** The wall time of the slowest single span — the thing worth fixing first. */
  slowest: Span | null;
  spanCount: number;
  spans: Span[];
  /** Grouped by name, for spans that ran more than once. */
  byName: { name: string; calls: number; totalMs: number }[];
}

export function report(): TimingReport {
  const all = spans();
  const grouped = new Map<string, { calls: number; totalMs: number }>();
  for (const s of all) {
    const g = grouped.get(s.name) ?? { calls: 0, totalMs: 0 };
    g.calls += 1;
    g.totalMs = Math.round((g.totalMs + s.ms) * 10) / 10;
    grouped.set(s.name, g);
  }

  return {
    // Spans overlap — most of these run inside a Promise.all — so summing them
    // would overstate wall time badly. The sum is still the right measure of
    // total DATABASE work, which is what a round-trip problem shows up in.
    totalMs: Math.round(all.reduce((t, s) => t + s.ms, 0) * 10) / 10,
    slowest: all.length ? all.reduce((a, b) => (b.ms > a.ms ? b : a)) : null,
    spanCount: all.length,
    spans: [...all].sort((a, b) => b.ms - a.ms),
    byName: Array.from(grouped.entries())
      .map(([name, g]) => ({ name, ...g }))
      .sort((a, b) => b.totalMs - a.totalMs),
  };
}

/**
 * The `Server-Timing` header value.
 *
 * Browsers render this natively in the Network panel's Timing tab, so a report
 * is visible without any tooling, on a real device, against production.
 * Names are sanitised because the header is a structured field and a stray
 * comma or semicolon would silently truncate everything after it.
 */
export function serverTimingHeader(max = 20): string {
  return report()
    .spans.slice(0, max)
    .map((s, i) => `${sanitise(s.name)}${i};dur=${s.ms}`)
    .join(", ");
}

function sanitise(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
}

/**
 * One structured line per request, for a log drain.
 *
 * Off unless ASCEND_TRACE=1, because this is the one part that would otherwise
 * write a line for every request in production forever.
 */
export function logReport(label: string): void {
  if (process.env.ASCEND_TRACE !== "1") return;
  const r = report();
  console.log(
    JSON.stringify({
      trace: label,
      db_ms: r.totalMs,
      spans: r.spanCount,
      slowest: r.slowest,
      by_name: r.byName,
    }),
  );
}
