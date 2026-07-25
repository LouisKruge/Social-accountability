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

function changeText(pct: number, isAbsolute: boolean, unit: string | null) {
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
  const title = `${data.displayName} is ${ordinal(data.rank)} in ${data.categoryName} on Ascend`;
  const description = `${changeText(data.pctChange, data.isAbsolute, data.unit)} this week in ${data.groupName}. Start low, climb fast.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  };
}

export default async function SharePage({ params }: { params: { cardId: string } }) {
  const data = await loadShareByCard(params.cardId);
  if (!data) notFound();

  const imageUrl = `/api/share-card/${data.rankingId}`;
  const positive = data.pctChange >= 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center px-4 py-10">
      <div className="mb-6 self-start">
        <Brand />
      </div>

      {/* Rendered rank card image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={`${data.displayName} — ${ordinal(data.rank)} in ${data.categoryName}`}
        className="w-full rounded-2xl border border-slate-200 shadow-md"
        width={1200}
        height={630}
      />

      <div className="mt-6 text-center">
        <p className="text-2xl font-black tracking-tight text-slate-900">
          {data.displayName} is {ordinal(data.rank)} in {data.categoryName}
        </p>
        <p className={`mt-1 text-lg font-bold ${positive ? "text-accent-600" : "text-red-500"}`}>
          {changeText(data.pctChange, data.isAbsolute, data.unit)} this week
        </p>
        <p className="mt-1 text-sm text-slate-500">
          in {data.groupName} — ranked by rate of improvement, not absolute numbers.
        </p>
      </div>

      <div className="mt-8 w-full space-y-3">
        <Link
          href="/signup"
          className="inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white"
        >
          Start your own climb
        </Link>
        <p className="text-center text-xs text-slate-400">
          Ascend — compete with friends on how fast you improve.
        </p>
      </div>
    </div>
  );
}
