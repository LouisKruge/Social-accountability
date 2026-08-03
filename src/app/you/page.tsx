import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui";
import { loadLedger, type LedgerSection } from "@/lib/ledger";
import { zar } from "@/lib/format";
import { signOut } from "@/app/auth/actions";
import { ProfileForm } from "@/app/profile/profile-form";
import { DeleteGlowupData } from "@/app/profile/delete-glowup";
import { DeleteAccount } from "@/app/profile/delete-account";

export const dynamic = "force-dynamic";

const SECTION_NAME: Record<LedgerSection, string> = {
  climb: "Climb",
  commit: "Commit",
  elevate: "Elevate",
};

/**
 * Absolute rand. The sign is carried by the row's own prefix, so the formatter
 * never has to decide whether a negative reads as "−R400" or "R−400".
 *
 * This used `toLocaleString("en-ZA")` until now — the exact call src/lib/format.ts
 * exists to replace, because Node and Chromium ship different CLDR data for
 * en-ZA and rendered the same figure as "12,400" server-side and "12 400" in
 * the browser. On the screen where a person reads their own money.
 */
const money = (n: number) => zar(Math.abs(n));

/**
 * YOU — one hub, not three settings screens.
 *
 * The ledger is the reason this tab exists: every money event across Climb,
 * Commit and Elevate reconciled into a single column, signed from the user's
 * point of view, so "where has my money gone" is answerable in one glance.
 * Gold appears here only against money actually received.
 */
export default async function YouPage({
  searchParams,
}: {
  searchParams: { glowup_delete?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: sub }, ledger] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, phone_number, notify_whatsapp")
      .eq("id", user!.id)
      .maybeSingle(),
    supabase.from("subscriptions").select("tier, status").eq("user_id", user!.id).maybeSingle(),
    loadLedger(supabase, user!.id),
  ]);

  const isPremium = sub?.tier === "premium" && sub.status === "active";

  return (
    <AppShell>
      <header className="mb-block flex items-baseline justify-between gap-4">
        <div>
          <p className="text-micro uppercase text-sage">Your account</p>
          <h1 className="font-display text-title font-semibold text-snow">You</h1>
        </div>
        <form action={signOut}>
          <button className="shrink-0 text-xs text-sage transition hover:text-snow">
            Sign out
          </button>
        </form>
      </header>

      {/* ── Money, reconciled across all three modes ─────────────────────── */}
      <section className="mb-chapter">
        <p className="text-micro uppercase text-sage">Net across Ascend</p>
        <p className="tnum -ml-1 mt-2 font-display text-hero font-semibold text-snow">
          {ledger.net < 0 && "\u2212"}
          {money(ledger.net)}
        </p>
        <dl className="mt-block flex flex-wrap gap-x-8 gap-y-3 border-t border-scree/60 pt-4">
          <div>
            <dt className="text-micro uppercase text-sage">Paid in</dt>
            <dd className="tnum mt-1 font-display text-lg text-snow">{money(ledger.paidOut)}</dd>
          </div>
          <div>
            <dt className="text-micro uppercase text-sage">Received</dt>
            {/* The one hue on the screen: money actually paid to you. */}
            <dd className="tnum mt-1 font-display text-lg text-summit">{money(ledger.received)}</dd>
          </div>
          {ledger.pending > 0 && (
            <div>
              <dt className="text-micro uppercase text-sage">In flight</dt>
              <dd className="tnum mt-1 font-display text-lg text-snow">{money(ledger.pending)}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="mb-chapter border-t border-snow/25">
        <p className="py-block text-micro uppercase text-sage">Every movement</p>
        {ledger.entries.length === 0 ? (
          <p className="border-t border-scree/60 py-5 text-body text-sage">
            No money has moved yet. Stakes, payouts and purchases all show up here.
          </p>
        ) : (
          <ul className="border-t border-scree/60">
            {ledger.entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 border-b border-scree/40 py-4 last:border-0">
                <span className="w-16 shrink-0 text-micro uppercase text-sage">
                  {SECTION_NAME[e.section]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-snow">{e.label}</span>
                  <span className="mt-0.5 block truncate text-caption text-sage">
                    {e.detail ? `${e.detail} \u00b7 ` : ""}
                    {new Date(e.date).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    })}
                  </span>
                </span>
                {e.amount !== 0 && (
                  <span
                    className={`tnum shrink-0 text-body ${
                      e.amount > 0 && e.status === "confirmed" ? "text-summit" : "text-snow/75"
                    }`}
                  >
                    {e.amount > 0 ? "+" : "\u2212"}
                    {money(e.amount)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Plan ────────────────────────────────────────────────────────── */}
      <section className="mb-chapter border-t border-scree/60 pt-block">
        <p className="mb-4 text-micro uppercase text-sage">Plan</p>
        <Link href="/billing" className="group flex items-center justify-between gap-4">
          <div>
            <p className="text-body text-snow">{isPremium ? "Premium" : "Free plan"}</p>
            <p className="mt-0.5 text-caption text-sage">Manage your subscription</p>
          </div>
          <span
            aria-hidden
            className="shrink-0 text-caption text-sage transition group-hover:translate-x-1 group-hover:text-snow"
          >
            &rarr;
          </span>
        </Link>
      </section>

      {/* ── Linked accounts & notifications ─────────────────────────────── */}
      <section className="mb-chapter border-t border-scree/60 pt-block">
        <p className="mb-4 text-micro uppercase text-sage">Alerts &amp; linked accounts</p>
        <ProfileForm
          displayName={profile?.display_name ?? ""}
          phoneNumber={profile?.phone_number ?? null}
          notifyWhatsapp={profile?.notify_whatsapp ?? true}
        />
        <div className="mt-block border-t border-scree/40 pt-4">
          <p className="text-body text-snow">Step tracker &middot; not linked</p>
          <p className="mt-1 text-caption text-sage">
            Steps are self-reported for now. Device sync is coming, and until it lands the
            integrity engine is what stands between a typed number and a payout.
          </p>
        </div>
      </section>

      {/* ── Privacy ─────────────────────────────────────────────────────── */}
      <section className="border-t border-scree/60 pt-block">
        <p className="mb-4 text-micro uppercase text-sage">Your data</p>
        {searchParams.glowup_delete === "ok" && (
          <p className="mb-4 rounded-field bg-ridge px-4 py-3 text-body text-snow ring-1 ring-scree">
            Your Elevate photos and reports are gone.
          </p>
        )}
        <div className="mb-block">
          <DeleteGlowupData />
        </div>
        <DeleteAccount />
      </section>
    </AppShell>
  );
}
