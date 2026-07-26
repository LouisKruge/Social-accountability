import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Card, Badge, Brand } from "@/components/ui";
import { loadLedger, type LedgerSection } from "@/lib/ledger";
import { signOut } from "@/app/auth/actions";
import { ProfileForm } from "@/app/profile/profile-form";
import { DeleteGlowupData } from "@/app/profile/delete-glowup";
import { DeleteAccount } from "@/app/profile/delete-account";

export const dynamic = "force-dynamic";

const SECTION_DOT: Record<LedgerSection, string> = {
  climb: "bg-ice",
  commit: "bg-ice",
  elevate: "bg-snow",
};
const SECTION_NAME: Record<LedgerSection, string> = {
  climb: "Climb",
  commit: "Commit",
  elevate: "Elevate",
};

const zar = (n: number) => `R${Math.abs(n).toLocaleString("en-ZA", { minimumFractionDigits: 0 })}`;

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
      <div className="mb-7 flex items-center justify-between">
        <Link href="/home" aria-label="All sections">
          <Brand />
        </Link>
        <form action={signOut}>
          <button className="text-sm text-sage transition hover:text-ice">Sign out</button>
        </form>
      </div>

      <header className="mb-7">
        <p className="text-[0.7rem] uppercase tracking-[0.16em] text-sage">Your account</p>
        <h1 className="mt-1.5 font-display text-[1.9rem] font-semibold leading-none tracking-tightest text-snow">
          You
        </h1>
      </header>

      {/* ── Activity ledger ─────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">Money in this app</h2>

        <Card className="mb-3">
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div>
              <dt className="text-[0.65rem] uppercase tracking-wider text-sage">Paid in</dt>
              <dd className="tnum mt-1 text-sm text-snow">{zar(ledger.paidOut)}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] uppercase tracking-wider text-sage">Received</dt>
              <dd className="tnum mt-1 text-sm text-summit">{zar(ledger.received)}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] uppercase tracking-wider text-sage">Net</dt>
              <dd className={`tnum mt-1 text-sm ${ledger.net >= 0 ? "text-snow" : "text-sage"}`}>
                {ledger.net < 0 ? "−" : ""}
                {zar(ledger.net)}
              </dd>
            </div>
          </dl>
          {ledger.pending > 0 && (
            <p className="mt-3 border-t border-scree/60 pt-3 text-center text-xs text-sage">
              {zar(ledger.pending)} still being processed
            </p>
          )}
        </Card>

        {ledger.entries.length === 0 ? (
          <Card>
            <p className="text-sm text-sage">
              No money has moved yet. Stakes, payouts and purchases will all show up here.
            </p>
          </Card>
        ) : (
          <Card className="!py-2">
            <ul className="divide-y divide-scree/50">
              {ledger.entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-3.5">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${SECTION_DOT[e.section]}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-snow/90">{e.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-sage">
                      {SECTION_NAME[e.section]}
                      {e.detail ? ` · ${e.detail}` : ""} ·{" "}
                      {new Date(e.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  {e.amount !== 0 && (
                    <span
                      className={`tnum shrink-0 text-sm ${
                        e.amount > 0 && e.status === "confirmed" ? "text-summit" : "text-snow/80"
                      }`}
                    >
                      {e.amount > 0 ? "+" : "−"}
                      {zar(e.amount)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* ── Plan ────────────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">Plan</h2>
        <Link href="/billing" className="block">
          <Card className="flex items-center justify-between transition hover:bg-ridge">
            <div>
              <p className="text-sm text-snow">{isPremium ? "Premium" : "Free plan"}</p>
              <p className="mt-0.5 text-xs text-sage">Manage your subscription</p>
            </div>
            <Badge tone={isPremium ? "summit" : "muted"}>{isPremium ? "Premium" : "Free"}</Badge>
          </Card>
        </Link>
      </section>

      {/* ── Linked accounts & notifications ─────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">
          Linked accounts &amp; alerts
        </h2>
        <Card className="mb-3">
          <ProfileForm
            displayName={profile?.display_name ?? ""}
            phoneNumber={profile?.phone_number ?? null}
            notifyWhatsapp={profile?.notify_whatsapp ?? true}
          />
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-snow">Step tracker</p>
              <p className="mt-0.5 text-xs text-sage">
                For verifying Commit challenges automatically.
              </p>
            </div>
            <Badge tone="muted">Not linked</Badge>
          </div>
          <p className="mt-3 text-xs text-sage/80">
            Steps are self-reported for now. Device sync is coming.
          </p>
        </Card>
      </section>

      {/* ── Privacy ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-sage">Your data</h2>
        {searchParams.glowup_delete === "ok" && (
          <div className="mb-3">
            <Card className="ring-1 ring-ice/25">
              <p className="text-sm text-ice">Your Elevate photos and reports are gone.</p>
            </Card>
          </div>
        )}
        <div className="mb-3">
          <DeleteGlowupData />
        </div>
        <DeleteAccount />
      </section>
    </AppShell>
  );
}
