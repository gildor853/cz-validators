import { describe, expect, it } from "vitest";
import { CzValidatorError, isCzValidatorError, tryParseIco } from "../src/index.js";
import { asciiUpper, attempt } from "../src/errors.js";

describe("errors", () => {
  it("CzValidatorError carries name, kind, code and message", () => {
    const err = new CzValidatorError("ico", "InvalidChecksum", "bad");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("CzValidatorError");
    expect(err.kind).toBe("ico");
    expect(err.code).toBe("InvalidChecksum");
    expect(err.message).toBe("bad");
  });

  it("isCzValidatorError narrows only library errors", () => {
    expect(isCzValidatorError(new CzValidatorError("psc", "InvalidFormat", "x"))).toBe(true);
    expect(isCzValidatorError(new Error("x"))).toBe(false);
    expect(isCzValidatorError({ kind: "psc", code: "InvalidFormat" })).toBe(false);
    expect(isCzValidatorError(null)).toBe(false);
  });

  it("tryParse* variants return library errors as results", () => {
    const r = tryParseIco("48136451");
    expect(!r.ok && isCzValidatorError(r.error) && r.error.code).toBe("InvalidChecksum");
  });

  it("attempt rethrows anything that is not a library error", () => {
    const bug = new TypeError("bug");
    expect(() =>
      attempt(() => {
        throw bug;
      }),
    ).toThrow(bug);
    expect(attempt(() => 1)).toEqual({ ok: true, value: 1 });
  });

  it("asciiUpper only maps a-z", () => {
    expect(asciiUpper("cz65 abc")).toBe("CZ65 ABC");
    expect(asciiUpper("ſ ﬀ ı é")).toBe("ſ ﬀ ı é");
  });
});
