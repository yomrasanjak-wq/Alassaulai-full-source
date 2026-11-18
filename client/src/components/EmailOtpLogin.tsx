import React, { useState } from "react";
import { ArrowLeft, Mail, Phone, ShieldCheck } from "lucide-react";

type Props = { onClose: () => void };
type Method = "email" | "phone";

export function EmailOtpLogin({ onClose }: Props) {
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"destination" | "code">("destination");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function changeMethod(next: Method) {
    setMethod(next);
    setStep("destination");
    setCode("");
    setMessage("");
    setError("");
  }

  async function requestCode() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const isPhone = method === "phone";
      const response = await fetch(isPhone ? "/api/auth/phone/request" : "/api/auth/email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify(isPhone ? { phone } : { email }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "تعذر إرسال رمز التحقق.");
      setStep("code");
      setMessage(result.message || (isPhone ? "إذا كان الرقم صالحًا، فسيصلك رمز برسالة SMS." : "إذا كان البريد صالحًا، فسيصلك رمز التحقق."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إرسال الرمز الآن.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError("");
    try {
      const isPhone = method === "phone";
      const response = await fetch(isPhone ? "/api/auth/phone/verify" : "/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify(isPhone ? { phone, code } : { email, code }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "رمز التحقق غير صحيح.");
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر التحقق من الرمز.");
    } finally {
      setBusy(false);
    }
  }

  const destination = method === "phone" ? phone : email;

  return (
    <div className="modal-content auth-modal">
      <div className="modal-icon"><ShieldCheck size={23} /></div>
      <span className="section-eyebrow">ALASSAUL / SECURE ACCOUNT</span>
      <h2>دخول مستقل وآمن</h2>
      <p>اختر الدخول بالبريد الإلكتروني أو برسالة تحقق على جوالك.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "18px 0" }}>
        <button type="button" onClick={() => changeMethod("email")} aria-pressed={method === "email"}
          className={method === "email" ? "button button-primary" : "button"}
          style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Mail size={17} /> البريد الإلكتروني
        </button>
        <button type="button" onClick={() => changeMethod("phone")} aria-pressed={method === "phone"}
          className={method === "phone" ? "button button-primary" : "button"}
          style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Phone size={17} /> رقم الجوال
        </button>
      </div>

      {step === "destination" ? (
        <form onSubmit={(event) => { event.preventDefault(); void requestCode(); }}>
          <label htmlFor="alassaul-login-destination" style={{ display: "block", textAlign: "right", marginBottom: 8 }}>
            {method === "phone" ? "رقم الجوال السعودي" : "البريد الإلكتروني"}
          </label>
          <div style={{ position: "relative", marginBottom: 14 }}>
            {method === "phone" ? <Phone size={18} style={{ position: "absolute", left: 14, top: 15, opacity: 0.65 }} /> : <Mail size={18} style={{ position: "absolute", left: 14, top: 15, opacity: 0.65 }} />}
            <input
              id="alassaul-login-destination"
              type={method === "phone" ? "tel" : "email"}
              inputMode={method === "phone" ? "tel" : "email"}
              autoComplete={method === "phone" ? "tel" : "email"}
              required
              maxLength={method === "phone" ? 16 : 320}
              value={method === "phone" ? phone : email}
              onChange={(event) => method === "phone" ? setPhone(event.target.value) : setEmail(event.target.value)}
              placeholder={method === "phone" ? "05XXXXXXXX" : "name@example.com"}
              dir="ltr"
              style={{ width: "100%", minHeight: 48, borderRadius: 12, border: "1px solid rgba(90,130,115,.35)", background: "rgba(255,255,255,.82)", color: "#173d35", padding: "12px 42px 12px 14px", textAlign: "left", boxSizing: "border-box" }}
            />
          </div>
          <button className="button button-primary full-button" type="submit" disabled={busy}>
            {busy ? "جارٍ الإرسال..." : method === "phone" ? "إرسال رمز SMS" : "إرسال رمز التحقق"} <ArrowLeft size={16} />
          </button>
        </form>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void verifyCode(); }}>
          <p dir="ltr" style={{ textAlign: "center", fontWeight: 600, marginBottom: 12 }}>{destination}</p>
          <label htmlFor="alassaul-login-code" style={{ display: "block", textAlign: "right", marginBottom: 8 }}>رمز التحقق المكوّن من 6 أرقام</label>
          <input
            id="alassaul-login-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            dir="ltr"
            style={{ width: "100%", minHeight: 54, borderRadius: 12, border: "1px solid rgba(90,130,115,.35)", background: "rgba(255,255,255,.82)", color: "#173d35", padding: 12, textAlign: "center", letterSpacing: 10, fontSize: 24, fontWeight: 700, boxSizing: "border-box", marginBottom: 14 }}
          />
          <button className="button button-primary full-button" type="submit" disabled={busy || code.length !== 6}>
            {busy ? "جارٍ التحقق..." : "تأكيد الدخول"} <ArrowLeft size={16} />
          </button>
          <button type="button" className="modal-text-button" disabled={busy} onClick={() => { setStep("destination"); setCode(""); setMessage(""); setError(""); }}>تغيير {method === "phone" ? "رقم الجوال" : "البريد"}</button>
          <button type="button" className="modal-text-button" disabled={busy} onClick={() => void requestCode()}>إعادة إرسال الرمز</button>
        </form>
      )}
      {message && <p role="status" style={{ color: "#26765d", marginTop: 12 }}>{message}</p>}
      {error && <p role="alert" style={{ color: "#b54747", marginTop: 12 }}>{error}</p>}
      <button className="modal-text-button" onClick={onClose} disabled={busy}>ليس الآن</button>
    </div>
  );
}
