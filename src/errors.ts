/**
 * Machine-readable reasons why an identifier was rejected.
 *
 * - `InvalidFormat`: characters or overall shape are wrong (letters where digits belong, bad separators, …).
 * - `InvalidLength`: right characters, wrong number of them.
 * - `InvalidChecksum`: the check digit / checksum does not match.
 * - `InvalidDate`: the date embedded in a rodné číslo does not exist or is not allowed for that number type.
 * - `InvalidComponent`: a part of the identifier is out of its allowed range (e.g. PSČ starting with 0).
 * - `UnknownBankCode`: bank code is not in the bundled ČNB list (only with `requireKnownBankCode`).
 * - `UnsupportedCountry`: IBAN country code is not in the bundled IBAN registry, or is not CZ where CZ is required.
 */
export type ErrorCode =
  | "InvalidFormat"
  | "InvalidLength"
  | "InvalidChecksum"
  | "InvalidDate"
  | "InvalidComponent"
  | "UnknownBankCode"
  | "UnsupportedCountry";

/** Which identifier a {@link CzValidatorError} refers to. */
export type IdentifierKind = "ico" | "dic" | "rodne-cislo" | "bank-account" | "iban" | "psc";

/**
 * The single error class thrown by every `parse*` function in this library.
 * Branch on `code`; `kind` tells which identifier was being parsed.
 * The error message never contains the rejected input, so it is safe to log
 * (this matters for rodná čísla, which are personal data).
 */
export class CzValidatorError extends Error {
  readonly code: ErrorCode;
  readonly kind: IdentifierKind;

  constructor(kind: IdentifierKind, code: ErrorCode, message: string) {
    super(message);
    this.name = "CzValidatorError";
    this.kind = kind;
    this.code = code;
  }
}

/** Result object returned by every `tryParse*` function. Never throws for invalid input. */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CzValidatorError };

/** Narrowing helper: `true` when `err` is a {@link CzValidatorError}. */
export function isCzValidatorError(err: unknown): err is CzValidatorError {
  return err instanceof CzValidatorError;
}

/** @internal */
export function fail(kind: IdentifierKind, code: ErrorCode, message: string): never {
  throw new CzValidatorError(kind, code, message);
}

/** @internal Wraps a throwing function into a `Result`. */
export function attempt<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, value: fn() };
  } catch (err) {
    if (err instanceof CzValidatorError) return { ok: false, error: err };
    throw err;
  }
}

/** @internal Input guard shared by all parsers. */
export function requireString(kind: IdentifierKind, input: unknown): string {
  if (typeof input !== "string") fail(kind, "InvalidFormat", `Expected a string, got ${input === null ? "null" : typeof input}.`);
  return input;
}

/** @internal Removes ASCII spaces, tabs and no-break spaces (common in copied values). */
export function stripSpaces(s: string): string {
  return s.replace(/[\s\u00A0\u202F]+/g, "");
}

/**
 * @internal Upper-cases ASCII letters only. `String#toUpperCase` would also map
 * characters such as "ſ" (long s) or "ﬀ" (ligature) to ASCII letters, letting
 * non-ASCII input pass ASCII-only validation.
 */
export function asciiUpper(s: string): string {
  return s.replace(/[a-z]+/g, (m) => m.toUpperCase());
}
