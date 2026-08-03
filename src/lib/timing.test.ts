import { describe, expect, it } from "vitest";
import { record, report, serverTimingHeader, spans, timed, withTiming } from "./timing";

// Each test starts from a clean slate: without React's cache, `spans()` returns
// a fresh array per call in this environment, so we clear explicitly.
function reset() {
  spans().length = 0;
}

describe("timed", () => {
  it("returns the wrapped value untouched", async () => {
    reset();
    const v = await timed("q", async () => ({ ok: 1 }));
    expect(v).toEqual({ ok: 1 });
  });

  it("records a span with a duration", async () => {
    reset();
    await timed("q", async () => {
      await new Promise((r) => setTimeout(r, 12));
      return null;
    });
    const s = spans().find((x) => x.name === "q")!;
    expect(s).toBeDefined();
    expect(s.ms).toBeGreaterThan(5);
  });

  it("records the span even when the operation throws", async () => {
    // A failing query is usually the slow one — losing its timing at exactly
    // the moment you need it would be the worst possible time.
    reset();
    await expect(
      timed("bad", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(spans().some((s) => s.name === "bad!error")).toBe(true);
  });

  it("counts rows when told how", async () => {
    reset();
    await timed("rows", async () => [1, 2, 3], (r) => r.length);
    expect(spans().find((s) => s.name === "rows")?.rows).toBe(3);
  });
});

describe("report", () => {
  it("is empty and safe with no spans", () => {
    reset();
    const r = report();
    expect(r.totalMs).toBe(0);
    expect(r.slowest).toBeNull();
    expect(r.spanCount).toBe(0);
  });

  it("names the slowest span, which is the one worth fixing", () => {
    reset();
    record("fast", 4);
    record("slow", 210);
    record("middling", 30);
    expect(report().slowest?.name).toBe("slow");
  });

  it("sorts spans slowest first", () => {
    reset();
    record("a", 5);
    record("b", 50);
    expect(report().spans.map((s) => s.name)).toEqual(["b", "a"]);
  });

  it("groups repeated spans so an N+1 is visible as one line", () => {
    reset();
    for (let i = 0; i < 6; i += 1) record("rpc.cohort_progress", 20);
    record("stakes", 15);
    const g = report().byName.find((x) => x.name === "rpc.cohort_progress")!;
    expect(g.calls).toBe(6);
    expect(g.totalMs).toBeCloseTo(120, 0);
    // The repeated query outranks the single slower one — which is the point.
    expect(report().byName[0].name).toBe("rpc.cohort_progress");
  });
});

describe("serverTimingHeader", () => {
  it("emits a valid Server-Timing field", () => {
    reset();
    record("stakes", 12.34);
    expect(serverTimingHeader()).toMatch(/^stakes0;dur=12\.3$/);
  });

  it("sanitises names so a stray separator cannot truncate the header", () => {
    // Server-Timing is a structured field: an unescaped comma or semicolon
    // silently drops everything after it.
    reset();
    record("rpc.cohort_progress; drop", 5);
    const h = serverTimingHeader();
    expect(h).not.toMatch(/[;,].*drop/);
    expect(h.split(";")).toHaveLength(2);
  });

  it("caps how many spans it emits", () => {
    reset();
    for (let i = 0; i < 60; i += 1) record(`q${i}`, i);
    expect(serverTimingHeader(5).split(", ")).toHaveLength(5);
  });

  it("carries no identifiers or values, only names and durations", () => {
    reset();
    record("stakes", 10, 3);
    const h = serverTimingHeader();
    expect(h).toMatch(/^[a-zA-Z0-9_;=.,\- ]+$/);
  });
});

describe("withTiming — the scope that makes a report trustworthy", () => {
  it("reports exactly the spans its own callback produced", async () => {
    const { result, timing } = await withTiming(async () => {
      await timed("a", async () => null);
      await timed("b", async () => null);
      return "done";
    });
    expect(result).toBe("done");
    expect(timing.spanCount).toBe(2);
    expect(timing.byName.map((x) => x.name).sort()).toEqual(["a", "b"]);
  });

  it("collects spans recorded deep inside anything it awaits", async () => {
    // THE BUG THIS EXISTS FOR: the first version scoped spans with React's
    // cache(), which only establishes a scope inside a Server Component
    // render. In a route handler every collector call returned a fresh array,
    // so the endpoint reported ZERO spans on a request that had demonstrably
    // hit the database. An empty report looks exactly like a fast request.
    async function threeLayersDown() {
      await timed("deep.query", async () => null);
    }
    async function middle() {
      await threeLayersDown();
    }
    const { timing } = await withTiming(async () => {
      await middle();
      return null;
    });
    expect(timing.spanCount).toBe(1);
    expect(timing.spans[0].name).toBe("deep.query");
  });

  it("does not inherit spans from a previous run", async () => {
    // Serverless containers are reused. A report that accumulated across
    // requests would overstate every request after the first.
    await withTiming(async () => {
      await timed("first", async () => null);
      return null;
    });
    const { timing } = await withTiming(async () => {
      await timed("second", async () => null);
      return null;
    });
    expect(timing.spanCount).toBe(1);
    expect(timing.spans[0].name).toBe("second");
  });

  it("keeps concurrent runs from bleeding into each other", async () => {
    const [a, b] = await Promise.all([
      withTiming(async () => {
        await timed("run-a", async () => new Promise((r) => setTimeout(r, 10)));
        return null;
      }),
      withTiming(async () => {
        await timed("run-b", async () => null);
        return null;
      }),
    ]);
    expect(a.timing.spans.map((s) => s.name)).toEqual(["run-a"]);
    expect(b.timing.spans.map((s) => s.name)).toEqual(["run-b"]);
  });

  it("still reports what it captured when the work throws", async () => {
    await expect(
      withTiming(async () => {
        await timed("ok", async () => null);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
