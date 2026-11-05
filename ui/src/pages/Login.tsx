import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { whatsappUrl, type User } from "@crane/shared";
import { api } from "../api.ts";
import { useApi } from "../hooks.ts";
import { useSession } from "../session.tsx";
import { Card, ErrorNote, Field, Spinner } from "../components/ui.tsx";

type PinState = "login" | "register" | "admin_setup" | "needs_admin" | "locked";

export function Login() {
  const { signIn, catalog } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: cfg } = useApi<{ mode: "otp" | "pin" }>("/auth/config");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | PinState>("phone");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bizPhone = catalog?.business.phone ?? "9789473129";

  function done(r: { token: string; user: User }) {
    signIn(r.token, r.user);
    const next = params.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    navigate(safeNext ?? (r.user.role === "admin" ? "/admin" : r.user.role === "operator" ? "/operator" : "/bookings"), { replace: true });
  }

  async function run(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const submitPhone = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      setCode("");
      setConfirm("");
      if (cfg?.mode === "pin") {
        const r = await api<{ state: PinState }>("/auth/pin/status", { body: { phone } });
        setStep(r.state);
      } else {
        const r = await api<{ devOtp?: string }>("/auth/otp/request", { body: { phone } });
        setDevOtp(r.devOtp ?? null);
        setStep("otp");
      }
    });
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (step === "register" && code !== confirm) return setError("The two PINs do not match");
    void run(async () => {
      const body = { phone, ...(name.trim() ? { name: name.trim() } : {}) };
      const r =
        step === "otp"
          ? await api<{ token: string; user: User }>("/auth/otp/verify", { body: { ...body, code } })
          : await api<{ token: string; user: User }>("/auth/pin/login", { body: { ...body, pin: code } });
      done(r);
    });
  };

  if (!cfg) return <Spinner />;

  const codeInput = (label: string, value: string, onChange: (v: string) => void, autoFocus = true) => (
    <Field label={label}>
      <input
        type={step === "otp" ? "text" : "password"}
        inputMode="numeric"
        autoComplete={step === "otp" ? "one-time-code" : step === "login" ? "current-password" : "new-password"}
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        required
        autoFocus={autoFocus}
        className="otp-input"
      />
    </Field>
  );

  const changeNumber = (
    <button type="button" className="btn btn--ghost" onClick={() => setStep("phone")}>
      Change number
    </button>
  );
  const helpLink = (text: string) => (
    <a className="btn btn--ghost" href={whatsappUrl(bizPhone, `Hi, I need help signing in to CraneGo with +91 ${phone}`)} target="_blank" rel="noreferrer">
      {text}
    </a>
  );

  return (
    <div className="narrow">
      <Card title="Sign in with your mobile">
        {step === "phone" && (
          <form onSubmit={submitPhone} className="stack">
            <Field label="Mobile number">
              <div className="phone-input">
                <span>+91</span>
                <input
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </Field>
            {cfg.mode === "otp" && (
              <Field label="Your name" hint="Only needed the first time">
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Kumar" />
              </Field>
            )}
            <ErrorNote error={error} />
            <button className="btn btn--primary" disabled={busy}>
              {busy ? "Please wait…" : cfg.mode === "otp" ? "Send OTP" : "Continue"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={submitCode} className="stack">
            <p>
              Enter the 6-digit code sent to <strong>+91 {phone}</strong>.
            </p>
            {devOtp && (
              <p className="devnote">
                Development mode — your OTP is <strong>{devOtp}</strong>
              </p>
            )}
            {codeInput("OTP", code, setCode)}
            <ErrorNote error={error} />
            <button className="btn btn--primary" disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
            {changeNumber}
          </form>
        )}

        {(step === "login" || step === "admin_setup") && (
          <form onSubmit={submitCode} className="stack">
            <p>
              {step === "login" ? "Welcome back! Enter your 6-digit PIN for " : "First admin sign-in. Enter the admin setup PIN for "}
              <strong>+91 {phone}</strong>.
            </p>
            {codeInput(step === "login" ? "PIN" : "Admin setup PIN", code, setCode)}
            {step === "admin_setup" && (
              <Field label="Your name">
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            )}
            <ErrorNote error={error} />
            <button className="btn btn--primary" disabled={busy || code.length !== 6}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            {step === "login" && helpLink("Forgot PIN? Message us on WhatsApp")}
            {changeNumber}
          </form>
        )}

        {step === "register" && (
          <form onSubmit={submitCode} className="stack">
            <p>
              New here? Create an account for <strong>+91 {phone}</strong>.
            </p>
            <Field label="Your name">
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Kumar" required autoFocus />
            </Field>
            {codeInput("Create a 6-digit PIN", code, setCode, false)}
            {codeInput("Enter the PIN again", confirm, setConfirm, false)}
            <p className="fineprint">Don't use your ATM or UPI PIN. You'll use this PIN to sign in next time.</p>
            <ErrorNote error={error} />
            <button className="btn btn--primary" disabled={busy || code.length !== 6 || confirm.length !== 6}>
              {busy ? "Creating…" : "Create account"}
            </button>
            {changeNumber}
          </form>
        )}

        {(step === "needs_admin" || step === "locked") && (
          <div className="stack">
            <p className="note note--warn">
              {step === "needs_admin"
                ? "This number is registered as staff. Ask the admin to set your PIN in Team settings."
                : "This account is locked after too many wrong PINs. Contact us to reset your PIN."}
            </p>
            {helpLink("Message us on WhatsApp")}
            {changeNumber}
          </div>
        )}
      </Card>
    </div>
  );
}
