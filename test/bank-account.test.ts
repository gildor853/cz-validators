import { describe, expect, it } from "vitest";
import {
  BANK_CODES_META,
  bankAccountToIban,
  getBank,
  ibanToBankAccount,
  isValidAccountPart,
  isValidBankAccount,
  listBanks,
  parseBankAccount,
  tryIbanToBankAccount,
  tryParseBankAccount,
} from "../src/index.js";
import { codeOf } from "./helpers.js";

describe("bank account", () => {
  it("parses the ČNB example 19-2000145399/0800", () => {
    expect(parseBankAccount("19-2000145399/0800")).toEqual({
      prefix: "19",
      number: "2000145399",
      bankCode: "0800",
      formatted: "19-2000145399/0800",
      bankName: "Česká spořitelna, a.s.",
      bic: "GIBACZPX",
      iban: "CZ6508000000192000145399",
    });
  });

  it("converts the ČNB examples to and from IBAN", () => {
    const cases = [
      ["19-2000145399/0800", "CZ6508000000192000145399", "CZ65 0800 0000 1920 0014 5399"],
      ["178124-4159/0710", "CZ6907101781240000004159", "CZ69 0710 1781 2400 0000 4159"],
      ["123457/0710", "CZ4907100000000000123457", "CZ49 0710 0000 0000 0012 3457"],
    ] as const;
    for (const [domestic, electronic, formatted] of cases) {
      expect(bankAccountToIban(domestic)).toEqual({ electronic, formatted });
      expect(ibanToBankAccount(formatted).formatted).toBe(domestic);
    }
    expect(parseBankAccount("19-123457/0710").bankName).toBe("ČESKÁ NÁRODNÍ BANKA");
  });

  it("accepts parts objects", () => {
    expect(bankAccountToIban({ prefix: "000019", number: "2000145399", bankCode: "0800" }).electronic).toBe("CZ6508000000192000145399");
    expect(bankAccountToIban({ number: "123457", bankCode: "0710" }).electronic).toBe("CZ4907100000000000123457");
    expect(codeOf(() => bankAccountToIban({ number: "12a457", bankCode: "0710" }))).toBe("InvalidFormat");
  });

  it("strips insignificant leading zeros and whitespace", () => {
    const a = parseBankAccount(" 000019 - 2000145399 / 0800 ");
    expect(a.formatted).toBe("19-2000145399/0800");
    expect(parseBankAccount("0-0000123457/0710").formatted).toBe("123457/0710");
  });

  it("implements the weighted mod-11 check (Vyhláška 169/2011 Sb.)", () => {
    expect(isValidAccountPart("2000145399")).toBe(true);
    expect(isValidAccountPart("19")).toBe(true);
    expect(isValidAccountPart("178124")).toBe(true);
    expect(isValidAccountPart("2000145398")).toBe(false);
    expect(isValidAccountPart("12345678901")).toBe(false);
    expect(codeOf(() => parseBankAccount("19-2000145398/0800"))).toBe("InvalidChecksum");
    expect(codeOf(() => parseBankAccount("18-2000145399/0800"))).toBe("InvalidChecksum");
  });

  it("enforces the length and non-zero digit rules", () => {
    expect(codeOf(() => parseBankAccount("1234567-2000145399/0800"))).toBe("InvalidLength");
    expect(codeOf(() => parseBankAccount("12345678901/0800"))).toBe("InvalidLength");
    expect(codeOf(() => parseBankAccount("1/0800"))).toBe("InvalidLength");
    expect(codeOf(() => parseBankAccount("2000145399/800"))).toBe("InvalidLength");
    // "0000000000" passes mod 11 trivially, but needs at least two non-zero digits
    expect(codeOf(() => parseBankAccount("0000000000/0800"))).toBe("InvalidComponent");
  });

  it("rejects malformed input", () => {
    expect(codeOf(() => parseBankAccount("2000145399"))).toBe("InvalidFormat");
    expect(codeOf(() => parseBankAccount("19--2000145399/0800"))).toBe("InvalidFormat");
    expect(codeOf(() => parseBankAccount("CZ6508000000192000145399"))).toBe("InvalidFormat");
    expect(isValidBankAccount("abc")).toBe(false);
    const r = tryParseBankAccount("19-2000145398/0800");
    if (r.ok) throw new Error("expected failure");
    expect(r.error.kind).toBe("bank-account");
  });

  it("handles unknown bank codes", () => {
    const a = parseBankAccount("19-2000145399/9999");
    expect(a.bankName).toBeUndefined();
    expect(a.bic).toBeUndefined();
    expect(codeOf(() => parseBankAccount("19-2000145399/9999", { requireKnownBankCode: true }))).toBe("UnknownBankCode");
  });

  it("refuses non-CZ IBANs in ibanToBankAccount", () => {
    expect(codeOf(() => ibanToBankAccount("DE89370400440532013000"))).toBe("UnsupportedCountry");
    expect(tryIbanToBankAccount("CZ6508000000192000145398").ok).toBe(false);
  });
});

describe("ČNB bank codes", () => {
  it("looks up banks", () => {
    expect(getBank("0100")).toEqual({ code: "0100", name: "Komerční banka, a.s.", bic: "KOMBCZPP", certis: true });
    expect(getBank("2010")?.name).toBe("Fio banka, a.s.");
    expect(getBank("5500")?.bic).toBe("RZBCCZPP");
    expect(getBank("0000")).toBeUndefined();
  });

  it("has the documented provenance and sane rows", () => {
    expect(BANK_CODES_META.retrieved).toBe("2026-10-09");
    const all = listBanks();
    expect(all.length).toBe(47);
    const codes = all.map((b) => b.code);
    expect([...codes].sort()).toEqual(codes);
    for (const b of all) {
      expect(b.code).toMatch(/^\d{4}$/);
      expect(b.name).toBe(b.name.trim());
      if (b.bic !== null) expect(b.bic).toMatch(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/);
    }
  });
});
