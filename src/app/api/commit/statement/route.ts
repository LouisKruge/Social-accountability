import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadWallet, toCsv } from "@/lib/wallet";

export const dynamic = "force-dynamic";

/**
 * Download your own statement.
 *
 * The client is RLS-bound, so this can only ever assemble the caller's own
 * ledger — there is no user id in the request to tamper with. A 401 rather
 * than a redirect, because this is a file download, not a page.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { ledger } = await loadWallet(supabase, user.id);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(ledger), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ascend-statement-${stamp}.csv"`,
      // A statement is personal financial data: never cached by an intermediary.
      "Cache-Control": "no-store, private",
    },
  });
}
