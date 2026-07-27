import { scanText } from "@/lib/glowup";

// ─────────────────────────────────────────────────────────────────────────────
// STYLE STUDIO — wardrobe intelligence.
//
// ── WHY THIS ANALYSES CLOTHES AND NOT PEOPLE ─────────────────────────────────
// Every photo this module touches is of a GARMENT — on a hanger, on a bed, on a
// rail. Not on a body. That is a deliberate architectural choice, not a
// limitation:
//
//   · A photo of a shirt carries none of the risk of a photo of a torso. There
//     is no body to comment on, so an entire class of harm is designed out
//     rather than guarded against.
//   · It is where the real styling value is anyway. A stylist's advantage is
//     knowing what you already own. You cannot plan outfits from clothes the
//     system has never seen, and no amount of analysing the person substitutes
//     for that.
//
// The response is still run through the same prohibited-content guard as the
// coaching reports, because a model asked about a shirt can still volunteer
// something about the person wearing it.
//
// ── THE OUTFIT BUILDER IS ARITHMETIC, NOT A MODEL ────────────────────────────
// Combining items the user owns into outfits is rule-based and pure: category
// coverage, occasion match, season match, colour compatibility. That makes it
// instant, free, offline-capable and exhaustively testable — and it means an
// outfit suggestion can always explain itself, because the rule that produced
// it is the explanation.
// ─────────────────────────────────────────────────────────────────────────────

export type Category =
  | "top"
  | "bottom"
  | "outerwear"
  | "footwear"
  | "accessory"
  | "formal"
  | "activewear";

export type Season = "summer" | "winter" | "all";
export type Occasion =
  | "everyday"
  | "work"
  | "formal"
  | "date"
  | "gym"
  | "travel"
  | "outdoors";

export interface WardrobeItem {
  id: string;
  name: string;
  category: Category;
  colour: string | null;
  seasons: Season[];
  occasions: Occasion[];
  priceZar: number | null;
  wearCount: number;
}

/** The fixed shape the vision pass must return. One key per field, never varies. */
export interface GarmentAnalysis {
  category: Category;
  name: string;
  colour: string;
  material: string;
  seasons: Season[];
  occasions: Occasion[];
}

const CATEGORIES: Category[] = [
  "top",
  "bottom",
  "outerwear",
  "footwear",
  "accessory",
  "formal",
  "activewear",
];
const SEASONS: Season[] = ["summer", "winter", "all"];
const OCCASIONS: Occasion[] = [
  "everyday",
  "work",
  "formal",
  "date",
  "gym",
  "travel",
  "outdoors",
];

/**
 * The garment system prompt.
 *
 * States the subject explicitly ("a garment, not a person") and gives the model
 * a defined action for the case where a person IS in frame, because "don't
 * describe the person" alone leaves it to improvise.
 */
export function buildGarmentPrompt(): string {
  return `You are cataloguing a single item of clothing for the owner's own digital wardrobe in Ascend, a South African app.

THE SUBJECT IS A GARMENT, NOT A PERSON. Describe only the item of clothing: what it is, its colour, its material, when it would be worn.

IF A PERSON IS VISIBLE IN THE PHOTO: describe the garment only. Do not describe, mention, refer to or characterise the person in any way — not their body, face, skin, hair, age, gender, or anything else about them. Treat them as though they were a mannequin you have been asked to look past.

NEVER comment on body shape, size, weight or fit-on-a-body. If you cannot describe the garment without referring to the person wearing it, return category "top" and name "Could not identify" and leave the other fields as empty strings or arrays.

Return ONLY a JSON object, no prose, no code fence:
{
  "category": one of ${JSON.stringify(CATEGORIES)},
  "name": short plain name, e.g. "Navy oxford shirt" (max 60 chars),
  "colour": the dominant colour in plain English,
  "material": the apparent fabric, or "unknown" if you cannot tell,
  "seasons": array from ${JSON.stringify(SEASONS)},
  "occasions": array from ${JSON.stringify(OCCASIONS)}
}

Be honest about uncertainty: "unknown" is a correct answer for material. Do not guess a brand — you will be wrong often enough that the catalogue becomes untrustworthy.`;
}

export interface GarmentValidation {
  ok: boolean;
  value?: GarmentAnalysis;
  errors: string[];
  /** Prohibition reasons the text tripped. Any hit is a rejection. */
  guard: string[];
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/** Validate the vision output against the schema AND the content guard. */
export function validateGarment(raw: unknown): GarmentValidation {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["Response was not an object."], guard: [] };
  }
  const r = raw as Record<string, unknown>;

  const category = r.category;
  if (typeof category !== "string" || !CATEGORIES.includes(category as Category)) {
    errors.push(`category must be one of ${CATEGORIES.join(", ")}.`);
  }
  if (typeof r.name !== "string" || r.name.trim().length === 0) {
    errors.push("name must be a non-empty string.");
  } else if (r.name.length > 60) {
    errors.push("name must be 60 characters or fewer.");
  }
  if (typeof r.colour !== "string") errors.push("colour must be a string.");
  if (typeof r.material !== "string") errors.push("material must be a string.");

  if (!isStringArray(r.seasons) || r.seasons.some((s) => !SEASONS.includes(s as Season))) {
    errors.push("seasons must be an array of known seasons.");
  }
  if (
    !isStringArray(r.occasions) ||
    r.occasions.some((o) => !OCCASIONS.includes(o as Occasion))
  ) {
    errors.push("occasions must be an array of known occasions.");
  }

  // The guard runs over every free-text field the model produced. A garment
  // description has no business mentioning a body, so any hit is a rejection.
  const text = [r.name, r.colour, r.material].filter((v) => typeof v === "string").join(" . ");
  const guard = scanText(text);

  if (errors.length > 0 || guard.length > 0) {
    return { ok: false, errors, guard };
  }
  return { ok: true, value: raw as unknown as GarmentAnalysis, errors: [], guard: [] };
}

// ── Cost per wear ────────────────────────────────────────────────────────────

/**
 * What each wearing has actually cost.
 *
 * Null when the price is unknown or the item has never been worn — an item worn
 * zero times has no cost per wear, and rendering its full price as "cost per
 * wear" would libel a jacket bought yesterday.
 */
export function costPerWear(priceZar: number | null, wearCount: number): number | null {
  if (priceZar === null || priceZar <= 0) return null;
  if (wearCount <= 0) return null;
  return Math.round((priceZar / wearCount) * 100) / 100;
}

/** Items the user paid for and has never put on. Stated without judgement. */
export function neverWorn(items: WardrobeItem[]): WardrobeItem[] {
  return items.filter((i) => i.wearCount === 0);
}

// ── Gap analysis ─────────────────────────────────────────────────────────────

export interface Gap {
  category: Category;
  occasion: Occasion;
  reason: string;
}

/**
 * What is missing for a given occasion.
 *
 * A "capsule" here is the minimum set of categories an occasion actually needs,
 * which is a defensible claim, rather than a fashion-magazine list of items
 * everyone supposedly must own.
 */
export const CAPSULE: Record<Occasion, Category[]> = {
  everyday: ["top", "bottom", "footwear"],
  work: ["top", "bottom", "footwear", "outerwear"],
  formal: ["formal", "footwear"],
  date: ["top", "bottom", "footwear"],
  gym: ["activewear", "footwear"],
  travel: ["top", "bottom", "footwear", "outerwear"],
  outdoors: ["top", "bottom", "outerwear", "footwear"],
};

export function findGaps(items: WardrobeItem[], occasion: Occasion): Gap[] {
  const need = CAPSULE[occasion];
  const have = new Set(
    items.filter((i) => i.occasions.includes(occasion)).map((i) => i.category),
  );
  return need
    .filter((c) => !have.has(c))
    .map((c) => ({
      category: c,
      occasion,
      reason: `You have nothing catalogued as ${LABEL[c]} for ${occasion}.`,
    }));
}

const LABEL: Record<Category, string> = {
  top: "a top",
  bottom: "trousers or a skirt",
  outerwear: "outerwear",
  footwear: "footwear",
  accessory: "an accessory",
  formal: "formalwear",
  activewear: "activewear",
};

// ── Outfit builder ───────────────────────────────────────────────────────────

export interface Outfit {
  items: WardrobeItem[];
  occasion: Occasion;
  /** Why these go together. Always populated — a rule that can't explain itself
   *  shouldn't be making suggestions. */
  rationale: string;
}

/**
 * Colours that reliably sit together. Deliberately conservative: this exists to
 * avoid a bad suggestion, not to be clever. Neutrals go with everything, which
 * is why they are listed as such rather than enumerated against every colour.
 */
const NEUTRALS = ["black", "white", "grey", "gray", "navy", "beige", "cream", "tan", "denim"];

export function coloursWork(a: string | null, b: string | null): boolean {
  if (!a || !b) return true; // unknown colour is not a reason to withhold an outfit
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (NEUTRALS.some((n) => x.includes(n)) || NEUTRALS.some((n) => y.includes(n))) return true;
  // Two saturated colours: only pair them when they are the same family.
  return x === y;
}

/**
 * Build outfits from what the user owns.
 *
 * Returns an empty array rather than a compromised suggestion when the wardrobe
 * cannot cover the occasion — a half-outfit is worse than an honest gap, and
 * findGaps() exists to say what is missing.
 */
export function buildOutfits(
  items: WardrobeItem[],
  occasion: Occasion,
  season: Season = "all",
  limit = 3,
): Outfit[] {
  const usable = items.filter(
    (i) =>
      i.occasions.includes(occasion) &&
      (season === "all" || i.seasons.includes(season) || i.seasons.includes("all")),
  );

  const need = CAPSULE[occasion];
  const byCategory = new Map<Category, WardrobeItem[]>();
  for (const c of need) {
    byCategory.set(
      c,
      usable.filter((i) => i.category === c),
    );
  }
  if (need.some((c) => (byCategory.get(c) ?? []).length === 0)) return [];

  const out: Outfit[] = [];
  const walk = (idx: number, chosen: WardrobeItem[]) => {
    if (out.length >= limit) return;
    if (idx === need.length) {
      out.push({
        items: [...chosen],
        occasion,
        rationale: explain(chosen, occasion),
      });
      return;
    }
    for (const candidate of byCategory.get(need[idx]) ?? []) {
      if (chosen.every((c) => coloursWork(c.colour, candidate.colour))) {
        walk(idx + 1, [...chosen, candidate]);
      }
      if (out.length >= limit) return;
    }
  };
  walk(0, []);
  return out;
}

function explain(items: WardrobeItem[], occasion: Occasion): string {
  const colours = Array.from(
    new Set(items.map((i) => i.colour?.toLowerCase()).filter(Boolean) as string[]),
  );
  const anchored = colours.find((c) => NEUTRALS.some((n) => c.includes(n)));
  const leastWorn = [...items].sort((a, b) => a.wearCount - b.wearCount)[0];

  const parts: string[] = [];
  if (anchored) {
    parts.push(`Anchored on ${anchored}, which sits with everything else here`);
  } else if (colours.length === 1) {
    parts.push(`One colour family throughout, so nothing competes`);
  } else {
    parts.push(`These colours sit together without clashing`);
  }
  parts.push(`covers what ${occasion} actually needs`);
  if (leastWorn && leastWorn.wearCount === 0) {
    parts.push(`and puts your ${leastWorn.name.toLowerCase()} to use for the first time`);
  }
  return `${parts.join(", ")}.`;
}
