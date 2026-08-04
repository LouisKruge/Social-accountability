import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Header } from "@/components/ui";
import { DashSection } from "@/components/dash";
import { PROVIDERS, availableProviders, providerDef, type Provider } from "@/lib/wearables";
import { disconnectDevice } from "./actions";

export const dynamic = "force-dynamic";

const NOTICE: Record<string, string> = {
  ok: "Connected. Your first sync reaches back thirty days.",
  cancelled: "You cancelled at the provider. Nothing was connected.",
  badstate: "That link didn't match the one we issued. Start again from here.",
  nocreds: "That provider isn't configured on this deployment yet.",
  exchangefailed: "The provider refused the connection. Try again.",
  notoken: "The provider didn't return a token. Try again.",
  savefailed: "We couldn't save the connection. Try again.",
};

/**
 * DEVICES.
 *
 * ── WHAT THIS SCREEN REFUSES TO DO ───────────────────────────────────────────
 * It does not render a connect button for a provider this deployment has no
 * credentials for. A button that fails after the tap is worse than an absent
 * one, because the person has already decided to trust you by the time it
 * breaks.
 *
 * Apple Health gets no connect button at all, and says why: HealthKit has no
 * server API, so there is nothing to authorize against. Everything else in this
 * industry ships that button anyway.
 */
export default async function DevicesPage({
  searchParams,
}: {
  searchParams: { connected?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase.rpc("my_wearables");
  const connections = (data ?? []) as {
    id: string;
    provider: Provider;
    status: string;
    scope: string | null;
    connected_at: string;
    last_synced_on: string | null;
    last_error: string | null;
    days_from_this_source: number;
  }[];

  const connected = new Map(connections.map((c) => [c.provider, c]));
  const usable = availableProviders(process.env as Record<string, string | undefined>);
  const notice = searchParams.connected ? NOTICE[searchParams.connected] : null;

  return (
    <AppShell>
      <Header
        title="Devices"
        back="/you"
        subtitle="Where your verified days come from."
      />

      {notice && (
        <p
          className={`mb-block rounded-field px-4 py-3 text-body ring-1 ${
            searchParams.connected === "ok"
              ? "bg-ridge text-snow ring-scree"
              : "bg-fall/10 text-fall ring-fall/30"
          }`}
        >
          {notice}
        </p>
      )}

      <DashSection title="Connected">
        {connections.length === 0 ? (
          <p className="text-meta text-sage">
            Nothing connected. Every day you log is counted as manually entered, which the integrity
            engine weights lower than a device reading — see{" "}
            <Link href="/commit/trust" className="text-snow underline decoration-scree underline-offset-4">
              the trust centre
            </Link>
            .
          </p>
        ) : (
          <ul className="border-t border-scree/60">
            {connections.map((c) => {
              const def = providerDef(c.provider);
              return (
                <li key={c.id} className="border-b border-scree/40 py-4 last:border-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-body text-snow">{def.name}</span>
                    <span
                      className={`shrink-0 text-caption ${
                        c.status === "active" ? "text-sage" : "text-fall"
                      }`}
                    >
                      {c.status === "active"
                        ? c.last_synced_on
                          ? `Synced ${c.last_synced_on}`
                          : "Not synced yet"
                        : c.status === "needs_reauth"
                          ? "Reconnect needed"
                          : "Error"}
                    </span>
                  </div>
                  <p className="mt-1 text-caption text-sage">
                    <span className="tnum text-snow">{c.days_from_this_source}</span>{" "}
                    {c.days_from_this_source === 1 ? "day" : "days"} came from this source.{" "}
                    {def.scopeBlurb}
                  </p>
                  {c.last_error && <p className="mt-1.5 text-caption text-fall">{c.last_error}</p>}
                  <form action={disconnectDevice} className="mt-2.5">
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      className="text-caption text-sage underline decoration-scree underline-offset-4 transition hover:text-snow"
                    >
                      Disconnect
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </DashSection>

      <DashSection title="Available">
        <ul className="border-t border-scree/60">
          {PROVIDERS.map((p) => {
            const already = connected.has(p.key);
            const ready = usable.includes(p.key);
            return (
              <li key={p.key} className="border-b border-scree/40 py-4 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-body text-snow">{p.name}</span>
                  {already ? (
                    <span className="shrink-0 text-caption text-sage">Connected</span>
                  ) : p.pull && ready ? (
                    <a
                      href={`/api/wearables/${p.key}/start`}
                      className="shrink-0 text-caption text-ice transition hover:text-snow"
                    >
                      Connect →
                    </a>
                  ) : (
                    <span className="shrink-0 text-caption text-sage/60">
                      {p.pull ? "Not yet available" : "From the iPhone app"}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-caption text-sage">{p.scopeBlurb}</p>
                {!p.pull && (
                  <p className="mt-1.5 text-caption text-sage/70">
                    Apple Health has no server, so nothing can connect to it from here. Your iPhone
                    sends the totals directly, and only while you have the app open.
                  </p>
                )}
                {p.pull && !ready && !already && (
                  <p className="mt-1.5 text-caption text-sage/70">
                    This deployment has no {p.name} credentials yet. We don&apos;t show a button
                    that would fail after you tapped it.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </DashSection>

      <p className="text-meta text-sage/80">
        Ascend reads daily step totals and nothing else — not sleep, not heart rate, not weight, not
        location. Disconnecting stops the sync immediately and deletes the stored authorisation; the
        days already verified stay on your record, because deleting them would rewrite challenges
        that are already settled. {user ? "" : ""}
      </p>
    </AppShell>
  );
}
