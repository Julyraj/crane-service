import crypto from "node:crypto";
import type { AdminStats, Crane, User } from "@crane/shared";
import { nowIso, type Db } from "../db.ts";
import { badRequest, conflict, notFound } from "../errors.ts";
import { toUser, type UserRow } from "../auth.ts";

interface CraneRow {
  id: string;
  class_id: string;
  reg_no: string;
  name: string;
  status: Crane["status"];
  default_operator_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_seen_at: string | null;
}

const toCrane = (r: CraneRow): Crane => ({
  id: r.id,
  classId: r.class_id,
  regNo: r.reg_no,
  name: r.name,
  status: r.status,
  defaultOperatorId: r.default_operator_id,
  lastLat: r.last_lat,
  lastLng: r.last_lng,
  lastSeenAt: r.last_seen_at,
});

const normaliseReg = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();

/** Start of the current day / month in IST, as UTC ISO strings. */
function istBoundaries(now = new Date()) {
  const offset = 330 * 60_000;
  const ist = new Date(now.getTime() + offset);
  const day = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - offset;
  const month = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - offset;
  return { day: new Date(day).toISOString(), month: new Date(month).toISOString() };
}

export function createAdminService(db: Db) {
  function assertOperator(id: string | null | undefined) {
    if (id == null) return;
    const u = db.prepare("SELECT role FROM users WHERE id = ?").get(id) as { role: string } | undefined;
    if (u?.role !== "operator") throw badRequest("Default operator must be a team member with the operator role");
  }

  const num = (sql: string, ...p: string[]) => Number((db.prepare(sql).get(...p) as { n: number | null }).n ?? 0);

  return {
    stats(): AdminStats {
      const { day, month } = istBoundaries();
      const fleet = db.prepare("SELECT status, COUNT(*) AS n FROM cranes GROUP BY status").all() as { status: string; n: number }[];
      const count = (s: string) => fleet.find((f) => f.status === s)?.n ?? 0;
      const avg = db.prepare("SELECT AVG(customer_rating) AS n FROM bookings WHERE customer_rating IS NOT NULL").get() as { n: number | null };
      return {
        bookingsToday: num("SELECT COUNT(*) AS n FROM bookings WHERE created_at >= ?", day),
        openRequests: num("SELECT COUNT(*) AS n FROM bookings WHERE status IN ('requested','confirmed')"),
        activeJobs: num("SELECT COUNT(*) AS n FROM bookings WHERE status IN ('assigned','en_route','on_site','in_progress')"),
        completedThisMonth: num("SELECT COUNT(*) AS n FROM bookings WHERE status = 'completed' AND completed_at >= ?", month),
        revenueThisMonth: num("SELECT SUM(amount_due) AS n FROM bookings WHERE status = 'completed' AND completed_at >= ?", month),
        outstanding: num("SELECT SUM(amount_due) AS n FROM bookings WHERE payment_status != 'paid' AND status IN ('completed','cancelled')"),
        fleet: {
          total: fleet.reduce((s, f) => s + f.n, 0),
          available: count("available"),
          onJob: count("on_job"),
          maintenance: count("maintenance"),
        },
        averageRating: avg.n == null ? null : Math.round(avg.n * 10) / 10,
      };
    },

    listCranes(): Crane[] {
      return (db.prepare("SELECT * FROM cranes ORDER BY class_id, name").all() as unknown as CraneRow[]).map(toCrane);
    },

    availableUnits(): Record<string, number> {
      const rows = db.prepare("SELECT class_id, COUNT(*) AS n FROM cranes WHERE status = 'available' GROUP BY class_id").all() as {
        class_id: string;
        n: number;
      }[];
      return Object.fromEntries(rows.map((r) => [r.class_id, r.n]));
    },

    createCrane(input: { classId: string; regNo: string; name: string; status: "available" | "maintenance"; defaultOperatorId?: string | null }): Crane {
      assertOperator(input.defaultOperatorId);
      const id = crypto.randomUUID();
      try {
        db.prepare(
          "INSERT INTO cranes (id, class_id, reg_no, name, status, default_operator_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).run(id, input.classId, normaliseReg(input.regNo), input.name, input.status, input.defaultOperatorId ?? null, nowIso());
      } catch (err) {
        if (String(err).includes("UNIQUE")) throw conflict("A crane with this registration already exists");
        throw err;
      }
      return toCrane(db.prepare("SELECT * FROM cranes WHERE id = ?").get(id) as unknown as CraneRow);
    },

    updateCrane(id: string, input: Partial<{ classId: string; regNo: string; name: string; status: "available" | "maintenance"; defaultOperatorId: string | null }>): Crane {
      const row = db.prepare("SELECT * FROM cranes WHERE id = ?").get(id) as CraneRow | undefined;
      if (!row) throw notFound("Crane not found");
      if (input.status && input.status !== row.status && row.status === "on_job") {
        throw conflict("Crane is on an active job; complete or reassign the job first");
      }
      assertOperator(input.defaultOperatorId);
      db.prepare(
        "UPDATE cranes SET class_id = ?, reg_no = ?, name = ?, status = ?, default_operator_id = ? WHERE id = ?",
      ).run(
        input.classId ?? row.class_id,
        input.regNo ? normaliseReg(input.regNo) : row.reg_no,
        input.name ?? row.name,
        input.status ?? row.status,
        input.defaultOperatorId !== undefined ? input.defaultOperatorId : row.default_operator_id,
        id,
      );
      return toCrane(db.prepare("SELECT * FROM cranes WHERE id = ?").get(id) as unknown as CraneRow);
    },

    deleteCrane(id: string) {
      const used = db.prepare("SELECT 1 FROM bookings WHERE crane_id = ? LIMIT 1").get(id);
      if (used) throw conflict("Crane has booking history; set it to maintenance instead");
      const r = db.prepare("DELETE FROM cranes WHERE id = ?").run(id);
      if (r.changes === 0) throw notFound("Crane not found");
    },

    listUsers(role?: string): (User & { jobs: number })[] {
      const rows = db
        .prepare(
          `SELECT u.*, (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = u.id OR b.operator_id = u.id) AS jobs
           FROM users u ${role ? "WHERE u.role = ?" : ""} ORDER BY u.created_at DESC LIMIT 500`,
        )
        .all(...(role ? [role] : [])) as unknown as (UserRow & { jobs: number })[];
      return rows.map((r) => ({ ...toUser(r), jobs: r.jobs }));
    },

    upsertUser(actor: User, input: { phone: string; name: string; role: User["role"] }): User {
      const existing = db.prepare("SELECT * FROM users WHERE phone = ?").get(input.phone) as UserRow | undefined;
      if (existing) {
        if (existing.id === actor.id && input.role !== actor.role) throw badRequest("You cannot change your own role");
        db.prepare("UPDATE users SET name = ?, role = ? WHERE id = ?").run(input.name, input.role, existing.id);
        return toUser(db.prepare("SELECT * FROM users WHERE id = ?").get(existing.id) as unknown as UserRow);
      }
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO users (id, phone, name, role, created_at) VALUES (?, ?, ?, ?, ?)").run(id, input.phone, input.name, input.role, nowIso());
      return toUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as UserRow);
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
