import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@crane/shared";
import { api } from "../api.ts";
import { useSession } from "../session.tsx";
import { Card, ErrorNote, Field } from "../components/ui.tsx";

export function Account() {
  const { user, setUser, signOut } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [company, setCompany] = useState(user?.company ?? "");
  const [gstin, setGstin] = useState(user?.gstin ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
