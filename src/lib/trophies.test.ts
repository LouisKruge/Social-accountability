import { describe, expect, it } from "vitest";
import {
  TROPHIES,
  evaluateTrophies,
  recoveryProtocol,
  summariseVault,
  type TrophyFacts,
} from "./trophies";

const facts = (over: Partial<TrophyFacts> = {}): TrophyFacts => ({
  rankedWeeks: 0,
  positionsOpened: 0,
  payoutsLanded: 0,
  verifiedDays: 0,
  heldDays: 0,
  bestSteadiness: null,
  peakDisciplineScore: null,
  qualifyingSeasons: 0,
  longestCleanRun: 0,
  recoveredPositions: 0,
  ...over,
});

const get = (f: TrophyFacts, key: string) => evaluateTrophies(f).find((t) => t.key === key)!;

describe("evaluateTrophies", () => {
  it("awards nothing to a brand-new account", () => {
    expect(evaluateTrophies(facts()).every((t) => !t.earned)).toBe(true);
  });

  it("returns every trophy, earned or not, with its requirement", () => {
    // A vault that only shows what you have cannot tell you what to go and do.
    const all = evaluateTrophies(facts());
    expect(all).toHaveLength(TROPHIES.length);
    expect(all.every((t) => t.requirement.length > 0)).toBe(true);
  });

  it("awards on a real count and reports progress toward the rest", () => {
    const f = facts({ rankedWeeks: 12 });
    expect(get(f, "first_week").earned).toBe(true);
    expect(get(f, "ten_weeks").earned).toBe(true);
    expect(get(f, "fifty_weeks")).toMatchObject({ earned: false, progress: 0.24 });
  });

  it("blocks the clean hundred on any held day, and says why", () => {
    const held = facts({ verifiedDays: 200, heldDays: 1 });
    const t = get(held, "clean_hundred");
    expect(t.earned).toBe(false);
    expect(t.progress).toBe(0);
    expect(t.evidence).toContain("held");
  });

  it("awards the clean hundred on a genuinely clean record", () => {
    expect(get(facts({ verifiedDays: 100, heldDays: 0 }), "clean_hundred").earned).toBe(true);
  });

  it("treats an unmeasured figure as not earned rather than as zero progress toward nothing", () => {
    const t = get(facts(), "metronome");
    expect(t.earned).toBe(false);
    expect(t.evidence).toBe("Not measured yet");
  });

  it("awards tier trophies off the PEAK score, which cannot be un-earned", () => {
    const f = facts({ peakDisciplineScore: 890 });
    expect(get(f, "elite_tier").earned).toBe(true);
    expect(get(f, "titan_tier").earned).toBe(true);
    expect(get(f, "legend_tier").earned).toBe(false);
  });

  it("has no trophy decided by chance", () => {
    // Nothing in this product is decided by a roll. A "legendary drop" would be
    // the first thing to break that, and it is a legal position as much as a
    // design one.
    for (const t of TROPHIES) {
      expect(`${t.name} ${t.requirement}`).not.toMatch(/random|chance|luck|draw|roll|lottery/i);
    }
  });
});

describe("summariseVault", () => {
  it("counts by rarity", () => {
    const s = summariseVault(evaluateTrophies(facts({ rankedWeeks: 12, positionsOpened: 1 })));
    expect(s.earned).toBe(3);
    expect(s.total).toBe(TROPHIES.length);
    expect(s.byRarity.common.earned).toBe(3);
    expect(s.byRarity.legendary.earned).toBe(0);
  });

  it("names the nearest unearned trophy", () => {
    const s = summariseVault(evaluateTrophies(facts({ rankedWeeks: 45 })));
    expect(s.nearest!.key).toBe("fifty_weeks");
  });

  it("is null-safe when nothing has any progress", () => {
    expect(summariseVault(evaluateTrophies(facts())).nearest).toBeNull();
  });
});

describe("recoveryProtocol", () => {
  it("stays silent below three missed days", () => {
    expect(recoveryProtocol(0, false).active).toBe(false);
    expect(recoveryProtocol(2, false).active).toBe(false);
  });

  it("engages at three, the same point momentum starts penalising", () => {
    // The number and the message have to agree, or the product contradicts
    // itself on the screen where somebody is already struggling.
    expect(recoveryProtocol(3, false).active).toBe(true);
  });

  it("gets smaller as the gap grows, never louder", () => {
    const short = recoveryProtocol(3, false);
    const long = recoveryProtocol(9, false);
    expect(long.headline).toContain("worth recovering");
    expect(long.steps[1]).toContain("Do not try to make the week up");
    expect(short.steps[0]).toContain("One day back");
  });

  it("mentions an open position only when there is one", () => {
    expect(recoveryProtocol(5, false).steps.some((s) => s.includes("position"))).toBe(false);
    expect(recoveryProtocol(5, true).steps.some((s) => s.includes("position"))).toBe(true);
  });

  it("never blames, and never notifies anyone", () => {
    // Announcing to somebody's group that they are struggling is the highest-
    // risk idea in the whole brief. It does not ship without its own consent
    // flow, and nothing here hints that it happened.
    for (const streak of [3, 5, 9, 30]) {
      const r = recoveryProtocol(streak, true);
      const text = `${r.headline} ${r.steps.join(" ")}`;
      expect(text).not.toMatch(/fail|lazy|disappoint|let down|gave up|quit|weak/i);
      expect(text).not.toMatch(/notified|told your|your friends|your group has been/i);
    }
  });
});
