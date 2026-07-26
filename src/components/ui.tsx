import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

// ── App chrome ───────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[30rem] flex-col px-5 pb-28 pt-6">
      {children}
    </div>
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
      <h1 className="font-display text-[1.75rem] font-semibold leading-none tracking-tightest text-snow">
        {title}
      </h1>
      {subtitle && <p className="mt-2 text-sm text-sage">{subtitle}</p>}
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
          <circle cx="20" cy="6" r="2" fill="#E8B84B" />
        </svg>
      </span>
      <span className={`font-display ${text} font-semibold tracking-tightest text-snow`}>
        Ascend
      </span>
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card bg-slope p-5 ring-1 ring-scree/70 ${className}`}>{children}</div>
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
  return (
    <button
      className={`inline-flex w-full items-center justify-center rounded-field px-4 py-3.5 text-sm transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
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
      className={`inline-flex w-full items-center justify-center rounded-field px-4 py-3.5 text-sm transition ${styles[variant]}`}
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
        className="w-full rounded-field bg-valley px-4 py-3.5 text-base text-snow ring-1 ring-scree transition placeholder:text-sage/50 focus:ring-2 focus:ring-ice"
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
      <p className="mx-auto mt-2 max-w-[22rem] text-sm leading-relaxed text-sage">{body}</p>
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
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${tones[tone]}`}
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
