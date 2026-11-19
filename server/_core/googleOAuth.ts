import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { Express, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const STATE_COOKIE = "__Host-alassaul_google_state";
const NONCE_COOKIE = "__Host-alassaul_google_nonce";
const VERIFIER_COOKIE = "__Host-alassaul_google_verifier";
const FLOW_MAX_AGE = 10 * 60 * 1000;

function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
function sha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}
function safeEqual(a: string | undefined, b: string | undefined) {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function originFor(req: Request) {
  const protoHeader = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = protoHeader || req.protocol;
  const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
  if (!host || (proto !== "https" && !/^localhost(?::\d+)?$/i.test(host))) {
    throw new Error("تعذر تحديد عنوان آمن لإكمال تسجيل الدخول.");
  }
  return `${proto}://${host}`;
}
function clearFlowCookies(res: Response) {
  const options = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  for (const name of [STATE_COOKIE, NONCE_COOKIE, VERIFIER_COOKIE]) res.clearCookie(name, options);
}
function flowCookieOptions() {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: FLOW_MAX_AGE };
}

export function registerGoogleOAuthRoutes(app: Express) {
  app.get("/api/auth/google", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    if (!ENV.googleClientId || !ENV.googleClientSecret || !ENV.cookieSecret || !ENV.databaseUrl || !ENV.appId) {
      res.status(503).send("تسجيل الدخول عبر Google غير مهيأ بعد على نسخة المعاينة.");
      return;
    }
    try {
      const redirectUri = `${originFor(req)}/api/auth/google/callback`;
      const state = randomToken();
      const nonce = randomToken();
      const verifier = randomToken(48);
      const options = flowCookieOptions();
      res.cookie(STATE_COOKIE, state, options);
      res.cookie(NONCE_COOKIE, nonce, options);
      res.cookie(VERIFIER_COOKIE, verifier, options);
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", ENV.googleClientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      url.searchParams.set("nonce", nonce);
      url.searchParams.set("code_challenge", sha256(verifier));
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("prompt", "select_account");
      res.redirect(302, url.toString());
    } catch (error) {
      console.error("[Google OAuth] Could not start login", error);
      res.status(400).send("تعذر بدء تسجيل الدخول الآمن.");
    }
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const expectedState = cookies[STATE_COOKIE];
    const nonce = cookies[NONCE_COOKIE];
    const verifier = cookies[VERIFIER_COOKIE];
    clearFlowCookies(res);
    if (!code || !safeEqual(state, expectedState) || !nonce || !verifier) {
      res.status(403).send("انتهت جلسة التحقق أو لم تطابق بيانات الحماية. أعد المحاولة من الموقع.");
      return;
    }
    if (!ENV.googleClientId || !ENV.googleClientSecret || !ENV.cookieSecret || !ENV.databaseUrl || !ENV.appId) {
      res.status(503).send("إعدادات تسجيل الدخول عبر Google غير مكتملة.");
      return;
    }

    try {
      const redirectUri = `${originFor(req)}/api/auth/google/callback`;
      const tokenBody = new URLSearchParams({
        code,
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      });
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: tokenBody,
      });
      const tokens = await tokenResponse.json() as { id_token?: string; error?: string };
      if (!tokenResponse.ok || !tokens.id_token) {
        console.error("[Google OAuth] Token exchange rejected", tokens.error ?? tokenResponse.status);
        res.status(401).send("رفض Google إكمال التحقق. أعد المحاولة.");
        return;
      }

      const { payload } = await jwtVerify(tokens.id_token, GOOGLE_JWKS, {
        issuer: GOOGLE_ISSUERS,
        audience: ENV.googleClientId,
        algorithms: ["RS256"],
      });
      const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const googleSub = typeof payload.sub === "string" ? payload.sub : "";
      const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 200) : "";
      if (!googleSub || !email || payload.email_verified !== true || payload.nonce !== nonce) {
        res.status(401).send("تعذر إثبات هوية حساب Google أو أن البريد غير موثّق.");
        return;
      }

      const alreadyLinked = await db.getUserByGoogleSub(googleSub);
      let user = alreadyLinked;
      if (user && user.email?.toLowerCase() !== email) {
        res.status(403).send("بيانات حساب Google لا تطابق الحساب المرتبط سابقاً.");
        return;
      }
      if (!user) {
        user = await db.getUserByVerifiedEmail(email);
        if (user) {
          user = await db.linkGoogleIdentity(user.openId, googleSub);
        } else {
          const openId = `google_${googleSub}`.slice(0, 64);
          await db.upsertUser({
            openId,
            googleSub,
            name: name || null,
            email,
            loginMethod: "google",
            lastSignedIn: new Date(),
          });
          user = await db.getUserByOpenId(openId);
        }
      }
      if (!user) throw new Error("تعذر إنشاء جلسة حساب Google.");
      await db.upsertUser({ openId: user.openId, name: user.name || name || null, email, loginMethod: "google", lastSignedIn: new Date() });
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      res.status(500).send("تعذر إكمال تسجيل الدخول. لم يتم حذف أو تغيير بيانات الحساب؛ أعد المحاولة لاحقاً.");
    }
  });
}
