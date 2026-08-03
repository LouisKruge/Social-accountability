import { EVENT_LABEL, daysBetween, planEvent, shiftDays, type EventKind } from "@/lib/events";

// ─────────────────────────────────────────────────────────────────────────────
// THE LIFE DIRECTOR
//
// One sentence in, a cross-mode plan out. "I have a wedding in two weeks" reads
// as an event, and produces proposals in Elevate, Commit and Climb at once.
//
// ── WHY THE PARSER IS RULES AND NOT A MODEL ──────────────────────────────────
// Dates and event kinds are a small, closed, testable grammar. A model would
// parse them well and occasionally hallucinate a date — and a hallucinated date
// here silently reschedules somebody's haircut and their challenge targets
// three days late. When it cannot parse something it says so and asks, which is
// the behaviour a wrong answer cannot give you.
//
// ── WHY NOTHING IS APPLIED AUTOMATICALLY ─────────────────────────────────────
// The brief says one request should trigger actions across the app. It produces
// PROPOSALS, each of which the user confirms, and the Commit ones never change
// a target on their own. There is real money on a Commit position, and an
// assistant that quietly lowers a target has changed what somebody staked on.
// The proposal says what it would do and why; the person decides.
// ─────────────────────────────────────────────────────────────────────────────

export interface DirectorRequest {
  /** What the person typed. */
  text: string;
  /** Today, as an ISO date. */
  today: string;
}

export interface ParsedIntent {
  kind: EventKind;
  /** ISO date. */
  date: string;
  /** The words the date was read from, so the UI can show its working. */
  dateSource: string;
  /** A title derived from the sentence, for the user to edit. */
  title: string;
  confidence: "high" | "low";
}

export type ProposalMode = "elevate" | "commit" | "climb";

export interface Proposal {
  id: string;
  mode: ProposalMode;
  title: string;
  detail: string;
  /** Where the user goes to act on it. */
  href: string;
  /** True when acting on this would change money already committed. */
  touchesMoney: boolean;
}

export interface DirectorPlan {
  intent: ParsedIntent | null;
  /** Set when the sentence could not be read. */
  problem: string | null;
  proposals: Proposal[];
}

// ── The grammar ──────────────────────────────────────────────────────────────

const KIND_WORDS: [EventKind, RegExp][] = [
  ["wedding", /\bwedding|marriage|getting married\b/i],
  ["interview", /\binterview|second round|final round\b/i],
  ["first_date", /\bfirst date|a date\b/i],
  ["presentation", /\bpresentation|present(ing)?\b|pitch\b|talk\b/i],
  ["conference", /\bconference|summit|expo\b/i],
  ["business_meeting", /\bmeeting|client|investors?\b/i],
  ["holiday", /\bholiday|vacation|trip|travel(l)?ing\b/i],
  ["photoshoot", /\bphotoshoot|photo shoot|headshots?\b/i],
  ["networking", /\bnetworking|mixer\b/i],
  ["graduation", /\bgraduation|graduating\b/i],
];

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/**
 * Read a sentence.
 *
 * Handles the phrasings people actually use: "in two weeks", "next Tuesday",
 * "on the 14th", "tomorrow", "in 10 days". Anything else returns null with a
 * reason, rather than a confident guess.
 */
export function parseIntent(req: DirectorRequest): { intent: ParsedIntent | null; problem: string | null } {
  const text = req.text.trim();
  if (text.length < 3) return { intent: null, problem: "Tell me what's coming up." };

  const kindMatch = KIND_WORDS.find(([, re]) => re.test(text));
  const date = parseDate(text, req.today);

  if (!kindMatch && !date) {
    return {
      intent: null,
      problem:
        "I couldn't find an event or a date in that. Try something like \"interview next Tuesday\" or \"wedding in two weeks\".",
    };
  }
  if (!kindMatch) {
    return {
      intent: null,
      problem: `I found the date but not what it is. Add a word like interview, wedding, date, shoot or holiday.`,
    };
  }
  if (!date) {
    return {
      intent: null,
      problem: `I can see it's ${EVENT_LABEL[kindMatch[0]].toLowerCase()}, but not when. Try "in two weeks", "next Friday" or a date.`,
    };
  }

  return {
    intent: {
      kind: kindMatch[0],
      date: date.iso,
      dateSource: date.source,
      title: titleFrom(text, kindMatch[0]),
      confidence: date.confidence,
    },
    problem: null,
  };
}

function parseDate(
  text: string,
  today: string,
): { iso: string; source: string; confidence: "high" | "low" } | null {
  const t = text.toLowerCase();

  // "tomorrow" / "today"
  if (/\btomorrow\b/.test(t)) return { iso: shiftDays(today, 1), source: "tomorrow", confidence: "high" };
  if (/\btoday\b/.test(t)) return { iso: today, source: "today", confidence: "high" };

  // "in 10 days" / "in two weeks" / "in a month"
  const rel = t.match(/\bin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|week|month)s?\b/);
  if (rel) {
    const n = wordToNumber(rel[1]);
    const unit = rel[2];
    const days = unit === "day" ? n : unit === "week" ? n * 7 : n * 30;
    return { iso: shiftDays(today, days), source: rel[0], confidence: "high" };
  }

  // "next Tuesday" / "on Friday"
  const dow = t.match(/\b(?:next|on|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (dow) {
    const target = WEEKDAYS.indexOf(dow[1]);
    const current = new Date(`${today}T00:00:00Z`).getUTCDay();
    // Always the NEXT occurrence: "on Friday" said on a Friday means the one
    // coming, not the one you are standing in.
    let delta = (target - current + 7) % 7;
    if (delta === 0) delta = 7;
    return { iso: shiftDays(today, delta), source: dow[0], confidence: "high" };
  }

  // An explicit ISO date.
  const iso = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return { iso: iso[1], source: iso[1], confidence: "high" };

  // "on the 14th" — day of the current or next month, whichever is ahead.
  const dom = t.match(/\bon\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (dom) {
    const day = Number(dom[1]);
    if (day >= 1 && day <= 31) {
      const base = new Date(`${today}T00:00:00Z`);
      const thisMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), day));
      const chosen =
        thisMonth.toISOString().slice(0, 10) >= today
          ? thisMonth
          : new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, day));
      // Low confidence: "the 14th" of which month is a guess, and the UI shows
      // the resolved date so it can be corrected before anything is created.
      return { iso: chosen.toISOString().slice(0, 10), source: dom[0], confidence: "low" };
    }
  }

  return null;
}

function wordToNumber(w: string): number {
  const words: Record<string, number> = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  return words[w] ?? Number(w) ?? 1;
}

/** A title from the sentence, falling back to the event's own name. */
function titleFrom(text: string, kind: EventKind): string {
  const cleaned = text
    .replace(/\b(i have|i've got|i got|there's|there is|i'm going to|im going to)\b/gi, "")
    .replace(/\b(in|on|next|this)\s+.*$/i, "")
    .replace(/\ba\b/gi, "")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 8
    ? words.join(" ").replace(/^./, (c) => c.toUpperCase())
    : EVENT_LABEL[kind];
}

// ── The cross-mode plan ──────────────────────────────────────────────────────

export interface DirectorContext {
  /** Open Commit positions, so the plan can reason about fatigue and money. */
  positions: { cohortId: string; name: string; exposure: number; daysRemaining: number }[];
  /** Whether the person is on any Climb route. */
  hasRoutes: boolean;
}

/**
 * Turn a parsed intent into proposals across the three modes.
 *
 * Elevate always gets one, because that is where the event lives. Commit gets
 * one only when a position genuinely overlaps the event — proposing a target
 * change for a challenge that ends before the wedding would be noise. Climb
 * gets one only when the person has somewhere to post it.
 */
export function buildPlan(intent: ParsedIntent, today: string, ctx: DirectorContext): Proposal[] {
  const daysUntil = daysBetween(today, intent.date);
  const plan = planEvent(intent.kind, intent.date, today);
  const proposals: Proposal[] = [];

  proposals.push({
    id: "elevate-event",
    mode: "elevate",
    title: `Create the ${EVENT_LABEL[intent.kind].toLowerCase()} plan`,
    detail:
      plan.missed.length > 0
        ? `${plan.tasks.length} things to do, working backwards from the date. ${plan.missed.length} ${plan.missed.length === 1 ? "window has" : "windows have"} already closed at this notice.`
        : `${plan.tasks.length} things to do, working backwards from the date — starting with ${plan.tasks[0]?.title.toLowerCase() ?? "the outfit"}.`,
    href: "/elevate/events/new",
    touchesMoney: false,
  });

  // Only positions that are still running ON the day of the event.
  const overlapping = ctx.positions.filter((p) => p.daysRemaining >= daysUntil && daysUntil >= 0);
  if (overlapping.length > 0) {
    const exposure = overlapping.reduce((t, p) => t + p.exposure, 0);
    proposals.push({
      id: "commit-load",
      mode: "commit",
      title: "Check your load around the date",
      detail: `${overlapping.length} ${overlapping.length === 1 ? "position is" : "positions are"} still running on the day — R${Math.round(exposure)} committed. The portfolio can show you a front-loaded plan so the days around the event are lighter. Nothing changes unless you change it.`,
      href: "/commit/portfolio",
      touchesMoney: true,
    });
  }

  if (ctx.hasRoutes && daysUntil >= 7) {
    proposals.push({
      id: "climb-countdown",
      mode: "climb",
      title: "Log the weeks between now and then",
      detail: `${Math.floor(daysUntil / 7)} full ${Math.floor(daysUntil / 7) === 1 ? "week" : "weeks"} before the date. Your group already ranks on rate of improvement — these are the weeks that will show it.`,
      href: "/groups",
      touchesMoney: false,
    });
  }

  return proposals;
}

export function direct(req: DirectorRequest, ctx: DirectorContext): DirectorPlan {
  const { intent, problem } = parseIntent(req);
  return {
    intent,
    problem,
    proposals: intent ? buildPlan(intent, req.today, ctx) : [],
  };
}
