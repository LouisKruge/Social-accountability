import { createClient } from "@/lib/supabase/server";
import { ExchangeTerminal } from "@/components/exchange-terminal";
import { loadExchange } from "@/lib/exchange";

export const dynamic = "force-dynamic";

export default async function CommitPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <ExchangeTerminal state={await loadExchange(supabase, user!.id)} />;
}
