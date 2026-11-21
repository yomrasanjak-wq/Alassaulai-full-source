import type { Express, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

type Handler = (req: Request, res: Response) => Promise<void>;

async function getRoutes() {
  const routes = new Map<string, Handler>();
  const app = {
    post: (path: string, handler: Handler) => routes.set(path, handler),
  } as unknown as Express;
  const { registerEmailAuthRoutes } = await import("./emailAuth");
  registerEmailAuthRoutes(app);
  return routes;
}

function request(body: unknown): Request {
  return {
    body,
    ip: "192.0.2.10",
    get: (name: string) => name.toLowerCase() === "origin"
      ? "https://alassaul.com"
      : name.toLowerCase() === "host" ? "alassaul.com" : undefined,
  } as unknown as Request;
}

function response() {
  const result: { statusCode: number; body?: unknown; headers: Record<string, string> } = {
    statusCode: 200,
    headers: {},
  };
  const res = {
    setHeader: (name: string, value: string) => { result.headers[name] = value; },
    status: (code: number) => { result.statusCode = code; return res; },
    json: (body: unknown) => { result.body = body; return res; },
  } as unknown as Response;
  return { res, result };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("independent OTP provider readiness", () => {
  it("returns 503 and does not claim success when email delivery is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("ALASSAUL_AUTH_EMAIL_FROM", "");
    vi.stubEnv("DATABASE_URL", "postgres://preview.invalid/db");
    vi.stubEnv("JWT_SECRET", "test-only-secret-with-at-least-32-characters");
    vi.resetModules();

    const routes = await getRoutes();
    const handler = routes.get("/api/auth/email/request");
    expect(handler).toBeDefined();
    const { res, result } = response();
    await handler!(request({ email: "visitor@example.com" }), res);

    expect(result.statusCode).toBe(503);
    expect(result.body).toMatchObject({ error: expect.stringContaining("غير مهيأة") });
  });

  it("returns 503 and does not claim success when SMS delivery is not configured", async () => {
    vi.stubEnv("UNIFONIC_AUTHENTICATE_APP_ID", "");
    vi.stubEnv("UNIFONIC_AUTHENTICATE_TOKEN", "");
    vi.stubEnv("DATABASE_URL", "postgres://preview.invalid/db");
    vi.stubEnv("JWT_SECRET", "test-only-secret-with-at-least-32-characters");
    vi.stubEnv("ALASSAUL_OWNER_PHONE", "");
    vi.resetModules();

    const routes = await getRoutes();
    const handler = routes.get("/api/auth/phone/request");
    expect(handler).toBeDefined();
    const { res, result } = response();
    await handler!(request({ phone: "0501234567" }), res);

    expect(result.statusCode).toBe(503);
    expect(result.body).toMatchObject({ error: expect.stringContaining("غير مهيأة") });
  });
});
