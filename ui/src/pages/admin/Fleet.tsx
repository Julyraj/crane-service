import { useState, type FormEvent } from "react";
import { CRANE_CLASSES, formatDateTime, getCraneClass, type Crane, type User } from "@crane/shared";
import { api } from "../../api.ts";
import { useApi } from "../../hooks.ts";
import { useSession } from "../../session.tsx";
import { Card, Empty, ErrorNote, Field } from "../../components/ui.tsx";

export function AdminFleet() {
  const { reloadCatalog } = useSession();
  const cranes = useApi<Crane[]>("/admin/cranes");
  const operators = useApi<User[]>("/admin/users?role=operator");
  const [form, setForm] = useState({ classId: "hydra-13", regNo: "", name: "", defaultOperatorId: "" });
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    cranes.reload();
    reloadCatalog();
  };

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/admin/cranes", {
        body: { ...form, name: form.name || `${getCraneClass(form.classId)?.name}`, defaultOperatorId: form.defaultOperatorId || null },
      });
      setForm({ ...form, regNo: "", name: "" });
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function update(id: string, body: Partial<Crane>) {
    setError(null);
    try {
      await api(`/admin/cranes/${id}`, { method: "PATCH", body });
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const opName = (id: string | null) => operators.data?.find((o) => o.id === id)?.name ?? "—";

  return (
    <div className="stack">
      <h1>Fleet</h1>
      <ErrorNote error={error ?? cranes.error} />
      <Card title="Cranes">
        {cranes.data?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Crane</th>
                  <th>Reg no</th>
                  <th>Status</th>
                  <th>Default operator</th>
                  <th>Last seen</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cranes.data.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <div className="muted">{getCraneClass(c.classId)?.name}</div>
                    </td>
                    <td>{c.regNo}</td>
                    <td>
                      <span className={`pill pill--${c.status}`}>{c.status.replace("_", " ")}</span>
                    </td>
                    <td>
                      <select value={c.defaultOperatorId ?? ""} onChange={(e) => update(c.id, { defaultOperatorId: e.target.value || null })}>
                        <option value="">—</option>
                        {(operators.data ?? []).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name ?? o.phone}
                          </option>
                        ))}
                      </select>
                      <span className="sr-only">{opName(c.defaultOperatorId)}</span>
                    </td>
                    <td className="muted">{c.lastSeenAt ? formatDateTime(c.lastSeenAt) : "—"}</td>
                    <td>
                      {c.status !== "on_job" && (
                        <button className="btn btn--small btn--ghost" onClick={() => update(c.id, { status: c.status === "maintenance" ? "available" : "maintenance" })}>
                          {c.status === "maintenance" ? "Back in service" : "Send to maintenance"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No cranes yet. Add your fleet below.</Empty>
        )}
      </Card>
      <Card title="Add crane">
        <form onSubmit={add} className="stack">
          <div className="row2">
            <Field label="Class">
              <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                {CRANE_CLASSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Registration no">
              <input value={form.regNo} onChange={(e) => setForm({ ...form, regNo: e.target.value })} placeholder="TN 30 AB 1234" required />
            </Field>
            <Field label="Display name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Hydra 13T #2" />
            </Field>
            <Field label="Default operator">
              <select value={form.defaultOperatorId} onChange={(e) => setForm({ ...form, defaultOperatorId: e.target.value })}>
                <option value="">—</option>
                {(operators.data ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name ?? o.phone}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <button className="btn btn--primary">Add crane</button>
        </form>
      </Card>
    </div>
  );
}
