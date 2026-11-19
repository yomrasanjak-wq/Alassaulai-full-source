import { describe, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
import { registerEmailAuthRoutes } from "./_core/emailAuth";

type Handler = (req: Request, res: Response) => Promise<void>;

function setup() {
  const routes = new Map<string, Handler>();
  const app = {
    post: (path: string, handler: Handler) => routes.set(path, handler),
  } as unknown as Express;
  registerEmailAuthRoutes(app);
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    setHeader(name: string, value: string) { this.headers[name] = value; return this; },
    cookie: vi.fn(),
  };
  return { routes, response };
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return {
    body,
    headers,
    ip: "203.0.113.10",
  } as unknown as Request;
}

describe("independent email authentication routes", () => {
  it("rejects malformed email before touching database or mail provider", async () => {
    const { routes, response } = setup();
    await routes.get("/api/auth/email/request")!(request({ email: "not-an-email" }), response as unknown as Response);
    expect(response.statusCode).toBe(400);
    expect(response.headers["Cache-Control"]).toContain("no-store");
  });

  it("rejects cross-origin code requests", async () => {
    const { routes, response } = setup();
    await routes.get("/api/auth/email/request")!(
      request({ email: "visitor@example.com" }, { origin: "https://attacker.example", host: "alassaul.com" }),
      response as unknown as Response,
    );
    expect(response.statusCode).toBe(403);
  });

  it("rejects malformed Saudi phone numbers before contacting the SMS provider", async () => {
    const { routes, response } = setup();
    await routes.get("/api/auth/phone/request")!(
      request({ phone: "0112345678" }),
      response as unknown as Response,
    );
    expect(response.statusCode).toBe(400);
    expect(response.headers["Cache-Control"]).toContain("no-store");
  });

  it("rejects malformed phone verification codes without issuing a session", async () => {
    const { routes, response } = setup();
    await routes.get("/api/auth/phone/verify")!(
      request({ phone: "0592901010", code: "123" }),
      response as unknown as Response,
    );
    expect(response.statusCode).toBe(400);
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it("rejects malformed verification codes without issuing a session", async () => {
    const { routes, response } = setup();
    await routes.get("/api/auth/email/verify")!(
      request({ email: "visitor@example.com", code: "123" }),
      response as unknown as Response,
    );
    expect(response.statusCode).toBe(400);
    expect(response.cookie).not.toHaveBeenCalled();
  });
});
