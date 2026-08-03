import { describe, expect, it } from "vitest";
import { buildRecap, clubLevel, clubStats, hallOfFame, headToHead, type RecapRanking } from "./recap";

const W1 = "2026-07-06";
const W2 = "2026-07-13";
const W3 = "2026-07-20";

const r = (
  userId: string,
  displayName: string,
  periodStart: string,
  pctChange: number,
  rank: number,
  categoryId = "savings",
  categoryName = "Savings",
): RecapRanking => ({
  userId,
  displayName,
  categoryId,
  categoryName,
  periodStart,
  pctChange,
  isAbsolute: false,
  rank,
});

const kinds = (h: RecapRanking[], p: string) => buildRecap(h, p).items.map((i) => i.kind);

describe("buildRecap", () => {
  it("says nothing about a week with no rankings", () => {
    // A recap that manufactures a highlight every week teaches people that
    // none of them mean anything.
    expect(buildRecap([], W3)).toMatchObject({ items: [], participants: 0 });
  });

  it("names the biggest move", () => {
    const h = [r("a", "Thandiwe", W3, 41.2, 1), r("b", "Sipho", W3, 12, 2)];
    const item = buildRecap(h, W3).items.find((i) => i.kind === "biggest_move")!;
    expect(item.headline).toBe("Thandiwe moved furthest");
    expect(item.detail).toContain("+41.2%");
  });

  it("does not celebrate a 'biggest move' when everyone went backwards", () => {
    const h = [r("a", "Thandiwe", W3, -4, 1), r("b", "Sipho", W3, -9, 2)];
    expect(kinds(h, W3)).not.toContain("biggest_move");
  });

  it("reports a close finish only when it was actually close", () => {
    const tight = [r("a", "Thandiwe", W3, 20, 1), r("b", "Sipho", W3, 18.5, 2)];
    expect(kinds(tight, W3)).toContain("closest_finish");

    const blowout = [r("a", "Thandiwe", W3, 40, 1), r("b", "Sipho", W3, 4, 2)];
    expect(kinds(blowout, W3)).not.toContain("closest_finish");
  });

  it("needs two climbers before it can call a finish close", () => {
    expect(kinds([r("a", "Thandiwe", W3, 20, 1)], W3)).not.toContain("closest_finish");
  });

  it("finds a comeback from a negative week to a positive one", () => {
    const h = [r("a", "Sipho", W2, -8, 3), r("a", "Sipho", W3, 14, 1)];
    const item = buildRecap(h, W3).items.find((i) => i.kind === "biggest_comeback")!;
    expect(item.headline).toBe("Sipho turned it around");
  });

  it("does not call an ordinary improvement a comeback", () => {
    // Up is not a comeback unless the week before was negative.
    const h = [r("a", "Sipho", W2, 5, 3), r("a", "Sipho", W3, 14, 1)];
    expect(kinds(h, W3)).not.toContain("biggest_comeback");
  });

  it("recognises a personal best only against a real history", () => {
    const thin = [r("a", "Sipho", W2, 5, 1), r("a", "Sipho", W3, 14, 1)];
    expect(kinds(thin, W3)).not.toContain("personal_best");

    const real = [
      r("a", "Sipho", W1, 5, 1),
      r("a", "Sipho", W2, 9, 1),
      r("a", "Sipho", W3, 14, 1),
    ];
    expect(kinds(real, W3)).toContain("personal_best");
  });

  it("welcomes a first-time climber", () => {
    const h = [r("a", "Thandiwe", W2, 10, 1), r("a", "Thandiwe", W3, 12, 1), r("z", "New", W3, 3, 2)];
    const item = buildRecap(h, W3).items.find((i) => i.kind === "first_rank")!;
    expect(item.headline).toBe("New is on the board");
  });

  it("calls a clean sweep only when someone topped every pitch", () => {
    const swept = [
      r("a", "Thandiwe", W3, 20, 1, "savings", "Savings"),
      r("a", "Thandiwe", W3, 15, 1, "steps", "Steps"),
      r("b", "Sipho", W3, 5, 2, "savings", "Savings"),
      r("b", "Sipho", W3, 4, 2, "steps", "Steps"),
    ];
    expect(kinds(swept, W3)).toContain("clean_sweep");

    const split = [
      r("a", "Thandiwe", W3, 20, 1, "savings", "Savings"),
      r("b", "Sipho", W3, 15, 1, "steps", "Steps"),
      r("a", "Thandiwe", W3, 4, 2, "steps", "Steps"),
      r("b", "Sipho", W3, 5, 2, "savings", "Savings"),
    ];
    expect(kinds(split, W3)).not.toContain("clean_sweep");
  });

  it("never claims a sweep in a single-pitch group", () => {
    const h = [r("a", "Thandiwe", W3, 20, 1), r("b", "Sipho", W3, 5, 2)];
    expect(kinds(h, W3)).not.toContain("clean_sweep");
  });

  it("counts participants, not rows", () => {
    const h = [
      r("a", "Thandiwe", W3, 20, 1, "savings", "Savings"),
      r("a", "Thandiwe", W3, 15, 1, "steps", "Steps"),
      r("b", "Sipho", W3, 5, 2, "savings", "Savings"),
    ];
    expect(buildRecap(h, W3).participants).toBe(2);
  });

  it("attributes every item to the people it is about", () => {
    const h = [r("a", "Thandiwe", W3, 20, 1), r("b", "Sipho", W3, 18.5, 2)];
    for (const item of buildRecap(h, W3).items) {
      expect(item.userIds.length).toBeGreaterThan(0);
    }
  });
});

describe("headToHead", () => {
  const history = [
    // Both ranked, same pitch — these count.
    r("me", "Me", W1, 10, 2), r("you", "Rival", W1, 14, 1),
    r("me", "Me", W2, 18, 1), r("you", "Rival", W2, 9, 2),
    r("me", "Me", W3, 12, 1), r("you", "Rival", W3, 6, 2),
    // Only I was ranked on Steps — this must NOT count as a win.
    r("me", "Me", W3, 30, 1, "steps", "Steps"),
  ];

  it("only counts weeks where both were ranked on the same pitch", () => {
    // Comparing a week you logged against a week they did not is an absence,
    // not a win. Scoring it as a win is how a rivalry feature becomes a lie.
    const h = headToHead(history, "me", "you", "Rival", W3);
    expect(h.metWeeks).toBe(3);
    expect(h.yourWins + h.theirWins + h.draws).toBe(3);
  });

  it("tallies the record correctly", () => {
    const h = headToHead(history, "me", "you", "Rival", W3);
    expect(h.yourWins).toBe(2);
    expect(h.theirWins).toBe(1);
    expect(h.draws).toBe(0);
  });

  it("reads form most-recent first", () => {
    expect(headToHead(history, "me", "you", "Rival", W3).form).toEqual(["W", "W", "L"]);
  });

  it("says who is ahead this week", () => {
    expect(headToHead(history, "me", "you", "Rival", W3).currentlyAhead).toBe("you");
    expect(headToHead(history, "me", "you", "Rival", W1).currentlyAhead).toBe("them");
  });

  it("returns null for a week they have not met in", () => {
    expect(headToHead(history, "me", "you", "Rival", "2026-08-03").currentlyAhead).toBeNull();
  });

  it("averages the margin across meetings", () => {
    // (-4 + 9 + 6) / 3
    expect(headToHead(history, "me", "you", "Rival", W3).averageMargin).toBe(3.7);
  });

  it("is null-safe against a rival you have never met", () => {
    const h = headToHead(history, "me", "stranger", "Stranger", W3);
    expect(h).toMatchObject({ metWeeks: 0, averageMargin: null, currentlyAhead: null, form: [] });
  });

  it("counts an exact tie as a draw, not a win", () => {
    const tied = [r("me", "Me", W3, 12, 1), r("you", "Rival", W3, 12, 1)];
    const h = headToHead(tied, "me", "you", "Rival", W3);
    expect(h.draws).toBe(1);
    expect(h.yourWins).toBe(0);
    expect(h.currentlyAhead).toBe("level");
  });
});

describe("clubLevel", () => {
  it("counts results, never members", () => {
    // A club of three who logged for six months is further along than twenty
    // who joined yesterday. A level that counts heads says the opposite, and
    // turns the feature into an incentive to add people who never log.
    expect(clubLevel(0).level).toBe(1);
    expect(clubLevel(20).level).toBe(2);
    expect(clubLevel(45).level).toBe(3);
  });

  it("reports the distance to the next level", () => {
    expect(clubLevel(0).toNext).toBe(20);
    expect(clubLevel(19).toNext).toBe(1);
  });

  it("caps rather than growing forever", () => {
    expect(clubLevel(10_000_000).toNext).toBeNull();
  });
});

describe("clubStats", () => {
  it("is null-safe on an empty club", () => {
    expect(clubStats([])).toMatchObject({ activeWeeks: 0, climbers: 0, reputation: null, level: 1 });
  });

  it("counts weeks and climbers distinctly from results", () => {
    const h = [
      r("a", "Thandiwe", W1, 10, 1, "savings", "Savings"),
      r("a", "Thandiwe", W1, 8, 1, "steps", "Steps"),
      r("b", "Sipho", W1, 5, 2, "savings", "Savings"),
      r("a", "Thandiwe", W2, 12, 1, "savings", "Savings"),
    ];
    expect(clubStats(h)).toMatchObject({ activeWeeks: 2, climbers: 2, totalResults: 4 });
  });

  it("reads reputation as the share of results that moved forward", () => {
    const h = [r("a", "A", W1, 10, 1), r("b", "B", W1, -5, 2), r("c", "C", W1, 4, 3), r("d", "D", W1, 2, 4)];
    expect(clubStats(h).reputation).toBe(0.75);
  });
});

describe("hallOfFame", () => {
  it("is empty for a club with no history", () => {
    expect(hallOfFame([])).toEqual([]);
  });

  it("records the biggest single week", () => {
    const h = [r("a", "Thandiwe", W1, 41.2, 1), r("b", "Sipho", W1, 9, 2)];
    expect(hallOfFame(h)[0]).toMatchObject({ title: "Biggest week", holder: "Thandiwe" });
  });

  it("needs more than one win before crowning a leader", () => {
    const once = [r("a", "Thandiwe", W1, 20, 1)];
    expect(hallOfFame(once).map((e) => e.title)).not.toContain("Most weeks led");

    const twice = [r("a", "Thandiwe", W1, 20, 1), r("a", "Thandiwe", W2, 18, 1)];
    expect(hallOfFame(twice).map((e) => e.title)).toContain("Most weeks led");
  });

  it("celebrates turning up, not just winning", () => {
    const h = [
      r("b", "Sipho", W1, 2, 2), r("b", "Sipho", W2, 3, 2), r("b", "Sipho", W3, 1, 2),
      r("a", "Thandiwe", W1, 40, 1),
    ];
    const entry = hallOfFame(h).find((e) => e.title === "Most weeks logged")!;
    expect(entry.holder).toBe("Sipho");
  });

  it("never enshrines a worst", () => {
    // A group's permanent record is not the place to keep somebody's bad month.
    const h = [r("a", "A", W1, 40, 1), r("b", "B", W1, -30, 2), r("b", "B", W2, -20, 2), r("b", "B", W3, -10, 2)];
    for (const e of hallOfFame(h)) {
      expect(`${e.title} ${e.detail}`).not.toMatch(/worst|lowest|least|slowest|failed/i);
    }
  });
});

describe("hallOfFame — ties", () => {
  it("awards no record when climbers are tied", () => {
    // Three people on three weeks each: naming one "the one who keeps turning
    // up" lets the sort order decide, and tells the other two they did less
    // than they did.
    const tied = [W1, W2, W3].flatMap((p) => [
      r("a", "A", p, 10, 1),
      r("b", "B", p, 9, 2),
      r("c", "C", p, 8, 3),
    ]);
    const titles = hallOfFame(tied).map((e) => e.title);
    expect(titles).not.toContain("Most weeks logged");
  });

  it("awards it when someone is genuinely clear", () => {
    const clear = [
      ...[W1, W2, W3].map((p) => r("a", "A", p, 10, 1)),
      r("b", "B", W3, 9, 2),
    ];
    expect(hallOfFame(clear).map((e) => e.title)).toContain("Most weeks logged");
  });

  it("does not crown a leader who is level on wins", () => {
    const level = [
      r("a", "A", W1, 10, 1), r("a", "A", W2, 10, 1),
      r("b", "B", W1, 9, 1, "steps", "Steps"), r("b", "B", W2, 9, 1, "steps", "Steps"),
    ];
    expect(hallOfFame(level).map((e) => e.title)).not.toContain("Most weeks led");
  });
});
