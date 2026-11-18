import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./env";
import {
  createEmailOtp,
  hashEmailOtp,
  hashRequestIp,
  normalizeLoginEmail,
  verifyEmailOtpHash,
} from "./emailOtp";

const originalSecret = ENV.cookieSecret;
afterEach(() => {
  ENV.cookieSecret = originalSecret;
});

describe("independent email OTP primitives", () => {
  it("normalizes email addresses consistently", () => {
    expect(normalizeLoginEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("creates six-digit one-time codes", () => {
    for (let index = 0; index < 20; index += 1) {
      expect(createEmailOtp()).toMatch(/^\d{6}$/);
    }
  });

  it("stores a keyed digest and verifies it without storing the raw code", () => {
    ENV.cookieSecret = "test-only-secret-with-at-least-32-characters";
    const email = "owner@example.com";
    const code = "042681";
    const digest = hashEmailOtp(email, code);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(code);
    expect(verifyEmailOtpHash(email, code, digest)).toBe(true);
    expect(verifyEmailOtpHash(email, "042680", digest)).toBe(false);
  });

  it("uses a keyed, deterministic hash for request IP throttling", () => {
    ENV.cookieSecret = "test-only-secret-with-at-least-32-characters";
    const first = hashRequestIp("203.0.113.10");
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(hashRequestIp("203.0.113.10"));
    expect(first).not.toContain("203.0.113.10");
  });
});
