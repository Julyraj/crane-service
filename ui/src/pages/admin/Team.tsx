import { useState, type FormEvent } from "react";
import { formatDateTime, type Role, type User } from "@crane/shared";
import { api } from "../../api.ts";
import { useApi } from "../../hooks.ts";
import { Card, ErrorNote, Field } from "../../components/ui.tsx";

export function AdminTeam() {
  const [role, setRole] = useState<"" | Role>("operator");
  const users = useApi<(User & { jobs: number })[]>(`/admin/users${role ? `?role=${role}` : ""}`);
  const [form, setForm] = useState({ phone: "", name: "", role: "operator" as Role, pin: "" });
  const { data: cfg } = useApi<{ mode: "otp" | "pin" }>("/auth/config");
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { pin, ...rest } = form;
      await api("/admin/users", { body: pin ? { ...rest, pin } : rest });
      setForm({ phone: "", name: "", role: form.role, pin: "" });
      users.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="stack">
      <h1>Team & customers</h1>
      <Card title="Add / update a person">
        <form onSubmit={save} className="stack">
          <div className="row3">
            <Field label="Mobile">
              <input inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </Field>
            <Field label="Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Role">
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                <option value="operator">Operator</option>
                <option value="admin">Admin / dispatcher</option>
                <option value="customer">Customer</option>
              </select>
            </Field>
          </div>
          {cfg?.mode === "pin" && (
            <Field label="Sign-in PIN (6 digits)" hint="Set a PIN for new staff, or enter a new one to reset a forgotten or locked PIN.">
              <input inputMode="numeric" maxLength={6} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} />
            </Field>
          )}
          <ErrorNote error={error} />
          <button className="btn btn--primary">Save</button>
          <p className="fineprint">
            {cfg?.mode === "pin"
              ? "They sign in with this mobile number and PIN. Use this form to update an existing person or reset any customer's PIN."
              : "They sign in with this mobile number via OTP. Existing users are updated."}
          </p>
        </form>
      </Card>
      <Card
        title="People"
        actions={
          <div className="chips">
            {(["operator", "admin", "customer", ""] as const).map((r) => (
              <button key={r} className={role === r ? "chip is-on" : "chip"} onClick={() => setRole(r)}>
                {r || "all"}
              </button>
            ))}
          </div>
        }
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Role</th>
                <th>Jobs</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name ?? "—"}
                    {u.company && <div className="muted">{u.company}</div>}
                  </td>
                  <td>
                    <a href={`tel:+91${u.phone}`}>{u.phone}</a>
                  </td>
                  <td>
                    <span className="tag">{u.role}</span>
                  </td>
                  <td>{u.jobs}</td>
                  <td className="muted">{formatDateTime(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
