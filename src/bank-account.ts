import { getBank } from "./banks.js";
import { attempt, fail, requireString, stripSpaces, type Result } from "./errors.js";
import { formatIbanGroups, ibanCheckDigits, parseIban } from "./iban.js";

/** A validated Czech domestic bank account number (`[prefix-]number/bankCode`). */
export interface BankAccount {
  /** Account prefix without leading zeros; `""` when there is none (or it is all zeros). */
  readonly prefix: string;
  /** Base account number without leading zeros (2–10 significant digits). */
  readonly number: string;
  /** Four-digit bank code. */
  readonly bankCode: string;
  /** Canonical domestic form, e.g. `"19-2000145399/0800"` or `"123457/0710"`. */
  readonly formatted: string;
  /** Bank name from the bundled ČNB list, or `undefined` for an unknown code. */
  readonly bankName: string | undefined;
  /** BIC from the bundled ČNB list, or `undefined` when unknown or not listed. */
  readonly bic: string | undefined;
  /** Corresponding CZ IBAN in electronic format. */
  readonly iban: string;
}

/** Options for {@link parseBankAccount}. */
export interface ParseBankAccountOptions {
  /** Reject bank codes that are not in the bundled ČNB list with `UnknownBankCode`. Default `false`. */
  readonly requireKnownBankCode?: boolean;
}

/** Weights from the annex of Vyhláška ČNB č. 169/2011 Sb., applied to digits counted from the right. */
const WEIGHTS = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1] as const;

/**
 * Check algorithm from the annex of Vyhláška č. 169/2011 Sb.: the digits, right-aligned to
 * 10 positions, multiplied by weights 6,3,7,9,10,5,8,4,2,1 must sum to a multiple of 11.
 * Applies to both the prefix and the base number.
 */
export function isValidAccountPart(digits: string): boolean {
  if (typeof digits !== "string" || !/^\d{1,10}$/.test(digits)) return false;
  const padded = digits.padStart(10, "0");
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(padded[i]) * WEIGHTS[i]!;
  return sum % 11 === 0;
}

function build(prefixRaw: string, numberRaw: string, bankCode: string, options: ParseBankAccountOptions): BankAccount {
  if (prefixRaw.length > 6) fail("bank-account", "InvalidLength", "Account prefix can have at most 6 digits.");
  if (numberRaw.length < 2 || numberRaw.length > 10) fail("bank-account", "InvalidLength", "Account number must have 2 to 10 digits.");
  if (bankCode.length !== 4) fail("bank-account", "InvalidLength", "Bank code must have exactly 4 digits.");
  if (numberRaw.replace(/0/g, "").length < 2)
    fail("bank-account", "InvalidComponent", "Account number must contain at least two non-zero digits.");
  if (!isValidAccountPart(prefixRaw === "" ? "0" : prefixRaw))
    fail("bank-account", "InvalidChecksum", "Account prefix fails the mod-11 check.");
  if (!isValidAccountPart(numberRaw)) fail("bank-account", "InvalidChecksum", "Account number fails the mod-11 check.");
  const bank = getBank(bankCode);
  if (!bank && options?.requireKnownBankCode) fail("bank-account", "UnknownBankCode", `Bank code ${bankCode} is not in the ČNB list.`);

  const prefix = prefixRaw.replace(/^0+/, "");
  const number = numberRaw.replace(/^0+/, "");
  const bban = bankCode + prefix.padStart(6, "0") + number.padStart(10, "0");
  return Object.freeze({
    prefix,
    number,
    bankCode,
    formatted: `${prefix === "" ? "" : `${prefix}-`}${number}/${bankCode}`,
    bankName: bank?.name,
    bic: bank?.bic ?? undefined,
    iban: `CZ${ibanCheckDigits("CZ", bban)}${bban}`,
  });
}

/**
 * Parses a domestic account number `[prefix-]number/bankCode` per Vyhláška č. 169/2011 Sb.:
 * prefix up to 6 digits (optional), base number 2–10 digits with at least two non-zero digits,
 * both parts passing the weighted mod-11 check, and a 4-digit bank code. Whitespace is ignored.
 *
 * The bank code is looked up in the bundled ČNB list for `bankName`/`bic`; unknown codes are
 * accepted unless `requireKnownBankCode` is set. Validity does not mean the account exists.
 *
 * @throws {CzValidatorError} `InvalidFormat`, `InvalidLength`, `InvalidComponent`, `InvalidChecksum`, `UnknownBankCode`
 */
export function parseBankAccount(input: string, options: ParseBankAccountOptions = {}): BankAccount {
  const s = stripSpaces(requireString("bank-account", input));
  const m = /^(?:(\d+)-)?(\d+)\/(\d+)$/.exec(s);
  if (!m) fail("bank-account", "InvalidFormat", "Account number must look like [prefix-]number/bankCode.");
  return build(m[1] ?? "", m[2]!, m[3]!, options);
}

/** Non-throwing variant of {@link parseBankAccount}. */
export function tryParseBankAccount(input: string, options?: ParseBankAccountOptions): Result<BankAccount> {
  return attempt(() => parseBankAccount(input, options));
}

/** `true` when {@link parseBankAccount} would succeed. */
export function isValidBankAccount(input: string, options?: ParseBankAccountOptions): boolean {
  return tryParseBankAccount(input, options).ok;
}

/** Parts accepted by {@link bankAccountToIban}. */
export interface BankAccountParts {
  readonly prefix?: string;
  readonly number: string;
  readonly bankCode: string;
}

/**
 * Converts a domestic account to a CZ IBAN (Vyhláška 169/2011 Sb. § 4: `CZ` + 2 check digits
 * + bank code + 6-digit prefix + 10-digit number). Accepts a string or parts; validates first.
 *
 * @returns `{ electronic, formatted }`, e.g. `CZ6508000000192000145399` / `CZ65 0800 0000 1920 0014 5399`.
 * @throws {CzValidatorError} as {@link parseBankAccount}
 */
export function bankAccountToIban(
  account: string | BankAccountParts,
  options: ParseBankAccountOptions = {},
): { readonly electronic: string; readonly formatted: string } {
  let acc: BankAccount;
  if (typeof account === "string") {
    acc = parseBankAccount(account, options);
  } else {
    const prefix = stripSpaces(account.prefix ?? "");
    const number = stripSpaces(account.number);
    const bankCode = stripSpaces(account.bankCode);
    if (!/^\d*$/.test(prefix) || !/^\d+$/.test(number) || !/^\d+$/.test(bankCode))
      fail("bank-account", "InvalidFormat", "Account parts must contain digits only.");
    acc = build(prefix, number, bankCode, options);
  }
  return Object.freeze({ electronic: acc.iban, formatted: formatIbanGroups(acc.iban) });
}

/**
 * Converts a CZ IBAN back to the domestic account form. The IBAN is fully validated
 * (mod-97, length) and the embedded account must pass the domestic checks too.
 *
 * @throws {CzValidatorError} `UnsupportedCountry` for non-CZ IBANs, otherwise as {@link parseIban} / {@link parseBankAccount}
 */
export function ibanToBankAccount(iban: string, options: ParseBankAccountOptions = {}): BankAccount {
  const parsed = parseIban(iban);
  if (parsed.country !== "CZ") fail("bank-account", "UnsupportedCountry", "Only CZ IBANs map to Czech domestic accounts.");
  const b = parsed.bban;
  return build(b.slice(4, 10), b.slice(10), b.slice(0, 4), options);
}

/** Non-throwing variant of {@link ibanToBankAccount}. */
export function tryIbanToBankAccount(iban: string, options?: ParseBankAccountOptions): Result<BankAccount> {
  return attempt(() => ibanToBankAccount(iban, options));
}
