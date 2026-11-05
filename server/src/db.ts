import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','operator','admin')),
    company TEXT,
    gstin TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE otp_codes (
    phone TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE cranes (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    reg_no TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','on_job','maintenance')),
    default_operator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    last_lat REAL,
    last_lng REAL,
    last_seen_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL,
    crane_class_id TEXT NOT NULL,
    rental_type TEXT NOT NULL,
    duration REAL NOT NULL,
    actual_duration REAL,
    scheduled_at TEXT NOT NULL,
    site_address TEXT NOT NULL,
    site_lat REAL NOT NULL,
    site_lng REAL NOT NULL,
    distance_km REAL NOT NULL,
    load_tons REAL,
    lift_height_m REAL,
    radius_m REAL,
    notes TEXT,
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    quote_json TEXT NOT NULL,
    final_quote_json TEXT,
    override_total REAL,
    amount_due REAL NOT NULL,
    crane_id TEXT REFERENCES cranes(id),
    operator_id TEXT REFERENCES users(id),
    start_otp TEXT,
    operator_lat REAL,
    operator_lng REAL,
    operator_seen_at TEXT,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    payment_method TEXT NOT NULL DEFAULT 'upi',
    payment_reference TEXT,
    cancel_reason TEXT,
    customer_rating INTEGER,
    customer_comment TEXT,
    operator_rating INTEGER,
    operator_comment TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX bookings_customer ON bookings(customer_id, created_at);
  CREATE INDEX bookings_operator ON bookings(operator_id, status);
  CREATE INDEX bookings_status ON bookings(status, scheduled_at);
  CREATE TABLE booking_events (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    note TEXT,
    actor_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL
  );
  CREATE INDEX booking_events_booking ON booking_events(booking_id, created_at);
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  `
  ALTER TABLE users ADD COLUMN pin_hash TEXT;
  ALTER TABLE users ADD COLUMN pin_failures INTEGER NOT NULL DEFAULT 0;
  `,
  `
  ALTER TABLE users ADD COLUMN pin_locked_until INTEGER;
  ALTER TABLE bookings ADD COLUMN pricing_json TEXT;
  ALTER TABLE bookings ADD COLUMN completed_at TEXT;
  ALTER TABLE bookings ADD COLUMN start_otp_failures INTEGER NOT NULL DEFAULT 0;
  UPDATE bookings SET completed_at = (
    SELECT MAX(e.created_at) FROM booking_events e WHERE e.booking_id = bookings.id AND e.status = 'completed'
  ) WHERE status = 'completed';
  CREATE INDEX bookings_completed ON bookings(completed_at);
  `,
];

export function openDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

function migrate(db: Db) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
  const row = db.prepare("SELECT version FROM schema_version").get() as { version: number } | undefined;
  let version = row?.version ?? 0;
  if (!row) db.prepare("INSERT INTO schema_version (version) VALUES (0)").run();
  while (version < MIGRATIONS.length) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[version]!);
      version += 1;
      db.prepare("UPDATE schema_version SET version = ?").run(version);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

export function tx<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export const nowIso = () => new Date().toISOString();
