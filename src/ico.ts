import { attempt, fail, requireString, stripSpaces, type Result } from "./errors.js";

/** A validated IČO (identifikační číslo osoby). */
export interface Ico {
  /** Normalized 8-digit value, e.g. `"48136450"`. */
  readonly value: string;
}

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2] as const;

/**
 * Computes the IČO check digit from the first seven digits.
 *
 * Weighted sum with weights 8…2, `r = sum mod 11`; check digit is
 * `(11 - r) mod 10`, i.e. r = 0 → 1, r = 1 → 0, r = 10 → 1, otherwise 11 − r.
 */
export function icoCheckDigit(firstSeven: string): number {
  if (!/^\d{7}$/.test(firstSeven)) fail("ico", "InvalidFormat", "icoCheckDigit expects exactly 7 digits.");
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(firstSeven[i]) * WEIGHTS[i]!;
  return (11 - (sum % 11)) % 10;
}

/**
 * Parses and validates an IČO. Whitespace is ignored; the result must be
 * exactly 8 digits (older 7-digit numbers must be written with their leading zero,
 * as ARES does). Only the check digit is verified, not existence in any register.
 *
 * @throws {CzValidatorError} `InvalidFormat`, `InvalidLength`, `InvalidChecksum`
 */
export function parseIco(input: string): Ico {
  const s = stripSpaces(requireString("ico", input));
  if (!/^\d+$/.test(s)) fail("ico", "InvalidFormat", "IČO must contain digits only.");
  if (s.length !== 8) fail("ico", "InvalidLength", `IČO must have 8 digits, got ${s.length}.`);
  if (icoCheckDigit(s.slice(0, 7)) !== Number(s[7])) fail("ico", "InvalidChecksum", "IČO check digit does not match.");
  return Object.freeze({ value: s });
}

/** Non-throwing variant of {@link parseIco}. */
export function tryParseIco(input: string): Result<Ico> {
  return attempt(() => parseIco(input));
}

/** `true` when {@link parseIco} would succeed. */
export function isValidIco(input: string): boolean {
  return tryParseIco(input).ok;
}
