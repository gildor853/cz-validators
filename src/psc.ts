import { attempt, fail, requireString, stripSpaces, type Result } from "./errors.js";

/** A syntactically valid PSČ (poštovní směrovací číslo). */
export interface Psc {
  /** Five digits, e.g. `"11000"`. */
  readonly value: string;
  /** Conventional written form `XXX XX`, e.g. `"110 00"`. */
  readonly formatted: string;
}

/**
 * Parses a Czech postal code. Accepts `11000`, `110 00` (any whitespace). Czech postal
 * codes start with 1–7 (the leading digits 0, 8 and 9 are used by the Slovak system that
 * shares the same five-digit scheme), which is checked as a sanity rule.
 *
 * This is a format check only: it does not say whether the code is actually assigned.
 *
 * @throws {CzValidatorError} `InvalidFormat`, `InvalidLength`, `InvalidComponent`
 */
export function parsePsc(input: string): Psc {
  const s = stripSpaces(requireString("psc", input));
  if (!/^\d+$/.test(s)) fail("psc", "InvalidFormat", "PSČ must contain digits only.");
  if (s.length !== 5) fail("psc", "InvalidLength", `PSČ must have 5 digits, got ${s.length}.`);
  if (s[0] === "0" || s[0] === "8" || s[0] === "9") fail("psc", "InvalidComponent", "Czech PSČ starts with a digit from 1 to 7.");
  return Object.freeze({ value: s, formatted: `${s.slice(0, 3)} ${s.slice(3)}` });
}

/** Non-throwing variant of {@link parsePsc}. */
export function tryParsePsc(input: string): Result<Psc> {
  return attempt(() => parsePsc(input));
}

/** `true` when {@link parsePsc} would succeed. */
export function isValidPsc(input: string): boolean {
  return tryParsePsc(input).ok;
}
