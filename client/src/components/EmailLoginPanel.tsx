import { useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";

type EmailLoginPanelProps = {
  onSuccess: () => void;
};

export function EmailLoginPanel({ onSuccess }: EmailLoginPanelProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState("");
  const utils = trpc.useUtils();

  const requestCode = trpc.auth.requestEmailCode.useMutation({
    onSuccess: () => {
      setCodeSent(true);
      setMessage("إذا كان البريد صحيحاً ولم تتجاوز حد الإرسال، سيصلك رمز تحقق صالح لمدة 10 دقائق.");
    },
    onError: (error) => setMessage(error.message || "تعذر إرسال الرمز. حاول لاحقاً."),
  });

  const verifyCode = trpc.auth.verifyEmailCode.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      onSuccess();
    },
    onError: (error) => setMessage(error.message || "تعذر التحقق من الرمز."),
  });

  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    requestCode.mutate({ email: email.trim() });
  }

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    verifyCode.mutate({ email: email.trim(), code: code.trim() });
  }

  return (
    <div className="email-login-panel" dir="rtl">
      <div className="auth-method-note"><ShieldCheck size={16} /> دخول مستقل وآمن عبر بريدك الإلكتروني، دون كلمة مرور.</div>
      {!codeSent ? (
        <form onSubmit={submitEmail} className="email-login-form">
          <label htmlFor="alassaul-login-email">البريد الإلكتروني</label>
          <input
            id="alassaul-login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={320}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
          <button className="button button-primary full-button" type="submit" disabled={requestCode.isPending}>
            <Mail size={16} /> {requestCode.isPending ? "جارٍ إرسال الرمز…" : "إرسال رمز التحقق"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="email-login-form">
          <p>أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه إلى بريدك.</p>
          <label htmlFor="alassaul-login-code">رمز التحقق</label>
          <input
            id="alassaul-login-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="••••••"
          />
          <button className="button button-primary full-button" type="submit" disabled={verifyCode.isPending || code.length !== 6}>
            <ShieldCheck size={16} /> {verifyCode.isPending ? "جارٍ التحقق…" : "تأكيد الدخول"}
          </button>
          <button className="modal-text-button" type="button" onClick={() => { setCodeSent(false); setCode(""); setMessage(""); }}>
            تغيير البريد الإلكتروني
          </button>
          <button className="modal-text-button" type="button" disabled={requestCode.isPending} onClick={() => { setMessage(""); requestCode.mutate({ email: email.trim() }); }}>
            إعادة إرسال الرمز <ArrowLeft size={14} />
          </button>
        </form>
      )}
      {message && <p className="auth-login-message" role="status" aria-live="polite">{message}</p>}
    </div>
  );
}
