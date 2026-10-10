// All rodná čísla in this file are synthetic: generated from arbitrary dates and serials
// so that they satisfy the rules. They are not taken from any real person.
import { describe, expect, it } from "vitest";
import { isValidRodneCislo, parseRodneCislo, tryParseRodneCislo } from "../src/index.js";
import { codeOf } from "./helpers.js";

describe("rodné číslo", () => {
  it("parses a 10-digit number of a man", () => {
    expect(parseRodneCislo("850101/1233")).toEqual({
      value: "8501011233",
      formatted: "850101/1233",
      length: 10,
      birthDate: "1985-01-01",
      sex: "male",
      supplementarySeries: false,
      checksumException: false,
    });
  });

  it("decodes women (+50) and accepts input without slash", () => {
    const r = parseRodneCislo("9057151235");
    expect(r.birthDate).toBe("1990-07-15");
    expect(r.sex).toBe("female");
  });

  it("maps two-digit years 00–53 to the 2000s for 10-digit numbers", () => {
    expect(parseRodneCislo("040101/1237").birthDate).toBe("2004-01-01");
    expect(parseRodneCislo("710615/4561").birthDate).toBe("1971-06-15");
  });

  it("decodes the supplementary series (+20 men, +70 women) from 2004", () => {
    const m = parseRodneCislo("102305/1238");
    expect(m).toMatchObject({ birthDate: "2010-03-05", sex: "male", supplementarySeries: true });
    const f = parseRodneCislo("158231/1236");
    expect(f).toMatchObject({ birthDate: "2015-12-31", sex: "female", supplementarySeries: true });
  });

  it("rejects the supplementary series before 2004", () => {
    // 1999, month 22: structurally fine, but +20 did not exist yet
    expect(codeOf(() => parseRodneCislo("992201/0006"))).toBe("InvalidDate");
  });

  it("parses 9-digit numbers for births before 1954 without a checksum", () => {
    expect(parseRodneCislo("530101/123")).toMatchObject({ length: 9, birthDate: "1953-01-01", sex: "male" });
    expect(parseRodneCislo("205315001")).toMatchObject({ length: 9, birthDate: "1920-03-15", sex: "female" });
  });

  it("rejects 9-digit numbers ending in 000 (never generated)", () => {
    expect(codeOf(() => parseRodneCislo("530101/000"))).toBe("InvalidComponent");
  });

  it("reads 10-digit numbers with years 00–53 as 19YY when 20YY would be in the future", () => {
    const ref = new Date("2026-10-09T00:00:00Z");
    expect(parseRodneCislo("500101/1235", { referenceDate: ref }).birthDate).toBe("1950-01-01");
    expect(parseRodneCislo("500101/1235", { referenceDate: new Date("2051-01-01T00:00:00Z") }).birthDate).toBe("2050-01-01");
    expect(parseRodneCislo("040101/1237", { referenceDate: ref }).birthDate).toBe("2004-01-01");
    // supplementary series cannot be read as 19YY
    expect(codeOf(() => parseRodneCislo("302615/4560", { referenceDate: ref }))).toBe("InvalidDate");
  });

  it("rejects 9-digit numbers for births from 1954", () => {
    expect(codeOf(() => parseRodneCislo("540101/123"))).toBe("InvalidDate");
  });

  it("requires divisibility by 11 for 10-digit numbers", () => {
    expect(codeOf(() => parseRodneCislo("850101/1234"))).toBe("InvalidChecksum");
  });

  it("accepts the remainder-10 → 0 exception only for 1954–1985", () => {
    // 750712005 mod 11 = 10, check digit 0
    expect(parseRodneCislo("750712/0050")).toMatchObject({ checksumException: true, birthDate: "1975-07-12" });
    // 900101003 mod 11 = 10, but 1990 is after the exception period
    expect(codeOf(() => parseRodneCislo("900101/0030"))).toBe("InvalidChecksum");
  });

  it("validates the calendar date including leap years", () => {
    expect(parseRodneCislo("000229/1234").birthDate).toBe("2000-02-29");
    expect(codeOf(() => parseRodneCislo("010229/1232"))).toBe("InvalidDate");
    expect(codeOf(() => parseRodneCislo("850132/1233"))).toBe("InvalidDate");
    expect(codeOf(() => parseRodneCislo("851301/1233"))).toBe("InvalidDate");
    expect(codeOf(() => parseRodneCislo("854101/1233"))).toBe("InvalidDate");
    expect(codeOf(() => parseRodneCislo("850100/1233"))).toBe("InvalidDate");
  });

  it("reports format and length errors without echoing the input", () => {
    expect(codeOf(() => parseRodneCislo("85010/11233"))).toBe("InvalidFormat");
    expect(codeOf(() => parseRodneCislo("850101-1233"))).toBe("InvalidFormat");
    expect(codeOf(() => parseRodneCislo("85010112"))).toBe("InvalidLength");
    expect(codeOf(() => parseRodneCislo("850101/12334"))).toBe("InvalidLength");
    const r = tryParseRodneCislo("850101/1234");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).not.toContain("850101");
      expect(r.error.kind).toBe("rodne-cislo");
    }
  });

  it("isValidRodneCislo mirrors parse", () => {
    expect(isValidRodneCislo("850101 / 1233")).toBe(true);
    expect(isValidRodneCislo("")).toBe(false);
  });
});
