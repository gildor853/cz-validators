import { BANK_CODE_ROWS, BANK_CODES_META } from "./data/bank-codes.js";

/** A payment-system participant from the ČNB bank-code list. */
export interface Bank {
  /** Four-digit payment-system code ("kód platebního styku"), e.g. `"0800"`. */
  readonly code: string;
  /** Provider name as published by ČNB, e.g. `"Česká spořitelna, a.s."`. */
  readonly name: string;
  /** BIC (SWIFT) code, or `null` when ČNB lists none. */
  readonly bic: string | null;
  /** Whether the provider is listed as a participant of the CERTIS clearing system. */
  readonly certis: boolean;
}

export { BANK_CODES_META };

const BANKS: ReadonlyMap<string, Bank> = new Map(
  BANK_CODE_ROWS.map(([code, name, bic, certis]) => [code, Object.freeze({ code, name, bic, certis })]),
);

/** Looks up a bank by its 4-digit code in the bundled ČNB list (see {@link BANK_CODES_META} for its date). */
export function getBank(code: string): Bank | undefined {
  return BANKS.get(code);
}

/** All banks in the bundled ČNB list, sorted by code. */
export function listBanks(): readonly Bank[] {
  return [...BANKS.values()];
}
