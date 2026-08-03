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

/**
 * 1 → "1st". Used wherever a rank is stated in prose rather than in a column,
 * because "you are 2 of 4" reads as a score and "2nd of 4" reads as a position.
 *
 * The teens are the whole reason this is a function and not a lookup: 11, 12
 * and 13 take "th" despite ending in 1, 2 and 3.
 */
export function ordinal(n: number): string {
  const rem100 = Math.abs(n) % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][Math.abs(n) % 10] ?? "th"}`;
}

/**
 * A decimal place only where there is one.
 *
 * "+14.0%" is precision theatre, and "+14%" sitting beside "+14.5%" in the same
 * column is worse than either — the eye reads the shorter one as a different
 * kind of number.
 */
export function fracOf(value: number): 0 | 1 {
  return Number.isInteger(value) ? 0 : 1;
}
