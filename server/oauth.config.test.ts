import type { Express, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

const envNames = ["OAUTH_PORTAL_URL", "VITE_OAUTH_PORTAL_URL", "VITE_APP_ID", "OAUTH_SERVER_URL", "JWT_SECRET", "DATABASE_URL"] as const;
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of envNames) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  vi.resetModules();
});

async function invokeRuntimeConfig() {
  const get = vi.fn();
  const app = { get } as unknown as Express;
  const { registerOAuthRoutes } = await import("./_core/oauth");
  registerOAuthRoutes(app);
  const route = get.mock.calls.find(([path]) => path === "/api/oauth/config")?.at(-1) as ((req: Request, res: Response) => void) | undefined;
  if (!route) throw new Error("OAuth runtime config route was not registered");
  const result: { status?: number; body?: unknown; headers: Record<string, string> } = { headers: {} };
  const response = {
    setHeader: (name: string, value: string) => { result.headers[name] = value; },
    status: (code: number) => { result.status = code; return response; },
    json: (body: unknown) => { result.body = body; return response; },
  } as unknown as Response;
  route({} as Request, response);
  return result;
}

describe("OAuth runtime configuration", () => {
  it("returns only the public portal URL and app id, never secret values", async () => {
    process.env.OAUTH_PORTAL_URL = "https://login.example.test/auth?discard=this";
    process.env.VITE_APP_ID = "qa-app-id";
    process.env.OAUTH_SERVER_URL = "https://oauth-api.example.test";
    process.env.JWT_SECRET = "test-only-not-a-real-secret";
    process.env.DATABASE_URL = "mysql://fixture.invalid/alassaul";
    vi.resetModules();

    const result = await invokeRuntimeConfig();
    expect(result.status).toBeUndefined();
    expect(result.headers["Cache-Control"]).toBe("no-store");
    expect(result.body).toEqual({ oauthPortalUrl: "https://login.example.test", appId: "qa-app-id" });
    expect(JSON.stringify(result.body)).not.toContain("test-only-not-a-real-secret");
    expect(JSON.stringify(result.body)).not.toContain("DATABASE_URL");
  });

  it("lists missing setting names only and returns non-cacheable Arabic-client-compatible failure data", async () => {
    for (const name of envNames) delete process.env[name];
    vi.resetModules();

    const result = await invokeRuntimeConfig();
    expect(result.status).toBe(503);
    expect(result.headers["Cache-Control"]).toBe("no-store");
    expect(result.body).toEqual({
      error: "OAuth login is not fully configured",
      missing: ["OAUTH_PORTAL_URL", "VITE_APP_ID", "OAUTH_SERVER_URL", "JWT_SECRET", "DATABASE_URL"],
    });
  });
});
