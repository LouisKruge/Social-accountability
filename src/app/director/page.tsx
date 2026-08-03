import Link from "next/link";
import { AppShell } from "@/components/ui";
import { DirectorForm } from "./director-form";

export const dynamic = "force-dynamic";

/**
 * THE LIFE DIRECTOR.
 *
 * One sentence in, a plan across all three modes out. The parser is rules, not
 * a model: dates and event kinds are a small closed grammar, and a hallucinated
 * date here silently reschedules somebody's haircut three days late. When it
 * cannot read a sentence it says so and asks — the behaviour a confident wrong
 * answer cannot give you.
 */
export default function DirectorPage() {
  return (
    <AppShell>
      <header className="mb-block">
        <Link
          href="/home"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-sage transition hover:text-snow"
        >
          <span aria-hidden>←</span> Today
        </Link>
        <p className="text-micro uppercase text-sage">Director</p>
        <h1 className="mt-2 max-w-[16rem] font-display text-display font-semibold text-snow">
          Tell it what&apos;s coming
        </h1>
        <p className="mt-3.5 max-w-[23rem] text-body text-sage">
          One sentence, and Ascend works out what it means across all three sections — the
          preparation, the load on your open positions, and the weeks in between.
        </p>
      </header>

      <DirectorForm />
    </AppShell>
  );
}
