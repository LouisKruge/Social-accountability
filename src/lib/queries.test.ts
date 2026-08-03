import { describe, expect, it, vi } from "vitest";
import { getCohorts, getMarket, getMyLogs, getMyPayouts, getMyStakes } from "./queries";
import type { ServerClient } from "@/lib/supabase/server";

/**
 * These guard the SHAPE of the query layer, not Supabase itself. The bug they
 * exist to catch is a loader quietly going back to querying a table directly
 * and reintroducing the duplicate round trips this module was written to end.
 */
function fakeClient(rows: Record<string, unknown[]>) {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push(table);
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => Promise.resolve({ data: rows[table] ?? [] }),
        then: (r: (v: { data: unknown[] }) => void) => r({ data: rows[table] ?? [] }),
      };
      return chain;
    },
    rpc(name: string) {
      calls.push(`rpc:${name}`);
      return Promise.resolve({ data: rows[name] ?? [] });
    },
  };
  return { client: client as unknown as ServerClient, calls };
}

describe("the shared query layer", () => {
  it("reads stakes from one place", async () => {
    const { client, calls } = fakeClient({ stakes: [{ id: "s1", cohort_id: "c1" }] });
    const rows = await getMyStakes(client, "u1");
    expect(rows).toHaveLength(1);
    expect(calls).toEqual(["stakes"]);
  });

  it("returns an empty array rather than null when there is nothing", async () => {
    // Every caller treats these as arrays. A null here would surface as a
    // crash in a loader rather than an empty screen.
    const { client } = fakeClient({});
    expect(await getMyStakes(client, "u1")).toEqual([]);
    expect(await getCohorts(client)).toEqual([]);
    expect(await getMyPayouts(client, "u1")).toEqual([]);
    expect(await getMarket(client)).toEqual([]);
  });

  it("does not query logs at all when the user has no stakes", async () => {
    // The old code always issued this query, even for an account with nothing
    // in it — a guaranteed wasted round trip on every empty dashboard.
    const { client, calls } = fakeClient({ stakes: [] });
    expect(await getMyLogs(client, "u1")).toEqual([]);
    expect(calls).not.toContain("daily_verification_logs");
  });

  it("fetches logs once the user has stakes", async () => {
    const { client, calls } = fakeClient({
      stakes: [{ id: "s1", cohort_id: "c1" }],
      daily_verification_logs: [{ stake_id: "s1", log_date: "2026-08-01" }],
    });
    const logs = await getMyLogs(client, "u1");
    expect(logs).toHaveLength(1);
    expect(calls).toContain("daily_verification_logs");
  });

  it("asks the market RPC by name", async () => {
    const { client, calls } = fakeClient({ cohort_market: [{ cohort_id: "c1" }] });
    await getMarket(client);
    expect(calls).toEqual(["rpc:cohort_market"]);
  });
});
