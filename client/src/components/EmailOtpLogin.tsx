import React, { useState } from "react";
import { ArrowLeft, KeyRound, LockKeyhole, Mail, Phone, ShieldCheck } from "lucide-react";

type Props = { onClose: () => void };
type Method = "email" | "phone";
type Step = "password" | "reset-code" | "new-password" | "phone-destination" | "phone-code";

export function EmailOtpLogin({ onClose }: Props) {
  const [method, setMethod] = useState<Method>("email");
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function resetFeedback() { setMessage(""); setError(""); }
  function changeMethod(next: Method) {
    setMethod(next);
    setStep(next === "email" ? "password" : "phone-destination");
    setCode("");
    resetFeedback();
  }

  async function postJson(url: string, body: Record<string, string>) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({})) as { message?: string; error?: string };
    if (!response.ok) throw new Error(result.error || "تعذر إكمال الطلب.");
    return result;
  }

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); resetFeedback();
    try {
      await postJson("/api/auth/password/login", { email, password });
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تسجيل الدخول.");
    } finally { setBusy(false); }
  }

  async function requestPasswordReset() {
    setBusy(true); resetFeedback();
    try {
      const result = await postJson("/api/auth/email/request", { email });
      setStep("reset-code");
      setMessage(result.message || "أرسلنا رمز التحقق إذا كان البريد معتمدًا.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إرسال رمز التحقق.");
    } finally { setBusy(false); }
  }

  async function verifyResetCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); resetFeedback();
    try {
      await postJson("/api/auth/email/verify", { email, code });
      setStep("new-password");
      setMessage("تم إثبات البريد. اختر كلمة مرور جديدة لحساب المالك.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "رمز التحقق غير صحيح.");
    } finally { setBusy(false); }
  }

  async function saveNewPassword(event: React.FormEvent) {
    event.preventDefault(); resetFeedback();
    if (newPassword.length < 12) { setError("كلمة المرور يجب ألا تقل عن 12 حرفًا."); return; }
    if (newPassword !== confirmPassword) { setError("كلمتا المرور غير متطابقتين."); return; }
    setBusy(true);
    try {
      await postJson("/api/auth/password/set", { password: newPassword });
      setMessage("تم حفظ كلمة المرور. جارٍ فتح المنصة...");
      window.setTimeout(() => window.location.assign("/"), 700);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ كلمة المرور.");
    } finally { setBusy(false); }
  }

  async function requestPhoneCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); resetFeedback();
    try {
      const result = await postJson("/api/auth/phone/request", { phone });
      setStep("phone-code");
      setMessage(result.message || "إذا كان الرقم معتمدًا فسيصلك رمز برسالة SMS.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إرسال الرمز.");
    } finally { setBusy(false); }
  }

  async function verifyPhoneCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); resetFeedback();
    try {
      await postJson("/api/auth/phone/verify", { phone, code });
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "رمز التحقق غير صحيح.");
    } finally { setBusy(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", minHeight: 49, borderRadius: 12, border: "1px solid rgba(90,130,115,.35)",
    background: "rgba(255,255,255,.9)", color: "#173d35", padding: "12px 14px",
    textAlign: "left", boxSizing: "border-box", marginBottom: 13,
  };
  const labelStyle: React.CSSProperties = { display: "block", textAlign: "right", marginBottom: 7, color: "#31564c", fontWeight: 600 };
  const primary = (label: string) => <button className="button button-primary full-button" type="submit" disabled={busy}>{busy ? "جارٍ التنفيذ..." : label} <ArrowLeft size={16} /></button>;

  return (
    <div className="modal-content auth-modal" dir="rtl">
      <div className="modal-icon"><ShieldCheck size={23} /></div>
      <span className="section-eyebrow">ALASSAUL / SECURE ACCOUNT</span>
      <h2>دخول آمن ومستقل</h2>
      <p>حساب المالك محمي بكلمة مرور، مع استعادة آمنة عبر البريد الإلكتروني.</p>

      <div role="tablist" aria-label="طريقة الدخول" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "18px 0" }}>
        <button type="button" role="tab" aria-selected={method === "email"} onClick={() => changeMethod("email")}
          className={method === "email" ? "button button-primary" : "button"}
          style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Mail size={17} /> البريد وكلمة المرور
        </button>
        <button type="button" role="tab" aria-selected={method === "phone"} onClick={() => changeMethod("phone")}
          className={method === "phone" ? "button button-primary" : "button"}
          style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Phone size={17} /> دخول الجوال
        </button>
      </div>

      {step === "password" && method === "email" && (
        <form onSubmit={signInWithPassword}>
          <label htmlFor="alassaul-owner-email" style={labelStyle}>البريد الإلكتروني</label>
          <input id="alassaul-owner-email" type="email" autoComplete="username" required maxLength={320}
            value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" dir="ltr" style={inputStyle} />
          <label htmlFor="alassaul-owner-password" style={labelStyle}>كلمة المرور</label>
          <div style={{ position: "relative" }}>
            <LockKeyhole size={17} style={{ position: "absolute", left: 14, top: 16, color: "#6b897d" }} />
            <input id="alassaul-owner-password" type="password" autoComplete="current-password" required maxLength={128}
              value={password} onChange={e => setPassword(e.target.value)} placeholder="أدخل كلمة المرور" dir="ltr"
              style={{ ...inputStyle, paddingLeft: 42 }} />
          </div>
          {primary("دخول غرفة التحكم")}
          <button type="button" className="modal-text-button" disabled={busy || !email} onClick={() => void requestPasswordReset()}>
            نسيت كلمة المرور؟ استعادة عبر البريد
          </button>
        </form>
      )}

      {step === "reset-code" && (
        <form onSubmit={verifyResetCode}>
          <p style={{ textAlign: "center", color: "#557269", marginBottom: 12 }} dir="ltr">{email}</p>
          <label htmlFor="alassaul-reset-code" style={labelStyle}>رمز التحقق المرسل إلى بريدك</label>
          <input id="alassaul-reset-code" type="text" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]{6}" maxLength={6} required value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••" dir="ltr"
            style={{ ...inputStyle, minHeight: 56, textAlign: "center", letterSpacing: 10, fontSize: 24, fontWeight: 700 }} />
          {primary("تأكيد البريد والمتابعة")}
          <button type="button" className="modal-text-button" disabled={busy} onClick={() => { setStep("password"); setCode(""); resetFeedback(); }}>العودة للدخول</button>
        </form>
      )}

      {step === "new-password" && (
        <form onSubmit={saveNewPassword}>
          <label htmlFor="alassaul-new-password" style={labelStyle}>كلمة المرور الجديدة (12 حرفًا على الأقل)</label>
          <input id="alassaul-new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128}
            required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="كلمة مرور قوية" dir="ltr" style={inputStyle} />
          <label htmlFor="alassaul-confirm-password" style={labelStyle}>تأكيد كلمة المرور</label>
          <input id="alassaul-confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128}
            required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="أعد كتابة كلمة المرور" dir="ltr" style={inputStyle} />
          {primary("حفظ كلمة المرور")}
        </form>
      )}

      {step === "phone-destination" && method === "phone" && (
        <form onSubmit={requestPhoneCode}>
          <label htmlFor="alassaul-phone" style={labelStyle}>رقم الجوال السعودي</label>
          <input id="alassaul-phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={16}
            value={phone} onChange={e => setPhone(e.target.value)} placeholder="05XXXXXXXX" dir="ltr" style={inputStyle} />
          {primary("إرسال رمز SMS")}
        </form>
      )}

      {step === "phone-code" && method === "phone" && (
        <form onSubmit={verifyPhoneCode}>
          <p dir="ltr" style={{ textAlign: "center", fontWeight: 600, marginBottom: 12 }}>{phone}</p>
          <label htmlFor="alassaul-phone-code" style={labelStyle}>رمز التحقق المكوّن من 6 أرقام</label>
          <input id="alassaul-phone-code" type="text" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]{6}" maxLength={6} required value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••" dir="ltr"
            style={{ ...inputStyle, minHeight: 56, textAlign: "center", letterSpacing: 10, fontSize: 24, fontWeight: 700 }} />
          {primary("تأكيد الدخول")}
          <button type="button" className="modal-text-button" disabled={busy} onClick={() => { setStep("phone-destination"); setCode(""); resetFeedback(); }}>تغيير رقم الجوال</button>
        </form>
      )}

      {message && <p role="status" style={{ color: "#26765d", marginTop: 12 }}>{message}</p>}
      {error && <p role="alert" style={{ color: "#b54747", marginTop: 12 }}>{error}</p>}
      <button className="modal-text-button" onClick={onClose} disabled={busy}>ليس الآن</button>
    </div>
  );
}
