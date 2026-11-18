import { createHash, randomInt } from "node:crypto";
import type { Express, Request, Response } from "express";
import { neon } from "@neondatabase/serverless";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

const CODE_TTL_MINUTES = 10;
const MAX_EMAIL_SENDS_PER_15_MIN = 3;
const MAX_IP_SENDS_PER_15_MIN = 10;
const MAX_VERIFY_ATTEMPTS = 5;

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
  return digest(`${ENV.cookieSecret}:alassaul-email-otp:${email}:${code}`);
}

function safeOrigin(req: Request): boolean {
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

function noStore(res: Response) {
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
    const detail = await response.text().catch(() => "");
    console.error("[EmailAuth] Delivery provider rejected request", response.status, detail.slice(0, 300));
    throw new Error("Email delivery failed");
  }
}

function getSql() {
  if (!ENV.databaseUrl) throw new Error("Database is not configured");
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
  return neon(ENV.databaseUrl);
}

export function registerEmailAuthRoutes(app: Express) {
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

    let codeId: number | undefined;
    try {
      const sql = getSql();
      const ipHash = digest(`${ENV.cookieSecret}:ip:${req.ip || "unknown"}`);
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
        name: isOwner ? "Yousef Assaul" : email.split("@")[0],
        loginMethod: "email_otp",
        lastSignedIn: new Date(),
        ...(isOwner ? { role: "admin" as const } : {}),
      });
      const user = await db.getUserByOpenId(openId);
      if (!user) throw new Error("User record could not be confirmed");

      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name || email,
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[EmailAuth] Verification could not complete", error);
      res.status(503).json({ error: "تعذر إكمال تسجيل الدخول الآن. حاول مرة أخرى لاحقًا." });
    }
  });
}
