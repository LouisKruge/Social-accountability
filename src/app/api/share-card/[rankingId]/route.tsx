import { ImageResponse } from "next/og";
import { loadShareByRanking } from "@/lib/shareData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDINAL = ["", "1st", "2nd", "3rd"];
const ordinal = (n: number) => ORDINAL[n] ?? `${n}th`;

function valueText(
  metricType: "percentage_change" | "streak",
  pct: number,
  isAbsolute: boolean,
  unit: string | null,
): string {
  if (metricType === "streak") return `${pct} ${unit || "day"}${pct === 1 ? "" : "s"}`;
  const sign = pct > 0 ? "+" : "";
  if (isAbsolute) return `${sign}${pct}${unit ? ` ${unit}` : ""}`;
  return `${sign}${pct}%`;
}

/**
 * The rank card — Ascend's advert to the outside world.
 *
 * The ascent line is the dominant visual: it climbs from the shared origin at
 * the lower left into summit light at the upper right, ending exactly where the
 * headline number sits. Everything else is deliberately quiet so the climb and
 * the number carry it.
 */
export async function GET(_req: Request, { params }: { params: { rankingId: string } }) {
  // Design harness: fixed sample card for local review. ALLOW_DESIGN_PREVIEW is
  // only ever set locally, so this branch does not exist on the deployed site.
  const demo =
    process.env.ALLOW_DESIGN_PREVIEW === "1" && params.rankingId === "demo"
      ? {
          cardId: "demo",
          rankingId: "demo",
          displayName: "Thandiwe",
          rank: 1,
          pctChange: 41.2,
          isAbsolute: false,
          categoryName: "Savings",
          metricType: "percentage_change" as const,
          unit: "ZAR",
          groupName: "Payday Warriors",
          periodStart: "2026-07-20",
          periodEnd: "2026-07-26",
        }
      : null;

  const data = demo ?? (await loadShareByRanking(params.rankingId).catch(() => null));

  const W = 1200;
  const H = 630;

  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            background: "#0E1712",
            color: "#F3F1EA",
            fontSize: 48,
          }}
        >
          Ascend
        </div>
      ),
      { width: W, height: H },
    );
  }

  const climbing = data.metricType === "streak" || data.pctChange >= 0;
  const tipColor = climbing ? "#E8B84B" : "#E06D5A";

  /*
   * Composition: the climb occupies the RIGHT half, the type the LEFT. An
   * earlier full-width sweep ran straight through the headline number, which
   * read as an accident rather than a composition. Split zones keep both the
   * trajectory and the number fully legible at WhatsApp-thumbnail size.
   */
  const path =
    "M 620 468 C 726 468, 778 392, 872 344 C 966 296, 1032 244, 1122 142";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          width: "100%",
          height: "100%",
          background: "#0E1712",
          color: "#F3F1EA",
          fontFamily: "sans-serif",
          padding: "56px 64px",
        }}
      >
        {/* summit light, top-right — where the climb lands */}
        <div
          style={{
            position: "absolute",
            top: -300,
            right: -230,
            width: 820,
            height: 660,
            borderRadius: 9999,
            background:
              "radial-gradient(circle, rgba(232,184,75,0.20) 0%, rgba(232,184,75,0.05) 42%, rgba(232,184,75,0) 68%)",
          }}
        />

        {/* the ascent line */}
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <defs>
            <linearGradient
              id="climb"
              gradientUnits="userSpaceOnUse"
              x1="620"
              y1="468"
              x2="1122"
              y2="142"
            >
              <stop offset="0%" stopColor="#4FB196" />
              <stop offset="45%" stopColor="#7FDCC0" />
              <stop offset="100%" stopColor={tipColor} />
            </linearGradient>
          </defs>
          {/* the shared starting line everyone climbs from */}
          <line x1="620" y1="468" x2="1136" y2="468" stroke="#2A3A32" strokeWidth="2" strokeDasharray="3 10" />
          <circle cx="620" cy="468" r="8" fill="#4FB196" />
          <path d={path} fill="none" stroke="url(#climb)" strokeWidth="7" strokeLinecap="round" />
          <circle cx="1122" cy="142" r="12" fill={tipColor} />
        </svg>

        {/* brand, quiet, top-left */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          <svg width="30" height="30" viewBox="0 0 24 24">
            <path
              d="M4 18 L10 12 L14 15 L20 6"
              fill="none"
              stroke="#7FDCC0"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="20" cy="6" r="2" fill="#E8B84B" />
          </svg>
          <div style={{ fontSize: 27, fontWeight: 600, letterSpacing: -0.5, color: "#F3F1EA" }}>
            Ascend
          </div>
        </div>

        {/* the payload */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            position: "relative",
            maxWidth: 600,
          }}
        >
          <div style={{ fontSize: 30, color: "#8A9A90", letterSpacing: 0.5 }}>
            {`${data.displayName} · ${data.categoryName}`}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 124,
              fontWeight: 700,
              letterSpacing: -5,
              lineHeight: 1,
              marginTop: 10,
              color: climbing ? "#E8B84B" : "#E06D5A",
            }}
          >
            {valueText(data.metricType, data.pctChange, data.isAbsolute, data.unit)}
          </div>
          <div style={{ display: "flex", fontSize: 34, marginTop: 18, color: "#F3F1EA" }}>
            {`${ordinal(data.rank)} in ${data.groupName} this week`}
          </div>
        </div>
      </div>
    ),
    { width: W, height: H },
  );
}
