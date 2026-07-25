import { ImageResponse } from "next/og";
import { loadShareByRanking } from "@/lib/shareData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDINAL = ["", "1st", "2nd", "3rd"];

function ordinal(n: number): string {
  return ORDINAL[n] ?? `${n}th`;
}

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
 * Server-rendered branded PNG (1200×630) for a user's weekly rank. Public: it's
 * meant to be shared. Renders only a ranking a user turned into a PUBLIC card,
 * and only the safe derived fields (name, rank, % change).
 */
export async function GET(_req: Request, { params }: { params: { rankingId: string } }) {
  const data = await loadShareByRanking(params.rankingId).catch(() => null);

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
            background: "#0f172a",
            color: "white",
            fontSize: 48,
          }}
        >
          Ascend
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const positive = data.metricType === "streak" || data.pctChange >= 0;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "72px",
          background: "linear-gradient(135deg, #4f46e5 0%, #312e81 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              width: 56,
              height: 56,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              background: "white",
              color: "#4f46e5",
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            ▲
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Ascend</div>
        </div>

        {/* Rank */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div style={{ fontSize: 30, opacity: 0.85 }}>{data.categoryName}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 8 }}>
            <div style={{ fontSize: 150, fontWeight: 900, lineHeight: 1 }}>
              {ordinal(data.rank)}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 72,
                fontWeight: 800,
                color: positive ? "#a3e635" : "#fca5a5",
              }}
            >
              {valueText(data.metricType, data.pctChange, data.isAbsolute, data.unit)}
            </div>
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, marginTop: 20 }}>{data.displayName}</div>
          <div style={{ fontSize: 26, opacity: 0.8, marginTop: 4 }}>
            {data.groupName} · rate of improvement, week of {data.periodStart}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", marginTop: 40, fontSize: 24, opacity: 0.75 }}>
          Start low. Climb fast.
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
