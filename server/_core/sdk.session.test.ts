import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("first-party session tokens", () => {
  it("creates a verifiable ALASSAUL session without a Manus app id", async () => {
    vi.stubEnv("JWT_SECRET", "test-only-session-secret-with-more-than-32-characters");
    vi.stubEnv("VITE_APP_ID", "");
    vi.stubEnv("OAUTH_SERVER_URL", "");
    vi.resetModules();

    const { sdk } = await import("./sdk");
    const token = await sdk.createSessionToken("canonical-user-open-id", {
      name: "ALASSAUL Test User",
      expiresInMs: 60_000,
    });
    const session = await sdk.verifySession(token);

    expect(session).toEqual({
      openId: "canonical-user-open-id",
      appId: "alassaul-first-party",
      name: "ALASSAUL Test User",
    });
  });
});
