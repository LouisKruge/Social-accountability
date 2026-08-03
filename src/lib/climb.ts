// Server only. A client component importing a value from this file would drag
// the database client and node: built-ins into the browser bundle.
import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import type { Direction, MetricType } from "@/lib/ranking";
import { currentPeriod, type Period } from "@/lib/period";
import { timed } from "@/lib/timing";

// ─────────────────────────────────────────────────────────────────────────────
// THE FACE — Climb's data layer.
//
// Commit became an exchange of modules and Elevate became five studios. Climb
// is neither, because it is the only mode that is fundamentally about OTHER
// PEOPLE. Its structure is the terrain the whole product is named after:
//
//   the face    every route you are on, and where you sit on each
//   a route     one group — the pitches it climbs
//   a pitch     one category — the leaderboard, which is the actual product
//
// ── ONE LOAD FOR THE WHOLE SECTION ───────────────────────────────────────────
// Every Climb screen used to issue its own queries: three on the group list,
// three on a group, five on a leaderboard — each one preceded by an auth round
// trip, several of them in a waterfall. This loader issues five, in parallel,
// and every screen filters the result in memory. That is the same move the
// Exchange made, for the same reason: a round trip to Paris costs more than any
// amount of filtering costs locally.
//
// ── HONESTY RULES CARRIED OVER FROM COMMIT ───────────────────────────────────
// A figure is read from the database or derived arithmetically from figures
// that were. Nothing here averages a percentage against a streak length, and
// nothing invents a composite "score" — see `bestMove` for why.
//
// ── PRIVACY ──────────────────────────────────────────────────────────────────
// Every query is RLS-bound to the caller. A raw logged value is only ever
// visible when its owner set `share_raw_value`; the rest of the group sees the
// rate of change and nothing else. That is the whole reason a person will put a
// debt number into a group chat's app at all.
// ─────────────────────────────────────────────────────────────────────────────

export interface PitchRow {
  userId: string;
  displayName: string;
  rank: number;
  pctChange: number;
  isAbsolute: boolean;
  /** Trajectory across recent periods, oldest first. */
  series: number[];
  /** Only present when this climber opted to reveal their raw number. */
  sharedValue?: number;
}

export interface ClimbPitch {
  id: string;
  groupId: string;
  routeName: string;
  name: string;
  metricType: MetricType;
  direction: Direction;
  unit: string | null;
  /** This period's standings, best first. */
  rows: PitchRow[];
  /** The viewer's row, or null when they have no ranked position yet. */
  viewer: PitchRow | null;
  /** How far to the climber one rung up. Null at the top, or when unranked. */
  gap: number | null;
  /** Has the viewer logged a number for the current period? */
  logged: boolean;
  /** The viewer's own trajectory, oldest first. */
  series: number[];
}

export interface ClimbRoute {
  id: string;
  name: string;
  inviteCode: string;
  isOwner: boolean;
  memberCount: number;
  pitches: ClimbPitch[];
  members: { userId: string; displayName: string; isOwner: boolean; isViewer: boolean }[];
  /** The viewer's best rank across this route's pitches this period. */
  bestRank: number | null;
  /** How many pitches the viewer still has not logged this period. */
  unlogged: number;
}

export interface BestMove {
  pitchId: string;
  routeId: string;
  routeName: string;
  pitchName: string;
  metricType: MetricType;
  unit: string | null;
  value: number;
  isAbsolute: boolean;
  rank: number;
  fieldSize: number;
}

export interface Momentum {
  /** Change against the climber's own recent average, in the pitch's own unit. */
  delta: number;
  direction: "accelerating" | "steady" | "slowing";
  /** How many prior periods the average was taken over. */
  over: number;
}

export interface ClimbState {
  period: Period;
  routes: ClimbRoute[];
  /** The hero figure: the viewer's single strongest move this period. */
  best: BestMove | null;
  /** Whether that move is faster or slower than their own recent average. */
  momentum: Momentum | null;
  /** Consecutive periods the viewer logged at least one number. */
  weeks: number;
  /** Pitches with nothing logged this period — the only real call to action. */
  pending: { routeId: string; routeName: string; pitchId: string; pitchName: string }[];
}

// ── Pure logic ───────────────────────────────────────────────────────────────

/**
 * The distance to the climber one rung up.
 *
 * Returns null at rank 1 and null when the viewer is unranked, rather than 0 —
 * "you are 0 away from the person above you" is false in both cases, and a
 * falsy-checked 0 would silently render as no gap at all.
 */
export function gapToNext(rows: PitchRow[], userId: string): number | null {
  const me = rows.find((r) => r.userId === userId);
  if (!me || me.rank <= 1) return null;
  const above = rows.find((r) => r.rank === me.rank - 1);
  if (!above) return null;
  return round2(above.pctChange - me.pctChange);
}

/**
 * Is this climber speeding up or slowing down?
 *
 * Measured against their OWN recent average rather than against the group,
 * because the entire premise of Climb is that people start from different
 * places. Someone moving +4% a week is not "slow" — they are steady, and the
 * only thing worth telling them is whether this week beat their own average.
 *
 * `threshold` is in the pitch's own unit: a percentage point for a percentage
 * pitch, a day for a streak.
 */
export function momentum(series: number[], threshold = 1): Momentum | null {
  if (series.length < 2) return null;
  const latest = series[series.length - 1];
  // Four periods is a month of weekly logging — recent enough to be about now,
  // long enough that one bad week does not redefine "normal".
  const prior = series.slice(-5, -1);
  const mean = prior.reduce((t, v) => t + v, 0) / prior.length;
  const delta = round2(latest - mean);
  return {
    delta,
    direction: delta > threshold ? "accelerating" : delta < -threshold ? "slowing" : "steady",
    over: prior.length,
  };
}

/**
 * The one move worth putting at the top of the screen.
 *
 * Deliberately NOT a composite score. A 12% savings gain and a 14-day streak
 * are different units, and any single number combining them is invented — which
 * is the one thing this codebase does not do with a figure it shows a person.
 * So: the strongest percentage move, and streaks only when there is no
 * percentage pitch to report at all.
 */
export function bestMove(pitches: ClimbPitch[]): BestMove | null {
  const ranked = pitches.filter((p) => p.viewer !== null);
  if (ranked.length === 0) return null;

  const pct = ranked.filter((p) => p.metricType === "percentage_change");
  const pool = pct.length > 0 ? pct : ranked;

  const winner = pool.reduce((best, p) =>
    p.viewer!.pctChange > best.viewer!.pctChange ? p : best,
  );

  return {
    pitchId: winner.id,
    routeId: winner.groupId,
    routeName: winner.routeName,
    pitchName: winner.name,
    metricType: winner.metricType,
    unit: winner.unit,
    value: winner.viewer!.pctChange,
    isAbsolute: winner.viewer!.isAbsolute,
    rank: winner.viewer!.rank,
    fieldSize: winner.rows.length,
  };
}

/**
 * Consecutive periods with at least one entry, counted back from `currentStart`.
 *
 * The Monday rule: a streak must not collapse to zero at 00:01 on Monday just
 * because the new week is empty. If the current period has no entry yet the
 * count is measured to the previous one — and if THAT is empty too, the streak
 * is genuinely broken and reads as broken.
 */
export function logStreak(logged: Iterable<string>, currentStart: string): number {
  const set = new Set(logged);
  let cursor = set.has(currentStart) ? currentStart : shiftWeeks(currentStart, -1);
  let n = 0;
  while (set.has(cursor)) {
    n += 1;
    cursor = shiftWeeks(cursor, -1);
  }
  return n;
}

function shiftWeeks(iso: string, weeks: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ── The loader ───────────────────────────────────────────────────────────────

/** Rankings older than this are not shown anywhere, so they are not fetched. */
const HISTORY_PERIODS = 12;

/**
 * The two embedded selects, typed at the call site.
 *
 * `src/lib/database.types.ts` is hand-maintained and declares `Relationships:
 * []` for every table, so supabase-js cannot infer the shape of an embedded
 * relation and resolves it to `SelectQueryError`. `.returns<T>()` states the
 * shape the query actually produces. The union with an array is not defensive
 * padding — PostgREST returns a to-one embed as an object, but the same syntax
 * yields an array when the relation is ambiguous, and both shapes have been
 * observed against this schema.
 */
interface MembershipRow {
  role: string;
  group_id: string;
  group:
    | { id: string; name: string; invite_code: string; owner_id: string }
    | { id: string; name: string; invite_code: string; owner_id: string }[]
    | null;
}

interface MemberRow {
  group_id: string;
  user_id: string;
  role: string;
  profile: { display_name: string } | { display_name: string }[] | null;
}

export async function loadClimb(supabase: ServerClient, userId: string): Promise<ClimbState> {
  const period = currentPeriod();
  const horizon = shiftWeeks(period.start, -HISTORY_PERIODS);

  const [myMemberships, everyMember, categoryRows, rankingRows, entryRows] = await Promise.all([
    // Which routes am I on? RLS lets a member read every row for a group they
    // belong to, so this needs the user filter — without it the list would be
    // every membership of every group, not mine.
    timed("group_members.mine", async () => {
      const { data } = await supabase
        .from("group_members")
        .select("role, group_id, group:groups(id, name, invite_code, owner_id)")
        .eq("user_id", userId)
        .order("joined_at", { ascending: true })
        .returns<MembershipRow[]>();
      return data ?? [];
    }, (r) => r.length),

    // Everyone on those routes, with their display name. One query serves both
    // the member counts on the face and the roster on a route.
    timed("group_members.all", async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id, user_id, role, profile:profiles(display_name)")
        .order("joined_at", { ascending: true })
        .returns<MemberRow[]>();
      return data ?? [];
    }, (r) => r.length),

    timed("categories", async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, group_id, name, metric_type, direction, unit")
        .order("created_at", { ascending: true });
      return data ?? [];
    }, (r) => r.length),

    // Newest first with a bound, then reversed in memory. Ordering ascending
    // under a limit would take the OLDEST rows and cut off the current week —
    // the one week every screen actually needs.
    timed("leaderboard_rankings", async () => {
      const { data } = await supabase
        .from("leaderboard_rankings")
        .select("group_id, category_id, user_id, period_start, pct_change, is_absolute, rank")
        .gte("period_start", horizon)
        .order("period_start", { ascending: false })
        .limit(1000);
      return data ?? [];
    }, (r) => r.length),

    // Mine, plus anyone who opted to share theirs. Two permissive SELECT
    // policies OR together, so one query returns both sets.
    timed("entries", async () => {
      const { data } = await supabase
        .from("entries")
        .select("user_id, category_id, period_start, raw_value, share_raw_value")
        .gte("period_start", horizon)
        .order("period_start", { ascending: false })
        .limit(1000);
      return data ?? [];
    }, (r) => r.length),
  ]);

  const names = new Map<string, string>();
  const membersByGroup = new Map<string, ClimbRoute["members"]>();
  for (const m of everyMember) {
    const profile = one(m.profile);
    if (profile?.display_name) names.set(m.user_id, profile.display_name);
    const list = membersByGroup.get(m.group_id) ?? [];
    list.push({
      userId: m.user_id,
      displayName: profile?.display_name ?? "Climber",
      isOwner: m.role === "owner",
      isViewer: m.user_id === userId,
    });
    membersByGroup.set(m.group_id, list);
  }

  // series[categoryId][userId] = pct changes, oldest first.
  const seriesBy = new Map<string, Map<string, number[]>>();
  const thisPeriod = new Map<string, typeof rankingRows>();
  for (const r of [...rankingRows].reverse()) {
    const byUser = seriesBy.get(r.category_id) ?? new Map<string, number[]>();
    const arr = byUser.get(r.user_id) ?? [];
    arr.push(Number(r.pct_change));
    byUser.set(r.user_id, arr);
    seriesBy.set(r.category_id, byUser);

    if (r.period_start === period.start) {
      const list = thisPeriod.get(r.category_id) ?? [];
      list.push(r);
      thisPeriod.set(r.category_id, list);
    }
  }

  const sharedValues = new Map<string, number>();
  const myLoggedPeriods = new Set<string>();
  const myLoggedThisPeriod = new Set<string>();
  for (const e of entryRows) {
    if (e.user_id === userId) {
      myLoggedPeriods.add(e.period_start);
      if (e.period_start === period.start) myLoggedThisPeriod.add(e.category_id);
    }
    if (e.share_raw_value && e.period_start === period.start) {
      sharedValues.set(`${e.category_id}:${e.user_id}`, Number(e.raw_value));
    }
  }

  const routes: ClimbRoute[] = [];
  for (const m of myMemberships) {
    const g = one(m.group);
    if (!g) continue;

    const pitches: ClimbPitch[] = categoryRows
      .filter((c) => c.group_id === g.id)
      .map((c) => {
        const rows: PitchRow[] = (thisPeriod.get(c.id) ?? [])
          .map((r) => ({
            userId: r.user_id,
            displayName: names.get(r.user_id) ?? "Climber",
            rank: r.rank,
            pctChange: Number(r.pct_change),
            isAbsolute: r.is_absolute,
            series: seriesBy.get(c.id)?.get(r.user_id) ?? [Number(r.pct_change)],
            sharedValue: sharedValues.get(`${c.id}:${r.user_id}`),
          }))
          .sort((a, b) => a.rank - b.rank);

        return {
          id: c.id,
          groupId: g.id,
          routeName: g.name,
          name: c.name,
          metricType: c.metric_type as MetricType,
          direction: c.direction as Direction,
          unit: c.unit,
          rows,
          viewer: rows.find((r) => r.userId === userId) ?? null,
          gap: gapToNext(rows, userId),
          logged: myLoggedThisPeriod.has(c.id),
          series: seriesBy.get(c.id)?.get(userId) ?? [],
        };
      });

    const myRanks = pitches.map((p) => p.viewer?.rank).filter((r): r is number => r !== undefined);

    routes.push({
      id: g.id,
      name: g.name,
      inviteCode: g.invite_code,
      isOwner: g.owner_id === userId,
      memberCount: membersByGroup.get(g.id)?.length ?? 0,
      members: membersByGroup.get(g.id) ?? [],
      pitches,
      bestRank: myRanks.length ? Math.min(...myRanks) : null,
      unlogged: pitches.filter((p) => !p.logged).length,
    });
  }

  const allPitches = routes.flatMap((r) => r.pitches);
  const best = bestMove(allPitches);
  const bestPitch = best ? allPitches.find((p) => p.id === best.pitchId) : undefined;

  return {
    period,
    routes,
    best,
    momentum: bestPitch ? momentum(bestPitch.series) : null,
    weeks: logStreak(myLoggedPeriods, period.start),
    pending: allPitches
      .filter((p) => !p.logged)
      .map((p) => ({
        routeId: p.groupId,
        routeName: p.routeName,
        pitchId: p.id,
        pitchName: p.name,
      })),
  };
}

/** Supabase types an embedded to-one relation as an array in some shapes. */
function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
