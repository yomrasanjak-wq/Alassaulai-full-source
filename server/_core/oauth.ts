import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Public, non-secret OAuth configuration used by the browser at login time.
  // Keeping this endpoint runtime-based avoids silently broken static builds
  // when VITE_* variables were not available during the Netlify build.
  app.get("/api/oauth/config", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const oauthPortalUrl = process.env.OAUTH_PORTAL_URL ?? process.env.VITE_OAUTH_PORTAL_URL ?? "";
    const appId = ENV.appId;
    // Validate both sides of the OAuth exchange before sending a visitor away.
    // The portal URL starts authorization; OAUTH_SERVER_URL exchanges the code.
    const missing: string[] = [];
    if (!oauthPortalUrl.trim()) missing.push("OAUTH_PORTAL_URL");
    if (!appId.trim()) missing.push("VITE_APP_ID");
    if (!ENV.oAuthServerUrl.trim()) missing.push("OAUTH_SERVER_URL");
    if (!ENV.cookieSecret.trim()) missing.push("JWT_SECRET");
    if (!ENV.databaseUrl.trim()) missing.push("DATABASE_URL");
    if (missing.length) {
      res.status(503).json({ error: "OAuth login is not fully configured", missing });
      return;
    }
    try {
      const parsed = new URL(oauthPortalUrl);
      if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
        res.status(503).json({ error: "OAuth portal must use HTTPS" });
        return;
      }
      res.json({ oauthPortalUrl: parsed.origin, appId });
    } catch {
      res.status(503).json({ error: "OAuth portal URL is invalid" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF guard: the nonce in `state` must match the one-time cookie that
    // startLogin set in the browser that began this login. An attacker can
    // forge `state`, but cannot plant this cookie in the victim's browser.
    // decodeOAuthState intentionally tolerates malformed input and returns no nonce.
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
