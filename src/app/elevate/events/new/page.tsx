import Link from "next/link";
import { AppShell } from "@/components/ui";
import { todayIso } from "@/lib/events";
import { EventForm } from "./event-form";

export const dynamic = "force-dynamic";

export default function NewEventPage({
  searchParams,
}: {
  searchParams: { kind?: string; date?: string; title?: string };
}) {
  return (
    <AppShell>
      <header className="mb-block">
        <Link
          href="/elevate"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-sage transition hover:text-snow"
        >
          <span aria-hidden>←</span> Elevate
        </Link>
        <h1 className="max-w-[16rem] font-display text-display font-semibold text-snow">
          What are you getting ready for?
        </h1>
        <p className="mt-3.5 max-w-[22rem] text-body text-sage">
          Give it a date and Ascend works backwards — when to get the haircut so it has settled,
          when the outfit needs choosing while a gap can still be filled, when to start practising
          out loud.
        </p>
      </header>

      {/* Prefilled when the Director sent you here, so the sentence you typed
          does not have to be retyped as three fields. The values are still
          editable — a parsed date is a proposal, not a decision. */}
      <EventForm
        today={todayIso()}
        prefill={{
          kind: searchParams.kind,
          date: searchParams.date,
          title: searchParams.title,
        }}
      />
    </AppShell>
  );
}
