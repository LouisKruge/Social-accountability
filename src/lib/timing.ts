// Server only. A client component importing a value from this file would drag
// the database client and node: built-ins into the browser bundle — which is
// exactly what happened before src/lib/modules.ts and src/lib/studios.ts
// existed, and it only surfaced as a build error once a node: import appeared.
// This import turns that mistake into a build failure naming the culprit.
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

// ─────────────────────────────────────────────────────────────────────────────
// SERVER TIMING
//
// Built because two performance fixes were reasoned about rather than measured
// in production. Static analysis said "seventeen round trips became twelve";
// nobody could say what those trips actually COST against the real database,
// from the real region, on a real request.
//
// ── WHAT IT RECORDS ──────────────────────────────────────────────────────────
// One span per query, per loader — name, duration, row count. NO values, NO
// user id, NO row contents, so a report can be logged, forwarded to a drain or
// read over the wire without carrying anybody's money or photographs with it.
// Row counts are included because "slow" and "slow because it returned 4 000
// rows" are different bugs.
//
// ── WHY AsyncLocalStorage AND NOT React's cache() ────────────────────────────
// This module originally scoped its spans with `React.cache`. It passed its
// unit tests and then reported ZERO spans in production, on a request that had
// demonstrably hit the database — the endpoint returned real row counts beside
// an empty span list.
//
// The reason: `cache()` only establishes a scope inside a React Server
// Component render. A Route Handler is not a render, so every call to the
// collector got a fresh array and every span went into a throwaway. An
// instrumentation module that silently reports nothing is worse than none,
// because an empty report looks like a fast request.
//
// AsyncLocalStorage is the correct primitive: it scopes to the async execution
// context, which covers route handlers, server components and anything either
// of them awaits.
// ─────────────────────────────────────────────────────────────────────────────

export interface Span {
  name: string;
  /** Milliseconds, to one decimal. */
  ms: number;
  /** Rows returned, where the span wrapped a query. */
  rows?: number;
}

const store = new AsyncLocalStorage<Span[]>();

/**
 * Used when nothing established a scope. A module-level singleton rather than
 * a fresh array, because a fresh array means every record() is discarded — the
 * exact failure this module already shipped once.
 *
 * It can accumulate across requests in a warm serverless container, which is
 * why anything that needs an accurate report wraps its work in `withTiming`.
 */
const unscoped: Span[] = [];

export function spans(): Span[] {
  return store.getStore() ?? unscoped;
}

/**
 * Run work inside a fresh span scope and return both its result and the report.
 *
 * This is the only way to get a trustworthy report: it guarantees the spans
 * recorded are exactly the ones this call produced, with nothing inherited from
 * a previous request on a warm container.
 */
export async function withTiming<T>(fn: () => Promise<T>): Promise<{ result: T; timing: TimingReport }> {
  const scope: Span[] = [];
  const result = await store.run(scope, fn);
  return { result, timing: buildReport(scope) };
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
  return buildReport(spans());
}

function buildReport(all: Span[]): TimingReport {
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
