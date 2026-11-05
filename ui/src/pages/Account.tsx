import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@crane/shared";
import { api } from "../api.ts";
import { useSession } from "../session.tsx";
import { Card, ErrorNote, Field } from "../components/ui.tsx";
import { useApi } from "../hooks.ts";

function ChangePin() {
  const [currentPin, setCurrent] = useState("");
  const [newPin, setNew] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      await api("/me/pin", { body: { currentPin, newPin } });
      setCurrent("");
      setNew("");
      setMsg("PIN changed");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <Card title="Change PIN">
      <form onSubmit={save} className="stack">
        <div className="row2">
          <Field label="Current PIN">
            <input type="password" inputMode="numeric" autoComplete="current-password" value={currentPin} onChange={(e) => setCurrent(digits(e.target.value))} required />
          </Field>
          <Field label="New 6-digit PIN">
            <input type="password" inputMode="numeric" autoComplete="new-password" value={newPin} onChange={(e) => setNew(digits(e.target.value))} required />
          </Field>
        </div>
        <ErrorNote error={error} />
        {msg && <p className="note note--ok">{msg}</p>}
        <button className="btn btn--primary" disabled={currentPin.length !== 6 || newPin.length !== 6}>
          Change PIN
        </button>
      </form>
    </Card>
  );
}

export function Account() {
  const { user, setUser, signOut } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [company, setCompany] = useState(user?.company ?? "");
  const [gstin, setGstin] = useState(user?.gstin ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: cfg } = useApi<{ mode: "otp" | "pin" }>("/auth/config");

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const r = await api<{ user: User }>("/me", { method: "PATCH", body: { name, company, gstin } });
      setUser(r.user);
      setMsg("Saved");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!user) return null;
  return (
    <div className="narrow stack">
      <Card title="Account">
        <p className="muted">
          +91 {user.phone} · <span className="tag">{user.role}</span>
        </p>
        <form onSubmit={save} className="stack">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {user.role === "customer" && (
            <>
              <Field label="Company (for invoices)">
                <input value={company} onChange={(e) => setCompany(e.target.value)} />
              </Field>
              <Field label="GSTIN" hint="Add to claim input tax credit on invoices">
                <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} />
              </Field>
            </>
          )}
          <ErrorNote error={error} />
          {msg && <p className="note note--ok">{msg}</p>}
          <button className="btn btn--primary">Save</button>
        </form>
      </Card>
      {cfg?.mode === "pin" && <ChangePin />}
      <button
        className="btn btn--ghost"
        onClick={async () => {
          await signOut();
          navigate("/");
        }}
      >
        Sign out
      </button>
    </div>
  );
}
