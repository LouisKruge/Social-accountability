import { describe, expect, it } from "vitest";
import { buildPlan, direct, parseIntent, type DirectorContext } from "./director";

// 2026-08-03 is a Monday.
const TODAY = "2026-08-03";
const parse = (text: string) => parseIntent({ text, today: TODAY });

const ctx: DirectorContext = {
  positions: [{ cohortId: "c1", name: "10k a day", exposure: 500, daysRemaining: 20 }],
  hasRoutes: true,
};

describe("parseIntent — the phrasings people actually use", () => {
  it("reads 'I have a wedding in two weeks'", () => {
    const { intent } = parse("I have a wedding in two weeks");
    expect(intent).toMatchObject({ kind: "wedding", date: "2026-08-17", confidence: "high" });
  });

  it("reads 'interview next Tuesday'", () => {
    expect(parse("interview next Tuesday").intent).toMatchObject({
      kind: "interview",
      date: "2026-08-04",
    });
  });

  it("takes the NEXT occurrence when the weekday is today", () => {
    // "on Monday", said on a Monday, means the one coming — not the one you
    // are standing in.
    expect(parse("presentation on Monday").intent!.date).toBe("2026-08-10");
  });

  it("reads 'in 10 days' and 'tomorrow'", () => {
    expect(parse("photoshoot in 10 days").intent!.date).toBe("2026-08-13");
    expect(parse("first date tomorrow").intent!.date).toBe("2026-08-04");
  });

  it("reads an explicit date", () => {
    expect(parse("graduation 2026-12-11").intent!.date).toBe("2026-12-11");
  });

  it("marks 'on the 14th' low confidence, because the month is a guess", () => {
    const { intent } = parse("conference on the 14th");
    expect(intent).toMatchObject({ date: "2026-08-14", confidence: "low" });
  });

  it("rolls 'on the 1st' into next month when it has passed", () => {
    expect(parse("holiday on the 1st").intent!.date).toBe("2026-09-01");
  });
});

describe("parseIntent — what it refuses to guess", () => {
  it("asks rather than inventing a date", () => {
    // A hallucinated date silently reschedules somebody's haircut three days
    // late. Asking is the behaviour a wrong answer cannot give you.
    const { intent, problem } = parse("I have a wedding");
    expect(intent).toBeNull();
    expect(problem).toContain("not when");
  });

  it("asks rather than inventing an event kind", () => {
    const { intent, problem } = parse("something in two weeks");
    expect(intent).toBeNull();
    expect(problem).toContain("not what it is");
  });

  it("says it understood nothing when it understood nothing", () => {
    const { intent, problem } = parse("asdf qwer");
    expect(intent).toBeNull();
    expect(problem).toContain("couldn't find");
  });

  it("handles an empty or trivial input", () => {
    expect(parse("").problem).toBe("Tell me what's coming up.");
    expect(parse("hi").problem).toBe("Tell me what's coming up.");
  });

  it("shows its working — the words the date came from", () => {
    expect(parse("wedding in two weeks").intent!.dateSource).toBe("in two weeks");
    expect(parse("interview next Tuesday").intent!.dateSource).toBe("next tuesday");
  });

  it("derives an editable title from the sentence", () => {
    expect(parse("Standard Bank interview next Tuesday").intent!.title).toContain("Standard Bank");
  });
});

describe("buildPlan — the cross-mode proposals", () => {
  const intent = parse("wedding in two weeks").intent!;

  it("always proposes the Elevate plan, because that is where an event lives", () => {
    const p = buildPlan(intent, TODAY, { positions: [], hasRoutes: false });
    expect(p.map((x) => x.mode)).toEqual(["elevate"]);
  });

  it("proposes a Commit check only when a position overlaps the date", () => {
    const overlapping = buildPlan(intent, TODAY, ctx);
    expect(overlapping.map((x) => x.id)).toContain("commit-load");

    // A challenge that finishes before the wedding is not affected by it.
    const finishesFirst = buildPlan(intent, TODAY, {
      ...ctx,
      positions: [{ cohortId: "c1", name: "Short one", exposure: 500, daysRemaining: 3 }],
    });
    expect(finishesFirst.map((x) => x.id)).not.toContain("commit-load");
  });

  it("marks the Commit proposal as touching money, and never applies it", () => {
    // There is real money on a position. An assistant that quietly lowers a
    // target has changed what somebody staked on.
    const commit = buildPlan(intent, TODAY, ctx).find((p) => p.id === "commit-load")!;
    expect(commit.touchesMoney).toBe(true);
    expect(commit.detail).toContain("Nothing changes unless you change it");
  });

  it("proposes Climb only when there is a route and real weeks to use", () => {
    expect(buildPlan(intent, TODAY, ctx).map((x) => x.id)).toContain("climb-countdown");

    const noRoutes = buildPlan(intent, TODAY, { ...ctx, hasRoutes: false });
    expect(noRoutes.map((x) => x.id)).not.toContain("climb-countdown");

    const soon = parse("wedding in 3 days").intent!;
    expect(buildPlan(soon, TODAY, ctx).map((x) => x.id)).not.toContain("climb-countdown");
  });

  it("warns when the notice is too short for parts of the plan", () => {
    const soon = parse("wedding in 3 days").intent!;
    const elevate = buildPlan(soon, TODAY, ctx).find((p) => p.mode === "elevate")!;
    expect(elevate.detail).toContain("already closed");
  });
});

describe("direct", () => {
  it("returns no proposals when it could not parse", () => {
    const plan = direct({ text: "nonsense here", today: TODAY }, ctx);
    expect(plan.proposals).toEqual([]);
    expect(plan.problem).not.toBeNull();
  });

  it("returns a full cross-mode plan from one sentence", () => {
    const plan = direct({ text: "I have a wedding in two weeks", today: TODAY }, ctx);
    expect(plan.problem).toBeNull();
    expect(plan.proposals.map((p) => p.mode)).toEqual(["elevate", "commit", "climb"]);
  });
});
