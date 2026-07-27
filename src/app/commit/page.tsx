import { createClient } from "@/lib/supabase/server";
import { ExchangeHome } from "@/components/exchange-home";
import { loadExchange } from "@/lib/exchange";

export const dynamic = "force-dynamic";

export default async function CommitPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <ExchangeHome state={await loadExchange(supabase, user!.id)} />;
}
