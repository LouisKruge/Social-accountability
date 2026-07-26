import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadShareByCard } from "@/lib/shareData";
import { Brand } from "@/components/ui";

export const dynamic = "force-dynamic";

const ORDINAL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };
const ordinal = (n: number) => ORDINAL[n] ?? `${n}th`;

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

function valueText(
  metricType: "percentage_change" | "streak",
  pct: number,
  isAbsolute: boolean,
  unit: string | null,
) {
  if (metricType === "streak") return `${pct} ${unit || "day"}${pct === 1 ? "" : "s"}`;
  const sign = pct > 0 ? "+" : "";
  return isAbsolute ? `${sign}${pct}${unit ? ` ${unit}` : ""}` : `${sign}${pct}%`;
}

export async function generateMetadata({
  params,
}: {
  params: { cardId: string };
}): Promise<Metadata> {
  const data = await loadShareByCard(params.cardId);
  if (!data) return { title: "Ascend" };

  const imageUrl = `${siteUrl()}/api/share-card/${data.rankingId}`;
  const value = valueText(data.metricType, data.pctChange, data.isAbsolute, data.unit);
  // A flex, not a tagline.
  const title = `${data.displayName} — ${value} in ${data.categoryName} this week`;
  const description = `${ordinal(data.rank)} in ${data.groupName}. Ranked on rate of improvement, so everyone climbs from their own baseline.`;

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: imageUrl, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  };
}

export default async function SharePage({ params }: { params: { cardId: string } }) {
  const data = await loadShareByCard(params.cardId);
  if (!data) notFound();

  const imageUrl = `/api/share-card/${data.rankingId}`;
  const value = valueText(data.metricType, data.pctChange, data.isAbsolute, data.unit);
  const climbing = data.metricType === "streak" || data.pctChange >= 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[34rem] flex-col px-5 py-8">
      <div className="mb-8">
        <Brand />
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={`${data.displayName}: ${value} in ${data.categoryName}, ${ordinal(data.rank)} in ${data.groupName}`}
        className="w-full rounded-card ring-1 ring-scree"
        width={1200}
        height={630}
      />

      <div className="mt-8">
        <p
          className={`font-display text-4xl font-semibold leading-none tracking-tightest ${
            climbing ? "text-summit" : "text-fall"
          }`}
        >
          {value}
        </p>
        <p className="mt-3 text-lg leading-snug text-snow">
          {data.displayName} is {ordinal(data.rank)} in {data.groupName} this week.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-sage">
          Ascend ranks on rate of improvement, not who started ahead — everyone climbs from their
          own baseline.
        </p>
      </div>

      <div className="mt-9">
        <Link
          href="/signup"
          className="inline-flex w-full items-center justify-center rounded-field bg-summit px-4 py-4 text-sm font-semibold text-valley transition hover:bg-summit-soft"
        >
          Start your own climb
        </Link>
      </div>
    </div>
  );
}
