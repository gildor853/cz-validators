import { IBAN_REGISTRY_ROWS } from "./data/iban-registry.js";
import { asciiUpper, attempt, fail, requireString, stripSpaces, type Result } from "./errors.js";

/** IBAN format of one country, from the SWIFT IBAN Registry. */
export interface IbanCountryFormat {
  /** ISO 3166-1 alpha-2 code. */
  readonly country: string;
  readonly countryName: string;
  /** Total IBAN length in characters. */
  readonly length: number;
  /** BBAN structure in registry notation, e.g. `"4!n16!n"` (n digits, a letters, c alphanumerics). */
  readonly bbanStructure: string;
}

/** A validated IBAN. */
export interface Iban {
  /** Electronic format: upper-case, no spaces, e.g. `"CZ6508000000192000145399"`. */
  readonly value: string;
  /** Print / paper format in groups of four, e.g. `"CZ65 0800 0000 1920 0014 5399"`. */
  readonly formatted: string;
  readonly country: string;
  readonly checkDigits: string;
  /** Basic Bank Account Number: everything after the check digits. */
  readonly bban: string;
}

/** Options for {@link parseIban}. */
export interface ParseIbanOptions {
  /**
   * Accept country codes missing from the bundled registry, checking only the generic
   * rules (2 letters, 2 digits, up to 30 alphanumerics, mod-97). Default `false`.
   */
  readonly allowUnknownCountry?: boolean;
}

const FORMATS: ReadonlyMap<string, IbanCountryFormat> = new Map(
  IBAN_REGISTRY_ROWS.map(([country, length, bbanStructure, countryName]) => [
    country,
    Object.freeze({ country, countryName, length, bbanStructure }),
  ]),
);

const STRUCTURE_RE = new Map<string, RegExp>();
function structureRegExp(structure: string): RegExp {
  let re = STRUCTURE_RE.get(structure);
  if (!re) {
    const body = structure.replace(/(\d+)!([nac])/g, (_m, n: string, t: string) =>
      t === "n" ? `\\d{${n}}` : t === "a" ? `[A-Z]{${n}}` : `[A-Z0-9]{${n}}`,
    );
    re = new RegExp(`^${body}$`);
    STRUCTURE_RE.set(structure, re);
  }
  return re;
}

/** IBAN format for a country, or `undefined` when the country does not use IBAN (per the bundled registry). */
export function getIbanCountryFormat(country: string): IbanCountryFormat | undefined {
  return typeof country === "string" ? FORMATS.get(asciiUpper(country)) : undefined;
}

/** All countries in the bundled IBAN registry, sorted by country code. */
export function listIbanCountries(): readonly IbanCountryFormat[] {
  return [...FORMATS.values()];
}

/**
 * ISO 7064 MOD 97-10 remainder of an IBAN-like string (country + check digits + BBAN),
 * computed after moving the first four characters to the end and mapping A=10 … Z=35.
 * A valid IBAN yields 1.
 */
export function ibanMod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const v = code >= 48 && code <= 57 ? code - 48 : code - 55;
    rem = v >= 10 ? (rem * 100 + v) % 97 : (rem * 10 + v) % 97;
  }
  return rem;
}

/** Computes the two IBAN check digits for a country code and BBAN. */
export function ibanCheckDigits(country: string, bban: string): string {
  const cc = asciiUpper(requireString("iban", country));
  const b = asciiUpper(requireString("iban", bban));
  if (!/^[A-Z]{2}$/.test(cc) || !/^[A-Z0-9]{1,30}$/.test(b))
    fail("iban", "InvalidFormat", "Country must be 2 letters and BBAN 1–30 alphanumerics.");
  return String(98 - ibanMod97(`${cc}00${b}`)).padStart(2, "0");
}

/** Groups an electronic-format IBAN into blocks of four characters. */
export function formatIbanGroups(electronic: string): string {
  return electronic.replace(/(.{4})(?=.)/g, "$1 ");
}

/**
 * Parses and validates an IBAN (ISO 13616): strips whitespace (print format allowed),
 * upper-cases, checks the country's length and BBAN structure from the SWIFT IBAN Registry
 * and verifies the MOD 97-10 check digits.
 *
 * The check proves the IBAN is well-formed, not that the account exists.
 *
 * @throws {CzValidatorError} `InvalidFormat`, `InvalidLength`, `InvalidChecksum`, `UnsupportedCountry`
 */
export function parseIban(input: string, options: ParseIbanOptions = {}): Iban {
  const s = asciiUpper(stripSpaces(requireString("iban", input)));
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s))
    fail("iban", "InvalidFormat", "IBAN must be 2 letters, 2 check digits and alphanumeric characters.");
  const country = s.slice(0, 2);
  const fmt = FORMATS.get(country);
  if (fmt) {
    if (s.length !== fmt.length) fail("iban", "InvalidLength", `IBAN for ${country} must have ${fmt.length} characters, got ${s.length}.`);
    if (!structureRegExp(fmt.bbanStructure).test(s.slice(4)))
      fail("iban", "InvalidFormat", `BBAN does not match the ${country} structure ${fmt.bbanStructure}.`);
  } else {
    if (!options?.allowUnknownCountry) fail("iban", "UnsupportedCountry", `Country ${country} is not in the IBAN registry.`);
    if (s.length > 34) fail("iban", "InvalidLength", "IBAN can have at most 34 characters.");
  }
  if (ibanMod97(s) !== 1) fail("iban", "InvalidChecksum", "IBAN check digits do not match.");
  return Object.freeze({ value: s, formatted: formatIbanGroups(s), country, checkDigits: s.slice(2, 4), bban: s.slice(4) });
}

/** Non-throwing variant of {@link parseIban}. */
export function tryParseIban(input: string, options?: ParseIbanOptions): Result<Iban> {
  return attempt(() => parseIban(input, options));
}

/** `true` when {@link parseIban} would succeed. */
export function isValidIban(input: string, options?: ParseIbanOptions): boolean {
  return tryParseIban(input, options).ok;
}
