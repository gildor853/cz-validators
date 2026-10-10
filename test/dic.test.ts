import { describe, expect, it } from "vitest";
import { isValidDic, parseDic, tryParseDic } from "../src/index.js";
import { codeOf } from "./helpers.js";

describe("DIČ", () => {
  it("treats CZ + 8 digits as a legal entity and verifies the IČO check digit", () => {
    expect(parseDic("CZ48136450")).toEqual({ value: "CZ48136450", digits: "48136450", kind: "legal-entity", checksumVerified: true });
    expect(codeOf(() => parseDic("CZ48136451"))).toBe("InvalidChecksum");
  });

  it("treats CZ + 9/10 digits as an individual and validates the rodné číslo (synthetic)", () => {
    expect(parseDic("CZ8501011233")).toMatchObject({ kind: "individual", checksumVerified: true });
    expect(parseDic("CZ530101123")).toMatchObject({ kind: "individual" });
    expect(codeOf(() => parseDic("CZ8501011234"))).toBe("InvalidChecksum");
    expect(codeOf(() => parseDic("CZ8513011233"))).toBe("InvalidDate");
  });

  it("format-checks 9-digit numbers starting with 6 (VAT groups CZ699…, VČP)", () => {
    expect(parseDic("CZ699000001")).toEqual({ value: "CZ699000001", digits: "699000001", kind: "special", checksumVerified: false });
  });

  it("normalizes case, spaces and an optional prefix", () => {
    expect(parseDic(" cz 481 364 50").value).toBe("CZ48136450");
    expect(parseDic("48136450").value).toBe("CZ48136450");
    expect(codeOf(() => parseDic("48136450", { requirePrefix: true }))).toBe("InvalidFormat");
  });

  it("rejects bad formats and lengths", () => {
    expect(codeOf(() => parseDic("SK48136450"))).toBe("InvalidFormat");
    expect(codeOf(() => parseDic("CZ4813645"))).toBe("InvalidLength");
    expect(codeOf(() => parseDic("CZ12345678901"))).toBe("InvalidLength");
    expect(isValidDic("CZ")).toBe(false);
    const r = tryParseDic("CZ48136451");
    if (r.ok) throw new Error("expected failure");
    expect(r.error.kind).toBe("dic");
  });
});
