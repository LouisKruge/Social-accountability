"use client";

import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { num } from "@/lib/format";

/**
 * Commit dashboard primitives.
 *
 * Dense and alive, but the register stays Commit's: precise, numeric, unexcited
 * about money. Gold is reserved for money that is actually confirmed as yours —
 * never for chrome, never for a projection. Every animation has a static
 * equivalent under prefers-reduced-motion (the value simply renders final).
 */

/** Counter that rolls up to its value. Under reduced motion it just shows it. */
export function Counter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20, mass: 0.6 });
  const text = useTransform(spring, (v) => `${prefix}${num(v, decimals)}${suffix}`);

  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  if (reduce) {
    return (
      <span className={className}>
        {prefix}
        {num(value, decimals)}
        {suffix}
      </span>
    );
  }
  return <motion.span className={className}>{text}</motion.span>;
}

/** A compact labelled figure. The workhorse of the stat grid. */
export function StatTile({
  label,
  children,
  tone = "default",
  hint,
}: {
  label: string;
  children: ReactNode;
  tone?: "default" | "money" | "good" | "bad" | "cool";
  hint?: string;
}) {
  const toneClass = {
    default: "text-snow",
    money: "text-summit", // confirmed money only
    good: "text-ice",
    bad: "text-fall",
    cool: "text-ice",
  }[tone];

  // Tiles sit in rows, and a label that wraps to two lines must not shove its
  // figure out of line with its neighbours. Reserving two lines for every label
  // keeps the figures on one baseline across the row.
  return (
    <div className="flex h-full flex-col rounded-field bg-valley/70 p-3.5 ring-1 ring-scree/70">
      <p className="min-h-[1.6rem] text-[0.62rem] uppercase leading-tight tracking-[0.14em] text-sage">
        {label}
      </p>
      <p className={`tnum font-display text-xl font-semibold tracking-tight ${toneClass}`}>
        {children}
      </p>
      {hint && <p className="mt-1 text-[0.65rem] leading-tight text-sage/80">{hint}</p>}
    </div>
  );
}

/**
 * Progress ring — how far through the target you are.
 * Uses the ice→summit gradient so the leading edge warms as you approach.
 */
export function ProgressRing({
  ratio,
  size = 132,
  stroke = 10,
  children,
}: {
  ratio: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, ratio));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1E2C25" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ascent-up)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - pct) : c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: reduce ? 0 : 1.1, ease: [0.22, 0.61, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Daily bars — your last N days against the daily target. */
export function DayBars({
  days,
  target,
}: {
  days: { label: string; value: number }[];
  target: number;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(target, ...days.map((d) => d.value), 1);
  // Sized in pixels, not percentages: a percentage height inside a flex item
  // with an indefinite content height resolves to nothing, which silently
  // rendered seven invisible bars.
  const PLOT = 64;
  const targetY = (target / max) * PLOT;

  return (
    <div>
      <div className="relative flex items-end gap-1.5" style={{ height: PLOT }}>
        {/* the daily target line, so each bar reads pass/fail at a glance */}
        <div
          aria-hidden
          className="absolute inset-x-0 border-t border-dashed border-scree/80"
          style={{ bottom: targetY }}
        />
        {days.map((d, i) => {
          const h = Math.max(2, (d.value / max) * PLOT);
          const hit = d.value >= target;
          return (
            <motion.div
              key={i}
              className={`flex-1 rounded-t ${hit ? "bg-ice" : "bg-scree"}`}
              initial={{ height: reduce ? h : 0 }}
              animate={{ height: h }}
              transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : i * 0.04 }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {days.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[0.6rem] text-sage">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * PACE CHART — your cumulative effort against the straight line that finishes
 * the challenge. Two lines, no axis furniture: the dashed line is the deal you
 * made, the drawn line is what you have actually done. Being above the dash is
 * the whole story, so nothing else competes for attention.
 */
export function PaceChart({
  actual,
  required,
  height = 128,
}: {
  actual: number[];
  required: number[];
  height?: number;
}) {
  const reduce = useReducedMotion();
  const n = Math.max(actual.length, required.length);
  if (n < 2) {
    return (
      <div
        className="grid place-items-center rounded-field bg-valley/70 text-xs text-sage ring-1 ring-scree/70"
        style={{ height }}
      >
        Two days of logs and your pace line appears here
      </div>
    );
  }

  const W = 300;
  const H = height;
  const pad = 6;
  const max = Math.max(...actual, ...required, 1);
  const x = (i: number) => pad + (i / (n - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");

  const last = actual[actual.length - 1] ?? 0;
  const owed = required[actual.length - 1] ?? 0;
  const ahead = last >= owed;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full overflow-visible"
      style={{ height: H }}
      role="img"
      aria-label={`Your cumulative total is ${Math.round(last).toLocaleString("en-ZA")} against ${Math.round(owed).toLocaleString("en-ZA")} needed by today`}
    >
      {/* the deal: a straight line from nothing to the target */}
      <path d={path(required)} fill="none" stroke="#2A3A32" strokeWidth="1.5" strokeDasharray="4 4" />
      {/* what you did */}
      <motion.path
        d={path(actual)}
        fill="none"
        stroke={ahead ? "url(#ascent-up)" : "#E06D5A"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 1.2, ease: [0.22, 0.61, 0.36, 1] }}
      />
      <circle cx={x(actual.length - 1)} cy={y(last)} r="3.5" fill={ahead ? "#E8B84B" : "#E06D5A"} />
    </svg>
  );
}

/** Section heading used throughout the dashboard. */
export function DashSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-7">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-sage">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Live activity feed.
 *
 * PRIVACY: only ever carries PROGRESS events, which cohort members can already
 * see, plus AGGREGATE money (the pool total). It never names an individual
 * alongside a rand figure — that would leak what someone staked.
 */
export function ActivityFeed({
  items,
}: {
  items: { id: string; text: string; when: string; kind: "progress" | "join" | "pool" }[];
}) {
  const reduce = useReducedMotion();
  const dot = { progress: "bg-ice", join: "bg-sage", pool: "bg-summit" };

  return (
    <ul className="space-y-0">
      {items.map((it, i) => (
        <motion.li
          key={it.id}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : Math.min(i, 6) * 0.05 }}
          className="flex items-center gap-3 border-b border-scree/40 py-2.5 last:border-0"
        >
          <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot[it.kind]}`} />
          <span className="min-w-0 flex-1 truncate text-sm text-snow/85">{it.text}</span>
          <span className="shrink-0 text-[0.65rem] text-sage">{it.when}</span>
        </motion.li>
      ))}
    </ul>
  );
}
