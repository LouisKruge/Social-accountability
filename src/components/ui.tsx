import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

// ── App chrome ───────────────────────────────────────────────────────────────

/**
 * The page frame. One gutter, one max width, one bottom inset that clears the
 * navigation — set here so no screen has to remember them, and so they cannot
 * drift apart from each other.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[30rem] flex-col px-gutter pb-32 pt-block">
      {children}
    </main>
  );
}

export function Header({
  title,
  subtitle,
  back,
}: {
  title: string;
  subtitle?: string;
  back?: string;
}) {
  return (
    <header className="mb-7">
      {back && (
        <Link
          href={back}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-sage transition hover:text-ice"
        >
          <span aria-hidden>←</span> Back
        </Link>
      )}
      <h1 className="font-display text-title font-semibold text-snow">{title}</h1>
      {subtitle && <p className="mt-tight text-body text-sage">{subtitle}</p>}
    </header>
  );
}

/** The mark is the ascent line itself — a climb out of the valley. */
export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-10 w-10" : "h-9 w-9";
  const text = size === "lg" ? "text-2xl" : "text-xl";
  return (
    <div className="flex items-center gap-2.5">
      <span className={`grid ${box} place-items-center rounded-[0.7rem] bg-slope ring-1 ring-scree`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M4 18 L10 12 L14 15 L20 6"
            fill="none"
            stroke="url(#ascent-up)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="6" r="2" fill="rgb(var(--summit))" />
        </svg>
      </span>
      <span className={`font-display ${text} font-semibold tracking-tightest text-snow`}>
        Ascend
      </span>
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

/**
 * A surface. `elevation` is explicit because "which layer is this on?" is a
 * design decision, and leaving it to whichever class someone typed is how an
 * interface ends up with six subtly different cards.
 */
export function Card({
  children,
  className = "",
  elevation = "rest",
  lit,
}: {
  children: ReactNode;
  className?: string;
  elevation?: "flat" | "rest" | "raised";
  /** Ambient light pooling at the top edge. Use sparingly — it marks a hero. */
  lit?: "summit" | "ice";
}) {
  const layer = {
    flat: "bg-slope/50 ring-scree/40",
    rest: "bg-slope ring-scree/70",
    raised: "bg-ridge shadow-lift ring-scree",
  }[elevation];

  return (
    <div
      className={`relative overflow-hidden rounded-card p-gutter ring-1 ${layer} ${
        lit === "summit" ? "lit-summit" : lit === "ice" ? "lit-ice" : ""
      } ${className}`}
    >
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * A loading surface that reads as loading rather than as broken. Matches the
 * shape of what is arriving, so the layout does not jump when it lands.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-field bg-slope/70 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-sheen bg-gradient-to-r from-transparent via-snow/[0.06] to-transparent" />
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles: Record<string, string> = {
    // gold means "this moves you up" — reserved for the committing action
    primary:
      "bg-summit text-valley hover:bg-summit-soft disabled:bg-summit-deep disabled:text-valley/60 font-semibold",
    secondary: "bg-ridge text-snow hover:bg-scree ring-1 ring-scree",
    ghost: "bg-transparent text-ice hover:bg-ridge",
    danger: "bg-fall/15 text-fall ring-1 ring-fall/40 hover:bg-fall/25",
  };
  // active:scale gives a press its weight. 0.98 is the smallest value that is
  // felt rather than seen — anything larger reads as a bounce.
  return (
    <button
      className={`inline-flex min-h-[3rem] w-full items-center justify-center rounded-field px-4 py-3.5 text-body font-medium transition duration-150 ease-ascend active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const styles: Record<string, string> = {
    primary: "bg-summit text-valley hover:bg-summit-soft font-semibold",
    secondary: "bg-ridge text-snow hover:bg-scree ring-1 ring-scree",
    ghost: "bg-transparent text-ice hover:bg-ridge",
  };
  return (
    <Link
      href={href}
      className={`inline-flex min-h-[3rem] w-full items-center justify-center rounded-field px-4 py-3.5 text-body font-medium transition duration-150 ease-ascend active:scale-[0.98] ${styles[variant]}`}
    >
      {children}
    </Link>
  );
}

export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-sage">{label}</span>
      <input
        // text-base (16px) is not a style choice: anything smaller makes iOS
        // Safari zoom the whole page on focus.
        className="w-full rounded-field bg-valley px-4 py-3.5 text-base text-snow ring-1 ring-scree transition duration-150 ease-ascend placeholder:text-sage/50 focus:ring-2 focus:ring-ice"
        {...props}
      />
      {hint && <span className="mt-2 block text-xs text-sage/80">{hint}</span>}
    </label>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-field bg-fall/10 px-4 py-3 text-sm text-fall ring-1 ring-fall/30">
      {children}
    </p>
  );
}

export function SuccessNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-field bg-ice/10 px-4 py-3 text-sm text-ice ring-1 ring-ice/25">
      {children}
    </p>
  );
}

export function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: ReactNode;
}) {
  return (
    <Card className="text-center">
      <p className="font-display text-lg font-medium tracking-tight text-snow">{title}</p>
      <p className="mx-auto mt-2 max-w-[22rem] text-body text-sage">{body}</p>
      {cta && <div className="mt-5">{cta}</div>}
    </Card>
  );
}

export function Badge({
  children,
  tone = "ice",
}: {
  children: ReactNode;
  tone?: "ice" | "summit" | "muted";
}) {
  const tones: Record<string, string> = {
    ice: "bg-ice/10 text-ice ring-1 ring-ice/20",
    summit: "bg-summit/12 text-summit ring-1 ring-summit/25",
    muted: "bg-ridge text-sage ring-1 ring-scree",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-caption font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// ── Formatting helpers ───────────────────────────────────────────────────────

export function formatChange(pct: number, isAbsolute: boolean, unit?: string | null): string {
  const sign = pct > 0 ? "+" : "";
  if (isAbsolute) return `${sign}${pct}${unit ? ` ${unit}` : ""}`;
  return `${sign}${pct}%`;
}

/**
 * Metric-aware value label. Streaks are a run length, not a signed change.
 */
export function formatMetric(
  metricType: "percentage_change" | "streak",
  value: number,
  isAbsolute: boolean,
  unit?: string | null,
): string {
  if (metricType === "streak") {
    return `${value} ${unit || "day"}${value === 1 ? "" : "s"}`;
  }
  return formatChange(value, isAbsolute, unit);
}

export function rankLabel(rank: number): string {
  return `${rank}`;
}
