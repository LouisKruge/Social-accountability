"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MODULES, type ModuleKey } from "@/lib/exchange";

/**
 * THE EXCHANGE SHELL.
 *
 * Commit's old information architecture was a single page of cards stacked
 * vertically, which meant the only way to reach anything was to scroll past
 * everything. That does not scale past about six sections, and Commit now has
 * seven modules.
 *
 * So navigation here is two things and no scrolling:
 *
 *   1. THE RAIL — a persistent horizontal strip of modules, each carrying its
 *      own live figure. It is always visible, so you can see the state of the
 *      whole exchange without opening anything, and switch in one tap.
 *
 *   2. THE COMMAND BAR — ⌘K on a keyboard, a tap target on a phone. Jumps to
 *      any module or any challenge by name. This is the fast path for someone
 *      who already knows where they are going, and it is the only navigation
 *      that does not get slower as the product grows.
 *
 * Deliberately NOT built: a radial menu and gesture shortcuts. Both are
 * undiscoverable without an onboarding overlay, both fight the browser's own
 * gestures on mobile web, and neither has an accessible equivalent. The command
 * bar does the same job and is reachable by keyboard, screen reader and tap.
 */

// ── The rail ─────────────────────────────────────────────────────────────────

export interface RailItem {
  key: ModuleKey;
  value: string | null;
  caption: string;
  alert: boolean;
}

export function ModuleRail({ items }: { items: RailItem[] }) {
  const pathname = usePathname() ?? "";
  const reduce = useReducedMotion();
  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);

  return (
    <nav
      aria-label="Exchange modules"
      className="-mx-5 mb-6 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex gap-2">
        {MODULES.map((m, i) => {
          const item = byKey.get(m.key);
          const active = pathname === m.href || pathname.startsWith(`${m.href}/`);
          return (
            <motion.li
              key={m.key}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : i * 0.03 }}
              className="shrink-0"
            >
              <Link
                href={m.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-w-[6.2rem] flex-col rounded-field px-3.5 py-2.5 ring-1 transition ${
                  active
                    ? "bg-ridge text-snow ring-ice/30"
                    : "bg-slope/60 text-sage ring-scree/60 hover:bg-ridge hover:text-snow"
                }`}
              >
                <span className="flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.12em]">
                  {m.name}
                  {item?.alert && (
                    <span aria-label="needs attention" className="h-1.5 w-1.5 rounded-full bg-fall" />
                  )}
                </span>
                <span
                  className={`tnum mt-1 font-display text-base font-semibold leading-none ${
                    item?.value ? "text-snow" : "text-sage/50"
                  }`}
                >
                  {item?.value ?? "—"}
                </span>
                {active && (
                  <motion.span
                    layoutId="rail-underline"
                    className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-ice"
                    transition={{ duration: reduce ? 0 : 0.3 }}
                  />
                )}
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </nav>
  );
}

// ── The command bar ──────────────────────────────────────────────────────────

export interface CommandTarget {
  id: string;
  label: string;
  sub: string;
  href: string;
  group: "Module" | "Challenge" | "Action";
}

export function CommandBar({ targets }: { targets: CommandTarget[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo<CommandTarget[]>(
    () => [
      ...MODULES.map((m) => ({
        id: m.key,
        label: m.name,
        sub: m.question,
        href: m.href,
        group: "Module" as const,
      })),
      ...targets,
    ],
    [targets],
  );

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all.slice(0, 8);
    return all
      .filter(
        (t) =>
          t.label.toLowerCase().includes(needle) || t.sub.toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [all, q]);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setCursor(0);
  }, []);

  const go = useCallback(
    (t: CommandTarget) => {
      close();
      router.push(t.href);
    },
    [close, router],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      }
      if (e.key === "Enter" && results[cursor]) {
        e.preventDefault();
        go(results[cursor]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, cursor, close, go]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search and jump"
        className="flex w-full items-center gap-2.5 rounded-field bg-slope/60 px-4 py-2.5 text-left text-sm text-sage ring-1 ring-scree/60 transition hover:bg-ridge hover:text-snow"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true">
          <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M13 13 L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="flex-1">Jump to…</span>
        <kbd className="hidden shrink-0 rounded bg-valley px-1.5 py-0.5 font-mono text-[0.6rem] text-sage ring-1 ring-scree sm:block">
          ⌘K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="absolute inset-0 bg-valley/80 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Jump to"
              className="relative w-full max-w-[26rem] overflow-hidden rounded-card bg-slope shadow-crest ring-1 ring-scree"
              initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setCursor(0);
                }}
                placeholder="Jump to a module or a challenge…"
                className="w-full bg-transparent px-5 py-4 text-base text-snow outline-none placeholder:text-sage/60"
              />
              <div className="h-px bg-scree/70" />
              {results.length === 0 ? (
                <p className="px-5 py-5 text-sm text-sage">Nothing matches that.</p>
              ) : (
                <ul className="max-h-[50vh] overflow-y-auto py-1.5">
                  {results.map((t, i) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setCursor(i)}
                        onClick={() => go(t)}
                        className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition ${
                          i === cursor ? "bg-ridge" : ""
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-snow">{t.label}</span>
                          <span className="block truncate text-[0.68rem] text-sage">{t.sub}</span>
                        </span>
                        <span className="shrink-0 text-[0.6rem] uppercase tracking-wider text-sage/70">
                          {t.group}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Bottom sheet ─────────────────────────────────────────────────────────────

/**
 * A drawer for detail that shouldn't cost a page load. Dismissible by the
 * backdrop, the handle, and Escape — three ways out, because a sheet you can't
 * close is a trap on a small screen.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-valley/75 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative max-h-[85vh] w-full max-w-[30rem] overflow-y-auto rounded-t-card bg-slope pb-8 ring-1 ring-scree"
            initial={reduce ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <button
              type="button"
              onClick={onClose}
              className="sticky top-0 z-10 flex w-full justify-center bg-slope py-3"
              aria-label="Close"
            >
              <span aria-hidden className="h-1 w-10 rounded-full bg-scree" />
            </button>
            <div className="px-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
