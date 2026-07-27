import { describe, expect, it } from "vitest";
import {
  AREA_LABEL,
  bestTimeToShoot,
  buildChecklist,
  type PhotoGoal,
  type Setting,
  type ShotConditions,
  type TimeOfDay,
} from "./photoCoach";

const GOALS: PhotoGoal[] = [
  "dating_profile",
  "professional",
  "interview",
  "content_creator",
  "general_confidence",
];
const TIMES: TimeOfDay[] = ["early_morning", "midday", "golden_hour", "evening", "night"];
const SETTINGS: Setting[] = ["indoors_window", "indoors_artificial", "outdoors", "studio"];

const base: ShotConditions = {
  goal: "dating_profile",
  timeOfDay: "golden_hour",
  setting: "outdoors",
  hasHelper: false,
};

describe("buildChecklist — always usable", () => {
  it("produces a checklist for every combination of conditions", () => {
    for (const goal of GOALS) {
      for (const timeOfDay of TIMES) {
        for (const setting of SETTINGS) {
          for (const hasHelper of [true, false]) {
            const c = buildChecklist({ goal, timeOfDay, setting, hasHelper });
            expect(c.steps.length, `${goal}/${timeOfDay}/${setting}`).toBeGreaterThan(4);
            expect(c.headline).toBeDefined();
          }
        }
      }
    }
  });

  it("covers light, camera, framing and the person in every case", () => {
    for (const setting of SETTINGS) {
      const c = buildChecklist({ ...base, setting });
      expect(c.byArea.light.length).toBeGreaterThan(0);
      expect(c.byArea.camera.length).toBeGreaterThan(0);
      expect(c.byArea.framing.length).toBeGreaterThan(0);
      expect(c.byArea.you.length).toBeGreaterThan(0);
    }
  });

  it("leads with a highest-weight step", () => {
    const c = buildChecklist(base);
    expect(c.headline.weight).toBe(3);
    expect(c.steps[0].weight).toBeGreaterThanOrEqual(c.steps[c.steps.length - 1].weight);
  });

  it("gives a reason for every single instruction", () => {
    // A rule without a reason is an order, not coaching.
    for (const goal of GOALS) {
      for (const s of buildChecklist({ ...base, goal }).steps) {
        expect(s.because.length, s.instruction).toBeGreaterThan(20);
      }
    }
  });

  it("is deterministic — the same conditions give the same list", () => {
    const a = buildChecklist(base);
    const b = buildChecklist(base);
    expect(a.steps.map((s) => s.instruction)).toEqual(b.steps.map((s) => s.instruction));
  });
});

describe("buildChecklist — the advice is actually condition-specific", () => {
  it("sends you into shade at midday and behind the sun at golden hour", () => {
    const midday = buildChecklist({ ...base, timeOfDay: "midday" });
    const golden = buildChecklist({ ...base, timeOfDay: "golden_hour" });
    expect(midday.byArea.light[0].instruction).toMatch(/shade/i);
    expect(golden.byArea.light[0].instruction).toMatch(/sun behind you/i);
  });

  it("kills the overhead light indoors", () => {
    const c = buildChecklist({ ...base, setting: "indoors_artificial" });
    expect(c.byArea.light[0].instruction).toMatch(/overhead light off/i);
  });

  it("faces you into the window", () => {
    const c = buildChecklist({ ...base, setting: "indoors_window" });
    expect(c.byArea.light[0].instruction).toMatch(/facing the window/i);
  });

  it("never tells you to use the phone flash at night", () => {
    const c = buildChecklist({ ...base, timeOfDay: "night" });
    expect(c.byArea.light[0].instruction).toMatch(/never use the flash/i);
  });

  it("tells a solo shooter to prop the phone up", () => {
    const solo = buildChecklist({ ...base, hasHelper: false });
    expect(solo.byArea.camera.some((s) => /prop the phone/i.test(s.instruction))).toBe(true);
  });

  it("tells a helper to take several frames", () => {
    const helped = buildChecklist({ ...base, hasHelper: true });
    expect(helped.byArea.camera.some((s) => /five or six/i.test(s.instruction))).toBe(true);
    expect(helped.byArea.camera.some((s) => /prop the phone/i.test(s.instruction))).toBe(false);
  });

  it("frames an interview tighter than a dating photo", () => {
    const interview = buildChecklist({ ...base, goal: "interview" }).byArea.framing[0].instruction;
    const dating = buildChecklist({ ...base, goal: "dating_profile" }).byArea.framing[0].instruction;
    expect(interview).toMatch(/head and shoulders/i);
    expect(dating).toMatch(/waist up/i);
  });

  it("asks a content creator to shoot vertical", () => {
    const c = buildChecklist({ ...base, goal: "content_creator" });
    expect(c.byArea.framing[0].instruction).toMatch(/vertical/i);
  });
});

describe("buildChecklist — it coaches the camera, never the body", () => {
  it("never comments on any part of the person's body", () => {
    // Anatomy words appear legitimately in lighting vocabulary — "shadows under
    // the eyes and nose" describes where light falls, not the person's nose.
    // What counts as commentary is the POSSESSIVE and EVALUATIVE forms, so
    // that is what this asserts against.
    const banned =
      /\b(weight|kilos|slim|thin|fat|skinny|belly|physique|body shape|figure)\b|\byour\s+(jaw|chin|cheekbones?|nose|face shape|build|frame)\b|\b(flatter|flattering|slimming)\b/i;
    for (const goal of GOALS) {
      for (const timeOfDay of TIMES) {
        for (const setting of SETTINGS) {
          for (const s of buildChecklist({ goal, timeOfDay, setting, hasHelper: true }).steps) {
            const text = `${s.instruction} ${s.because}`;
            expect(banned.test(text), text).toBe(false);
          }
        }
      }
    }
  });

  it("frames the one instruction about the person as a camera instruction", () => {
    const c = buildChecklist(base);
    const shoulders = c.steps.find((s) => /shoulders/i.test(s.instruction))!;
    expect(shoulders.because).toMatch(/nothing to do with how you look/i);
  });

  it("blames the situation, not the person, for awkwardness", () => {
    const c = buildChecklist(base);
    const hands = c.steps.find((s) => /hands/i.test(s.instruction))!;
    expect(hands.because).toMatch(/not the person/i);
  });
});

describe("bestTimeToShoot", () => {
  it("names the golden hour outdoors", () => {
    expect(bestTimeToShoot("outdoors")).toMatch(/sunrise|sunset/i);
  });

  it("warns about direct sun through glass", () => {
    expect(bestTimeToShoot("indoors_window")).toMatch(/direct sun/i);
  });

  it("says nothing rather than inventing a best hour where it does not matter", () => {
    expect(bestTimeToShoot("studio")).toBeNull();
    expect(bestTimeToShoot("indoors_artificial")).toBeNull();
  });
});

describe("AREA_LABEL", () => {
  it("labels every area", () => {
    const c = buildChecklist(base);
    for (const s of c.steps) expect(AREA_LABEL[s.area]).toBeTruthy();
  });
});
