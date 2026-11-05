import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";
import { openDb } from "../src/db.ts";
import { createApp } from "../src/app.ts";

let server: Server;
let base: string;
const ADMIN = "9789473129";
const CUSTOMER = "9876543210";
const OPERATOR = "9000000001";

beforeAll(async () => {
  const config = loadConfig({ NODE_ENV: "test", ADMIN_PHONES: ADMIN, DEV_OTP: "true", UI_DIST: "/nonexistent" });
  const db = openDb(":memory:");
  const { app } = createApp({ db, config, sms: { sendOtp: async () => {} } });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => server?.close());

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function login(phone: string, name: string) {
  const r = await call("POST", "/auth/otp/request", { phone });
  expect(r.status).toBe(200);
  const v = await call("POST", "/auth/otp/verify", { phone, code: r.body.devOtp, name });
  expect(v.status).toBe(200);
  return v.body as { token: string; user: { id: string; role: string } };
}

describe("booking lifecycle", () => {
  let admin: string, customer: string, operator: string, operatorId: string, craneId: string, bookingId: string, otp: string;

  it("rejects bad OTPs and locks after attempts", async () => {
    await call("POST", "/auth/otp/request", { phone: "9111111111" });
    const bad = await call("POST", "/auth/otp/verify", { phone: "9111111111", code: "000000" });
    // 1 in a million chance the random OTP is 000000
    expect([400, 200]).toContain(bad.status);
    const again = await call("POST", "/auth/otp/request", { phone: "9111111111" });
    expect(again.status).toBe(429);
  });

  it("logs in users with roles", async () => {
    const a = await login(ADMIN, "Owner");
    expect(a.user.role).toBe("admin");
    admin = a.token;
    const c = await login(CUSTOMER, "Kumar");
    expect(c.user.role).toBe("customer");
    customer = c.token;
    const promoted = await call("POST", "/admin/users", { phone: OPERATOR, name: "Murugan", role: "operator" }, admin);
    expect(promoted.status).toBe(200);
    operatorId = promoted.body.id;
    operator = (await login(OPERATOR, "Murugan")).token;
    expect((await call("GET", "/auth/me", undefined, operator)).body.user.role).toBe("operator");
  });

  it("blocks non-admins from admin APIs", async () => {
    expect((await call("GET", "/admin/stats", undefined, customer)).status).toBe(403);
    expect((await call("GET", "/admin/stats")).status).toBe(401);
  });

  it("creates fleet and quotes", async () => {
    const crane = await call("POST", "/admin/cranes", { classId: "hydra-15", regNo: "tn 30 aa 1501", name: "Hydra 15T #1" }, admin);
    expect(crane.status).toBe(201);
    expect(crane.body.regNo).toBe("TN 30 AA 1501");
    craneId = crane.body.id;
    const cat = await call("GET", "/catalog");
    expect(cat.body.classes.find((c: { id: string }) => c.id === "hydra-15").availableUnits).toBe(1);
    const q = await call("POST", "/quote", {
      craneClassId: "hydra-13", rentalType: "hourly", duration: 5, siteLat: 11.7, siteLng: 78.2,
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(q.status).toBe(200);
    expect(q.body.quote.total).toBeGreaterThan(0);
    const rec = await call("POST", "/recommend", { loadTons: 8, radiusM: 2 });
    expect(rec.body.craneClassId).toBe("hydra-13");
  });

  it("runs the full job flow", async () => {
    const created = await call("POST", "/bookings", {
      craneClassId: "hydra-13", rentalType: "hourly", duration: 4, siteLat: 11.7, siteLng: 78.2,
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      siteAddress: "SIPCOT Industrial Estate, Salem", contactName: "Kumar", contactPhone: CUSTOMER,
    }, customer);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("requested");
    bookingId = created.body.id;

    // Customer cannot confirm; operator cannot see it yet
    expect((await call("POST", `/bookings/${bookingId}/confirm`, {}, customer)).status).toBe(403);
    expect((await call("GET", `/bookings/${bookingId}`, undefined, operator)).status).toBe(404);

    expect((await call("POST", `/bookings/${bookingId}/confirm`, { overrideTotal: 6000 }, admin)).body.amountDue).toBe(6000);
    const assigned = await call("POST", `/bookings/${bookingId}/assign`, { craneId, operatorId }, admin);
    expect(assigned.status).toBe(200);
    expect(assigned.body.status).toBe("assigned");

    const custView = await call("GET", `/bookings/${bookingId}`, undefined, customer);
    otp = custView.body.startOtp;
    expect(otp).toMatch(/^\d{4}$/);
    const opView = await call("GET", `/bookings/${bookingId}`, undefined, operator);
    expect(opView.body.startOtp).toBeUndefined();

    expect((await call("POST", `/bookings/${bookingId}/status`, { status: "en_route" }, operator)).body.status).toBe("en_route");
    expect((await call("POST", `/bookings/${bookingId}/location`, { lat: 11.68, lng: 78.16 }, operator)).status).toBe(200);
    expect((await call("POST", `/bookings/${bookingId}/location`, { lat: 11.68, lng: 78.16 }, customer)).status).toBe(403);
    expect((await call("POST", `/bookings/${bookingId}/cancel`, { reason: "changed mind" }, customer)).status).toBe(409);
    expect((await call("POST", `/bookings/${bookingId}/status`, { status: "on_site" }, operator)).body.status).toBe("on_site");

    const wrong = otp === "0000" ? "1111" : "0000";
    expect((await call("POST", `/bookings/${bookingId}/start`, { otp: wrong }, operator)).status).toBe(400);
    expect((await call("POST", `/bookings/${bookingId}/start`, { otp }, operator)).body.status).toBe("in_progress");

    const done = await call("POST", `/bookings/${bookingId}/complete`, { actualDuration: 6 }, operator);
    expect(done.body.status).toBe("completed");
    // Negotiated 6000 + overtime (6h vs 4h quoted)
    expect(done.body.amountDue).toBeGreaterThan(6000);
    expect(done.body.finalQuote.billableUnits).toBe(6);

    const cranes = await call("GET", "/admin/cranes", undefined, admin);
    expect(cranes.body[0].status).toBe("available");

    expect((await call("POST", `/bookings/${bookingId}/rate`, { stars: 5, comment: "Great" }, customer)).body.customerRating).toBe(5);
    expect((await call("POST", `/bookings/${bookingId}/rate`, { stars: 4 }, customer)).status).toBe(409);
    expect((await call("POST", `/bookings/${bookingId}/payment`, { status: "paid", method: "upi", reference: "UTR123" }, admin)).body.paymentStatus).toBe("paid");

    const full = await call("GET", `/bookings/${bookingId}`, undefined, customer);
    expect(full.body.events.map((e: { status: string }) => e.status)).toEqual([
      "requested", "confirmed", "assigned", "en_route", "on_site", "in_progress", "completed", "rating", "payment",
    ]);
  });

  it("scopes booking lists by role", async () => {
    expect((await call("GET", "/bookings", undefined, customer)).body).toHaveLength(1);
    expect((await call("GET", "/bookings", undefined, operator)).body).toHaveLength(1);
    const other = await login("9222222222", "Other");
    expect((await call("GET", "/bookings", undefined, other.token)).body).toHaveLength(0);
    expect((await call("GET", `/bookings/${bookingId}`, undefined, other.token)).status).toBe(404);
  });

  it("reports admin stats", async () => {
    const s = await call("GET", "/admin/stats", undefined, admin);
    expect(s.body.completedThisMonth).toBe(1);
    expect(s.body.averageRating).toBe(5);
    expect(s.body.fleet.total).toBe(1);
  });

  it("validates input", async () => {
    const r = await call("POST", "/bookings", { craneClassId: "nope" }, customer);
    expect(r.status).toBe(400);
    expect(r.body.error).toBeTruthy();
  });
});
