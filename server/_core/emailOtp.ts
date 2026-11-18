import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { ENV } from "./env";

const OTP_TTL_MINUTES = 10;

/** Normalize addresses consistently before storage, lookup, throttling, and hashing. */
export function normalizeLoginEmail(value: string): string {
  return value.trim().normalize("NFKC").toLowerCase();
}

export function createEmailOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** HMAC prevents a database read from revealing active one-time codes. */
export function hashEmailOtp(email: string, code: string): string {
  if (ENV.cookieSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters for email verification.");
  }
  return createHmac("sha256", ENV.cookieSecret)
    .update("alassaul-email-otp:v1:")
    .update(email)
    .update(":")
    .update(code)
    .digest("hex");
}

export function verifyEmailOtpHash(email: string, code: string, storedHash: string): boolean {
  const expected = Buffer.from(hashEmailOtp(email, code), "hex");
  const actual = Buffer.from(storedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function sendEmailOtp(email: string, code: string): Promise<void> {
  if (!ENV.emailApiKey || !ENV.emailFrom) {
    throw new Error("Email delivery is not configured. Set RESEND_API_KEY and ALASSAUL_EMAIL_FROM.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.emailApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ENV.emailFrom,
      to: [email],
      subject: "رمز الدخول إلى ALASSAUL-AI",
      text: `رمز التحقق الخاص بك هو: ${code}\nصلاحية الرمز ${OTP_TTL_MINUTES} دقائق. لا تشارك الرمز مع أي شخص.`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#183b32"><h2>مرحباً بك في ALASSAUL-AI</h2><p>استخدم رمز التحقق التالي لتسجيل الدخول:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:18px;background:#eef5f1;border-radius:12px;text-align:center">${code}</div><p>تنتهي صلاحية الرمز خلال ${OTP_TTL_MINUTES} دقائق. لا تشاركه مع أي شخص.</p></div>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    // Do not log the provider response: it may contain recipient or account metadata.
    throw new Error(`Email provider rejected the message (HTTP ${response.status}).`);
  }
}

export const EMAIL_OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;
export const EMAIL_OTP_MAX_REQUESTS_PER_15_MINUTES = 3;
