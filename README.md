# cz-validators

[![CI](https://github.com/gildor853/cz-validators/actions/workflows/ci.yml/badge.svg)](https://github.com/gildor853/cz-validators/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen.svg)

Provided as is, without warranty — see [DISCLAIMER.md](./DISCLAIMER.md).

Zero-dependency TypeScript validators for **Czech identifiers**: IČO, DIČ,
rodné číslo, domestic bank account numbers (with the ČNB bank-code list and
conversion to/from IBAN), IBAN for all registry countries, and PSČ.
Every rule is taken from a cited primary source, and every result is typed.

> 🇨🇿 Validace a normalizace českých identifikátorů: IČO, DIČ, rodné číslo,
> číslo účtu (včetně seznamu kódů bank ČNB a převodu na IBAN), IBAN a PSČ.
> Pravidla podle vyhlášky ČNB 169/2011 Sb., zákona 133/2000 Sb. a dalších
> uvedených zdrojů.

## Why

- **Correct edge cases**: IČO remainder 0/1/10, the rodné číslo
  remainder-10 exception, the +20/+70 month series since 2004, 9-digit
  numbers before 1954, leap days, bank accounts with insignificant leading
  zeros.
- **Typed results, not just booleans**: normalized and formatted values,
  birth date and sex from a rodné číslo, bank name and BIC for an account,
  the kind of a DIČ and whether its checksum could actually be verified.
- **Typed errors** with stable codes (`InvalidChecksum`, `InvalidDate`, …)
  that never echo the input back, so they are safe to log.
- **Bundled reference data with provenance**: ČNB bank codes and the SWIFT
  IBAN Registry country table, committed as source files with dates and URLs.
- **Tiny**: no runtime dependencies, ESM + CJS, tree-shakeable.

## Install

Not published to npm yet. Install a tagged release from GitHub (npm builds
the package during installation):

```sh
npm install github:gildor853/cz-validators#v1.0.0
```

Requires Node.js 18+, or any modern browser / edge runtime (the code uses no
Node.js APIs).

The published package has no runtime dependencies and is verified on
Node.js 18 and 20 by a runtime smoke test in CI. Development (tests) needs
Node.js 22.12+, as required by vitest 5.

## Quick start

```ts
import {
  parseIco,
  parseDic,
  parseRodneCislo,
  parseBankAccount,
  ibanToBankAccount,
  parseIban,
  parsePsc,
  tryParseIco,
} from "cz-validators";

parseIco("481 364 50");
// { value: "48136450" }

parseDic("cz48136450");
// { value: "CZ48136450", digits: "48136450", kind: "legal-entity", checksumVerified: true }

parseRodneCislo("905715/1235"); // synthetic example
// { value: "9057151235", formatted: "905715/1235", length: 10,
//   birthDate: "1990-07-15", sex: "female", supplementarySeries: false, checksumException: false }

parseBankAccount("19-2000145399/0800");
// { prefix: "19", number: "2000145399", bankCode: "0800",
//   formatted: "19-2000145399/0800", bankName: "Česká spořitelna, a.s.",
//   bic: "GIBACZPX", iban: "CZ6508000000192000145399" }

ibanToBankAccount("CZ69 0710 1781 2400 0000 4159").formatted;
// "178124-4159/0710"

parseIban("gb29 nwbk 6016 1331 9268 19");
// { value: "GB29NWBK60161331926819", formatted: "GB29 NWBK 6016 1331 9268 19",
//   country: "GB", checkDigits: "29", bban: "NWBK60161331926819" }

parsePsc("11000").formatted; // "110 00"

const r = tryParseIco("48136451");
if (!r.ok) console.log(r.error.code); // "InvalidChecksum"
```

## API reference

Every identifier has the same three functions:

| Function | Returns | On invalid input |
| --- | --- | --- |
| `parseX(input, options?)` | frozen value object | throws `CzValidatorError` |
| `tryParseX(input, options?)` | `{ ok: true, value } \| { ok: false, error }` | never throws |
| `isValidX(input, options?)` | `boolean` | – |

Whitespace (including no-break spaces) is ignored everywhere.

### IČO – `parseIco` / `tryParseIco` / `isValidIco`

Returns `{ value }` (8 digits). Seven-digit legacy numbers must be written
with their leading zero, as ARES does. `icoCheckDigit(firstSeven)` returns
the check digit.

Rule: weights 8, 7, 6, 5, 4, 3, 2 on the first seven digits,
`r = sum mod 11`, check digit `(11 − r) mod 10`, i.e. **r = 0 → 1,
r = 1 → 0, r = 10 → 1**, otherwise 11 − r. Example: ČNB, IČO 48136450,
sum 155, r = 1, check digit 0.

### DIČ – `parseDic` / `tryParseDic` / `isValidDic`

Returns `{ value: "CZ…", digits, kind, checksumVerified }`. The `CZ` prefix
is optional in the input (`{ requirePrefix: true }` to require it) and
always present in `value`.

| Numeric part | `kind` | What is validated |
| --- | --- | --- |
| 8 digits | `legal-entity` | IČO check digit (the DIČ equals the IČO) |
| 9 digits starting with 6 | `special` | **format only** (`checksumVerified: false`): VAT groups `CZ699nnnnnk` and numbers assigned by the tax office ("VČP"); the check-digit algorithm is not published |
| other 9 or 10 digits | `individual` | full rodné číslo validation (the DIČ equals the RČ) |

Limits: since 2021 an individual (and also a legal entity) may have a DIČ
based on a VČP instead of the RČ/IČO. The format of a VČP is not published;
VČP-based numbers that do not start with 6 and do not happen to satisfy the
IČO/RČ rules are rejected. Validation never proves VAT registration; use the
ADIS register or VIES for that.

### Rodné číslo – `parseRodneCislo` / `tryParseRodneCislo` / `isValidRodneCislo`

Returns `{ value, formatted, length, birthDate, sex, supplementarySeries, checksumException }`.
Accepts `YYMMDDXXXX`, `YYMMDD/XXXX` and the 9-digit forms.

- 10 digits: the whole number must be divisible by 11. Historical exception:
  if the first nine digits leave remainder 10, the check digit 0 is accepted
  (`checksumException: true`), only for birth years up to 1985, when issuing
  such numbers stopped.
- 9 digits: only for births before 1954, no check digit, ending 001–999.
- Month: 1–12 men, +50 women; since 2004 also +20 men / +70 women
  (`supplementarySeries: true`).
- The birth date must exist (leap years included).
- Century: 9-digit → 1900–1953. 10-digit → 1954–1999 for `YY ≥ 54`;
  for `YY ≤ 53` it is 20YY unless that date would be after
  `options.referenceDate` (default: now), then 19YY (10-digit numbers were
  assigned later to some people born before 1954).

> **Privacy.** A rodné číslo is personal data and reveals birth date and sex.
> Do not log it, do not put it in URLs or analytics, and store it only where
> you have a legal basis to do so (GDPR; § 13c of zákon 133/2000 Sb. limits
> who may use it). This library never includes the input in error messages.
> All examples and tests in this repository use synthetic numbers.

### Bank account – `parseBankAccount` / `tryParseBankAccount` / `isValidBankAccount`

Parses `[prefix-]number/bankCode` and returns
`{ prefix, number, bankCode, formatted, bankName, bic, iban }`.

- prefix: optional, up to 6 digits; base number: 2–10 digits with at least two
  non-zero digits; leading zeros are insignificant and removed in
  `formatted`;
- both parts must pass the weighted mod-11 check (weights 6, 3, 7, 9, 10, 5,
  8, 4, 2, 1 on the digits right-aligned to 10 places; the sum must be
  divisible by 11). `isValidAccountPart(digits)` exposes the check;
- bank code: exactly 4 digits. Unknown codes are accepted (with
  `bankName: undefined`) unless `{ requireKnownBankCode: true }`.

Conversions:

- `bankAccountToIban(accountOrParts)` → `{ electronic, formatted }`;
  accepts a string or `{ prefix?, number, bankCode }`.
- `ibanToBankAccount(iban)` / `tryIbanToBankAccount(iban)` → the same object
  as `parseBankAccount`; non-CZ IBANs fail with `UnsupportedCountry`.

A CZ IBAN is `CZ` + 2 check digits + bank code (4) + prefix (6) + number
(10), 24 characters.

### Bank codes – `getBank` / `listBanks` / `BANK_CODES_META`

`getBank("0800")` → `{ code, name, bic, certis }` or `undefined`.
`BANK_CODES_META` records the source URL, retrieval date (2026-10-09) and
the file's last-modified date at ČNB (2026-09-25). The list changes from time
to time; the original CSV is committed in [`data/`](./data) and
`npm run gen:data` regenerates the TypeScript table.

### IBAN – `parseIban` / `tryParseIban` / `isValidIban`

Returns `{ value, formatted, country, checkDigits, bban }`, where `value` is
the electronic format and `formatted` the print format (groups of four).
Checks: characters, per-country length and BBAN structure from the SWIFT
IBAN Registry, and ISO 7064 MOD 97-10. Countries outside the registry fail
with `UnsupportedCountry` unless `{ allowUnknownCountry: true }`.

Helpers: `ibanCheckDigits(country, bban)`, `ibanMod97(iban)`,
`formatIbanGroups(electronic)`, `getIbanCountryFormat(country)`,
`listIbanCountries()` (89 countries).

### PSČ – `parsePsc` / `tryParsePsc` / `isValidPsc`

Returns `{ value: "11000", formatted: "110 00" }`. Five digits, first digit
1–7 (0, 8 and 9 belong to the Slovak series of the former common system).
This is a format check only, not a claim that the code exists.

## Error handling

All failures are `CzValidatorError` with:

- `code`: `InvalidFormat` | `InvalidLength` | `InvalidChecksum` |
  `InvalidDate` | `InvalidComponent` | `UnknownBankCode` | `UnsupportedCountry`
- `kind`: `ico` | `dic` | `rodne-cislo` | `bank-account` | `iban` | `psc`

Non-string input fails with `InvalidFormat`. Messages never contain the input.

```ts
import { tryParseBankAccount } from "cz-validators";

function accountError(userInput: string): string | null {
  const r = tryParseBankAccount(userInput);
  if (r.ok) return null;
  switch (r.error.code) {
    case "InvalidChecksum": return "Číslo účtu nemá platnou kontrolní číslici.";
    case "InvalidFormat":   return "Zadejte účet ve tvaru předčíslí-číslo/kód banky.";
    default:                return "Neplatné číslo účtu.";
  }
}

accountError("19-2000145399/0800"); // null
accountError("19-2000145398/0800"); // "Číslo účtu nemá platnou kontrolní číslici."
```

## Sources

| Topic | Source |
| --- | --- |
| Bank account format and check algorithm | Vyhláška ČNB č. 169/2011 Sb., § 5–6 and annex ([PDF at cnb.cz](https://www.cnb.cz/export/sites/cnb/cs/platebni-styk/.galleries/pravni_predpisy/download/vyhl_169_2011.pdf)) |
| CZ IBAN structure | Vyhláška č. 169/2011 Sb., § 4; ČNB, [IBAN – mezinárodní formát čísla účtu](https://www.cnb.cz/cs/platebni-styk/iban/iban-mezinarodni-format-cisla-uctu/) (examples used in tests) |
| Bank codes | ČNB, [Kódy bank / platebního styku](https://www.cnb.cz/cs/platebni-styk/ucty-kody-bank/), CSV retrieved 2026-10-09 |
| IBAN check digits and country formats | ISO 13616 / ISO 7064; SWIFT [IBAN Registry](https://www.swift.com/standards/data-standards/iban-international-bank-account-number) release 101 (see [`data/iban-registry.txt`](./data/iban-registry.txt) for how it was transcribed) |
| Rodné číslo | Zákon č. 133/2000 Sb., o evidenci obyvatel, § 13; MV ČR, [Rodné číslo](https://mv.gov.cz/docDetail.aspx?docid=21975362&doctype=ART); remainder-10 exception: DASTA/NZIS, [Struktura rodného čísla](https://dastacr.cz/dasta/hypertext/DSBET.htm) |
| DIČ | Zákon č. 280/2009 Sb., daňový řád, § 130; Finanční správa, [nápověda registru plátců DPH](https://adisspr.mfcr.cz/adis/idph/napo_i_dph.htm) and [Informace ke skupinové registraci](https://financnisprava.gov.cz/assets/cs/prilohy/d-seznam-dani/Infor_skupinova_reg.pdf) (format `CZ699nnnnnk`) |
| IČO check digit | Weighted mod-11 as used by ARES / ČSÚ; cross-checked against published IČOs (e.g. ČNB 48136450) |
| PSČ | Česká pošta numbering; leading-digit regions per [cs.wikipedia: Poštovní směrovací číslo](https://cs.wikipedia.org/wiki/Po%C5%A1tovn%C3%AD_sm%C4%9Brovac%C3%AD_%C4%8D%C3%ADslo) |

## Limitations

- All checks are **offline and structural**. A valid result does not mean the
  company, person, account, IBAN or postal code exists or is active.
- DIČ numbers based on a VČP are only partly supported (see above).
- The bundled bank-code list and IBAN registry are snapshots; new bank codes
  or IBAN countries need a library update (or `allowUnknownCountry`).
- The rodné číslo rules cover numbers assigned under Czech (and former
  Czechoslovak) rules; possible future changes to the format are not covered.

## Disclaimer

**Use at your own risk.** This software is provided as is, without warranty of any kind. It is not legal or tax advice. Verify identifiers against official registers. See the full legal text in [DISCLAIMER.md](./DISCLAIMER.md).

## Contributing

This repository is maintained by a single author and does not accept external
contributions; issues and pull requests are limited to collaborators.

Security problems can be reported privately, see [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © 2026 Gildor
