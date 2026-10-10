import { describe, expect, it } from "vitest";
import { icoCheckDigit, isValidIco, parseIco, tryParseIco } from "../src/index.js";
import { codeOf } from "./helpers.js";

describe("IČO", () => {
  it("accepts the IČO of the Czech National Bank (48136450, remainder 1 → check digit 0)", () => {
    // 4·8 + 8·7 + 1·6 + 3·5 + 6·4 + 4·3 + 5·2 = 155, 155 mod 11 = 1
    expect(parseIco("48136450")).toEqual({ value: "48136450" });
    expect(icoCheckDigit("4813645")).toBe(0);
  });

  it("maps remainder 0 to check digit 1", () => {
    // 2·8 + 5·7 + 5·6 + 9·5 + 6·4 + 6·3 + 4·2 = 176, 176 mod 11 = 0
    expect(icoCheckDigit("2559664")).toBe(1);
    expect(isValidIco("25596641")).toBe(true);
    expect(isValidIco("25596640")).toBe(false);
  });

  it("maps remainder 10 to check digit 1", () => {
    // 1·8 + 1·2 = 10
    expect(icoCheckDigit("1000001")).toBe(1);
    expect(isValidIco("10000011")).toBe(true);
    expect(isValidIco("10000010")).toBe(false);
  });

  it("uses 11 − remainder otherwise", () => {
    // 0·8 + 3·7 + 6·6 + 8·5 + 0·4 + 8·3 + 4·2 = 129, 129 mod 11 = 8 → 3
    expect(icoCheckDigit("0368084")).toBe(3);
    expect(isValidIco("03680843")).toBe(true);
  });

  it("ignores whitespace", () => {
    expect(parseIco(" 481 364 50 ").value).toBe("48136450");
  });

  it("reports typed errors", () => {
    expect(codeOf(() => parseIco("4813645"))).toBe("InvalidLength");
    expect(codeOf(() => parseIco("481364500"))).toBe("InvalidLength");
    expect(codeOf(() => parseIco("4813645A"))).toBe("InvalidFormat");
    expect(codeOf(() => parseIco("48136451"))).toBe("InvalidChecksum");
    expect(codeOf(() => parseIco(12345678 as unknown as string))).toBe("InvalidFormat");
    const r = tryParseIco("48136451");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("ico");
  });

  it("validates icoCheckDigit input", () => {
    expect(codeOf(() => icoCheckDigit("123"))).toBe("InvalidFormat");
  });

  it("returns frozen values", () => {
    expect(Object.isFrozen(parseIco("48136450"))).toBe(true);
  });
});
