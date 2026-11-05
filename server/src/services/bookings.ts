import crypto from "node:crypto";
import {
  ACTIVE_STATUSES,
  canTransition,
  computeQuote,
  estimateRoadKm,
  getCraneClass,
  isDispatched,
  type Booking,
  type BookingEvent,
  type BookingStatus,
  type CreateBookingInput,
  type PricingConfig,
  type Quote,
  type User,
} from "@crane/shared";
import type { AppConfig } from "../config.ts";
import { nowIso, tx, type Db } from "../db.ts";
import { badRequest, conflict, forbidden, notFound } from "../errors.ts";
import type { RealtimeHub } from "../realtime.ts";
import { getPricing } from "./settings.ts";

interface BookingRow {
  id: string;
  code: string;
  customer_id: string;
  status: BookingStatus;
  crane_class_id: string;
  rental_type: Booking["rentalType"];
  duration: number;
  actual_duration: number | null;
  scheduled_at: string;
  site_address: string;
  site_lat: number;
  site_lng: number;
  distance_km: number;
  load_tons: number | null;
  lift_height_m: number | null;
  radius_m: number | null;
  notes: string | null;
  contact_name: string;
  contact_phone: string;
  quote_json: string;
  final_quote_json: string | null;
  override_total: number | null;
  amount_due: number;
  crane_id: string | null;
  operator_id: string | null;
  start_otp: string | null;
  operator_lat: number | null;
  operator_lng: number | null;
  operator_seen_at: string | null;
  payment_status: Booking["paymentStatus"];
  payment_method: Booking["paymentMethod"];
  payment_reference: string | null;
  cancel_reason: string | null;
  customer_rating: number | null;
  operator_rating: number | null;
  created_at: string;
  updated_at: string;
  customer_name: string | null;
  customer_phone: string;
  operator_name: string | null;
  operator_phone: string | null;
  crane_reg_no: string | null;
  crane_name: string | null;
}

const SELECT = `
  SELECT b.*, c.name AS customer_name, c.phone AS customer_phone,
         o.name AS operator_name, o.phone AS operator_phone,
         cr.reg_no AS crane_reg_no, cr.name AS crane_name
  FROM bookings b
  JOIN users c ON c.id = b.customer_id
  LEFT JOIN users o ON o.id = b.operator_id
  LEFT JOIN cranes cr ON cr.id = b.crane_id`;

function canView(row: { customer_id: string; operator_id: string | null }, viewer: User): boolean {
  if (viewer.role === "admin") return true;
  if (viewer.role === "operator" && row.operator_id === viewer.id) return true;
  return row.customer_id === viewer.id;
}

function serialize(row: BookingRow, viewer: User, events?: BookingEvent[]): Booking {
  const isCustomer = row.customer_id === viewer.id;
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    craneClassId: row.crane_class_id,
    rentalType: row.rental_type,
    duration: row.duration,
    actualDuration: row.actual_duration,
    scheduledAt: row.scheduled_at,
    siteAddress: row.site_address,
    siteLat: row.site_lat,
    siteLng: row.site_lng,
    distanceKm: row.distance_km,
    loadTons: row.load_tons,
    liftHeightM: row.lift_height_m,
    radiusM: row.radius_m,
    notes: row.notes,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    quote: JSON.parse(row.quote_json) as Quote,
    finalQuote: row.final_quote_json ? (JSON.parse(row.final_quote_json) as Quote) : null,
    overrideTotal: row.override_total,
    amountDue: row.amount_due,
    craneId: row.crane_id,
    craneRegNo: row.crane_reg_no,
    craneName: row.crane_name,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    operatorPhone: row.operator_phone,
    // The job-start OTP is shown to the customer (site) only, never to the operator.
    startOtp: isCustomer || viewer.role === "admin" ? row.start_otp : undefined,
    operatorLat: row.operator_lat,
    operatorLng: row.operator_lng,
    operatorSeenAt: row.operator_seen_at,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    cancelReason: row.cancel_reason,
    customerRating: row.customer_rating,
    operatorRating: row.operator_rating,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    events,
  };
}

function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return `SVC-${s}`;
}

export function createBookingService(db: Db, config: AppConfig, hub: RealtimeHub) {
  const getRow = (id: string) => db.prepare(`${SELECT} WHERE b.id = ?`).get(id) as BookingRow | undefined;

  function events(bookingId: string): BookingEvent[] {
    const rows = db
      .prepare(
        `SELECT e.id, e.status, e.note, e.created_at, u.name AS actor_name, u.role AS actor_role
         FROM booking_events e LEFT JOIN users u ON u.id = e.actor_id
         WHERE e.booking_id = ? ORDER BY e.created_at ASC, e.rowid ASC`,
      )
      .all(bookingId) as { id: string; status: BookingEvent["status"]; note: string | null; created_at: string; actor_name: string | null }[];
    return rows.map((r) => ({ id: r.id, status: r.status, note: r.note, actorName: r.actor_name, createdAt: r.created_at }));
  }

  function addEvent(bookingId: string, status: BookingEvent["status"], actor: User | null, note?: string | null) {
    db.prepare("INSERT INTO booking_events (id, booking_id, status, note, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      crypto.randomUUID(),
      bookingId,
      status,
      note ?? null,
      actor?.id ?? null,
      nowIso(),
    );
  }

  function broadcast(id: string) {
    const row = getRow(id);
    if (!row) return;
    hub.publish("booking", [row.customer_id, row.operator_id], (viewer) =>
      canView(row, viewer) ? serialize(row, viewer) : null,
    );
  }

  function load(id: string, viewer: User): BookingRow {
    const row = getRow(id);
    if (!row || !canView(row, viewer)) throw notFound("Booking not found");
    return row;
  }

  function assertTransition(row: BookingRow, to: BookingStatus, viewer: User) {
    const role = viewer.role === "admin" ? "admin" : row.customer_id === viewer.id ? "customer" : viewer.role;
    if (!canTransition(row.status, to, role)) {
      throw conflict(`Cannot move booking from "${row.status}" to "${to}"`);
    }
  }

  function setStatus(row: BookingRow, to: BookingStatus, actor: User, extra: Record<string, unknown> = {}, note?: string) {
    const cols = Object.keys(extra);
    const sets = ["status = ?", "updated_at = ?", ...cols.map((c) => `${c} = ?`)].join(", ");
    db.prepare(`UPDATE bookings SET ${sets} WHERE id = ? AND status = ?`).run(
      to,
      nowIso(),
      ...(cols.map((c) => extra[c]) as (string | number | null)[]),
      row.id,
      row.status,
    );
    addEvent(row.id, to, actor, note);
  }

  function releaseCrane(craneId: string | null, exceptBookingId: string) {
    if (!craneId) return;
    const busy = db
      .prepare(
        `SELECT 1 FROM bookings WHERE crane_id = ? AND id != ? AND status IN (${ACTIVE_STATUSES.map(() => "?").join(",")}) LIMIT 1`,
      )
      .get(craneId, exceptBookingId, ...ACTIVE_STATUSES);
    if (!busy) db.prepare("UPDATE cranes SET status = 'available' WHERE id = ? AND status = 'on_job'").run(craneId);
  }

  return {
    quote(input: { craneClassId: string; rentalType: Booking["rentalType"]; duration: number; siteLat: number; siteLng: number; scheduledAt: string }, pricing?: PricingConfig) {
      const distanceKm = estimateRoadKm(config.business.yard, { lat: input.siteLat, lng: input.siteLng });
      const quote = computeQuote({ ...input, distanceKm }, pricing ?? getPricing(db));
      return { distanceKm, quote };
    },

    create(customer: User, input: CreateBookingInput): Booking {
      if (new Date(input.scheduledAt).getTime() < Date.now() - 15 * 60_000) {
        throw badRequest("Scheduled time is in the past");
      }
      const { distanceKm, quote } = this.quote(input);
      const id = crypto.randomUUID();
      const now = nowIso();
      tx(db, () => {
        db.prepare(
          `INSERT INTO bookings (id, code, customer_id, status, crane_class_id, rental_type, duration, scheduled_at,
             site_address, site_lat, site_lng, distance_km, load_tons, lift_height_m, radius_m, notes,
             contact_name, contact_phone, quote_json, amount_due, payment_method, created_at, updated_at)
           VALUES (?, ?, ?, 'requested', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id, newCode(), customer.id, input.craneClassId, input.rentalType, input.duration,
          new Date(input.scheduledAt).toISOString(), input.siteAddress, input.siteLat, input.siteLng, distanceKm,
          input.loadTons ?? null, input.liftHeightM ?? null, input.radiusM ?? null, input.notes ?? null,
          input.contactName, input.contactPhone, JSON.stringify(quote), quote.total, input.paymentMethod, now, now,
        );
        addEvent(id, "requested", customer);
      });
      broadcast(id);
      return serialize(getRow(id)!, customer, events(id));
    },

    list(viewer: User, filter: { status?: string; scope?: string } = {}): Booking[] {
      const where: string[] = [];
      const params: string[] = [];
      if (viewer.role === "admin" && filter.scope !== "mine") {
        // all bookings
      } else if (viewer.role === "operator" && filter.scope !== "mine") {
        where.push("b.operator_id = ?");
        params.push(viewer.id);
      } else {
        where.push("b.customer_id = ?");
        params.push(viewer.id);
      }
      if (filter.status === "open") {
        where.push(`b.status NOT IN ('completed','cancelled')`);
      } else if (filter.status) {
        where.push("b.status = ?");
        params.push(filter.status);
      }
      const sql = `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY b.scheduled_at DESC LIMIT 200`;
      return (db.prepare(sql).all(...params) as unknown as BookingRow[]).map((r) => serialize(r, viewer));
    },

    get(id: string, viewer: User): Booking {
      return serialize(load(id, viewer), viewer, events(id));
    },

    cancel(id: string, viewer: User, reason: string): Booking {
      const row = load(id, viewer);
      assertTransition(row, "cancelled", viewer);
      const pricing = getPricing(db);
      const fee = isDispatched(row.status) ? Math.round(pricing.cancellationFee * (1 + pricing.gstRate)) : 0;
      tx(db, () => {
        setStatus(row, "cancelled", viewer, { cancel_reason: reason, amount_due: fee }, reason);
        releaseCrane(row.crane_id, row.id);
      });
      broadcast(id);
      return this.get(id, viewer);
    },

    confirm(id: string, admin: User, input: { overrideTotal?: number; note?: string }): Booking {
      const row = load(id, admin);
      assertTransition(row, "confirmed", admin);
      const amount = input.overrideTotal ?? row.amount_due;
      tx(db, () =>
        setStatus(
          row,
          "confirmed",
          admin,
          { override_total: input.overrideTotal ?? null, amount_due: amount },
          input.overrideTotal ? `Negotiated total ₹${input.overrideTotal.toLocaleString("en-IN")}. ${input.note ?? ""}`.trim() : input.note,
        ),
      );
      broadcast(id);
      return this.get(id, admin);
    },

    assign(id: string, admin: User, input: { craneId: string; operatorId: string }): Booking {
      const row = load(id, admin);
      assertTransition(row, "assigned", admin);
      const crane = db.prepare("SELECT * FROM cranes WHERE id = ?").get(input.craneId) as
        | { id: string; class_id: string; status: string; name: string; reg_no: string }
        | undefined;
      if (!crane) throw badRequest("Crane not found");
      const booked = getCraneClass(row.crane_class_id)!;
      const offered = getCraneClass(crane.class_id)!;
      if (offered.capacityTons < booked.capacityTons) throw badRequest(`${crane.name} is smaller than the booked ${booked.name}`);
      if (crane.status === "maintenance") throw conflict(`${crane.name} is under maintenance`);
      if (crane.status === "on_job" && row.crane_id !== crane.id) throw conflict(`${crane.name} is on another job`);
      const operator = db.prepare("SELECT id, name, role FROM users WHERE id = ?").get(input.operatorId) as
        | { id: string; name: string | null; role: string }
        | undefined;
      if (!operator || operator.role !== "operator") throw badRequest("Operator not found");

      const otp = row.start_otp ?? crypto.randomInt(0, 10_000).toString().padStart(4, "0");
      tx(db, () => {
        if (row.crane_id && row.crane_id !== crane.id) releaseCrane(row.crane_id, row.id);
        setStatus(
          row,
          "assigned",
          admin,
          { crane_id: crane.id, operator_id: operator.id, start_otp: otp },
          `${crane.name} (${crane.reg_no}) with operator ${operator.name ?? "—"}`,
        );
        db.prepare("UPDATE cranes SET status = 'on_job' WHERE id = ?").run(crane.id);
      });
      broadcast(id);
      return this.get(id, admin);
    },

    operatorStatus(id: string, viewer: User, status: "en_route" | "on_site"): Booking {
      const row = load(id, viewer);
      assertTransition(row, status, viewer);
      tx(db, () => setStatus(row, status, viewer));
      broadcast(id);
      return this.get(id, viewer);
    },

    start(id: string, viewer: User, otp: string): Booking {
      const row = load(id, viewer);
      if (row.operator_id !== viewer.id) throw forbidden("Only the assigned operator can start this job");
      assertTransition(row, "in_progress", viewer);
      const ok =
        row.start_otp != null &&
        crypto.timingSafeEqual(Buffer.from(row.start_otp.padEnd(4)), Buffer.from(otp.padEnd(4).slice(0, 4)));
      if (!ok) throw badRequest("Incorrect start OTP. Ask the site contact for the 4-digit code.");
      tx(db, () => setStatus(row, "in_progress", viewer, {}, "Start OTP verified at site"));
      broadcast(id);
      return this.get(id, viewer);
    },

    complete(id: string, viewer: User, input: { actualDuration: number; note?: string }): Booking {
      const row = load(id, viewer);
      assertTransition(row, "completed", viewer);
      const pricing = getPricing(db);
      const finalQuote = computeQuote(
        {
          craneClassId: row.crane_class_id,
          rentalType: row.rental_type,
          duration: input.actualDuration,
          distanceKm: row.distance_km,
          scheduledAt: row.scheduled_at,
          now: row.created_at,
        },
        pricing,
      );
      const original = JSON.parse(row.quote_json) as Quote;
      // Negotiated totals stay fixed; only overtime beyond the quoted duration is added on top.
      const amount =
        row.override_total != null
          ? row.override_total + Math.max(0, finalQuote.total - original.total)
          : finalQuote.total;
      tx(db, () => {
        setStatus(
          row,
          "completed",
          viewer,
          { actual_duration: input.actualDuration, final_quote_json: JSON.stringify(finalQuote), amount_due: amount },
          input.note,
        );
        releaseCrane(row.crane_id, row.id);
      });
      broadcast(id);
      return this.get(id, viewer);
    },

    location(id: string, viewer: User, loc: { lat: number; lng: number }) {
      const row = load(id, viewer);
      if (row.operator_id !== viewer.id) throw forbidden("Only the assigned operator can share location");
      if (!ACTIVE_STATUSES.includes(row.status)) throw conflict("Location sharing is only for active jobs");
      const at = nowIso();
      db.prepare("UPDATE bookings SET operator_lat = ?, operator_lng = ?, operator_seen_at = ? WHERE id = ?").run(loc.lat, loc.lng, at, id);
      if (row.crane_id) {
        db.prepare("UPDATE cranes SET last_lat = ?, last_lng = ?, last_seen_at = ? WHERE id = ?").run(loc.lat, loc.lng, at, row.crane_id);
      }
      hub.publish("location", [row.customer_id, row.operator_id], () => ({ bookingId: id, lat: loc.lat, lng: loc.lng, at }));
      return { ok: true, at };
    },

    rate(id: string, viewer: User, input: { stars: number; comment?: string }): Booking {
      const row = load(id, viewer);
      if (row.status !== "completed") throw conflict("You can rate after the job is completed");
      let col: "customer" | "operator";
      if (row.customer_id === viewer.id) col = "customer";
      else if (row.operator_id === viewer.id) col = "operator";
      else throw forbidden();
      if (row[`${col}_rating`] != null) throw conflict("Already rated");
      tx(db, () => {
        db.prepare(`UPDATE bookings SET ${col}_rating = ?, ${col}_comment = ?, updated_at = ? WHERE id = ?`).run(
          input.stars,
          input.comment ?? null,
          nowIso(),
          id,
        );
        addEvent(id, "rating", viewer, `${"★".repeat(input.stars)}${input.comment ? ` — ${input.comment}` : ""}`);
      });
      broadcast(id);
      return this.get(id, viewer);
    },

    payment(id: string, admin: User, input: { status: Booking["paymentStatus"]; method?: Booking["paymentMethod"]; reference?: string }): Booking {
      const row = load(id, admin);
      tx(db, () => {
        db.prepare(
          "UPDATE bookings SET payment_status = ?, payment_method = COALESCE(?, payment_method), payment_reference = ?, updated_at = ? WHERE id = ?",
        ).run(input.status, input.method ?? null, input.reference ?? row.payment_reference, nowIso(), id);
        addEvent(id, "payment", admin, `Payment: ${input.status.replace("_", " ")}${input.reference ? ` (ref ${input.reference})` : ""}`);
      });
      broadcast(id);
      return this.get(id, admin);
    },
  };
}

export type BookingService = ReturnType<typeof createBookingService>;
