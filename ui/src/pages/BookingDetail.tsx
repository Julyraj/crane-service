import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BOOKING_STATUSES,
  canTransition,
  formatDateTime,
  formatINR,
  getCraneClass,
  googleMapsDirectionsUrl,
  STATUS_LABELS,
  upiUrl,
  whatsappUrl,
  type Booking,
  type Crane,
  type User,
} from "@crane/shared";
import { api } from "../api.ts";
import { useApi } from "../hooks.ts";
import { useRealtime } from "../realtime.ts";
import { useSession } from "../session.tsx";
import { MapView, type MapMarker } from "../components/MapView.tsx";
import { QuoteBreakdown } from "../components/QuoteBreakdown.tsx";
import { Card, ErrorNote, Field, Spinner, StatusBadge } from "../components/ui.tsx";

const FLOW = BOOKING_STATUSES.filter((s) => s !== "cancelled");

export function BookingDetail() {
  const { id } = useParams();
  const { user, catalog } = useSession();
  const { data: b, setData, error, reload } = useApi<Booking>(`/bookings/${id}`);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useRealtime((event, data) => {
    if (event === "booking" && (data as Booking).id === id) reload();
    if (event === "location") {
      const loc = data as { bookingId: string; lat: number; lng: number; at: string };
      if (loc.bookingId === id) setData((prev) => (prev ? { ...prev, operatorLat: loc.lat, operatorLng: loc.lng, operatorSeenAt: loc.at } : prev));
    }
  });

  async function act(path: string, body: unknown = {}) {
    setActionError(null);
    setBusy(true);
    try {
      setData(await api<Booking>(`/bookings/${id}/${path}`, { body }));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorNote error={error} />;
  if (!b || !user) return <Spinner />;

  const role = user.role;
  const isCustomer = b.customerId === user.id;
  const isOperator = role === "operator" && b.operatorId === user.id;
  const isAdmin = role === "admin";
  const crane = getCraneClass(b.craneClassId);
  const bill = b.finalQuote ?? b.quote;
  const stepIndex = FLOW.indexOf(b.status as (typeof FLOW)[number]);
  const markers: MapMarker[] = [
    { id: "site", kind: "site", lat: b.siteLat, lng: b.siteLng, label: "Work site" },
    ...(b.operatorLat != null && b.operatorLng != null
      ? [{ id: "crane", kind: "crane" as const, lat: b.operatorLat, lng: b.operatorLng, label: b.craneName ?? "Crane" }]
      : []),
  ];
  const business = catalog?.business;

  return (
    <div className="detail">
      <div className="page-head">
        <div>
          <p className="muted">{b.code}</p>
          <h1>{crane?.name}</h1>
        </div>
        <StatusBadge status={b.status} />
      </div>

      {b.status !== "cancelled" ? (
        <ol className="progress" aria-label="Booking progress">
          {FLOW.map((s, i) => (
            <li key={s} className={i < stepIndex ? "done" : i === stepIndex ? "current" : ""}>
              <span>{STATUS_LABELS[s]}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="note note--warn">Cancelled: {b.cancelReason}</p>
      )}

      <ErrorNote error={actionError} />

      <div className="detail__grid">
        <div className="stack">
          {isCustomer && b.startOtp && ["assigned", "en_route", "on_site"].includes(b.status) && (
            <Card className="otp-card">
              <p>Share this code with the operator only when the crane is at your site:</p>
              <div className="otp">{b.startOtp}</div>
            </Card>
          )}

          {isOperator && <OperatorPanel booking={b} busy={busy} act={act} />}
          {isAdmin && <AdminPanel booking={b} busy={busy} act={act} />}

          <Card title="Live map">
            <MapView markers={markers} height={300} />
            <p className="fineprint">
              {b.operatorSeenAt ? `Crane location updated ${formatDateTime(b.operatorSeenAt)}` : "Live crane location appears once the operator starts the trip."}
            </p>
          </Card>

          <Card title="Job details">
            <dl className="kv">
              <dt>Start</dt>
              <dd>{formatDateTime(b.scheduledAt)}</dd>
              <dt>Duration</dt>
              <dd>
                {b.duration} {b.rentalType === "hourly" ? "hours" : b.rentalType === "daily" ? "days" : "months"}
                {b.actualDuration != null && ` (actual ${b.actualDuration})`}
              </dd>
              <dt>Site</dt>
              <dd>
                {b.siteAddress} <span className="muted">· {b.distanceKm} km from yard</span>
              </dd>
              <dt>Site contact</dt>
              <dd>
                {b.contactName} · <a href={`tel:+91${b.contactPhone}`}>+91 {b.contactPhone}</a>
              </dd>
              {b.loadTons != null && (
                <>
                  <dt>Lift</dt>
                  <dd>
                    {b.loadTons} t{b.liftHeightM != null && ` · ${b.liftHeightM} m high`}
                    {b.radiusM != null && ` · ${b.radiusM} m radius`}
                  </dd>
                </>
              )}
              {b.notes && (
                <>
                  <dt>Notes</dt>
                  <dd>{b.notes}</dd>
                </>
              )}
              {b.craneName && (
                <>
                  <dt>Crane</dt>
                  <dd>
                    {b.craneName} · {b.craneRegNo}
                  </dd>
                </>
              )}
              {b.operatorName && (
                <>
                  <dt>Operator</dt>
                  <dd>
                    {b.operatorName}
                    {b.operatorPhone && (
                      <>
                        {" "}
                        · <a href={`tel:+91${b.operatorPhone}`}>Call</a>
                      </>
                    )}
                  </dd>
                </>
              )}
              {(isAdmin || isOperator) && (
                <>
                  <dt>Customer</dt>
                  <dd>
                    {b.customerName ?? "—"} · +91 {b.customerPhone}
                  </dd>
                </>
              )}
            </dl>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <QuoteBreakdown quote={bill} overrideTotal={b.overrideTotal} title={b.finalQuote ? "Final bill" : "Fare estimate"} />
            <div className="amount-due">
              <span>Amount {b.paymentStatus === "paid" ? "paid" : "due"}</span>
              <strong>{formatINR(b.amountDue)}</strong>
            </div>
            <p className="muted">
              Payment: {b.paymentMethod.replace("_", " ")} · {b.paymentStatus.replace("_", " ")}
            </p>
            <div className="btn-row">
              {isCustomer && business?.upiId && b.paymentStatus !== "paid" && b.amountDue > 0 && ["completed", "cancelled"].includes(b.status) && (
                <a className="btn btn--primary" href={upiUrl({ upiId: business.upiId, payee: business.name, amount: b.amountDue, note: b.code })}>
                  Pay by UPI
                </a>
              )}
              {b.amountDue > 0 && ["completed", "cancelled"].includes(b.status) && (
                <Link className="btn btn--ghost" to={`/bookings/${b.id}/invoice`}>
                  Invoice
                </Link>
              )}
              {business && (
                <a className="btn btn--ghost" target="_blank" rel="noreferrer" href={whatsappUrl(business.phone, `Hi, regarding booking ${b.code}`)}>
                  WhatsApp support
                </a>
              )}
            </div>
          </Card>

          {isCustomer && canTransition(b.status, "cancelled", "customer") && <CancelBox busy={busy} onCancel={(reason) => act("cancel", { reason })} />}

          {b.status === "completed" &&
            ((isCustomer && b.customerRating == null) || (isOperator && b.operatorRating == null)) && (
              <RateBox who={isCustomer ? "the operator & service" : "the customer"} onRate={(stars, comment) => act("rate", { stars, comment })} />
            )}

          <Card title="Timeline">
            <ol className="timeline">
              {(b.events ?? []).map((e) => (
                <li key={e.id}>
                  <strong>{e.status in STATUS_LABELS ? STATUS_LABELS[e.status as keyof typeof STATUS_LABELS] : e.status}</strong>
                  <span className="muted">
                    {formatDateTime(e.createdAt)}
                    {e.actorName && ` · ${e.actorName}`}
                  </span>
                  {e.note && <p>{e.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

type Act = (path: string, body?: unknown) => Promise<void>;

function OperatorPanel({ booking: b, busy, act }: { booking: Booking; busy: boolean; act: Act }) {
  const [otp, setOtp] = useState("");
  const [hours, setHours] = useState(String(b.duration));
  const [sharing, setSharing] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const watch = useRef<number | null>(null);
  const lastSent = useRef(0);
  const active = ["assigned", "en_route", "on_site", "in_progress"].includes(b.status);

  useEffect(() => {
    if (!sharing || !active) return;
    if (!navigator.geolocation) {
      setGeoError("Location not supported on this device");
      return;
    }
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        const now = Date.now();
        if (now - lastSent.current < 10_000) return;
        lastSent.current = now;
        api(`/bookings/${b.id}/location`, { body: { lat: p.coords.latitude, lng: p.coords.longitude } }).catch((e) => setGeoError((e as Error).message));
      },
      (err) => setGeoError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    };
  }, [sharing, active, b.id]);

  useEffect(() => {
    if (b.status === "en_route") setSharing(true);
  }, [b.status]);

  if (!active) return null;
  return (
    <Card title="Job actions" className="action-card">
      <div className="btn-row">
        <a className="btn btn--ghost" target="_blank" rel="noreferrer" href={googleMapsDirectionsUrl({ lat: b.siteLat, lng: b.siteLng })}>
          🧭 Navigate
        </a>
        <a className="btn btn--ghost" href={`tel:+91${b.contactPhone}`}>
          📞 Call site
        </a>
        <label className="toggle">
          <input type="checkbox" checked={sharing} onChange={(e) => setSharing(e.target.checked)} /> Share live location
        </label>
      </div>
      {geoError && <p className="error">{geoError}</p>}
      {b.status === "assigned" && (
        <button className="btn btn--primary btn--block btn--lg" disabled={busy} onClick={() => act("status", { status: "en_route" })}>
          Start trip to site
        </button>
      )}
      {b.status === "en_route" && (
        <button className="btn btn--primary btn--block btn--lg" disabled={busy} onClick={() => act("status", { status: "on_site" })}>
          I've arrived at site
        </button>
      )}
      {b.status === "on_site" && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void act("start", { otp });
          }}
        >
          <Field label="Start OTP from site contact">
            <input className="otp-input" inputMode="numeric" maxLength={4} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <button className="btn btn--primary btn--block btn--lg" disabled={busy || otp.length !== 4}>
            Verify OTP & start lifting
          </button>
        </form>
      )}
      {b.status === "in_progress" && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void act("complete", { actualDuration: Number(hours) });
          }}
        >
          <Field label={`Actual ${b.rentalType === "hourly" ? "hours" : b.rentalType === "daily" ? "days" : "months"} worked`}>
            <input type="number" min={0.5} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
          <button className="btn btn--primary btn--block btn--lg" disabled={busy || !(Number(hours) > 0)}>
            Complete job
          </button>
        </form>
      )}
    </Card>
  );
}

function AdminPanel({ booking: b, busy, act }: { booking: Booking; busy: boolean; act: Act }) {
  const cranes = useApi<Crane[]>("/admin/cranes");
  const operators = useApi<User[]>("/admin/users?role=operator");
  const [override, setOverride] = useState("");
  const [craneId, setCraneId] = useState(b.craneId ?? "");
  const [operatorId, setOperatorId] = useState(b.operatorId ?? "");
  const [payRef, setPayRef] = useState(b.paymentReference ?? "");
  const [cancelReason, setCancelReason] = useState("");
  const booked = getCraneClass(b.craneClassId)!;
  const eligible = (cranes.data ?? []).filter(
    (c) => (getCraneClass(c.classId)?.capacityTons ?? 0) >= booked.capacityTons && (c.status !== "maintenance" || c.id === b.craneId),
  ).sort((x, y) => (getCraneClass(x.classId)?.capacityTons ?? 0) - (getCraneClass(y.classId)?.capacityTons ?? 0));

  return (
    <Card title="Dispatch" className="action-card">
      {b.status === "requested" && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void act("confirm", override ? { overrideTotal: Number(override) } : {});
          }}
        >
          <Field label="Agreed total incl. GST (optional)" hint={`Computed: ${formatINR(b.quote.total)}`}>
            <input type="number" min={1} value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Leave blank to accept the quote" />
          </Field>
          <button className="btn btn--primary" disabled={busy}>
            Confirm booking
          </button>
        </form>
      )}
      {(b.status === "confirmed" || b.status === "assigned") && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void act("assign", { craneId, operatorId });
          }}
        >
          <div className="row2">
            <Field label="Crane">
              <select
                value={craneId}
                onChange={(e) => {
                  setCraneId(e.target.value);
                  const c = cranes.data?.find((x) => x.id === e.target.value);
                  if (c?.defaultOperatorId) setOperatorId(c.defaultOperatorId);
                }}
                required
              >
                <option value="">Select crane…</option>
                {eligible.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.regNo}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Operator">
              <select value={operatorId} onChange={(e) => setOperatorId(e.target.value)} required>
                <option value="">Select operator…</option>
                {(operators.data ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name ?? o.phone}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {eligible.length === 0 && <p className="note note--warn">No crane of {booked.name} or larger is in service. Check Fleet.</p>}
          <p className="fineprint">A crane or operator already booked at an overlapping time will be refused.</p>
          <button className="btn btn--primary" disabled={busy || !craneId || !operatorId}>
            {b.status === "assigned" ? "Reassign" : "Assign & notify"}
          </button>
        </form>
      )}
      {["en_route", "in_progress"].includes(b.status) && (
        <div className="btn-row">
          {b.status === "en_route" && (
            <button className="btn btn--ghost" disabled={busy} onClick={() => act("status", { status: "on_site" })}>
              Mark arrived
            </button>
          )}
          {b.status === "in_progress" && (
            <button className="btn btn--ghost" disabled={busy} onClick={() => act("complete", { actualDuration: b.duration })}>
              Complete with booked duration
            </button>
          )}
        </div>
      )}
      {["completed", "cancelled"].includes(b.status) && b.amountDue > 0 && (
        <form
          className="row2"
          onSubmit={(e) => {
            e.preventDefault();
            void act("payment", { status: "paid", reference: payRef || undefined });
          }}
        >
          <Field label="Payment reference / UTR">
            <input value={payRef} onChange={(e) => setPayRef(e.target.value)} />
          </Field>
          <button className="btn btn--primary align-end" disabled={busy || b.paymentStatus === "paid"}>
            {b.paymentStatus === "paid" ? "Paid ✓" : "Mark as paid"}
          </button>
        </form>
      )}
      {canTransition(b.status, "cancelled", "admin") && (
        <details className="danger-zone">
          <summary>Cancel booking</summary>
          <div className="row2">
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason" />
            <button className="btn btn--danger" disabled={busy || cancelReason.trim().length < 2} onClick={() => act("cancel", { reason: cancelReason })}>
              Cancel booking
            </button>
          </div>
        </details>
      )}
    </Card>
  );
}

function CancelBox({ busy, onCancel }: { busy: boolean; onCancel: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open)
    return (
      <button className="btn btn--ghost btn--block" onClick={() => setOpen(true)}>
        Cancel booking
      </button>
    );
  return (
    <Card title="Cancel booking">
      <Field label="Reason">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Work postponed" />
      </Field>
      <div className="btn-row">
        <button className="btn btn--danger" disabled={busy || reason.trim().length < 2} onClick={() => onCancel(reason)}>
          Confirm cancel
        </button>
        <button className="btn btn--ghost" onClick={() => setOpen(false)}>
          Keep booking
        </button>
      </div>
    </Card>
  );
}

function RateBox({ who, onRate }: { who: string; onRate: (stars: number, comment?: string) => void }) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  return (
    <Card title={`Rate ${who}`}>
      <div className="stars" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} className={n <= stars ? "on" : ""} onClick={() => setStars(n)}>
            ★
          </button>
        ))}
      </div>
      <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" />
      <button className="btn btn--primary" onClick={() => onRate(stars, comment || undefined)}>
        Submit rating
      </button>
    </Card>
  );
}
