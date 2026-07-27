/**
 * Deterministic number formatting.
 *
 * `toLocaleString("en-ZA")` is NOT safe here: Node and Chromium ship different
 * CLDR data for en-ZA, so the same call produced "268,400" in a client
 * component and "268 400" in a server one — on the same screen, in the same
 * column. On a page where people are reading their own money that is not a
 * cosmetic problem, and it is a React hydration mismatch besides.
 *
 * So Commit formats numbers itself. One separator, everywhere, on both sides of
 * the render boundary.
 */

/** 268400 → "268,400". Always grouped in threes, never locale-dependent. */
export function num(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole, frac] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${value < 0 ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

/** Rand, rounded to the nearest cent-free figure unless asked otherwise. */
export function zar(value: number, decimals = 0): string {
  return `R${num(value, decimals)}`;
}
