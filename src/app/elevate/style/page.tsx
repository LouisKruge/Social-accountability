import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StudioPage } from "@/components/elevate-shell";
import { EmptyState } from "@/components/ui";
import { loadElevate } from "@/lib/elevate";
import { buildOutfits, findGaps, costPerWear, CAPSULE, type Occasion } from "@/lib/wardrobe";
import { zar } from "@/lib/format";

export const dynamic = "force-dynamic";

const OCCASIONS: Occasion[] = ["everyday", "work", "formal", "date", "gym", "travel", "outdoors"];

/**
 * STYLE STUDIO — outfits from clothes you actually own.
 *
 * The outfit builder is rule-based and runs on the server in microseconds. That
 * matters beyond performance: every suggestion can state the rule that produced
 * it, so "why this?" always has an answer.
 */
export default async function StyleStudioPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const state = await loadElevate(supabase, user!.id);
  const { wardrobe, wardrobeStats } = state;

  const plans = OCCASIONS.map((o) => ({
    occasion: o,
    outfits: buildOutfits(wardrobe, o, "all", 2),
    gaps: findGaps(wardrobe, o),
  })).filter((p) => p.outfits.length > 0 || wardrobe.some((i) => i.occasions.includes(p.occasion)));

  return (
    <StudioPage
      state={state}
      studioKey="style"
      action={
        <Link
          href="/elevate/style/add"
          className="shrink-0 rounded-field bg-snow px-3.5 py-2 text-xs font-semibold text-valley transition hover:bg-snow/90"
        >
          Add an item
        </Link>
      }
    >
      {wardrobe.length === 0 ? (
        <EmptyState
          title="Nothing catalogued yet"
          body="Photograph a few things you already own — on a hanger or laid flat. Once Elevate knows what's in your wardrobe it can plan outfits from it instead of telling you to go shopping."
          cta={
            <Link
              href="/elevate/style/add"
              className="inline-flex w-full items-center justify-center rounded-field bg-snow px-4 py-3.5 text-sm font-semibold text-valley transition hover:bg-snow/90"
            >
              Add your first item
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-7 grid grid-cols-3 gap-2">
            <Tile label="Items" value={String(wardrobeStats.total)} />
            <Tile
              label="Never worn"
              value={String(wardrobeStats.neverWornCount)}
              hint={wardrobeStats.neverWornCount > 0 ? "worth a look" : undefined}
            />
            <Tile
              label="Best value"
              value={wardrobeStats.bestValue ? zar(wardrobeStats.bestValue.cpw) : "—"}
              hint={wardrobeStats.bestValue ? "per wear" : "add prices"}
            />
          </div>

          {plans.map((p) => (
            <section key={p.occasion} className="mb-8">
              <h2 className="mb-3 text-micro uppercase text-sage">{p.occasion}</h2>

              {p.outfits.length > 0 ? (
                <div className="space-y-2.5">
                  {p.outfits.map((o, i) => (
                    <article
                      key={i}
                      className="rounded-card bg-slope/70 p-4 ring-1 ring-scree/60"
                    >
                      <ul className="flex flex-wrap gap-1.5">
                        {o.items.map((it) => (
                          <li
                            key={it.id}
                            className="rounded-full bg-valley/70 px-2.5 py-1 text-caption text-snow/90 ring-1 ring-scree/60"
                          >
                            {it.name}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-meta text-sage">{o.rationale}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-card bg-slope/40 px-4 py-3 text-meta text-sage ring-1 ring-scree/40">
                  Not enough catalogued for a complete {p.occasion} outfit yet.
                </p>
              )}

              {p.gaps.length > 0 && (
                <ul className="mt-2.5 space-y-1.5">
                  {p.gaps.map((g) => (
                    <li
                      key={g.category}
                      className="flex gap-2.5 rounded-field bg-valley/50 px-3.5 py-2.5 ring-1 ring-scree/40"
                    >
                      <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sage" />
                      <span className="text-caption leading-relaxed text-sage">{g.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section>
            <h2 className="mb-3 text-micro uppercase text-sage">Everything you own</h2>
            <ul className="space-y-1.5">
              {wardrobe.map((i) => {
                const cpw = costPerWear(i.priceZar, i.wearCount);
                return (
                  <li
                    key={i.id}
                    className="flex items-center gap-3 rounded-card bg-slope/50 px-4 py-3 ring-1 ring-scree/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-snow/90">{i.name}</p>
                      <p className="mt-0.5 text-caption text-sage">
                        {i.category}
                        {i.colour && ` · ${i.colour}`}
                        {i.occasions.length > 0 && ` · ${i.occasions.join(", ")}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum text-caption text-sage">
                        {i.wearCount === 0 ? "never worn" : `${i.wearCount} wears`}
                      </p>
                      {cpw !== null && (
                        <p className="tnum text-caption text-snow/70">{zar(cpw)}/wear</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <p className="mt-8 text-center text-meta text-sage/70">
        Photographs here are of clothes, not of you — Elevate catalogues the garment and never
        looks at the person wearing it.
      </p>
    </StudioPage>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-field bg-slope/60 p-3.5 ring-1 ring-scree/50">
      <p className="text-micro uppercase text-sage">{label}</p>
      <p className="tnum mt-1 font-display text-xl font-semibold text-snow">{value}</p>
      {hint && <p className="mt-0.5 text-[0.62rem] text-sage/80">{hint}</p>}
    </div>
  );
}
