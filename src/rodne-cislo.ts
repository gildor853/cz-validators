import { attempt, fail, requireString, stripSpaces, type Result } from "./errors.js";

/** A validated rodné číslo (Czech birth number). Treat every field as personal data. */
export interface RodneCislo {
  /** Digits only, no slash, e.g. `"0451015234"`. */
  readonly value: string;
  /** Conventional written form with a slash, e.g. `"045101/5234"`. */
  readonly formatted: string;
  /** Number of digits: 9 (issued for births before 1954) or 10. */
  readonly length: 9 | 10;
  /** Birth date encoded in the number, ISO `YYYY-MM-DD`. */
  readonly birthDate: string;
  /** Sex encoded in the number (month offset +50 / +70 means female). */
  readonly sex: "male" | "female";
  /**
   * `true` when the month uses the supplementary series (+20 men, +70 women)
   * introduced in 2004 for days on which the regular numbers ran out.
   */
  readonly supplementarySeries: boolean;
  /**
   * `true` when the number relies on the historical exception: the first nine digits
   * give remainder 10 modulo 11 and the check digit is 0. Such numbers were issued
   * until 1985 (internal FSÚ rule Č. Vk. 2898/1985, per the DASTA/NZIS description) and are
   * accepted only for birth years up to 1985.
   */
  readonly checksumException: boolean;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Options for {@link parseRodneCislo}. */
export interface ParseRodneCisloOptions {
  /**
   * Used to resolve the century of 10-digit numbers with year digits 00–53: they are read as
   * 20YY unless that birth date would lie after this date, in which case they are read as 19YY
   * (10-digit numbers were also assigned later to some people born before 1954).
   * Default: the current date.
   */
  readonly referenceDate?: Date;
}

/**
 * Parses and validates a rodné číslo per § 13 of zákon č. 133/2000 Sb.:
 *
 * - 10 digits, the whole number divisible by 11; 9 digits only for births before 1954;
 * - YYMMDD prefix; women have +50 on the month; since 2004 a supplementary series
 *   adds +20 (men) / +70 (women);
 * - the encoded date must exist.
 *
 * - 9-digit numbers end in 001–999 (a "000" ending was never generated).
 *
 * An optional slash between the 6th and 7th digit and whitespace are accepted.
 * Error messages never include the input.
 *
 * @throws {CzValidatorError} `InvalidFormat`, `InvalidLength`, `InvalidDate`, `InvalidComponent`, `InvalidChecksum`
 */
export function parseRodneCislo(input: string, options: ParseRodneCisloOptions = {}): RodneCislo {
  const s = stripSpaces(requireString("rodne-cislo", input));
  let digits: string;
  if (/^\d+$/.test(s)) digits = s;
  else if (/^\d{6}\/\d+$/.test(s)) digits = s.replace("/", "");
  else fail("rodne-cislo", "InvalidFormat", "Rodné číslo must be digits, optionally with a slash after the 6th digit.");
  if (digits.length !== 9 && digits.length !== 10) fail("rodne-cislo", "InvalidLength", "Rodné číslo must have 9 or 10 digits.");
  const length = digits.length as 9 | 10;
  const yy = Number(digits.slice(0, 2));
  const mmRaw = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));

  let year: number;
  if (length === 9) {
    if (yy > 53) fail("rodne-cislo", "InvalidDate", "9-digit rodná čísla were issued only for births before 1954.");
    if (digits.endsWith("000")) fail("rodne-cislo", "InvalidComponent", "9-digit rodná čísla never end in 000.");
    year = 1900 + yy;
  } else {
    year = yy >= 54 ? 1900 + yy : 2000 + yy;
  }

  let month: number;
  let sex: "male" | "female";
  let supplementarySeries = false;
  if (mmRaw >= 1 && mmRaw <= 12) {
    month = mmRaw;
    sex = "male";
  } else if (mmRaw >= 51 && mmRaw <= 62) {
    month = mmRaw - 50;
    sex = "female";
  } else if (mmRaw >= 21 && mmRaw <= 32) {
    month = mmRaw - 20;
    sex = "male";
    supplementarySeries = true;
  } else if (mmRaw >= 71 && mmRaw <= 82) {
    month = mmRaw - 70;
    sex = "female";
    supplementarySeries = true;
  } else {
    fail("rodne-cislo", "InvalidDate", "Month part of the rodné číslo is out of range.");
  }
  if (length === 10 && year >= 2000) {
    const ref = options?.referenceDate ?? new Date();
    const refIso = `${ref.getUTCFullYear()}-${pad2(ref.getUTCMonth() + 1)}-${pad2(ref.getUTCDate())}`;
    if (`${year}-${pad2(month)}-${pad2(dd)}` > refIso) year -= 100;
  }
  if (supplementarySeries && year < 2004)
    fail("rodne-cislo", "InvalidDate", "Month offsets +20/+70 are only used for births from 2004 on.");
  if (dd < 1 || dd > daysInMonth(year, month))
    fail("rodne-cislo", "InvalidDate", "Day part of the rodné číslo is not a valid day of that month.");

  let checksumException = false;
  if (length === 10) {
    const remainder = Number(digits.slice(0, 9)) % 11;
    const check = Number(digits[9]);
    if (remainder === 10 && check === 0) {
      if (year > 1985) fail("rodne-cislo", "InvalidChecksum", "Rodné číslo check digit does not match.");
      checksumException = true;
    } else if (remainder !== check) {
      fail("rodne-cislo", "InvalidChecksum", "Rodné číslo check digit does not match.");
    }
  }

  return Object.freeze({
    value: digits,
    formatted: `${digits.slice(0, 6)}/${digits.slice(6)}`,
    length,
    birthDate: `${year}-${pad2(month)}-${pad2(dd)}`,
    sex,
    supplementarySeries,
    checksumException,
  });
}

/** Non-throwing variant of {@link parseRodneCislo}. */
export function tryParseRodneCislo(input: string, options?: ParseRodneCisloOptions): Result<RodneCislo> {
  return attempt(() => parseRodneCislo(input, options));
}

/** `true` when {@link parseRodneCislo} would succeed. */
export function isValidRodneCislo(input: string, options?: ParseRodneCisloOptions): boolean {
  return tryParseRodneCislo(input, options).ok;
}
