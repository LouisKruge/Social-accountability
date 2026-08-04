import { createClient } from "@/lib/supabase/server";
import { AppShell, Header } from "@/components/ui";
import { longDate } from "@/components/treasury-ui";
import { loadTreasury } from "@/lib/treasuryAccount";
import { zar } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * THE TAX YEAR.
 *
 * The South African tax year runs 1 March to 28/29 February, which is the whole
 * reason this screen exists rather than a calendar-year total: a January
 * transaction belongs to the year that started the previous March, and getting
 * that wrong files it in the wrong return.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ───────────────────────────────────────
 * It does not tell anyone what they owe, and it does not classify the net
 * figure as income, a capital gain or a hobby loss. That depends on facts
 * Ascend does not have. It reports what moved, in the periods SARS uses, in a
 * form an accountant can work from — and says plainly that it is not advice.
 */
export default async function TaxPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { tax } = await loadTreasury(supabase, user!.id);

  return (
    <AppShell>
      <Header
        title={`Tax year ${tax.label}`}
        back="/commit/wallet"
        subtitle={`${longDate(tax.start)} to ${longDate(tax.end)}`}
      />

      <section className="mb-chapter">
        <p className="text-micro uppercase text-sage">Net for the year</p>
        <p
          className={`tnum -ml-1 mt-2 font-display text-hero font-semibold ${
            tax.net > 0 ? "text-summit" : "text-snow"
          }`}
        >
          {tax.net < 0 ? `−${zar(Math.abs(tax.net))}` : zar(tax.net)}
        </p>
        <p className="mt-3 max-w-[23rem] text-body text-sage">
          Winnings less what you staked and less platform fees, across{" "}
          <span className="tnum text-snow">{tax.transactions}</span>{" "}
          {tax.transactions === 1 ? "movement" : "movements"}.
        </p>
      </section>

      <dl className="mb-chapter flex flex-wrap gap-x-8 gap-y-4 border-t border-scree/60 pt-4">
        <Figure label="Staked" value={zar(tax.staked)} />
        <Figure label="Won" value={zar(tax.won)} />
        <Figure label="Fees" value={zar(tax.fees)} />
      </dl>

      <div className="mb-chapter">
        <a
          href="/api/treasury/tax"
          className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-field bg-ridge px-4 py-3.5 text-body text-snow ring-1 ring-scree transition hover:bg-scree"
        >
          Download the statement (CSV)
        </a>
      </div>

      <p className="text-meta text-sage/80">
        This is a record of what moved, not tax advice. Whether any of it is taxable — and how —
        depends on your own circumstances, and it is worth twenty minutes with an accountant rather
        than a guess from an app. Refunded stakes are netted out of the staked figure, so a
        challenge you were refunded for does not show as a loss.
      </p>
    </AppShell>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-micro uppercase text-sage">{label}</dt>
      <dd className="tnum mt-1 font-display text-lg text-snow">{value}</dd>
    </div>
  );
}
