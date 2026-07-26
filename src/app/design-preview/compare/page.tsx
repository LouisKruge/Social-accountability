import { notFound } from "next/navigation";

/** Side-by-side mode comparison for the final self-critique. Dev-only. */
export const dynamic = "force-dynamic";

export default function Compare() {
  if (process.env.ALLOW_DESIGN_PREVIEW !== "1") notFound();
  const modes = [
    { q: "", label: "CLIMB — competitive" },
    { q: "?view=commit", label: "COMMIT — trustworthy with money" },
    { q: "?view=elevate", label: "ELEVATE — private, considered" },
  ];
  return (
    <div className="flex gap-4 bg-valley p-4">
      {modes.map((m) => (
        <div key={m.label} className="flex flex-col">
          <p className="mb-2 text-[0.7rem] uppercase tracking-[0.16em] text-sage">{m.label}</p>
          <iframe
            src={`/design-preview${m.q}`}
            width={390}
            height={1150}
            className="rounded-card border border-scree"
            title={m.label}
          />
        </div>
      ))}
    </div>
  );
}
