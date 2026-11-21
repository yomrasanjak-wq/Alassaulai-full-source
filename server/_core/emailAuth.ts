import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { COOKIE_NAME } from "@shared/const";
import express from "express";
type Request = {
  body: any;
  ip?: string;
  query: Record<string, unknown>;
  headers: import("node:http").IncomingHttpHeaders;
  params: Record<string, string>;
  get(name: string): string | undefined;
};
type Response = {
  setHeader(name: string, value: string): Response;
  cookie(name: string, value: any, options?: any): Response;
  clearCookie(name: string, options?: any): Response;
  status(code: number): Response;
  json(body?: any): Response;
  redirect(statusOrUrl: number | string, url?: string): Response;
  set(name: string, value: string): Response;
};
type Application = ReturnType<typeof express>;
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { normalizeSaudiPhone } from "./phoneNumber";

const CODE_TTL_MINUTES = 10;
const MAX_EMAIL_SENDS_PER_15_MIN = 3;
const MAX_IP_SENDS_PER_15_MIN = 10;
const MAX_PHONE_SENDS_PER_15_MIN = 3;
const MAX_PHONE_SENDS_PER_DAY = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function hmac(value: string): string {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }
  return createHmac("sha256", ENV.cookieSecret).update(value).digest("hex");
}

function codeDigest(email: string, code: string): string {
  return hmac(`alassaul-email-otp:${email}:${code}`);
}

function getSql() {
  if (!ENV.databaseUrl) throw new Error("DATABASE_URL is not configured");
  return neon(ENV.databaseUrl);
}

function noStore(res: Response) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
}

function safeOrigin(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const host = req.get("host");
    return Boolean(
      host &&
      parsed.host.toLowerCase() === host.toLowerCase() &&
      (parsed.protocol === "https:" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

async function sendEmailCode(email: string, code: string): Promise<void> {
  if (!ENV.resendApiKey || !ENV.authEmailFrom) {
    throw new Error("Email OTP provider is not configured");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ENV.authEmailFrom,
      to: [email],
      subject: "رمز الدخول إلى ALASSAUL-AI",
      text: `رمز الدخول الخاص بك هو: ${code}\nتنتهي صلاحيته خلال ${CODE_TTL_MINUTES} دقائق. لا تشاركه مع أي شخص.`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#173d35"><h2>الدخول إلى ALASSAUL-AI</h2><p>استخدم رمز التحقق التالي:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:18px;background:#eef5f1;border-radius:12px;text-align:center">${code}</div><p>تنتهي صلاحية الرمز خلال ${CODE_TTL_MINUTES} دقائق. لا تشاركه مع أي شخص.</p></div>`,
    }),
  });
  if (!response.ok) {
    console.error("[EmailAuth] Resend rejected delivery", response.status);
    throw new Error("Email delivery failed");
  }
}

async function unifonicVerify(phone: string, code?: string): Promise<boolean> {
  if (!ENV.unifonicAuthenticateAppId || !ENV.unifonicAuthenticateToken) {
    throw new Error("Unifonic SMS verification is not configured");
  }
  const endpoint = code
    ? "https://authenticate.cloud.api.unifonic.com/services/api/v2/verifications/check"
    : "https://authenticate.cloud.api.unifonic.com/services/api/v2/verifications/start";
  const body = new URLSearchParams(code
    ? { to: phone, channel: "sms", code }
    : { to: phone, channel: "sms", locale: "ar", length: "6" });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-Authenticate-App-Id": ENV.unifonicAuthenticateAppId,
      Authorization: ENV.unifonicAuthenticateToken,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const result = await response.json().catch(() => ({})) as {
    id?: string;
    response_status?: string;
    error_code?: number;
  };
  if (!response.ok) {
    console.error("[PhoneAuth] Unifonic rejected request", response.status);
    throw new Error("SMS verification provider failed");
  }
  if (!code) {
    if (!result.id || result.response_status !== "correct") {
      throw new Error("SMS provider did not confirm the verification request");
    }
    return true;
  }
  if ([107, 108, 109, 110].includes(Number(result.error_code)) ||
      result.response_status === "incorrect" || result.response_status === "expired") return false;
  return result.error_code === 101 || result.response_status === "correct";
}

async function establishSession(req: Request, res: Response, openId: string, displayName: string) {
  const sessionToken = await sdk.createSessionToken(openId, {
    name: displayName,
    expiresInMs: SESSION_MS,
  });
  res.cookie(COOKIE_NAME, sessionToken, {
    ...getSessionCookieOptions(req),
    sameSite: "lax",
    maxAge: SESSION_MS,
  });
  res.json({ success: true });
}

function serviceUnavailable(res: Response, message: string) {
  res.status(503).json({ error: message });
}

export function registerEmailAuthRoutes(app: Application) {
  app.post("/api/auth/email/request", async (req: Request, res: Response) => {
    noStore(res);
    if (!safeOrigin(req)) {
      res.status(403).json({ error: "تعذر إتمام الطلب." });
      return;
    }
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      res.status(400).json({ error: "أدخل بريدًا إلكترونيًا صحيحًا." });
      return;
    }
    if (!ENV.resendApiKey || !ENV.authEmailFrom || !ENV.databaseUrl || !ENV.cookieSecret) {
      serviceUnavailable(res, "خدمة إرسال رمز البريد غير مهيأة حاليًا. لم يتم إرسال رمز.");
      return;
    }

    let codeId: number | undefined;
    try {
      const sql = getSql();
      const ipHash = hmac(`ip:${req.ip || "unknown"}`);
      const code = String(randomInt(100000, 1000000));
      const lockKey = `email-otp:${email}`;
      const inserted = await sql.query(
        `WITH lock AS MATERIALIZED (
           SELECT pg_advisory_xact_lock(hashtextextended($1, 0))
         ), rate AS MATERIALIZED (
           SELECT
             count(*) FILTER (WHERE email = $2 AND "deliveryStatus" = 'sent' AND "createdAt" > now() - interval '15 minutes')::int AS email_count,
             count(*) FILTER (WHERE "ipHash" = $3 AND "deliveryStatus" = 'sent' AND "createdAt" > now() - interval '15 minutes')::int AS ip_count
           FROM public.email_login_codes, lock
         ), inserted AS (
           INSERT INTO public.email_login_codes (email, "codeHash", "ipHash", "expiresAt", "deliveryStatus")
           SELECT $2, $4, $3, now() + interval '10 minutes', 'pending'
           FROM rate
           WHERE email_count < ${MAX_EMAIL_SENDS_PER_15_MIN}
             AND ip_count < ${MAX_IP_SENDS_PER_15_MIN}
           RETURNING id
         )
         SELECT id FROM inserted`,
        [lockKey, email, ipHash, codeDigest(email, code)],
      ) as Array<{ id: number }>;
      codeId = Number(inserted[0]?.id);
      if (!codeId) {
        res.status(429).json({ error: "تجاوزت عدد طلبات الرمز المسموح. حاول بعد 15 دقيقة.", retryAfter: 900 });
        return;
      }
      try {
        await sendEmailCode(email, code);
        await sql.query(
          'UPDATE public.email_login_codes SET "deliveryStatus" = \'sent\' WHERE id = $1 AND "deliveryStatus" = \'pending\'',
          [codeId],
        );
      } catch (error) {
        await sql.query(
          'UPDATE public.email_login_codes SET "deliveryStatus" = \'failed\', "consumedAt" = now() WHERE id = $1 AND "deliveryStatus" = \'pending\'',
          [codeId],
        ).catch(() => undefined);
        throw error;
      }
      res.json({ success: true, message: "إذا كان البريد صالحًا، فسيصلك رمز التحقق." });
    } catch (error) {
      console.error("[EmailAuth] Could not issue login code", error);
      serviceUnavailable(res, "تعذر إرسال رمز البريد الآن. تحقق من إعداد خدمة البريد ثم أعد المحاولة.");
    }
  });

  app.post("/api/auth/email/verify", async (req: Request, res: Response) => {
    noStore(res);
    if (!safeOrigin(req)) {
      res.status(403).json({ error: "تعذر إتمام الطلب." });
      return;
    }
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!email || !/^\d{6}$/.test(code)) {
      res.status(400).json({ error: "البريد أو رمز التحقق غير صحيح." });
      return;
    }
    if (!ENV.databaseUrl || !ENV.cookieSecret) {
      serviceUnavailable(res, "خدمة تسجيل الدخول غير مهيأة حاليًا.");
      return;
    }

    try {
      const sql = getSql();
      const candidates = await sql.query(
        'SELECT id, "codeHash", attempts FROM public.email_login_codes WHERE email = $1 AND "deliveryStatus" = \'sent\' AND "consumedAt" IS NULL AND "expiresAt" > now() AND attempts < $2 ORDER BY "createdAt" DESC LIMIT 1',
        [email, MAX_VERIFY_ATTEMPTS],
      ) as Array<{ id: number; codeHash: string; attempts: number }>;
      const challenge = candidates[0];
      if (!challenge) {
        res.status(400).json({ error: "البريد أو رمز التحقق غير صحيح، أو انتهت صلاحيته." });
        return;
      }

      const expected = Buffer.from(challenge.codeHash, "hex");
      const supplied = Buffer.from(codeDigest(email, code), "hex");
      const matches = expected.length === supplied.length && timingSafeEqual(expected, supplied);
      if (!matches) {
        await sql.query(
          'UPDATE public.email_login_codes SET attempts = attempts + 1 WHERE id = $1 AND "consumedAt" IS NULL AND attempts < $2',
          [challenge.id, MAX_VERIFY_ATTEMPTS],
        );
        res.status(400).json({ error: "البريد أو رمز التحقق غير صحيح، أو انتهت صلاحيته." });
        return;
      }

      const consumed = await sql.query(
        'UPDATE public.email_login_codes SET "consumedAt" = now() WHERE id = $1 AND "codeHash" = $2 AND "deliveryStatus" = \'sent\' AND "consumedAt" IS NULL AND "expiresAt" > now() AND attempts < $3 RETURNING id',
        [challenge.id, challenge.codeHash, MAX_VERIFY_ATTEMPTS],
      ) as Array<{ id: number }>;
      if (!consumed.length) {
        res.status(400).json({ error: "انتهت صلاحية الرمز أو سبق استخدامه." });
        return;
      }

      const user = await db.linkVerifiedEmailIdentity(email);
      await establishSession(req, res, user.openId, user.name || email);
    } catch (error) {
      console.error("[EmailAuth] Verification could not complete", error);
      serviceUnavailable(res, error instanceof Error ? error.message : "تعذر إكمال تسجيل الدخول الآن.");
    }
  });

  app.post("/api/auth/phone/request", async (req: Request, res: Response) => {
    noStore(res);
    if (!safeOrigin(req)) {
      res.status(403).json({ error: "تعذر إتمام الطلب." });
      return;
    }
    const phone = normalizeSaudiPhone(req.body?.phone);
    if (!phone) {
      res.status(400).json({ error: "أدخل رقم جوال سعودي صحيحًا يبدأ بـ 05." });
      return;
    }
    if (!ENV.unifonicAuthenticateAppId || !ENV.unifonicAuthenticateToken || !ENV.databaseUrl || !ENV.cookieSecret) {
      serviceUnavailable(res, "خدمة الرسائل النصية غير مهيأة حاليًا. لم يتم إرسال رمز.");
      return;
    }

    let requestId: number | undefined;
    try {
      const sql = getSql();
      const ownerPhone = normalizeSaudiPhone(ENV.ownerPhone);
      const isOwner = Boolean(ownerPhone && phone === ownerPhone);
      if (!isOwner) {
        const linked = await sql.query(
          'SELECT 1 AS found FROM public."authIdentities" WHERE "provider" = \'phone_sms\' AND "providerSubject" = $1 LIMIT 1',
          [phone],
        ) as Array<{ found: number }>;
        if (!linked.length) {
          res.status(403).json({ error: "رقم الجوال غير مرتبط بحساب معتمد. اطلب اعتماده أولاً." });
          return;
        }
      }

      const phoneHash = hmac(`phone:${phone}`);
      const inserted = await sql.query(
        `WITH lock AS MATERIALIZED (
           SELECT pg_advisory_xact_lock(hashtextextended($1, 0))
         ), rate AS MATERIALIZED (
           SELECT
             count(*) FILTER (WHERE "deliveryStatus" = 'sent' AND "createdAt" > now() - interval '15 minutes')::int AS recent,
             count(*) FILTER (WHERE "deliveryStatus" = 'sent' AND "createdAt" > now() - interval '24 hours')::int AS daily
           FROM public.phone_login_requests, lock
           WHERE "phoneHash" = $2
         ), inserted AS (
           INSERT INTO public.phone_login_requests ("phoneHash", "deliveryStatus")
           SELECT $2, 'pending' FROM rate
           WHERE recent < ${MAX_PHONE_SENDS_PER_15_MIN} AND daily < ${MAX_PHONE_SENDS_PER_DAY}
           RETURNING id
         )
         SELECT id FROM inserted`,
        [`phone-otp:${phoneHash}`, phoneHash],
      ) as Array<{ id: number }>;
      requestId = Number(inserted[0]?.id);
      if (!requestId) {
        res.status(429).json({ error: "تجاوزت عدد طلبات الرسائل المسموح. حاول لاحقًا.", retryAfter: 900 });
        return;
      }

      try {
        await unifonicVerify(phone);
        await sql.query(
          'UPDATE public.phone_login_requests SET "deliveryStatus" = \'sent\' WHERE id = $1 AND "deliveryStatus" = \'pending\'',
          [requestId],
        );
      } catch (error) {
        await sql.query(
          'UPDATE public.phone_login_requests SET "deliveryStatus" = \'failed\' WHERE id = $1 AND "deliveryStatus" = \'pending\'',
          [requestId],
        ).catch(() => undefined);
        throw error;
      }
      res.json({ success: true, message: "إذا كان الرقم صالحًا، فسيصلك رمز التحقق برسالة SMS." });
    } catch (error) {
      console.error("[PhoneAuth] Could not issue SMS verification", error);
      serviceUnavailable(res, "تعذر إرسال رسالة التحقق الآن. تحقق من إعداد خدمة الرسائل ثم أعد المحاولة.");
    }
  });

  app.post("/api/auth/phone/verify", async (req: Request, res: Response) => {
    noStore(res);
    if (!safeOrigin(req)) {
      res.status(403).json({ error: "تعذر إتمام الطلب." });
      return;
    }
    const phone = normalizeSaudiPhone(req.body?.phone);
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!phone || !/^\d{6}$/.test(code)) {
      res.status(400).json({ error: "رقم الجوال أو رمز التحقق غير صحيح." });
      return;
    }
    if (!ENV.unifonicAuthenticateAppId || !ENV.unifonicAuthenticateToken || !ENV.databaseUrl || !ENV.cookieSecret) {
      serviceUnavailable(res, "خدمة الرسائل النصية غير مهيأة حاليًا.");
      return;
    }

    try {
      const approved = await unifonicVerify(phone, code);
      if (!approved) {
        res.status(400).json({ error: "رمز التحقق غير صحيح أو انتهت صلاحيته." });
        return;
      }
      const user = await db.linkVerifiedPhoneIdentity(phone);
      await establishSession(req, res, user.openId, user.name || phone);
    } catch (error) {
      console.error("[PhoneAuth] Verification could not complete", error);
      serviceUnavailable(res, error instanceof Error ? error.message : "تعذر إكمال تسجيل الدخول الآن.");
    }
  });
}
