/**
 * THE POOL — Commit's signature element.
 *
 * Derived from the same altitude logic as the ascent line rather than being a
 * generic progress bar: staked money POOLS IN THE VALLEY and then CLIMBS to
 * whoever hit their target. So the basin sits low, fills in ICE (staked, at
 * rest, not yours yet), and only a confirmed payout is ever drawn in GOLD.
 *
 * The vessel illustrates; it never replaces the figure. Every usage renders the
 * exact rand amount alongside it.
 *
 * Motion here is deliberately slower than Climb — this is money, not a
 * celebration. Under prefers-reduced-motion the level simply renders at its
 * final height (see globals.css), which still communicates the same thing.
 */
export function Pool({
  /** Confirmed stakes currently in the pool, in rand. */
  filled,
  /** Pool size if every slot is taken, in rand. */
  capacity,
  /** Number of people who have staked. */
  participants,
  /** Optional: draw the level in gold because this is a confirmed payout. */
  confirmed = false,
  height = 96,
}: {
  filled: number;
  capacity: number;
  participants: number;
  confirmed?: boolean;
  height?: number;
}) {
  const ratio = capacity > 0 ? Math.min(1, filled / capacity) : 0;
  const W = 260;
  const H = height;
  const top = 8; // rim
  const floor = H - 12; // inner floor
  const inset = 34; // wall inset — a deep vessel, not a shallow tray
  const levelY = floor - (floor - top) * ratio;
  const uid = `${confirmed ? "gold" : "ice"}-${height}`;

  const line = confirmed ? "#E8B84B" : "#7FDCC0";
  const body = confirmed ? "rgba(232,184,75,0.14)" : "rgba(127,220,192,0.12)";
  const pips = Math.min(participants, 20);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      role="img"
      aria-label={`Pool: R${filled.toLocaleString("en-ZA")} held from ${participants} ${
        participants === 1 ? "person" : "people"
      }`}
    >
      {/* the empty vessel — visible walls so the unfilled part reads clearly */}
      <clipPath id={`vessel-${uid}`}>
        <path d={`M ${inset} ${top} L ${inset + 8} ${floor} L ${W - inset - 8} ${floor} L ${W - inset} ${top} Z`} />
      </clipPath>
      <path
        d={`M ${inset} ${top} L ${inset + 8} ${floor} L ${W - inset - 8} ${floor} L ${W - inset} ${top} Z`}
        fill="#0E1712"
        stroke="#2A3A32"
        strokeWidth="1.25"
      />

      {/* what is actually in it */}
      <g clipPath={`url(#vessel-${uid})`}>
        <rect
          x="0"
          y={levelY}
          width={W}
          height={H}
          fill={body}
          style={{ transition: "y 900ms cubic-bezier(0.22,0.61,0.36,1)" }}
        />
        {/* the surface: the one bright line, so the level is unmistakable */}
        <rect x="0" y={levelY - 1} width={W} height="2" fill={line} opacity="0.95" />
      </g>

      {/* one pip per person already in — the trust signal, countable at a glance */}
      {Array.from({ length: pips }).map((_, i) => {
        const span = W - inset * 2 - 24;
        const step = pips > 1 ? span / (pips - 1) : 0;
        const x = pips === 1 ? W / 2 : inset + 12 + step * i;
        return <circle key={i} cx={x} cy={top - 4} r="1.8" fill={line} opacity="0.8" />;
      })}
    </svg>
  );
}

/**
 * Pool summary block — the vessel plus the exact figures it stands for. Use this
 * rather than <Pool /> alone anywhere money is shown, so the number is never
 * replaced by the picture.
 */
export function PoolSummary({
  filled,
  capacity,
  participants,
  stakeAmount,
}: {
  filled: number;
  capacity: number;
  participants: number;
  stakeAmount: number;
}) {
  return (
    <div>
      <Pool filled={filled} capacity={capacity} participants={participants} />
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-sage">In the pool</dt>
        <dd className="tnum text-right text-snow">R{filled.toLocaleString("en-ZA")}</dd>
        <dt className="text-sage">Staked so far</dt>
        <dd className="tnum text-right text-snow">
          {participants} {participants === 1 ? "person" : "people"}
        </dd>
        <dt className="text-sage">Stake per person</dt>
        <dd className="tnum text-right text-snow">R{stakeAmount.toLocaleString("en-ZA")}</dd>
      </dl>
    </div>
  );
}
