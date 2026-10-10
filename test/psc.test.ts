import { describe, expect, it } from "vitest";
import { isValidPsc, parsePsc, tryParsePsc } from "../src/index.js";
import { codeOf } from "./helpers.js";

describe("PSČ", () => {
  it("normalizes and formats", () => {
    expect(parsePsc("11000")).toEqual({ value: "11000", formatted: "110 00" });
    expect(parsePsc("602 00").formatted).toBe("602 00");
    expect(parsePsc(" 739\u00A061 ").value).toBe("73961");
  });

  it("rejects bad input", () => {
    expect(codeOf(() => parsePsc("1100"))).toBe("InvalidLength");
    expect(codeOf(() => parsePsc("110-00"))).toBe("InvalidFormat");
    expect(codeOf(() => parsePsc("01001"))).toBe("InvalidComponent");
    expect(codeOf(() => parsePsc("81101"))).toBe("InvalidComponent");
    expect(codeOf(() => parsePsc("94901"))).toBe("InvalidComponent");
    expect(isValidPsc("79862")).toBe(true);
    expect(tryParsePsc("x").ok).toBe(false);
  });
});
