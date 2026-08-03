// ─────────────────────────────────────────────────────────────────────────────
// THE WEEKLY RECAP — "This week in Payday Warriors"
//
// Every Sunday the group gets a written week: biggest improvement, closest
// finish, biggest comeback, steadiest climber, new records.
//
// ── WHY THIS IS WRITTEN BY RULES AND NOT BY A MODEL ──────────────────────────
// Every line is a superlative over a table the group can already see. A model
// could only paraphrase those rows, and a paraphrase that gets a name or a
// number wrong — in a message sent to a person's friends — is worse than no
// recap at all. The sentences are templates; the facts are queries.
//
// ── WHY IT IS BUILT ONLY FROM RANKINGS ───────────────────────────────────────
// `leaderboard_rankings` is the one table a group can read about each other.
// Raw entries are private unless shared, so nothing in here can leak a number
// somebody chose not to publish. That constraint is what makes the recap safe
// to send to a group chat.
//
// ── AND WHY IT WILL SAY NOTHING RATHER THAN PAD ──────────────────────────────
// A week with two climbers and no movement produces an empty recap, and the
// screen says so. A recap that manufactures a "highlight" every week teaches
// people that none of them mean anything.
// ─────────────────────────────────────────────────────────────────────────────

export interface RecapRanking {
  userId: string;
  displayName: string;
  categoryId: string;
  categoryName: string;
  periodStart: string;
  pctChange: number;
  isAbsolute: boolean;
  rank: number;
}

export type RecapKind =
  | "biggest_move"
  | "closest_finish"
  | "biggest_comeback"
  | "steadiest"
  | "personal_best"
  | "first_rank"
  | "clean_sweep";

export interface RecapItem {
  kind: RecapKind;
  headline: string;
  detail: string;
  /** Who it is about. Used to mark the viewer's own moments. */
  userIds: string[];
}

export interface Recap {
  periodStart: string;
  items: RecapItem[];
  /** Climbers who were ranked this week. */
  participants: number;
}

const pct = (v: number, isAbsolute: boolean) =>
  `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}${isAbsolute ? "" : "%"}`;

/**
 * Write the week.
 *
 * `history` is every ranking the group has, across periods; `periodStart` is
 * the week being written about.
 */
export function buildRecap(
  history: RecapRanking[],
  periodStart: string,
): Recap {
  const week = history.filter((r) => r.periodStart === periodStart);
  const items: RecapItem[] = [];
  const participants = new Set(week.map((r) => r.userId)).size;

  if (week.length === 0) return { periodStart, items, participants: 0 };

  // ── Biggest move ─────────────────────────────────────────────────────────
  const best = week.reduce((a, b) => (b.pctChange > a.pctChange ? b : a));
  if (best.pctChange > 0) {
    items.push({
      kind: "biggest_move",
      headline: `${best.displayName} moved furthest`,
      detail: `${pct(best.pctChange, best.isAbsolute)} on ${best.categoryName}.`,
      userIds: [best.userId],
    });
  }

  // ── Closest finish ───────────────────────────────────────────────────────
  // Per category, the smallest gap between first and second. A tight race is
  // the thing people actually talk about afterwards.
  let closest: { gap: number; a: RecapRanking; b: RecapRanking } | null = null;
  for (const categoryId of new Set(week.map((r) => r.categoryId))) {
    const rows = week
      .filter((r) => r.categoryId === categoryId)
      .sort((x, y) => x.rank - y.rank);
    if (rows.length < 2) continue;
    const gap = Math.abs(rows[0].pctChange - rows[1].pctChange);
    if (!closest || gap < closest.gap) closest = { gap, a: rows[0], b: rows[1] };
  }
  if (closest && closest.gap < 5) {
    items.push({
      kind: "closest_finish",
      headline: `${closest.a.displayName} held off ${closest.b.displayName}`,
      detail: `${Math.round(closest.gap * 10) / 10} points between them on ${closest.a.categoryName}.`,
      userIds: [closest.a.userId, closest.b.userId],
    });
  }

  // ── Biggest comeback ─────────────────────────────────────────────────────
  // The largest improvement against the same person's own previous week.
  const prior = previousPeriodOf(history, periodStart);
  if (prior) {
    const before = new Map(
      history
        .filter((r) => r.periodStart === prior)
        .map((r) => [`${r.userId}:${r.categoryId}`, r.pctChange]),
    );
    let comeback: { delta: number; row: RecapRanking } | null = null;
    for (const r of week) {
      const was = before.get(`${r.userId}:${r.categoryId}`);
      if (was === undefined) continue;
      const delta = r.pctChange - was;
      if (was < 0 && delta > 0 && (!comeback || delta > comeback.delta)) {
        comeback = { delta, row: r };
      }
    }
    if (comeback) {
      items.push({
        kind: "biggest_comeback",
        headline: `${comeback.row.displayName} turned it around`,
        detail: `From negative last week to ${pct(comeback.row.pctChange, comeback.row.isAbsolute)} on ${comeback.row.categoryName}.`,
        userIds: [comeback.row.userId],
      });
    }
  }

  // ── Personal bests ───────────────────────────────────────────────────────
  const bests: RecapRanking[] = [];
  for (const r of week) {
    const past = history.filter(
      (h) =>
        h.userId === r.userId &&
        h.categoryId === r.categoryId &&
        h.periodStart < periodStart,
    );
    if (past.length >= 2 && r.pctChange > Math.max(...past.map((h) => h.pctChange))) {
      bests.push(r);
    }
  }
  for (const b of bests.slice(0, 2)) {
    items.push({
      kind: "personal_best",
      headline: `${b.displayName} set a personal best`,
      detail: `${pct(b.pctChange, b.isAbsolute)} on ${b.categoryName} — their strongest week yet.`,
      userIds: [b.userId],
    });
  }

  // ── First time ranked ────────────────────────────────────────────────────
  const seenBefore = new Set(
    history.filter((h) => h.periodStart < periodStart).map((h) => h.userId),
  );
  const debuts = [...new Set(week.map((r) => r.userId))].filter((u) => !seenBefore.has(u));
  for (const userId of debuts.slice(0, 2)) {
    const row = week.find((r) => r.userId === userId)!;
    items.push({
      kind: "first_rank",
      headline: `${row.displayName} is on the board`,
      detail: `First ranked week — ${pct(row.pctChange, row.isAbsolute)} on ${row.categoryName}.`,
      userIds: [userId],
    });
  }

  // ── Clean sweep ──────────────────────────────────────────────────────────
  const categories = new Set(week.map((r) => r.categoryId));
  if (categories.size > 1) {
    for (const userId of new Set(week.map((r) => r.userId))) {
      const mine = week.filter((r) => r.userId === userId);
      if (mine.length === categories.size && mine.every((r) => r.rank === 1)) {
        items.push({
          kind: "clean_sweep",
          headline: `${mine[0].displayName} took every pitch`,
          detail: `First on all ${categories.size} this week.`,
          userIds: [userId],
        });
      }
    }
  }

  return { periodStart, items, participants };
}

/** The most recent period in `history` strictly before `periodStart`. */
function previousPeriodOf(history: RecapRanking[], periodStart: string): string | null {
  const earlier = history
    .map((r) => r.periodStart)
    .filter((p) => p < periodStart)
    .sort();
  return earlier.length ? earlier[earlier.length - 1] : null;
}

// ── Rivals ───────────────────────────────────────────────────────────────────

export interface HeadToHead {
  rivalId: string;
  rivalName: string;
  /** Weeks in which both were ranked on the same pitch. */
  metWeeks: number;
  yourWins: number;
  theirWins: number;
  draws: number;
  /** Your average margin across meetings. Negative means they beat you. */
  averageMargin: number | null;
  /** The last three results, most recent first: "W" | "L" | "D". */
  form: ("W" | "L" | "D")[];
  /** Who is currently ahead this week, or null when they have not met. */
  currentlyAhead: "you" | "them" | "level" | null;
}

/**
 * Head-to-head against one rival.
 *
 * Built entirely from `leaderboard_rankings`, which group members can already
 * read about each other. A rivalry cannot expose anything a leaderboard did not
 * already show — it only counts what happened.
 *
 * Only weeks where BOTH were ranked on the SAME pitch count. Comparing a week
 * you logged against a week they did not is not a win, it is an absence, and
 * scoring it as a win is how a rivalry feature becomes a lie.
 */
export function headToHead(
  history: RecapRanking[],
  youId: string,
  rivalId: string,
  rivalName: string,
  currentPeriod: string,
): HeadToHead {
  const mine = history.filter((r) => r.userId === youId);
  const theirs = history.filter((r) => r.userId === rivalId);

  const results: { period: string; result: "W" | "L" | "D"; margin: number }[] = [];

  for (const m of mine) {
    const t = theirs.find(
      (r) => r.periodStart === m.periodStart && r.categoryId === m.categoryId,
    );
    if (!t) continue;
    const margin = m.pctChange - t.pctChange;
    results.push({
      period: m.periodStart,
      result: margin > 0 ? "W" : margin < 0 ? "L" : "D",
      margin,
    });
  }

  results.sort((a, b) => b.period.localeCompare(a.period));

  const current = results.find((r) => r.period === currentPeriod);

  return {
    rivalId,
    rivalName,
    metWeeks: results.length,
    yourWins: results.filter((r) => r.result === "W").length,
    theirWins: results.filter((r) => r.result === "L").length,
    draws: results.filter((r) => r.result === "D").length,
    averageMargin: results.length
      ? Math.round((results.reduce((t, r) => t + r.margin, 0) / results.length) * 10) / 10
      : null,
    form: results.slice(0, 3).map((r) => r.result),
    currentlyAhead: current
      ? current.result === "W"
        ? "you"
        : current.result === "L"
          ? "them"
          : "level"
      : null,
  };
}

// ── Club headquarters ────────────────────────────────────────────────────────

export interface ClubStats {
  /** Weeks in which anybody was ranked. */
  activeWeeks: number;
  /** Total ranked results the club has produced. */
  totalResults: number;
  /** Distinct climbers who have ever been ranked. */
  climbers: number;
  /** Club level, from sustained activity. See `clubLevel`. */
  level: number;
  /** Results needed for the next level, or null at the cap. */
  toNextLevel: number | null;
  /** Share of results that were positive moves, or null with nothing to judge. */
  reputation: number | null;
}

export interface HallOfFameEntry {
  title: string;
  holder: string;
  holderId: string;
  detail: string;
}

/**
 * Club level.
 *
 * Deliberately driven by RESULTS, not by members. A club of three people who
 * have logged for six months is further along than a club of twenty who joined
 * yesterday, and a level that counts heads would say the opposite — which turns
 * the feature into an incentive to add people who will never log.
 *
 * Thresholds are roughly quadratic so the early levels arrive quickly and the
 * later ones take real time.
 */
export function clubLevel(totalResults: number): { level: number; toNext: number | null } {
  const threshold = (n: number) => 5 * n * n;
  let level = 1;
  while (level < 25 && totalResults >= threshold(level + 1)) level += 1;
  return {
    level,
    toNext: level >= 25 ? null : threshold(level + 1) - totalResults,
  };
}

export function clubStats(history: RecapRanking[]): ClubStats {
  const weeks = new Set(history.map((r) => r.periodStart));
  const climbers = new Set(history.map((r) => r.userId));
  const { level, toNext } = clubLevel(history.length);

  return {
    activeWeeks: weeks.size,
    totalResults: history.length,
    climbers: climbers.size,
    level,
    toNextLevel: toNext,
    reputation: history.length
      ? Math.round((history.filter((r) => r.pctChange > 0).length / history.length) * 100) / 100
      : null,
  };
}

/**
 * The hall of fame.
 *
 * Records only — the biggest single week, the most weeks led, the most
 * consistent climber. No "worst" anything: a group's permanent record is not
 * the place to enshrine somebody's bad month.
 */
export function hallOfFame(history: RecapRanking[]): HallOfFameEntry[] {
  if (history.length === 0) return [];
  const entries: HallOfFameEntry[] = [];

  const best = history.reduce((a, b) => (b.pctChange > a.pctChange ? b : a));
  if (best.pctChange > 0) {
    entries.push({
      title: "Biggest week",
      holder: best.displayName,
      holderId: best.userId,
      detail: `${pct(best.pctChange, best.isAbsolute)} on ${best.categoryName}, week of ${best.periodStart}.`,
    });
  }

  const firsts = new Map<string, { name: string; count: number }>();
  for (const r of history.filter((x) => x.rank === 1)) {
    const cur = firsts.get(r.userId) ?? { name: r.displayName, count: 0 };
    cur.count += 1;
    firsts.set(r.userId, cur);
  }
  // A record needs a STRICT lead. With three climbers tied on three weeks each,
  // naming one of them "the one who keeps turning up" is arbitrary — the sort
  // order decides, and the other two are told they did less than they did.
  const leaderRanked = [...firsts.entries()].sort((a, b) => b[1].count - a[1].count);
  const topLeader = leaderRanked[0];
  const leaderIsClear =
    topLeader && (leaderRanked.length === 1 || topLeader[1].count > leaderRanked[1][1].count);
  if (topLeader && leaderIsClear && topLeader[1].count > 1) {
    entries.push({
      title: "Most weeks led",
      holder: topLeader[1].name,
      holderId: topLeader[0],
      detail: `${topLeader[1].count} weeks at the top.`,
    });
  }

  const byUser = new Map<string, { name: string; weeks: Set<string> }>();
  for (const r of history) {
    const cur = byUser.get(r.userId) ?? { name: r.displayName, weeks: new Set<string>() };
    cur.weeks.add(r.periodStart);
    byUser.set(r.userId, cur);
  }
  const weekRanked = [...byUser.entries()].sort((a, b) => b[1].weeks.size - a[1].weeks.size);
  const mostWeeks = weekRanked[0];
  const weeksAreClear =
    mostWeeks && (weekRanked.length === 1 || mostWeeks[1].weeks.size > weekRanked[1][1].weeks.size);
  if (mostWeeks && weeksAreClear && mostWeeks[1].weeks.size > 2) {
    entries.push({
      title: "Most weeks logged",
      holder: mostWeeks[1].name,
      holderId: mostWeeks[0],
      detail: `${mostWeeks[1].weeks.size} ranked weeks — the one who keeps turning up.`,
    });
  }

  return entries;
}
