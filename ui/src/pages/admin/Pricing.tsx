import { useEffect, useState } from "react";
import { CRANE_CLASSES, type CraneRates, type PricingConfig } from "@crane/shared";
import { api } from "../../api.ts";
import { useApi } from "../../hooks.ts";
import { useSession } from "../../session.tsx";
import { Card, ErrorNote, Field, Spinner } from "../../components/ui.tsx";

const RATE_FIELDS: { key: keyof CraneRates; label: string }[] = [
  { key: "hourly", label: "₹/hour" },
  { key: "minHours", label: "Min hrs" },
  { key: "daily", label: "₹/day" },
  { key: "monthly", label: "₹/month" },
  { key: "perKm", label: "₹/km" },
];

const PCT_FIELDS: { key: keyof PricingConfig; label: string }[] = [
  { key: "gstRate", label: "GST %" },
  { key: "nightSurchargeRate", label: "Night surcharge % (22:00–06:00)" },
  { key: "instantSurchargeRate", label: "Instant dispatch surcharge %" },
];
const NUM_FIELDS: { key: keyof PricingConfig; label: string }[] = [
  { key: "instantWindowHours", label: "Instant window (hours)" },
  { key: "freeKm", label: "Free km (one way)" },
  { key: "operatorBataPerDay", label: "Operator bata ₹/day" },
  { key: "cancellationFee", label: "Cancellation fee after dispatch ₹" },
];

export function AdminPricing() {
  const { reloadCatalog } = useSession();
  const { data, error } = useApi<PricingConfig>("/admin/pricing");
  const [p, setP] = useState<PricingConfig | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => setP(data), [data]);
  if (error) return <ErrorNote error={error} />;
  if (!p) return <Spinner />;

  const setRate = (id: string, key: keyof CraneRates, v: number) => setP({ ...p, rates: { ...p.rates, [id]: { ...p.rates[id]!, [key]: v } } });

  async function save() {
    setMsg(null);
    setSaveError(null);
    try {
      setP(await api<PricingConfig>("/admin/pricing", { method: "PUT", body: p }));
      reloadCatalog();
      setMsg("Pricing saved. New quotes use these rates immediately.");
    } catch (e) {
      setSaveError((e as Error).message);
    }
  }

  return (
    <div className="stack">
      <h1>Pricing</h1>
      <Card title="Crane rates (excl. GST)">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Crane</th>
                {RATE_FIELDS.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CRANE_CLASSES.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  {RATE_FIELDS.map((f) => (
                    <td key={f.key}>
                      <input
                        className="num-input"
                        type="number"
                        min={f.key === "minHours" ? 1 : 0}
                        value={p.rates[c.id]?.[f.key] ?? 0}
                        onChange={(e) => setRate(c.id, f.key, Number(e.target.value))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Charges & surcharges">
        <div className="row3">
          {PCT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <input type="number" min={0} step={0.5} value={Math.round((p[f.key] as number) * 1000) / 10} onChange={(e) => setP({ ...p, [f.key]: Number(e.target.value) / 100 })} />
            </Field>
          ))}
          {NUM_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <input type="number" min={0} value={p[f.key] as number} onChange={(e) => setP({ ...p, [f.key]: Number(e.target.value) })} />
            </Field>
          ))}
        </div>
      </Card>
      <ErrorNote error={saveError} />
      {msg && <p className="note note--ok">{msg}</p>}
      <button className="btn btn--primary btn--lg" onClick={save}>
        Save pricing
      </button>
    </div>
  );
}
