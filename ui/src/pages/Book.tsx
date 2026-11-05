import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  formatINR,
  getCraneClass,
  type Booking,
  type CraneRecommendation,
  type Quote,
  type RentalType,
} from "@crane/shared";
import { api } from "../api.ts";
import { useSession } from "../session.tsx";
import { MapView, type MapMarker } from "../components/MapView.tsx";
import { QuoteBreakdown } from "../components/QuoteBreakdown.tsx";
import { Card, ErrorNote, Field } from "../components/ui.tsx";

const DRAFT_KEY = "crane.bookingDraft";

interface Draft {
  craneClassId: string;
  rentalType: RentalType;
  duration: number;
  site: { lat: number; lng: number } | null;
  siteAddress: string;
  when: "now" | "later";
  scheduledLocal: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  loadTons: string;
  liftHeightM: string;
  radiusM: string;
  paymentMethod: "upi" | "cash" | "bank_transfer" | "credit";
}

// Bookings are always in India time (IST, UTC+5:30), whatever timezone the device uses.
const IST_OFFSET_MS = 330 * 60_000;

/** Date -> "YYYY-MM-DDTHH:mm" in IST, for <input type="datetime-local">. */
function toIstInput(d: Date) {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" entered as IST -> Date. */
function fromIstInput(v: string) {
  return new Date(`${v}:00+05:30`);
}

function loadDraft(): Partial<Draft> {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "{}") as Partial<Draft>;
  } catch {
    return {};
  }
}

const UNIT: Record<RentalType, string> = { hourly: "hours", daily: "days", monthly: "months" };

export function Book() {
  const { user, catalog } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tomorrow9 = useMemo(() => `${toIstInput(new Date(Date.now() + 86_400_000)).slice(0, 10)}T09:00`, []);

  const [draft, setDraft] = useState<Draft>(() => ({
    craneClassId: params.get("crane") ?? "hydra-13",
    rentalType: "hourly",
    duration: 4,
    site: null,
    siteAddress: "",
    when: "later",
    scheduledLocal: tomorrow9,
    contactName: user?.name ?? "",
    contactPhone: user?.phone ?? "",
    notes: "",
    loadTons: "",
    liftHeightM: "",
    radiusM: "",
    paymentMethod: "upi",
    ...loadDraft(),
  }));
  const [quote, setQuote] = useState<{ quote: Quote; distanceKm: number } | null>(null);
  const [rec, setRec] = useState<CraneRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  useEffect(() => {
    if (user) setDraft((d) => ({ ...d, contactName: d.contactName || user.name || "", contactPhone: d.contactPhone || user.phone }));
  }, [user]);

  const scheduledIso = useMemo(() => {
    if (draft.when === "now") return new Date(Date.now() + 5 * 60_000).toISOString();
    const d = fromIstInput(draft.scheduledLocal);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }, [draft.when, draft.scheduledLocal]);

  // Live quote
  useEffect(() => {
    if (!draft.site || !scheduledIso || !(draft.duration > 0)) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<{ quote: Quote; distanceKm: number }>("/quote", {
        body: {
          craneClassId: draft.craneClassId,
          rentalType: draft.rentalType,
          duration: draft.duration,
          siteLat: draft.site!.lat,
          siteLng: draft.site!.lng,
          scheduledAt: scheduledIso,
        },
        signal: ctrl.signal,
      })
        .then(setQuote)
        .catch((e) => {
          if ((e as Error).name !== "AbortError") setQuote(null);
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [draft.craneClassId, draft.rentalType, draft.duration, draft.site, scheduledIso]);

  async function recommend() {
    setError(null);
    const load = Number(draft.loadTons);
    if (!(load > 0)) return setError("Enter the load weight in tons to get a suggestion.");
    try {
      const r = await api<CraneRecommendation>("/recommend", {
        body: {
          loadTons: load,
          ...(draft.liftHeightM ? { liftHeightM: Number(draft.liftHeightM) } : {}),
          ...(draft.radiusM ? { radiusM: Number(draft.radiusM) } : {}),
        },
      });
      setRec(r);
      if (r.craneClassId) set("craneClassId", r.craneClassId);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Location is not available on this device.");
    navigator.geolocation.getCurrentPosition(
      (p) => set("site", { lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError("Could not get your location. Tap the map to pin the site instead."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!draft.site) return setError("Pin the work site on the map.");
    if (!scheduledIso) return setError("Pick a valid date and time.");
    if (!user) {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* storage unavailable: the form is simply not restored after sign-in */
      }
      navigate("/login?next=/book");
      return;
    }
    setBusy(true);
    try {
      const num = (s: string) => (s.trim() ? Number(s) : undefined);
      const booking = await api<Booking>("/bookings", {
        body: {
          craneClassId: draft.craneClassId,
          rentalType: draft.rentalType,
          duration: draft.duration,
          siteLat: draft.site.lat,
          siteLng: draft.site.lng,
          scheduledAt: draft.when === "now" ? new Date(Date.now() + 5 * 60_000).toISOString() : scheduledIso,
          siteAddress: draft.siteAddress,
          contactName: draft.contactName,
          contactPhone: draft.contactPhone,
          loadTons: num(draft.loadTons),
          liftHeightM: num(draft.liftHeightM),
          radiusM: num(draft.radiusM),
          notes: draft.notes || undefined,
          paymentMethod: draft.paymentMethod,
        },
      });
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      navigate(`/bookings/${booking.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const markers: MapMarker[] = [
    ...(catalog ? [{ id: "yard", kind: "yard" as const, ...catalog.business.yard, label: "Our yard" }] : []),
    ...(draft.site ? [{ id: "site", kind: "site" as const, ...draft.site, label: "Work site" }] : []),
  ];
  const selected = getCraneClass(draft.craneClassId);

  return (
    <form className="book" onSubmit={submit}>
      <div className="book__main">
        <Card title="1 · What are you lifting?">
          <div className="row3">
            <Field label="Load (tons)">
              <input inputMode="decimal" value={draft.loadTons} onChange={(e) => set("loadTons", e.target.value)} placeholder="e.g. 8" />
            </Field>
            <Field label="Lift height (m)">
              <input inputMode="decimal" value={draft.liftHeightM} onChange={(e) => set("liftHeightM", e.target.value)} placeholder="optional" />
            </Field>
            <Field label="Reach / radius (m)">
              <input inputMode="decimal" value={draft.radiusM} onChange={(e) => set("radiusM", e.target.value)} placeholder="optional" />
            </Field>
          </div>
          <button type="button" className="btn btn--ghost" onClick={recommend}>
            Suggest the right crane
          </button>
          {rec && (
            <p className={rec.craneClassId ? "note note--ok" : "note note--warn"}>
              {rec.craneClassId ? `Suggested: ${getCraneClass(rec.craneClassId)?.name}. ` : ""}
              {rec.reason}
            </p>
          )}
          <div className="crane-picker" role="radiogroup" aria-label="Crane">
            {(catalog?.classes ?? []).map((c) => (
              <button
                type="button"
                key={c.id}
                role="radio"
                aria-checked={draft.craneClassId === c.id}
                className={`crane-option ${draft.craneClassId === c.id ? "is-selected" : ""}`}
                onClick={() => set("craneClassId", c.id)}
              >
                <strong>{c.name}</strong>
                <span>
                  {c.capacityTons} t · {c.maxLiftHeightM} m
                </span>
                <span className="crane-option__price">{formatINR(c.rates.hourly)}/hr</span>
                <span className={`avail ${c.availableUnits > 0 ? "" : "avail--none"}`}>
                  {c.availableUnits > 0 ? `${c.availableUnits} available` : "On request"}
                </span>
              </button>
            ))}
          </div>
          <p className="fineprint">Capacity guidance is indicative; our operator confirms against the manufacturer load chart before lifting.</p>
        </Card>

        <Card title="2 · Where is the site?" actions={<button type="button" className="btn btn--small btn--ghost" onClick={useMyLocation}>📍 Use my location</button>}>
          <MapView markers={markers} onPick={(lat, lng) => set("site", { lat, lng })} />
          <p className="fineprint">{draft.site ? `Pinned ${draft.site.lat.toFixed(5)}, ${draft.site.lng.toFixed(5)}` : "Tap the map to pin the exact work site."}</p>
          <Field label="Site address / landmark">
            <textarea rows={2} value={draft.siteAddress} onChange={(e) => set("siteAddress", e.target.value)} required minLength={5} placeholder="Door no, street, area, town" />
          </Field>
        </Card>

        <Card title="3 · When and how long?">
          <div className="segmented" role="radiogroup">
            {(["now", "later"] as const).map((w) => (
              <button type="button" key={w} role="radio" aria-checked={draft.when === w} className={draft.when === w ? "is-on" : ""} onClick={() => set("when", w)}>
                {w === "now" ? "⚡ As soon as possible" : "📅 Schedule"}
              </button>
            ))}
          </div>
          {draft.when === "later" && (
            <Field label="Start date & time (India time)">
              <input type="datetime-local" value={draft.scheduledLocal} min={toIstInput(new Date())} onChange={(e) => set("scheduledLocal", e.target.value)} required />
            </Field>
          )}
          <div className="row2">
            <Field label="Rental type">
              <select
                value={draft.rentalType}
                onChange={(e) => {
                  const t = e.target.value as RentalType;
                  setDraft((d) => ({ ...d, rentalType: t, duration: t === "hourly" ? 4 : 1 }));
                }}
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily (8 hr shift)</option>
                <option value="monthly">Monthly</option>
              </select>
            </Field>
            <Field label={`Duration (${UNIT[draft.rentalType]})`}>
              <input type="number" min={1} step={1} value={draft.duration} onChange={(e) => set("duration", Number(e.target.value))} required />
            </Field>
          </div>
        </Card>

        <Card title="4 · Site contact & notes">
          <div className="row2">
            <Field label="Contact name">
              <input value={draft.contactName} onChange={(e) => set("contactName", e.target.value)} required={Boolean(user)} placeholder={user ? "" : "Filled after sign-in"} />
            </Field>
            <Field label="Contact mobile">
              <input inputMode="numeric" value={draft.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} required={Boolean(user)} placeholder={user ? "" : "Filled after sign-in"} />
            </Field>
          </div>
          <Field label="Notes for the operator" hint="Access road, ground conditions, permits, power lines nearby…">
            <textarea rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <Field label="Payment">
            <select value={draft.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value as Draft["paymentMethod"])}>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="credit">Credit account (contractors)</option>
            </select>
          </Field>
        </Card>
      </div>

      <aside className="book__side">
        <Card className="sticky">
          {quote ? (
            <>
              <p className="muted">≈ {quote.distanceKm} km from our yard</p>
              <QuoteBreakdown quote={quote.quote} />
            </>
          ) : (
            <p className="muted">Pin your site to see the upfront fare.</p>
          )}
          <ErrorNote error={error} />
          <button className="btn btn--primary btn--block btn--lg" disabled={busy}>
            {busy ? "Booking…" : user ? `Request ${selected?.name ?? "crane"}` : "Sign in to book"}
          </button>
          <p className="fineprint">No payment now. We confirm the booking and assign a crane & operator, then you get a start OTP.</p>
        </Card>
      </aside>
    </form>
  );
}
