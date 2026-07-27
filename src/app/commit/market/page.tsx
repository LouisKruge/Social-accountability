import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ModulePage } from "@/components/module-shell";
import { loadExchange } from "@/lib/exchange";
import { MarketView } from "./market-view";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = await loadExchange(supabase, user!.id);

  return (
    <ModulePage
      state={state}
      moduleKey="market"
      action={
        <Link
          href="/commit/new"
          className="shrink-0 rounded-field bg-ice px-3.5 py-2 text-xs font-semibold text-valley transition hover:bg-ice-soft"
        >
          List one
        </Link>
      }
    >
      <MarketView open={state.dashboard.open} />
    </ModulePage>
  );
}
