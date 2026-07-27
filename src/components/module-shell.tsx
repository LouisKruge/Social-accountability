import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/ui";
import { ModuleRail } from "@/components/exchange-shell";
import { MODULES, type ExchangeState, type ModuleKey } from "@/lib/exchange";

/**
 * Every module wears the same frame: a back route to the exchange, the module's
 * own name and the question it answers, and the rail — so the state of every
 * other module is legible from inside any one of them, and switching never
 * costs more than a tap.
 */
export function ModulePage({
  state,
  moduleKey,
  action,
  children,
}: {
  state: ExchangeState;
  moduleKey: ModuleKey;
  action?: ReactNode;
  children: ReactNode;
}) {
  const def = MODULES.find((m) => m.key === moduleKey)!;

  return (
    <AppShell>
      <header className="mb-5">
        <Link
          href="/commit"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-sage transition hover:text-ice"
        >
          <span aria-hidden>←</span> The exchange
        </Link>
        <div className="flex items-baseline justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-title font-semibold text-snow">
              {def.name}
            </h1>
            <p className="mt-1.5 text-sm text-sage">{def.question}</p>
          </div>
          {action}
        </div>
      </header>

      <ModuleRail
        items={MODULES.map((m) => ({
          key: m.key,
          value: state.modules[m.key].value,
          caption: state.modules[m.key].caption,
          alert: state.modules[m.key].alert,
        }))}
      />

      {children}
    </AppShell>
  );
}
