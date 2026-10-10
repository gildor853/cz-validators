// Runtime smoke test of the built package (ESM entry), run by CI on Node
// versions the test runner no longer supports. No dependencies, no network.
// The bare specifier resolves to ./dist through the package's "exports" map.
import assert from "node:assert/strict";
import { bankAccountToIban, getBank, ibanToBankAccount, parseDic, parseIban, parseIco, parsePsc, parseRodneCislo } from "cz-validators";

assert.equal(parseIco("48136450").value, "48136450");
assert.equal(parseDic("cz 48136450").kind, "legal-entity");
// synthetic rodné číslo
assert.equal(parseRodneCislo("905715/1235").birthDate, "1990-07-15");
assert.equal(bankAccountToIban("19-2000145399/0800").formatted, "CZ65 0800 0000 1920 0014 5399");
assert.equal(ibanToBankAccount("CZ6907101781240000004159").formatted, "178124-4159/0710");
assert.equal(parseIban("GB29 NWBK 6016 1331 9268 19").country, "GB");
assert.equal(getBank("0800")?.bic, "GIBACZPX");
assert.equal(parsePsc("11000").formatted, "110 00");

console.log(`ESM smoke test passed on Node ${process.version}`);
