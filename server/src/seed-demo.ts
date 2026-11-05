/**
 * Seeds a demo fleet and team. Safe to run repeatedly.
 *   pnpm seed:demo
 */
import crypto from "node:crypto";
import path from "node:path";
import { loadConfig } from "./config.ts";
import { nowIso, openDb } from "./db.ts";

const config = loadConfig();
const db = openDb(path.join(config.dataDir, "crane.db"));

const users = [
  { phone: config.business.phone, name: "Owner", role: "admin" },
  { phone: "9000000001", name: "Murugan (Operator)", role: "operator" },
  { phone: "9000000002", name: "Selvam (Operator)", role: "operator" },
  { phone: "9000000003", name: "Ravi (Operator)", role: "operator" },
];
const ids: Record<string, string> = {};
for (const u of users) {
  const existing = db.prepare("SELECT id FROM users WHERE phone = ?").get(u.phone) as { id: string } | undefined;
  if (existing) {
    ids[u.phone] = existing.id;
    continue;
  }
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO users (id, phone, name, role, created_at) VALUES (?, ?, ?, ?, ?)").run(id, u.phone, u.name, u.role, nowIso());
  ids[u.phone] = id;
}

const cranes = [
  { classId: "hydra-13", regNo: "TN 30 AA 1301", name: "Hydra 13T #1", op: "9000000001" },
  { classId: "hydra-15", regNo: "TN 30 AA 1501", name: "Hydra 15T #1", op: "9000000002" },
  { classId: "hydra-16", regNo: "TN 30 AA 1601", name: "Hydra 16T #1", op: "9000000003" },
  { classId: "tele-60", regNo: "TN 30 BB 6001", name: "Telescopic 60T", op: null },
  { classId: "tele-100", regNo: "TN 30 BB 1001", name: "Telescopic 100T", op: null },
  { classId: "tele-150", regNo: "TN 30 BB 1501", name: "Telescopic 150T", op: null },
];
for (const c of cranes) {
  db.prepare(
    `INSERT INTO cranes (id, class_id, reg_no, name, status, default_operator_id, created_at)
     VALUES (?, ?, ?, ?, 'available', ?, ?) ON CONFLICT(reg_no) DO NOTHING`,
  ).run(crypto.randomUUID(), c.classId, c.regNo, c.name, c.op ? ids[c.op]! : null, nowIso());
}
console.log(`Seeded ${users.length} users and ${cranes.length} cranes into ${config.dataDir}`);
db.close();
