"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AREA_LABEL,
  bestTimeToShoot,
  buildChecklist,
  type PhotoGoal,
  type Setting,
  type TimeOfDay,
} from "@/lib/photoCoach";

const GOALS: { key: PhotoGoal; label: string }[] = [
  { key: "dating_profile", label: "Dating profile" },
  { key: "professional", label: "Professional" },
  { key: "interview", label: "Interview" },
  { key: "content_creator", label: "Content" },
  { key: "general_confidence", label: "Just a good one" },
];

const SETTINGS: { key: Setting; label: string }[] = [
  { key: "indoors_window", label: "Indoors, by a window" },
  { key: "indoors_artificial", label: "Indoors, lights on" },
  { key: "outdoors", label: "Outdoors" },
  { key: "studio", label: "Studio" },
];

const TIMES: { key: TimeOfDay; label: string }[] = [
  { key: "early_morning", label: "Early" },
  { key: "midday", label: "Midday" },
  { key: "golden_hour", label: "Golden hour" },
  { key: "evening", label: "Evening" },
  { key: "night", label: "Night" },
];

/**
 * The shot list, built live as the conditions change.
 *
 * No upload, no waiting, no API call — this is the one part of Elevate that
 * runs entirely on the device, because the answer is known before the photo
 * exists. It is also the only part that can actually change the photograph.
 */
export function PhotoView({ defaultGoal }: { defaultGoal: PhotoGoal }) {
  const reduce = useReducedMotion();
  const [goal, setGoal] = useState<PhotoGoal>(defaultGoal);
  const [setting, setSetting] = useState<Setting>("indoors_window");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("golden_hour");
  const [hasHelper, setHasHelper] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());

  const checklist = useMemo(
    () => buildChecklist({ goal, setting, timeOfDay, hasHelper }),
    [goal, setting, timeOfDay, hasHelper],
  );
  const timing = bestTimeToShoot(setting);
  const areas = (["light", "camera", "framing", "setting", "you"] as const).filter(
    (a) => checklist.byArea[a].length > 0,
  );

  const toggle = (k: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <>
      {/* ── Conditions ──────────────────────────────────────────────────── */}
      <div className="mb-6 space-y-3 rounded-card bg-slope/60 p-4 ring-1 ring-scree/50">
        <Row label="Shooting for">
          {GOALS.map((g) => (
            <Chip key={g.key} on={goal === g.key} onClick={() => setGoal(g.key)}>
              {g.label}
            </Chip>
          ))}
        </Row>
        <Row label="Where">
          {SETTINGS.map((s) => (
            <Chip key={s.key} on={setting === s.key} onClick={() => setSetting(s.key)}>
              {s.label}
            </Chip>
          ))}
        </Row>
        {setting === "outdoors" && (
          <Row label="When">
            {TIMES.map((t) => (
              <Chip key={t.key} on={timeOfDay === t.key} onClick={() => setTimeOfDay(t.key)}>
                {t.label}
              </Chip>
            ))}
          </Row>
        )}
        <Row label="Camera held by">
          <Chip on={!hasHelper} onClick={() => setHasHelper(false)}>
            Just me
          </Chip>
          <Chip on={hasHelper} onClick={() => setHasHelper(true)}>
            Someone else
          </Chip>
        </Row>
      </div>

      {/* ── The one that matters most ───────────────────────────────────── */}
      <div className="mb-6 rounded-card bg-slope p-5 ring-1 ring-snow/20">
        <p className="text-[0.62rem] uppercase tracking-[0.16em] text-sage">
          If you only do one thing
        </p>
        <p className="mt-2 font-display text-lg font-semibold leading-snug tracking-tight text-snow">
          {checklist.headline.instruction}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-sage">{checklist.headline.because}</p>
      </div>

      {timing && (
        <p className="mb-6 rounded-field bg-valley/60 px-4 py-3 text-xs leading-relaxed text-sage ring-1 ring-scree/60">
          <span className="text-snow/90">Best time:</span> {timing}
        </p>
      )}

      {/* ── The full list, grouped, tickable ────────────────────────────── */}
      <div className="space-y-6">
        {areas.map((area) => (
          <section key={area}>
            <h2 className="mb-2.5 text-xs uppercase tracking-[0.16em] text-sage">
              {AREA_LABEL[area]}
            </h2>
            <ul className="space-y-1.5">
              {checklist.byArea[area].map((s, i) => {
                const key = `${area}-${i}`;
                const ticked = done.has(key);
                return (
                  <motion.li
                    key={key}
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduce ? 0 : 0.25, delay: reduce ? 0 : i * 0.03 }}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      aria-pressed={ticked}
                      className={`flex w-full items-start gap-3 rounded-card px-4 py-3.5 text-left ring-1 transition ${
                        ticked
                          ? "bg-slope/40 ring-scree/40"
                          : "bg-slope/70 ring-scree/60 hover:bg-ridge"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-[0.25rem] ring-1 transition ${
                          ticked ? "bg-snow text-valley ring-snow" : "ring-scree"
                        }`}
                      >
                        {ticked && <span className="text-[0.6rem] leading-none">✓</span>}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-sm leading-snug ${
                            ticked ? "text-sage line-through" : "text-snow/90"
                          }`}
                        >
                          {s.instruction}
                        </span>
                        <span className="mt-1 block text-[0.68rem] leading-relaxed text-sage/80">
                          {s.because}
                        </span>
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-sage/70">
        {done.size} of {checklist.steps.length} ticked. This is a camera checklist — it never
        comments on you, only on the light, the lens and the frame.
      </p>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[0.62rem] uppercase tracking-[0.14em] text-sage">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-3 py-1.5 text-[0.68rem] ring-1 transition ${
        on ? "bg-snow/12 text-snow ring-snow/25" : "bg-valley/60 text-sage ring-scree/60 hover:text-snow"
      }`}
    >
      {children}
    </button>
  );
}
