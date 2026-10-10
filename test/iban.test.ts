import { describe, expect, it } from "vitest";
import {
  formatIbanGroups,
  getIbanCountryFormat,
  ibanCheckDigits,
  isValidIban,
  listIbanCountries,
  parseIban,
  tryParseIban,
} from "../src/index.js";
import { codeOf } from "./helpers.js";

// Examples published by the Czech National Bank:
// https://www.cnb.cz/cs/platebni-styk/iban/iban-mezinarodni-format-cisla-uctu/
const CNB_EXAMPLES = [
  ["CZ6508000000192000145399", "CZ65 0800 0000 1920 0014 5399"],
  ["CZ6907101781240000004159", "CZ69 0710 1781 2400 0000 4159"],
  ["CZ4907100000000000123457", "CZ49 0710 0000 0000 0012 3457"],
] as const;

describe("IBAN", () => {
  it.each(CNB_EXAMPLES)("accepts the ČNB example %s in both formats", (electronic, printed) => {
    const a = parseIban(electronic);
    const b = parseIban(printed);
    expect(a).toEqual(b);
    expect(a).toEqual({ value: electronic, formatted: printed, country: "CZ", checkDigits: electronic.slice(2, 4), bban: electronic.slice(4) });
  });

  it("accepts examples of other countries (SWIFT IBAN Registry)", () => {
    expect(isValidIban("GB29 NWBK 6016 1331 9268 19")).toBe(true);
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("gb29nwbk60161331926819")).toBe(true);
  });

  it("detects a changed digit and swapped digits", () => {
    expect(codeOf(() => parseIban("CZ6508000000192000145398"))).toBe("InvalidChecksum");
    expect(codeOf(() => parseIban("CZ6508000000192000143599"))).toBe("InvalidChecksum");
    expect(codeOf(() => parseIban("CZ5608000000192000145399"))).toBe("InvalidChecksum");
  });

  it("checks the per-country length and BBAN structure", () => {
    expect(codeOf(() => parseIban("CZ650800000019200014539"))).toBe("InvalidLength");
    expect(codeOf(() => parseIban("DE8937040044053201300"))).toBe("InvalidLength");
    // GB BBAN starts with 4 letters
    expect(codeOf(() => parseIban("GB29123460161331926819"))).toBe("InvalidFormat");
  });

  it("rejects unknown countries unless allowed", () => {
    expect(codeOf(() => parseIban("US12345678901234"))).toBe("UnsupportedCountry");
    const iban = `ZZ${ibanCheckDigits("ZZ", "ABC123")}ABC123`;
    expect(parseIban(iban, { allowUnknownCountry: true }).country).toBe("ZZ");
  });

  it("caps unknown-country IBANs at 34 characters", () => {
    const bban = "A".repeat(31);
    const iban = `ZZ${ibanCheckDigits("ZZ", bban.slice(0, 30))}${bban.slice(0, 30)}`;
    expect(parseIban(iban, { allowUnknownCountry: true }).value).toHaveLength(34);
    expect(codeOf(() => parseIban(`ZZ00${bban}`, { allowUnknownCountry: true }))).toBe("InvalidLength");
  });

  it("does not let non-ASCII letters pass via Unicode case mapping", () => {
    // "ſ" (long s) upper-cases to "S", "ﬀ" to "FF" and "ı" to "I".
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(true);
    expect(isValidIban("gb82 west 1234 5698 7654 32")).toBe(true);
    expect(codeOf(() => parseIban("GB82 WEſT 1234 5698 7654 32"))).toBe("InvalidFormat");
    expect(codeOf(() => ibanCheckDigits("GB", "WEſT12345698765432"))).toBe("InvalidFormat");
    expect(codeOf(() => ibanCheckDigits("ﬀ", "123"))).toBe("InvalidFormat");
    expect(getIbanCountryFormat("cı")).toBeUndefined();
    expect(getIbanCountryFormat(42 as never)).toBeUndefined();
  });

  it("parses repeatedly with the cached BBAN structure", () => {
    for (let i = 0; i < 2; i++) expect(isValidIban("CZ65 0800 0000 1920 0014 5399")).toBe(true);
  });

  it("rejects garbage", () => {
    expect(codeOf(() => parseIban("CZ65-0800"))).toBe("InvalidFormat");
    expect(codeOf(() => parseIban(""))).toBe("InvalidFormat");
    expect(tryParseIban("1234").ok).toBe(false);
  });

  it("computes check digits", () => {
    expect(ibanCheckDigits("CZ", "08000000192000145399")).toBe("65");
    expect(ibanCheckDigits("GB", "NWBK60161331926819")).toBe("29");
    expect(codeOf(() => ibanCheckDigits("C1", "123"))).toBe("InvalidFormat");
  });

  it("exposes the registry table", () => {
    expect(getIbanCountryFormat("cz")).toEqual({ country: "CZ", countryName: "Czechia", length: 24, bbanStructure: "4!n16!n" });
    expect(getIbanCountryFormat("SK")?.length).toBe(24);
    expect(getIbanCountryFormat("NO")?.length).toBe(15);
    expect(getIbanCountryFormat("LC")?.length).toBe(32);
    expect(getIbanCountryFormat("US")).toBeUndefined();
    const all = listIbanCountries();
    expect(all.length).toBe(89);
    for (const f of all) expect(f.length).toBeLessThanOrEqual(34);
    expect(formatIbanGroups("NO9386011117947")).toBe("NO93 8601 1117 947");
  });
});
