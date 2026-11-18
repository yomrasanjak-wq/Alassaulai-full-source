import { describe, expect, it } from "vitest";
import { normalizeSaudiPhone } from "./_core/phoneNumber";

describe("normalizeSaudiPhone", () => {
  it("normalizes the Saudi local mobile format", () => {
    expect(normalizeSaudiPhone("0592901010")).toBe("+966592901010");
  });

  it("accepts E.164 and international 00 prefix", () => {
    expect(normalizeSaudiPhone("+966592901010")).toBe("+966592901010");
    expect(normalizeSaudiPhone("00966592901010")).toBe("+966592901010");
  });

  it("accepts a nine-digit mobile without the trunk zero", () => {
    expect(normalizeSaudiPhone("592901010")).toBe("+966592901010");
  });

  it("rejects malformed numbers and non-mobile Saudi prefixes", () => {
    expect(normalizeSaudiPhone("059290101")).toBeNull();
    expect(normalizeSaudiPhone("0112345678")).toBeNull();
    expect(normalizeSaudiPhone("+971592901010")).toBeNull();
    expect(normalizeSaudiPhone(null)).toBeNull();
  });
});
