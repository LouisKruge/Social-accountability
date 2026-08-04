import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Header } from "@/components/ui";
import { CATEGORY_LABEL, longDate } from "@/components/treasury-ui";
import { loadTreasury } from "@/lib/treasuryAccount";
import { withdrawDisputeForm } from "../../actions";
import { MessageForm } from "./message-form";

export const dynamic = "force-dynamic";

/**
 * ONE DISPUTE.
 *
 * A thread rather than a status page, because the thing a person actually wants
 * is to see that somebody read what they wrote. Support's replies are marked as
 * support and the user's as their own; the RLS policy pins the author on the
 * way in, so the labels here cannot be gamed by whoever is typing.
 */
export default async function DisputePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const treasury = await loadTreasury(supabase, user!.id);
  const dispute = treasury.disputes.find((d) => d.id === params.id);
  if (!dispute) notFound();

  const stillOpen = dispute.state === "open" || dispute.state === "evidence";

  return (
    <AppShell>
      <Header
        title={CATEGORY_LABEL[dispute.category] ?? "Dispute"}
        back="/commit/wallet/disputes"
        subtitle={`${dispute.label} · opened ${longDate(dispute.openedAt)}`}
      />

      <section className="mb-chapter rounded-field bg-ridge px-4 py-4 ring-1 ring-scree">
        <p className="text-micro uppercase text-sage">What you said</p>
        <p className="mt-2 text-body text-snow">{dispute.summary}</p>
        <p className="mt-3 border-t border-scree/60 pt-3 text-caption text-sage">{dispute.blurb}</p>
      </section>

      {dispute.resolution && (
        <section className="mb-chapter">
          <p className="text-micro uppercase text-sage">The decision</p>
          <p className="mt-2 text-body text-snow">{dispute.resolution}</p>
        </section>
      )}

      {dispute.messages.length > 0 && (
        <section className="mb-chapter">
          <p className="mb-3 text-micro uppercase text-sage">The thread</p>
          <ul className="space-y-3">
            {dispute.messages.map((m, i) => (
              <li
                key={`${m.at}-${i}`}
                className={`rounded-field px-4 py-3 ring-1 ${
                  m.author === "support"
                    ? "bg-ridge text-snow ring-scree"
                    : "bg-valley text-snow/85 ring-scree/60"
                }`}
              >
                <p className="text-micro uppercase text-sage">
                  {m.author === "support" ? "Ascend" : "You"} · {longDate(m.at)}
                </p>
                <p className="mt-1.5 text-body">{m.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stillOpen ? (
        <>
          <div className="mb-block">
            <MessageForm disputeId={dispute.id} />
          </div>
          <form action={withdrawDisputeForm}>
            <input type="hidden" name="id" value={dispute.id} />
            <button
              type="submit"
              className="text-caption text-sage underline decoration-scree underline-offset-4 transition hover:text-snow"
            >
              Withdraw this dispute
            </button>
          </form>
        </>
      ) : (
        <p className="text-meta text-sage/80">
          This one is closed. Nothing further can be added to it, and the record stays on your
          account.
        </p>
      )}
    </AppShell>
  );
}
