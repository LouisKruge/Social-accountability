import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

// ── App chrome ───────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-24 pt-6">
      {children}
    </div>
  );
}

export function Header({ title, subtitle, back }: { title: string; subtitle?: string; back?: string }) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back} className="mb-2 inline-flex items-center gap-1 text-sm text-brand-600">
          <span aria-hidden>←</span> Back
        </Link>
      )}
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </header>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-lg font-black text-white">
        ▲
      </span>
      <span className="text-xl font-black tracking-tight text-brand-700">Ascend</span>
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles: Record<string, string> = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-400",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    ghost: "bg-transparent text-brand-600 hover:bg-brand-50",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400",
  };
  return (
    <button
      className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
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
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    ghost: "bg-transparent text-brand-600 hover:bg-brand-50",
  };
  return (
    <Link
      href={href}
      className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${styles[variant]}`}
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
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        {...props}
      />
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}

export function SuccessNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-xl border border-accent-500/40 bg-lime-50 px-3 py-2 text-sm text-lime-800">
      {children}
    </p>
  );
}

export function EmptyState({ title, body, cta }: { title: string; body: string; cta?: ReactNode }) {
  return (
    <Card className="text-center">
      <p className="text-base font-semibold text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">{body}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </Card>
  );
}

export function Badge({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "amber" | "slate" }) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

// ── Formatting helpers ───────────────────────────────────────────────────────

export function formatChange(pct: number, isAbsolute: boolean, unit?: string | null): string {
  const sign = pct > 0 ? "+" : "";
  if (isAbsolute) {
    const u = unit ? ` ${unit}` : "";
    return `${sign}${pct}${u}`;
  }
  return `${sign}${pct}%`;
}

/**
 * Leaderboard value label that's aware of the metric type. Streaks are a raw
 * count (e.g. "12 day streak"), not a signed change; percentage/absolute metrics
 * keep the +/− change formatting.
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

export function rankMedal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}

/**
 * Dependency-free trend bars (a mini chart). Values can be negative; bars grow
 * from a shared midline. Used for the premium historical trend.
 */
export function TrendBars({ values }: { values: { label: string; value: number }[] }) {
  if (values.length === 0) {
    return <p className="text-sm text-slate-400">No history yet — check back after a few weeks.</p>;
  }
  const max = Math.max(1, ...values.map((v) => Math.abs(v.value)));
  return (
    <div className="flex items-end gap-1.5" style={{ height: 96 }}>
      {values.map((v, i) => {
        const heightPct = (Math.abs(v.value) / max) * 100;
        const positive = v.value >= 0;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end justify-center">
              <div
                className={`w-full rounded-t ${positive ? "bg-accent-500" : "bg-red-400"}`}
                style={{ height: `${Math.max(6, heightPct)}%` }}
                title={`${v.value}`}
              />
            </div>
            <span className="text-[10px] text-slate-400">{v.label}</span>
          </div>
        );
      })}
    </div>
  );
}
