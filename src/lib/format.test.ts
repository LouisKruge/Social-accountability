import { describe, expect, it } from "vitest";
import { fracOf, num, ordinal, zar } from "./format";

describe("num", () => {
  it("groups in threes", () => {
    expect(num(268_400)).toBe("268,400");
    expect(num(1_234_567)).toBe("1,234,567");
    expect(num(999)).toBe("999");
    expect(num(1_000)).toBe("1,000");
  });

  it("handles zero and negatives", () => {
    expect(num(0)).toBe("0");
    expect(num(-1_500)).toBe("-1,500");
  });

  it("keeps requested decimals", () => {
    expect(num(1_234.5, 2)).toBe("1,234.50");
    expect(num(0.5, 2)).toBe("0.50");
  });

  it("rounds when no decimals are wanted", () => {
    expect(num(1_234.6)).toBe("1,235");
  });

  it("does not depend on the host's locale data", () => {
    // The bug this module exists to prevent: Node and Chromium disagreed on
    // en-ZA's group separator, so the same figure rendered two ways.
    expect(num(268_400)).toBe(num(268_400));
    expect(num(268_400)).not.toContain(" ");
  });
});

describe("zar", () => {
  it("prefixes rand", () => {
    expect(zar(1_800)).toBe("R1,800");
    expect(zar(405.5, 2)).toBe("R405.50");
  });
});

describe("ordinal", () => {
  it("takes the suffix from the last digit", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(9)).toBe("9th");
  });

  it("gives the teens 'th' despite their last digit", () => {
    // The whole reason this is a function rather than a lookup.
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
  });

  it("goes back to the last digit past the teens", () => {
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(102)).toBe("102nd");
    expect(ordinal(111)).toBe("111th");
    expect(ordinal(113)).toBe("113th");
  });
});

describe("fracOf", () => {
  it("asks for a decimal only when there is one", () => {
    expect(fracOf(14)).toBe(0);
    expect(fracOf(14.5)).toBe(1);
    expect(fracOf(-8)).toBe(0);
    expect(fracOf(0)).toBe(0);
  });
});
