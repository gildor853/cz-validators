import { CzValidatorError } from "../src/index.js";

/** Runs `fn` and returns the `code` of the thrown CzValidatorError (or fails the test). */
export function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    if (err instanceof CzValidatorError) return err.code;
    throw err;
  }
  throw new Error("expected a CzValidatorError, but nothing was thrown");
}
