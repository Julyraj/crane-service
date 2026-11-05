import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { User } from "@crane/shared";
import { api } from "../api.ts";
import { useSession } from "../session.tsx";
import { Card, ErrorNote, Field } from "../components/ui.tsx";

export function Login() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ devOtp?: string }>("/auth/otp/request", { body: { phone } });
      setDevOtp(r.devOtp ?? null);
      setStep("otp");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ token: string; user: User }>("/auth/otp/verify", {
        body: { phone, code, ...(name.trim() ? { name: name.trim() } : {}) },
      });
      signIn(r.token, r.user);
      const next = params.get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      navigate(safeNext ?? (r.user.role === "admin" ? "/admin" : r.user.role === "operator" ? "/operator" : "/bookings"), { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <Card title="Sign in with your mobile">
        {step === "phone" ? (
          <form onSubmit={requestOtp} className="stack">
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
            <Field label="Your name" hint="Only needed the first time">
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Kumar" />
            </Field>
            <ErrorNote error={error} />
            <button className="btn btn--primary" disabled={busy}>
              {busy ? "Sending…" : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="stack">
            <p>
              Enter the 6-digit code sent to <strong>+91 {phone}</strong>.
            </p>
            {devOtp && (
              <p className="devnote">
                Development mode — your OTP is <strong>{devOtp}</strong>
              </p>
            )}
            <Field label="OTP">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                className="otp-input"
              />
            </Field>
            <ErrorNote error={error} />
            <button className="btn btn--primary" disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setStep("phone")}>
              Change number
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
