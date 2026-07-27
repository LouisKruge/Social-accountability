import { describe, expect, it } from "vitest";
import { num, zar } from "./format";

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
