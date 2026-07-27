// ─────────────────────────────────────────────────────────────────────────────
// PHOTO COACH — the checklist you get BEFORE the photo, not after it.
//
// Every other part of Elevate looks at a picture that already exists and says
// what went wrong. This module is the only one that can change the picture,
// which makes it the highest-leverage thing in the product: a shot list handed
// over before someone opens the camera is worth more than any critique
// afterwards.
//
// It is deliberately PURE and RULE-BASED, not a model call. Good photographic
// advice is not a matter of opinion — the sun is where it is, a phone's
// short lens distorts at close range whoever is holding it — and encoding it as
// rules means the advice is instant, free, works offline, is identical for
// everyone, and can be tested. A model would add latency and variance to
// answers that do not vary.
//
// ── SCOPE ────────────────────────────────────────────────────────────────────
// Camera, light, framing, setting, and what to do with your hands. Nothing about
// the person's body or face. "Turn your shoulders 30° off-camera" is a camera
// instruction; "your jaw looks better from the left" is a judgement about a
// person, and this module does not make those.
// ─────────────────────────────────────────────────────────────────────────────

export type PhotoGoal =
  | "dating_profile"
  | "professional"
  | "interview"
  | "content_creator"
  | "general_confidence";

export type TimeOfDay = "early_morning" | "midday" | "golden_hour" | "evening" | "night";
export type Setting = "indoors_window" | "indoors_artificial" | "outdoors" | "studio";

export interface ShotConditions {
  goal: PhotoGoal;
  timeOfDay: TimeOfDay;
  setting: Setting;
  /** Whether someone else is holding the camera. Changes what is achievable. */
  hasHelper: boolean;
}

export type ChecklistArea = "light" | "camera" | "framing" | "setting" | "you";

export interface ChecklistStep {
  area: ChecklistArea;
  instruction: string;
  /** Why it works. A rule without a reason is not coaching. */
  because: string;
  /** 1 = worth doing, 3 = this is the one that matters most. */
  weight: 1 | 2 | 3;
}

export const AREA_LABEL: Record<ChecklistArea, string> = {
  light: "Light",
  camera: "Camera",
  framing: "Framing",
  setting: "Background",
  you: "You",
};

// ── Light ────────────────────────────────────────────────────────────────────

function lightSteps(c: ShotConditions): ChecklistStep[] {
  const steps: ChecklistStep[] = [];

  if (c.setting === "indoors_window") {
    steps.push({
      area: "light",
      instruction: "Stand facing the window, about a metre back from it.",
      because:
        "A window is a big, soft light source. Facing it fills in shadows under the eyes and nose; standing with your back to it turns you into a silhouette.",
      weight: 3,
    });
  }
  if (c.setting === "indoors_artificial") {
    steps.push({
      area: "light",
      instruction: "Turn the overhead light off and put a lamp at face height in front of you.",
      because:
        "Ceiling lights come straight down, which drops hard shadows into the eye sockets and under the chin. Light from in front and slightly above is what studios recreate.",
      weight: 3,
    });
  }
  if (c.setting === "outdoors") {
    if (c.timeOfDay === "midday") {
      steps.push({
        area: "light",
        instruction: "Find open shade — a doorway, under a tree, the shadow side of a building.",
        because:
          "Midday sun is directly overhead and unforgiving. Open shade gives you the same brightness without the hard shadows, and you stop squinting.",
        weight: 3,
      });
    } else if (c.timeOfDay === "golden_hour") {
      steps.push({
        area: "light",
        instruction: "Put the sun behind you and slightly to one side, and expose for your face.",
        because:
          "Low sun behind you separates you from the background and lights your hair, while the sky in front still fills your face. This is the hour photographers plan around.",
        weight: 3,
      });
    } else if (c.timeOfDay === "night") {
      steps.push({
        area: "light",
        instruction: "Find a shopfront, a lit doorway, or stand near a streetlight — never use the flash.",
        because:
          "A phone flash is a tiny light right next to the lens: it flattens everything and turns the background black. Any existing soft light will look better.",
        weight: 3,
      });
    } else {
      steps.push({
        area: "light",
        instruction: "Keep the sun to one side rather than straight ahead or straight behind.",
        because: "Side light gives shape. Straight-on light is flat; straight-behind is a silhouette.",
        weight: 2,
      });
    }
  }
  if (c.setting === "studio") {
    steps.push({
      area: "light",
      instruction: "One key light at 45° to one side and slightly above eye level.",
      because:
        "This is the standard portrait setup because it gives shape without drama. Add a reflector opposite if the shadow side goes too dark.",
      weight: 3,
    });
  }
  return steps;
}

// ── Camera ───────────────────────────────────────────────────────────────────

function cameraSteps(c: ShotConditions): ChecklistStep[] {
  const steps: ChecklistStep[] = [
    {
      area: "camera",
      instruction: "Put the lens at your own eye level, not above or below it.",
      because:
        "A camera above you shrinks everything below it; a camera below points up and distorts the same way. Eye level is neutral, and it is what someone standing in front of you actually sees.",
      weight: 3,
    },
    {
      area: "camera",
      instruction: "Step back and zoom in slightly rather than holding the phone close.",
      because:
        "A phone's wide lens stretches whatever is nearest to it. Distance plus a little zoom gives natural proportions — this is the single most common phone-photo mistake.",
      weight: 3,
    },
  ];

  if (!c.hasHelper) {
    steps.push({
      area: "camera",
      instruction: "Prop the phone up and use the timer or your headphone volume button.",
      because:
        "An outstretched arm forces the lens close and pulls the frame off-level. Propping it up buys you distance and both hands.",
      weight: 3,
    });
    steps.push({
      area: "camera",
      instruction: "Shoot the back camera, not the selfie one.",
      because:
        "On nearly every phone the rear camera has a better sensor and lens. A mirror or a timer gets you the same shot at higher quality.",
      weight: 2,
    });
  } else {
    steps.push({
      area: "camera",
      instruction: "Ask them to take five or six, not one.",
      because:
        "Expression varies frame to frame. Nobody's best photograph is their first one, and choosing from six costs nothing.",
      weight: 2,
    });
  }
  return steps;
}

// ── Framing, setting, and what you do ────────────────────────────────────────

function framingSteps(c: ShotConditions): ChecklistStep[] {
  const goalFraming: Record<PhotoGoal, ChecklistStep> = {
    dating_profile: {
      area: "framing",
      instruction: "Frame from roughly the waist up, with your eyes about a third down the frame.",
      because:
        "Close enough to read your expression, wide enough to show context. Eyes on the upper third is where people look first.",
      weight: 3,
    },
    professional: {
      area: "framing",
      instruction: "Head and shoulders, with a little space above your head.",
      because:
        "A headshot is about the face. Too much room above wastes the frame; none at all feels cramped.",
      weight: 3,
    },
    interview: {
      area: "framing",
      instruction: "Head and shoulders, square to camera, plain background.",
      because:
        "An interview photo should be legible at thumbnail size and give nothing to be distracted by.",
      weight: 3,
    },
    content_creator: {
      area: "framing",
      instruction: "Shoot vertical, and leave headroom you can crop into later.",
      because:
        "Every social surface crops differently. Shooting a bit wider means one photo survives several crops.",
      weight: 2,
    },
    general_confidence: {
      area: "framing",
      instruction: "Waist up, and leave a little space on the side you're facing.",
      because:
        "Space in the direction you're looking reads as open. Being crammed against the edge reads as trapped.",
      weight: 2,
    },
  };
  return [goalFraming[c.goal]];
}

function settingSteps(c: ShotConditions): ChecklistStep[] {
  const steps: ChecklistStep[] = [
    {
      area: "setting",
      instruction: "Put a metre or two between you and whatever is behind you.",
      because:
        "Distance lets the background fall out of focus and stops things appearing to grow out of your head.",
      weight: 2,
    },
  ];
  if (c.goal === "interview" || c.goal === "professional") {
    steps.push({
      area: "setting",
      instruction: "Pick a plain wall, and check what's in shot behind you before you start.",
      because:
        "A busy background costs you the one second someone spends on the photo. Plain is not boring; it is legible.",
      weight: 2,
    });
  }
  if (c.goal === "dating_profile") {
    steps.push({
      area: "setting",
      instruction: "Choose somewhere that says something true about how you spend time.",
      because:
        "A background is free information. A place you actually go gives someone an opening line; a blank wall gives them nothing.",
      weight: 2,
    });
  }
  return steps;
}

function youSteps(c: ShotConditions): ChecklistStep[] {
  const steps: ChecklistStep[] = [
    {
      area: "you",
      instruction: "Turn your shoulders about 30° off-camera, then bring your face back to the lens.",
      because:
        "Square-on to the camera is a passport photo. A slight turn gives the frame depth, and it is a camera instruction — nothing to do with how you look.",
      weight: 2,
    },
    {
      area: "you",
      instruction: "Give your hands a job: a pocket, a cup, a strap, a lapel.",
      because:
        "Hands with nothing to do end up hanging or clenched, and that is what reads as awkward — not the person.",
      weight: 2,
    },
    {
      area: "you",
      instruction: "Breathe out just before the shutter, and drop your shoulders.",
      because:
        "Holding a breath and a pose tightens the whole frame. Exhaling on the shot is the oldest trick portrait photographers use.",
      weight: 1,
    },
  ];
  if (c.goal === "dating_profile" || c.goal === "general_confidence") {
    steps.push({
      area: "you",
      instruction: "Look just past the lens, then flick your eyes back to it as it fires.",
      because:
        "Staring into a lens for several seconds makes any expression go dead. Arriving at it late keeps the eyes alive.",
      weight: 2,
    });
  }
  return steps;
}

// ── The checklist ────────────────────────────────────────────────────────────

export interface Checklist {
  steps: ChecklistStep[];
  /** The single step to get right if nothing else. */
  headline: ChecklistStep;
  byArea: Record<ChecklistArea, ChecklistStep[]>;
}

/**
 * Build the shot list. Deterministic: the same conditions always give the same
 * checklist, which is what lets a person re-open it mid-shoot and trust it.
 */
export function buildChecklist(c: ShotConditions): Checklist {
  const steps = [
    ...lightSteps(c),
    ...cameraSteps(c),
    ...framingSteps(c),
    ...settingSteps(c),
    ...youSteps(c),
  ].sort((a, b) => b.weight - a.weight);

  const byArea = {
    light: steps.filter((s) => s.area === "light"),
    camera: steps.filter((s) => s.area === "camera"),
    framing: steps.filter((s) => s.area === "framing"),
    setting: steps.filter((s) => s.area === "setting"),
    you: steps.filter((s) => s.area === "you"),
  } satisfies Record<ChecklistArea, ChecklistStep[]>;

  return { steps, headline: steps[0], byArea };
}

/**
 * The best time to shoot today, given where they are.
 *
 * Returns a real recommendation or null — indoors by a window, time of day
 * barely matters, and inventing a "best hour" for it would be noise.
 */
export function bestTimeToShoot(setting: Setting): string | null {
  if (setting === "outdoors") {
    return "The hour after sunrise or before sunset. Low sun is soft and warm; midday sun is neither.";
  }
  if (setting === "indoors_window") {
    return "Any time the window is bright but the sun isn't shining directly through it — direct sun through glass is as hard as standing in it.";
  }
  return null;
}
