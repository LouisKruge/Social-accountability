"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Counter } from "./dash";
import { num, zar } from "@/lib/format";
import type { LedgerLine, PayoutTracking, TrustSummary } from "@/lib/wallet";

/**
 * Wallet surface.
 *
 * Gold discipline carries over unchanged: gold is money that has actually been
 * paid to the user. A locked stake, an expected payout and a projection are all
 * cool-toned, because none of them is money in hand yet.
 */

// ── Positions ────────────────────────────────────────────────────────────────

export function PositionTile({
  label,
  amount,
  hint,
  tone = "default",
  big = false,
}: {
  label: string;
  amount: number;
  hint?: string;
  tone?: "default" | "paid" | "risk" | "incoming";
  big?: boolean;
}) {
  const toneClass = {
    default: "text-snow",
    paid: "text-summit", // landed money, and only landed money
    risk: "text-snow",
    incoming: "text-ice",
  }[tone];

  return (
    <div className="flex h-full flex-col rounded-card bg-slope p-4 ring-1 ring-scree/70">
      <p className="min-h-[1.6rem] text-[0.62rem] uppercase leading-tight tracking-[0.14em] text-sage">
        {label}
      </p>
      <p
        className={`tnum font-display font-semibold tracking-tightest ${toneClass} ${
          big ? "text-[2rem] leading-none" : "text-xl"
        }`}
      >
        <Counter value={amount} prefix="R" />
      </p>
      {hint && <p className="mt-1.5 text-caption leading-tight text-sage/80">{hint}</p>}
    </div>
  );
}

/** ROI, stated as what it is: return on everything ever staked. */
export function RoiBar({ roi, staked, won }: { roi: number | null; staked: number; won: number }) {
  const reduce = useReducedMotion();
  if (roi === null) {
    return (
      <div className="rounded-card bg-slope/60 p-4 ring-1 ring-scree/50">
        <p className="text-xs text-sage">
          Your return shows here once you&apos;ve staked on something.
        </p>
      </div>
    );
  }
  const up = roi >= 0;
  const pct = Math.round(roi * 100);
  // Anchored at break-even in the CENTRE, because that is the number that
  // matters: left of centre you are down, right of centre you are up. A bar
  // measured from zero saturates on any gain and stops telling you anything.
  const magnitude = Math.min(1, Math.abs(roi));

  return (
    <div className="rounded-card bg-slope p-4 ring-1 ring-scree/70">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-micro uppercase text-sage">Return so far</p>
        <p className={`tnum font-display text-lg font-semibold ${up ? "text-ice" : "text-fall"}`}>
          {up ? "+" : ""}
          {pct}%
        </p>
      </div>
      <div className="relative mt-3 h-1.5 w-full rounded-full bg-valley">
        <motion.div
          className={`absolute top-0 h-full ${up ? "rounded-r-full bg-ice" : "rounded-l-full bg-fall"}`}
          style={up ? { left: "50%" } : { right: "50%" }}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${Math.max(1.5, magnitude * 50)}%` }}
          transition={{ duration: reduce ? 0 : 0.8, ease: [0.22, 0.61, 0.36, 1] }}
        />
        {/* break-even */}
        <span aria-hidden className="absolute left-1/2 top-[-3px] h-[calc(100%+6px)] w-px bg-scree" />
      </div>
      <p className="mt-1.5 text-center text-[0.6rem] text-sage/70">break-even</p>
      <dl className="mt-2.5 flex justify-between text-caption">
        <div className="flex gap-1.5">
          <dt className="text-sage">Staked</dt>
          <dd className="tnum text-snow/85">{zar(staked)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-sage">Came back</dt>
          <dd className="tnum text-snow/85">{zar(won)}</dd>
        </div>
      </dl>
    </div>
  );
}

// ── Payout tracker ───────────────────────────────────────────────────────────

const TONE_RING: Record<PayoutTracking["tone"], string> = {
  neutral: "ring-scree/70",
  progress: "ring-ice/25",
  good: "ring-summit/25",
  warn: "ring-summit/20",
  bad: "ring-fall/30",
};

const TONE_TEXT: Record<PayoutTracking["tone"], string> = {
  neutral: "text-sage",
  progress: "text-ice",
  good: "text-summit",
  warn: "text-summit",
  bad: "text-fall",
};

/**
 * Where one payout is, right now.
 *
 * The tracker never claims progress a payout has not made: a held payout shows
 * how far it genuinely got and then the state it is actually in, rather than a
 * hopeful line to "Paid".
 */
export function PayoutTracker({ p }: { p: PayoutTracking }) {
  const reduce = useReducedMotion();
  const paid = p.state === "paid";
  const overdue =
    !paid && p.expectedBy !== null && Date.parse(p.expectedBy) < Date.now() - 86_400_000;

  return (
    <article className={`rounded-card bg-slope p-5 ring-1 ${TONE_RING[p.tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-snow/90">{p.cohortName}</p>
          <p className="mt-0.5 text-caption text-sage">
            {p.kind === "refund" ? "Stake refund" : "Winnings"}
          </p>
        </div>
        <p
          className={`tnum shrink-0 font-display text-xl font-semibold ${
            paid ? "text-summit" : "text-snow"
          }`}
        >
          {zar(p.amount)}
        </p>
      </div>

      {/* the rail */}
      <ol className="mt-4 flex items-center gap-1" aria-label="Payout progress">
        {p.steps.map((s, i) => (
          <li key={`${s.state}-${i}`} className="flex flex-1 items-center gap-1">
            <motion.span
              className={`h-1 flex-1 rounded-full ${
                s.done ? "bg-ice" : s.active ? TONE_DOT[p.tone] : "bg-scree"
              }`}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              style={{ transformOrigin: "left" }}
              transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : i * 0.07 }}
            />
          </li>
        ))}
      </ol>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className={`text-xs font-medium ${TONE_TEXT[p.tone]}`}>{p.label}</p>
        {p.expectedBy ? (
          overdue ? (
            // Never keep showing a date that has already gone by as if it were
            // still coming. Saying "later than expected" is what keeps the rest
            // of the page believable.
            <p className="shrink-0 text-caption text-fall">later than expected</p>
          ) : (
            <p className="tnum shrink-0 text-caption text-sage">
              expected{" "}
              {new Date(p.expectedBy).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
            </p>
          )
        ) : (
          !paid && <p className="shrink-0 text-caption text-sage">no date yet</p>
        )}
      </div>

      <p className="mt-2.5 text-meta text-sage">
        {p.blurb}
        {overdue && " This one has taken longer than we estimated — we're on it."}
      </p>

      {p.needsUser && (
        <p className="mt-3 rounded-field bg-fall/10 px-3.5 py-2.5 text-meta text-fall ring-1 ring-fall/25">
          We need your bank details checked before this can move.
        </p>
      )}

      {/* the audit trail — every state change, with the reason given */}
      {p.history.length > 0 && (
        <details className="mt-3.5 border-t border-scree/50 pt-3">
          <summary className="cursor-pointer text-caption text-sage transition hover:text-snow">
            Full history ({p.history.length})
          </summary>
          <ol className="mt-2.5 space-y-2">
            {p.history.map((h, i) => (
              <li key={i} className="flex gap-2.5 text-caption">
                <span className="tnum shrink-0 text-sage">
                  {new Date(h.at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                </span>
                <span className="min-w-0 flex-1 text-snow/80">{h.reason}</span>
                <span className="shrink-0 text-sage/70">{h.actor}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}

const TONE_DOT: Record<PayoutTracking["tone"], string> = {
  neutral: "bg-sage",
  progress: "bg-ice",
  good: "bg-summit",
  warn: "bg-summit",
  bad: "bg-fall",
};

// ── Ledger ───────────────────────────────────────────────────────────────────

export function LedgerTable({ lines }: { lines: LedgerLine[] }) {
  const reduce = useReducedMotion();
  if (lines.length === 0) {
    return (
      <p className="rounded-card bg-slope/60 px-4 py-5 text-center text-xs text-sage ring-1 ring-scree/50">
        Nothing has moved yet. Every stake, refund, fee and payout will be listed here.
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-card ring-1 ring-scree/50">
      {lines.map((l, i) => {
        const inbound = l.amount > 0;
        return (
          <motion.li
            key={l.id}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : Math.min(i, 8) * 0.03 }}
            className="flex items-center gap-3 border-b border-scree/40 bg-slope/60 px-4 py-3 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-snow/90">{l.label}</p>
              <p className="tnum mt-0.5 truncate text-caption text-sage">
                {new Date(l.at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                {l.memo && ` · ${l.memo}`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={`tnum text-sm ${
                  l.status === "cleared" && inbound
                    ? "text-summit"
                    : inbound
                      ? "text-ice"
                      : "text-snow/85"
                }`}
              >
                {inbound ? "+" : "−"}
                {zar(Math.abs(l.amount))}
              </p>
              {l.status !== "cleared" && (
                <p className="text-[0.62rem] capitalize text-sage">{l.status}</p>
              )}
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

// ── Trust ────────────────────────────────────────────────────────────────────

const SEVERITY_TONE = ["", "text-sage", "text-summit", "text-fall"];

export function TrustPanel({
  trust,
  integrityScore,
}: {
  trust: TrustSummary;
  integrityScore: number | null;
}) {
  return (
    <div className="space-y-3">
      {integrityScore !== null && (
        <div className="rounded-card bg-slope p-4 ring-1 ring-scree/70">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-micro uppercase text-sage">
              Verification confidence
            </p>
            <p className="tnum font-display text-lg font-semibold text-snow">
              {num(integrityScore)}
              <span className="text-xs font-normal text-sage">/100</span>
            </p>
          </div>
          <p className="mt-2 text-meta text-sage">
            How well your logged days can be corroborated. Days we can&apos;t verify are held for a
            person to look at — never thrown away.
          </p>
        </div>
      )}

      {/* Where money would be sent. Never the full account number. */}
      <div className="rounded-card bg-slope p-4 ring-1 ring-scree/70">
        <p className="text-micro uppercase text-sage">Payouts go to</p>
        {trust.destination ? (
          <>
            <p className="mt-1.5 text-sm text-snow">
              {trust.destination.bank} ····{trust.destination.last4}
            </p>
            <p className="mt-0.5 text-caption text-sage">
              {trust.destination.holder} ·{" "}
              <span className={trust.destination.verified ? "text-ice" : "text-summit"}>
                {trust.destination.verified ? "verified" : "awaiting verification"}
              </span>
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-meta text-sage">
            No account on file. Add one before your first challenge settles so a payout
            isn&apos;t held up.
          </p>
        )}
      </div>

      {trust.flags.length > 0 && (
        <div className="rounded-card bg-slope p-4 ring-1 ring-scree/70">
          <p className="text-micro uppercase text-sage">Days under review</p>
          <ul className="mt-2.5 space-y-2.5">
            {trust.flags.map((f, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  aria-hidden
                  className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${
                    f.severity >= 3 ? "bg-fall" : f.severity === 2 ? "bg-summit" : "bg-sage"
                  }`}
                />
                <div className="min-w-0">
                  <p className={`text-meta ${SEVERITY_TONE[f.severity] ?? "text-sage"}`}>
                    {f.detail}
                  </p>
                  <p className="tnum mt-0.5 text-[0.62rem] text-sage/70">
                    {new Date(f.at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {trust.devices.length > 0 && (
        <div className="rounded-card bg-slope p-4 ring-1 ring-scree/70">
          <p className="text-micro uppercase text-sage">Your devices</p>
          <ul className="mt-2.5 space-y-2">
            {trust.devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 flex-1 truncate text-snow/85">{d.label}</span>
                <span className="tnum shrink-0 text-caption text-sage">
                  {new Date(d.lastSeen).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {trust.events.length > 0 && (
        <div className="rounded-card bg-slope p-4 ring-1 ring-scree/70">
          <p className="text-micro uppercase text-sage">Recent account activity</p>
          <ul className="mt-2.5 space-y-2">
            {trust.events.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 flex-1 truncate capitalize text-snow/85">
                  {e.kind.replace(/_/g, " ")}
                  {e.city && <span className="text-sage"> · {e.city}</span>}
                </span>
                <span className="tnum shrink-0 text-caption text-sage">
                  {new Date(e.at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
