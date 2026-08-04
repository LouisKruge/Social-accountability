import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { summariseTaxYear, taxCsv, type TaxableMovement } from "@/lib/treasury";

export const dynamic = "force-dynamic";

/**
 * Download your own tax-year statement.
 *
 * The client is RLS-bound, so this can only ever assemble the caller's own
 * movements — there is no user id in the request to tamper with. A 401 rather
 * than a redirect, because this is a file download, not a page.
 *
 * `?year=` takes ANY date inside the wanted tax year; the summariser resolves
 * it to the 1 March – 28/29 February window. Taking a date rather than a label
 * means the caller never has to know which side of the year a January
 * transaction falls on, which is exactly the thing people get wrong.
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const asked = new URL(request.url).searchParams.get("year");
  const anchor =
    asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("wallet_transactions")
    .select("kind, amount, effective_at")
    .eq("user_id", user.id);

  const movements: TaxableMovement[] = (data ?? []).map((m) => ({
    at: m.effective_at,
    kind:
      m.kind === "winnings_credited"
        ? "winnings"
        : m.kind === "fee_charged"
          ? "fee"
          : m.kind === "stake_refunded"
            ? "refund"
            : "stake",
    amount: Number(m.amount ?? 0),
  }));

  const summary = summariseTaxYear(movements, anchor);

  return new NextResponse(taxCsv(summary, movements), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ascend-tax-${summary.label.replace("/", "-")}.csv"`,
      // Personal financial data: never cached by an intermediary.
      "Cache-Control": "no-store, private",
    },
  });
}
