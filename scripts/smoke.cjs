// Runtime smoke test of the built package (CJS entry). See smoke.mjs.
"use strict";
const assert = require("node:assert/strict");
const { parseBankAccount, tryParseIco, tryParseRodneCislo, CzValidatorError } = require("cz-validators");

assert.equal(parseBankAccount("123457/0710").iban, "CZ4907100000000000123457");
const bad = tryParseIco("48136451");
assert.equal(bad.ok, false);
assert.ok(bad.error instanceof CzValidatorError);
assert.equal(bad.error.code, "InvalidChecksum");
assert.equal(tryParseRodneCislo("010229/1232").ok, false);

console.log(`CJS smoke test passed on Node ${process.version}`);
