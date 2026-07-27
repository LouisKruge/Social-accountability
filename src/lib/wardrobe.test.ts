import { describe, expect, it } from "vitest";
import {
  buildGarmentPrompt,
  buildOutfits,
  coloursWork,
  costPerWear,
  findGaps,
  neverWorn,
  validateGarment,
  type WardrobeItem,
} from "./wardrobe";

const item = (over: Partial<WardrobeItem> & { id: string; category: WardrobeItem["category"] }): WardrobeItem => ({
  name: "Item",
  colour: "navy",
  seasons: ["all"],
  occasions: ["everyday"],
  priceZar: null,
  wearCount: 0,
  ...over,
});

describe("buildGarmentPrompt", () => {
  it("states the subject is a garment, not a person", () => {
    const p = buildGarmentPrompt();
    expect(p).toMatch(/GARMENT, NOT A PERSON/);
  });

  it("gives a defined action for when a person is in frame", () => {
    // "Don't describe the person" alone leaves the model to improvise.
    expect(buildGarmentPrompt()).toMatch(/IF A PERSON IS VISIBLE/);
  });

  it("forbids body commentary explicitly", () => {
    expect(buildGarmentPrompt()).toMatch(/NEVER comment on body shape, size, weight/);
  });

  it("tells the model that uncertainty is an acceptable answer", () => {
    expect(buildGarmentPrompt()).toMatch(/"unknown" is a correct answer/);
  });
});

describe("validateGarment", () => {
  const good = {
    category: "top",
    name: "Navy oxford shirt",
    colour: "navy",
    material: "cotton",
    seasons: ["all"],
    occasions: ["work", "everyday"],
  };

  it("accepts a well-formed garment", () => {
    const v = validateGarment(good);
    expect(v.ok).toBe(true);
    expect(v.value?.name).toBe("Navy oxford shirt");
  });

  it("rejects a non-object", () => {
    expect(validateGarment("nope").ok).toBe(false);
    expect(validateGarment(null).ok).toBe(false);
  });

  it("rejects an unknown category", () => {
    const v = validateGarment({ ...good, category: "hat" });
    expect(v.ok).toBe(false);
    expect(v.errors.join(" ")).toMatch(/category/);
  });

  it("rejects an unknown occasion", () => {
    expect(validateGarment({ ...good, occasions: ["clubbing"] }).ok).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(validateGarment({ ...good, name: "  " }).ok).toBe(false);
  });

  it("caps the name length so the catalogue stays scannable", () => {
    expect(validateGarment({ ...good, name: "x".repeat(61) }).ok).toBe(false);
  });

  it("collects every schema problem at once", () => {
    const v = validateGarment({ category: "hat", name: "", colour: 1, material: null, seasons: "x", occasions: 2 });
    expect(v.errors.length).toBeGreaterThan(3);
  });

  it("REJECTS a garment description that strays onto the body", () => {
    // The whole point of cataloguing clothes rather than people: if the model
    // volunteers body commentary anyway, it never reaches the user.
    const v = validateGarment({ ...good, name: "Shirt that hides your belly" });
    expect(v.ok).toBe(false);
    expect(v.guard.length).toBeGreaterThan(0);
  });

  it("REJECTS a garment description suggesting weight loss", () => {
    const v = validateGarment({ ...good, material: "slimming — wear while you lose weight" });
    expect(v.ok).toBe(false);
    expect(v.guard.length).toBeGreaterThan(0);
  });

  it("still allows legitimate garment vocabulary", () => {
    // "slim fit" and "skinny jeans" are garment cuts, not body commentary.
    expect(validateGarment({ ...good, name: "Slim fit chinos" }).ok).toBe(true);
    expect(validateGarment({ ...good, name: "Skinny jeans", category: "bottom" }).ok).toBe(true);
  });
});

describe("costPerWear", () => {
  it("divides price by wears", () => {
    expect(costPerWear(1200, 40)).toBe(30);
  });

  it("is null for an item never worn", () => {
    // A jacket bought yesterday has no cost per wear; showing its full price
    // as one would be a lie about a perfectly reasonable purchase.
    expect(costPerWear(1200, 0)).toBeNull();
  });

  it("is null when the price is unknown", () => {
    expect(costPerWear(null, 10)).toBeNull();
  });

  it("rounds to cents", () => {
    expect(costPerWear(100, 3)).toBe(33.33);
  });
});

describe("neverWorn", () => {
  it("finds items paid for and never used", () => {
    const items = [item({ id: "a", category: "top", wearCount: 5 }), item({ id: "b", category: "top" })];
    expect(neverWorn(items).map((i) => i.id)).toEqual(["b"]);
  });
});

describe("findGaps", () => {
  it("names what is missing for an occasion", () => {
    const items = [item({ id: "a", category: "top", occasions: ["gym"] })];
    const gaps = findGaps(items, "gym");
    expect(gaps.map((g) => g.category)).toEqual(["activewear", "footwear"]);
  });

  it("finds no gaps when the occasion is covered", () => {
    const items = [
      item({ id: "a", category: "top" }),
      item({ id: "b", category: "bottom" }),
      item({ id: "c", category: "footwear" }),
    ];
    expect(findGaps(items, "everyday")).toEqual([]);
  });

  it("ignores items catalogued for a different occasion", () => {
    const items = [item({ id: "a", category: "top", occasions: ["gym"] })];
    expect(findGaps(items, "everyday").length).toBe(3);
  });

  it("explains each gap in plain language", () => {
    const g = findGaps([], "everyday");
    expect(g[0].reason).toMatch(/You have nothing catalogued/);
  });
});

describe("coloursWork", () => {
  it("lets neutrals go with anything", () => {
    expect(coloursWork("navy", "red")).toBe(true);
    expect(coloursWork("orange", "white")).toBe(true);
  });

  it("allows the same colour family", () => {
    expect(coloursWork("green", "green")).toBe(true);
  });

  it("holds back two clashing saturated colours", () => {
    expect(coloursWork("orange", "purple")).toBe(false);
  });

  it("does not withhold an outfit over an unknown colour", () => {
    expect(coloursWork(null, "orange")).toBe(true);
  });
});

describe("buildOutfits", () => {
  const wardrobe: WardrobeItem[] = [
    item({ id: "t1", category: "top", name: "White tee", colour: "white" }),
    item({ id: "t2", category: "top", name: "Orange tee", colour: "orange" }),
    item({ id: "b1", category: "bottom", name: "Navy chinos", colour: "navy" }),
    item({ id: "f1", category: "footwear", name: "White sneakers", colour: "white" }),
  ];

  it("builds an outfit that covers the occasion", () => {
    const out = buildOutfits(wardrobe, "everyday");
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].items.map((i) => i.category).sort()).toEqual(["bottom", "footwear", "top"]);
  });

  it("always explains itself", () => {
    const out = buildOutfits(wardrobe, "everyday");
    expect(out[0].rationale.length).toBeGreaterThan(10);
  });

  it("returns nothing rather than a half-outfit", () => {
    // An honest gap beats a compromised suggestion; findGaps says what's missing.
    const out = buildOutfits([item({ id: "t1", category: "top" })], "everyday");
    expect(out).toEqual([]);
  });

  it("respects the season filter", () => {
    const winterOnly = wardrobe.map((i) => ({ ...i, seasons: ["winter" as const] }));
    expect(buildOutfits(winterOnly, "everyday", "summer")).toEqual([]);
    expect(buildOutfits(winterOnly, "everyday", "winter").length).toBeGreaterThan(0);
  });

  it("respects the limit", () => {
    expect(buildOutfits(wardrobe, "everyday", "all", 1)).toHaveLength(1);
  });

  it("mentions an unworn item when it puts one to use", () => {
    const out = buildOutfits(wardrobe, "everyday");
    expect(out.some((o) => /first time/.test(o.rationale))).toBe(true);
  });
});
