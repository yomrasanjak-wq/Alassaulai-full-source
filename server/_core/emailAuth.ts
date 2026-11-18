import { createHash, createHmac, randomInt } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { COOKIE_NAME } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

const CODE_TTL_MINUTES = 10;
const MAX_EMAIL_SENDS_PER_15_MIN = 3;
const MAX_IP_SENDS_PER_15_MIN = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const EMAIL_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function codeDigest(email: string, code: string): string {
  return createHmac("sha256", ENV.cookieSecret).update(`alassaul-email-otp:${email}:${code}`).digest("hex");
}


function normalizeSaudiPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/[\s()-]/g, "");
  const phone = compact.startsWith("05")
    ? `+966${compact.slice(1)}`
    : compact.startsWith("5") && compact.length === 9
      ? `+966${compact}`
      : compact.startsWith("00966")
        ? `+${compact.slice(2)}`
        : compact;
  return /^\+9665\d{8}$/.test(phone) ? phone : null;
}

async function unifonicVerify(phone: string, code?: string): Promise<boolean> {
  const { unifonicAuthenticateAppId, unifonicAuthenticateToken } = ENV;
  if (!unifonicAuthenticateAppId || !unifonicAuthenticateToken) {
    throw new Error("Independent Saudi SMS verification is not configured");
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
      "X-Authenticate-App-Id": unifonicAuthenticateAppId,
      Authorization: unifonicAuthenticateToken,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const result = await response.json().catch(() => ({})) as {
    response_status?: string;
    error_code?: number;
    message?: string;
  };

  if (code) {
    if (result.error_code === 107 || result.error_code === 108 ||
        result.error_code === 109 || result.error_code === 110 ||
        result.response_status === "incorrect" || result.response_status === "expired") {
      return false;
    }
    if (!response.ok) {
      console.error("[PhoneAuth] Verification provider rejected check", response.status);
      throw new Error("SMS verification provider failed");
    }
    return result.error_code === 101 || result.response_status === "correct";
  }

  if (!response.ok) {
    console.error("[PhoneAuth] Verification provider rejected send", response.status);
    throw new Error("SMS verification provider failed");
  }
  return true;
}

function safeOrigin(req: any): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const host = req.headers.host;
    return Boolean(host && parsed.host.toLowerCase() === host.toLowerCase() &&
      (parsed.protocol === "https:" || parsed.hostname === "localhost"));
  } catch {
    return false;
  }
}

function noStore(res: any) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
}

async function sendCode(email: string, code: string): Promise<void> {
  if (!ENV.resendApiKey || !ENV.authEmailFrom) {
    throw new Error("Independent email delivery is not configured");
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
      text: `رمز الدخول الخاص بك هو: ${code}\nصلاحية الرمز ${CODE_TTL_MINUTES} دقائق. لا تشارك هذا الرمز مع أي شخص.`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#173d35"><h2>الدخول إلى ALASSAUL-AI</h2><p>استخدم رمز التحقق التالي:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:18px;background:#eef5f1;border-radius:12px;text-align:center">${code}</div><p>تنتهي صلاحية الرمز خلال ${CODE_TTL_MINUTES} دقائق. لا تشاركه مع أي شخص.</p></div>`,
    }),
  });
  if (!response.ok) {
    console.error("[EmailAuth] Delivery provider rejected request", response.status);
    throw new Error("Email delivery failed");
  }
}

function getSql() {
  if (!ENV.databaseUrl) throw new Error("Database is not configured");
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
  return neon(ENV.databaseUrl);
}

export function registerEmailAuthRoutes(app: any) {
  app.post("/api/auth/email/request", async (req: any, res: any) => {
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

    let codeId: number | undefined;
    try {
      const sql = getSql();
      const ipHash = createHmac("sha256", ENV.cookieSecret).update(`ip:${req.ip || "unknown"}`).digest("hex");
      const [emailRate] = await sql.query(
        "SELECT count(*)::int AS count FROM public.email_login_codes WHERE email = $1 AND \"createdAt\" > now() - interval '15 minutes'",
        [email],
      ) as Array<{ count: number }>;
      const [ipRate] = await sql.query(
        "SELECT count(*)::int AS count FROM public.email_login_codes WHERE \"ipHash\" = $1 AND \"createdAt\" > now() - interval '15 minutes'",
        [ipHash],
      ) as Array<{ count: number }>;
      if (Number(emailRate?.count ?? 0) >= MAX_EMAIL_SENDS_PER_15_MIN ||
          Number(ipRate?.count ?? 0) >= MAX_IP_SENDS_PER_15_MIN) {
        res.json({ success: true, message: "إذا كان البريد صالحًا، فسيصلك رمز التحقق." });
        return;
      }

      const code = String(randomInt(100000, 1000000));
      const hash = codeDigest(email, code);
      const inserted = await sql.query(
        'INSERT INTO public.email_login_codes (email, "codeHash", "ipHash", "expiresAt") VALUES ($1, $2, $3, now() + interval \'10 minutes\') RETURNING id',
        [email, hash, ipHash],
      ) as Array<{ id: number }>;
      codeId = Number(inserted[0]?.id);
      if (!codeId) throw new Error("Could not create login challenge");

      await sendCode(email, code);
      res.json({ success: true, message: "إذا كان البريد صالحًا، فسيصلك رمز التحقق." });
    } catch (error) {
      if (codeId) {
        try {
          const sql = getSql();
          await sql.query('UPDATE public.email_login_codes SET "consumedAt" = now() WHERE id = $1 AND "consumedAt" IS NULL', [codeId]);
        } catch { /* best-effort invalidation */ }
      }
      console.error("[EmailAuth] Could not issue login code", error);
      res.status(503).json({ error: "خدمة إرسال رمز الدخول غير مهيأة حاليًا. لم يتم تغيير أي بيانات في حسابك." });
    }
  });

  app.post("/api/auth/email/verify", async (req: any, res: any) => {
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

    try {
      const sql = getSql();
      const expectedHash = codeDigest(email, code);
      const consumed = await sql.query(
        'UPDATE public.email_login_codes SET "consumedAt" = now() WHERE id = (SELECT id FROM public.email_login_codes WHERE email = $1 AND "consumedAt" IS NULL AND "expiresAt" > now() AND attempts < $3 ORDER BY "createdAt" DESC LIMIT 1) AND "codeHash" = $2 AND "consumedAt" IS NULL AND "expiresAt" > now() RETURNING id',
        [email, expectedHash, MAX_VERIFY_ATTEMPTS],
      ) as Array<{ id: number }>;

      if (!consumed.length) {
        await sql.query(
          'UPDATE public.email_login_codes SET attempts = attempts + 1 WHERE id = (SELECT id FROM public.email_login_codes WHERE email = $1 AND "consumedAt" IS NULL AND "expiresAt" > now() AND attempts < $2 ORDER BY "createdAt" DESC LIMIT 1) AND "consumedAt" IS NULL',
          [email, MAX_VERIFY_ATTEMPTS],
        );
        res.status(400).json({ error: "البريد أو رمز التحقق غير صحيح، أو انتهت صلاحيته." });
        return;
      }

      const ownerEmail = ENV.ownerEmail;
      const isOwner = Boolean(ownerEmail && email === ownerEmail);
      const openId = `email_${digest(`alassaul-subject:${email}`).slice(0, 48)}`;
      await db.upsertUser({
        openId,
        email,
        name: isOwner ? "Yousef Assaul" : (email.split("@")[0] || "زائر"),
        loginMethod: "email_otp",
        lastSignedIn: new Date(),
        ...(isOwner ? { role: "admin" as const } : {}),
      });
      const user = await db.getUserByOpenId(openId);
      if (!user) throw new Error("User record could not be confirmed");

      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name || email,
        expiresInMs: EMAIL_SESSION_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        sameSite: "lax",
        maxAge: EMAIL_SESSION_MS,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[EmailAuth] Verification could not complete", error);
      res.status(503).json({ error: "تعذر إكمال تسجيل الدخول الآن. حاول مرة أخرى لاحقًا." });
    }
  });

  app.post("/api/auth/phone/request", async (req: any, res: any) => {
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
    try {
      await unifonicVerify(phone);
      res.json({ success: true, message: "إذا كان الرقم صالحًا، فسيصلك رمز التحقق برسالة SMS." });
    } catch (error) {
      console.error("[PhoneAuth] Could not issue SMS verification", error);
      res.status(503).json({ error: "خدمة الرسائل النصية غير مهيأة حاليًا." });
    }
  });

  app.post("/api/auth/phone/verify", async (req: any, res: any) => {
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
    try {
      const approved = await unifonicVerify(phone, code);
      if (!approved) {
        res.status(400).json({ error: "رمز التحقق غير صحيح أو انتهت صلاحيته." });
        return;
      }
      const ownerPhone = normalizeSaudiPhone(ENV.ownerPhone);
      const isOwner = Boolean(ownerPhone && phone === ownerPhone);
      const email = isOwner ? ENV.ownerEmail : null;
      const openId = isOwner
        ? `email_${digest(`alassaul-subject:${ENV.ownerEmail}`).slice(0, 48)}`
        : `phone_${digest(`alassaul-phone:${phone}`).slice(0, 48)}`;
      await db.upsertUser({
        openId,
        email,
        name: isOwner ? "Yousef Assaul" : phone,
        loginMethod: "phone_sms",
        lastSignedIn: new Date(),
        ...(isOwner ? { role: "admin" as const } : {}),
      });
      const user = await db.getUserByOpenId(openId);
      if (!user) throw new Error("User record could not be confirmed");
      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name || (email ?? phone),
        expiresInMs: EMAIL_SESSION_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        sameSite: "lax",
        maxAge: EMAIL_SESSION_MS,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[PhoneAuth] Verification could not complete", error);
      res.status(503).json({ error: "تعذر إكمال تسجيل الدخول الآن." });
    }
  });

}
