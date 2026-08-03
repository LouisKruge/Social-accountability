import { describe, expect, it } from "vitest";
import { record, report, serverTimingHeader, spans } from "./timing";

/**
 * Not a unit test so much as a worked example: it reproduces the span pattern a
 * real /commit render produces and prints the report, so the shape of the
 * production output is reviewable before anything is deployed.
 */
describe("a worked example of a real report", () => {
  it("reads like a query log", () => {
    spans().length = 0;
    // A representative /commit render: the parallel burst, then the per-cohort
    // boards, then the wallet's own reads.
    record("auth.getUser", 41.2);
    record("stakes", 63.8, 3);
    record("cohorts", 58.1, 5);
    record("payouts", 61.4, 1);
    record("rpc.cohort_market", 72.9, 2);
    record("verification_logs", 88.3, 42);
    record("rpc.cohort_progress", 96.4, 7);
    record("rpc.cohort_progress", 91.7, 4);
    record("rpc.cohort_progress", 94.1, 6);
    record("rpc.wallet_positions", 104.6, 1);
    record("wallet_transactions", 55.2, 0);
    record("loader.dashboard", 190.5);
    record("loader.wallet", 168.0);

    const r = report();
    // eslint-disable-next-line no-console
    console.log(
      "\n── sample report ──\n" +
        JSON.stringify(
          { db_total_ms: r.totalMs, round_trips: r.spanCount, slowest: r.slowest, by_name: r.byName.slice(0, 5) },
          null,
          2,
        ) +
        "\n\nServer-Timing: " +
        serverTimingHeader(6) +
        "\n",
    );

    // The N+1 is the thing this must surface, and it does: three separate
    // cohort_progress calls group into one line that outweighs any single query.
    const board = r.byName.find((x) => x.name === "rpc.cohort_progress")!;
    expect(board.calls).toBe(3);
    expect(board.totalMs).toBeGreaterThan(r.byName.find((x) => x.name === "stakes")!.totalMs);
  });
});
