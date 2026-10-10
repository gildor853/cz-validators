import { CzValidatorError, asciiUpper, attempt, fail, requireString, stripSpaces, type Result } from "./errors.js";
import { parseIco } from "./ico.js";
import { parseRodneCislo } from "./rodne-cislo.js";

/**
 * How the numeric part of a DIČ was interpreted.
 *
 * - `legal-entity`: 8 digits, numerically equal to the IČO; the IČO check digit is verified.
 * - `individual`: 9 or 10 digits, numerically equal to a rodné číslo; fully validated as one.
 * - `special`: 9 digits starting with 6 (e.g. `CZ699nnnnnk` for VAT groups, or a payer's own
 *   number "VČP"); the check-digit algorithm is not published, so only the format is checked.
 */
export type DicKind = "legal-entity" | "individual" | "special";

/** A validated DIČ (daňové identifikační číslo). */
export interface Dic {
  /** Normalized form with the country prefix, e.g. `"CZ48136450"`. */
  readonly value: string;
  /** Numeric part without `CZ`. */
  readonly digits: string;
  readonly kind: DicKind;
  /** `true` when a check digit was verified; `false` when only the format was checked (`special`). */
  readonly checksumVerified: boolean;
}

/** Options for {@link parseDic}. */
export interface ParseDicOptions {
  /** Require the `CZ` prefix in the input. Default `false` (bare digits are accepted). */
  readonly requirePrefix?: boolean;
}

/**
 * Parses and validates a Czech DIČ. The code is `CZ` followed by the numeric part,
 * which is the IČO (legal entities), the rodné číslo (individuals), or a number assigned
 * by the tax administration ("VČP", VAT groups `CZ699…`).
 *
 * Validation is offline and structural: it does not prove that the DIČ is registered
 * or that its holder is a VAT payer (check the ADIS / VIES registers for that).
 * Note that a VČP-based DIČ of a legal entity or individual can be 8–10 digits and need
 * not satisfy the IČO / rodné číslo rules; such numbers are rejected unless they start with 6.
 *
 * @throws {CzValidatorError} `InvalidFormat`, `InvalidLength`, `InvalidChecksum`, `InvalidDate`
 */
export function parseDic(input: string, options: ParseDicOptions = {}): Dic {
  let s = asciiUpper(stripSpaces(requireString("dic", input)));
  if (s.startsWith("CZ")) s = s.slice(2);
  else if (options?.requirePrefix) fail("dic", "InvalidFormat", "DIČ must start with the CZ prefix.");
  if (!/^\d+$/.test(s)) fail("dic", "InvalidFormat", "DIČ must be CZ followed by digits.");
  if (s.length < 8 || s.length > 10) fail("dic", "InvalidLength", `DIČ must have 8 to 10 digits after CZ, got ${s.length}.`);

  let kind: DicKind;
  let checksumVerified = true;
  try {
    if (s.length === 8) {
      parseIco(s);
      kind = "legal-entity";
    } else if (s.length === 9 && s.startsWith("6")) {
      kind = "special";
      checksumVerified = false;
    } else {
      parseRodneCislo(s);
      kind = "individual";
    }
  } catch (err) {
    if (err instanceof CzValidatorError) throw new CzValidatorError("dic", err.code, `Invalid DIČ: ${err.message}`);
    throw err;
  }
  return Object.freeze({ value: `CZ${s}`, digits: s, kind, checksumVerified });
}

/** Non-throwing variant of {@link parseDic}. */
export function tryParseDic(input: string, options?: ParseDicOptions): Result<Dic> {
  return attempt(() => parseDic(input, options));
}

/** `true` when {@link parseDic} would succeed. */
export function isValidDic(input: string, options?: ParseDicOptions): boolean {
  return tryParseDic(input, options).ok;
}
