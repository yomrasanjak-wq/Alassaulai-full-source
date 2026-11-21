import { describe, expect, it } from "vitest";
import { normalizeSaudiPhone } from "./phoneNumber";

describe("normalizeSaudiPhone", () => {
  it("normalizes common Saudi mobile formats to E.164", () => {
    expect(normalizeSaudiPhone("0501234567")).toBe("+966501234567");
    expect(normalizeSaudiPhone("501234567")).toBe("+966501234567");
    expect(normalizeSaudiPhone("+966501234567")).toBe("+966501234567");
    expect(normalizeSaudiPhone("00966501234567")).toBe("+966501234567");
  });

  it("rejects non-Saudi, landline, and malformed values", () => {
    expect(normalizeSaudiPhone("+971501234567")).toBeNull();
    expect(normalizeSaudiPhone("0112345678")).toBeNull();
    expect(normalizeSaudiPhone("050123")).toBeNull();
    expect(normalizeSaudiPhone(null)).toBeNull();
  });
});
