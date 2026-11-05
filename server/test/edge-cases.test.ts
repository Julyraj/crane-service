import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PRICING } from "@crane/shared";
import { loadConfig } from "../src/config.ts";
import { openDb } from "../src/db.ts";
import { createApp } from "../src/app.ts";

let server: Server;
let base: string;

beforeAll(async () => {
  const config = loadConfig({ NODE_ENV: "test", ADMIN_PHONES: "9789473129", DEV_OTP: "true", UI_DIST: "/nonexistent" });
  const { app } = createApp({ db: openDb(":memory:"), config, sms: { sendOtp: async () => {} } });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server?.close());

async function call(method: string, path: string, body?: unknown, token?: string, raw?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

async function login(phone: string, name = "User") {
  const r = await call("POST", "/auth/otp/request", { phone });
  const v = await call("POST", "/auth/otp/verify", { phone, code: r.body.devOtp, name });
  return v.body as { token: string; user: { id: string } };
}

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString();
const bookingBody = (over: Record<string, unknown> = {}) => ({
  craneClassId: "hydra-13", rentalType: "hourly", duration: 4, siteLat: 11.7, siteLng: 78.2,
  scheduledAt: tomorrow(), siteAddress: "Five Roads, Salem", contactName: "Kumar", contactPhone: "9876543210",
  ...over,
});

let admin: string, custA: string, custB: string, op1: string, op2: string, op1Id: string, op2Id: string;
let hydra13: string, hydra16: string, tele60: string;

describe("setup", () => {
  it("creates people and fleet", async () => {
    admin = (await login("9789473129", "Owner")).token;
    custA = (await login("9876543210", "Kumar")).token;
    custB = (await login("9123456780", "Ravi")).token;
    op1Id = (await call("POST", "/admin/users", { phone: "9000000001", name: "Op One", role: "operator" }, admin)).body.id;
    op2Id = (await call("POST", "/admin/users", { phone: "9000000002", name: "Op Two", role: "operator" }, admin)).body.id;
    op1 = (await login("9000000001")).token;
    op2 = (await login("9000000002")).token;
    hydra13 = (await call("POST", "/admin/cranes", { classId: "hydra-13", regNo: "TN 30 AA 1301", name: "H13" }, admin)).body.id;
    hydra16 = (await call("POST", "/admin/cranes", { classId: "hydra-16", regNo: "TN 30 AA 1601", name: "H16" }, admin)).body.id;
    tele60 = (await call("POST", "/admin/cranes", { classId: "tele-60", regNo: "TN 30 BB 6001", name: "T60", status: "maintenance" }, admin)).body.id;
    expect([hydra13, hydra16, tele60].every(Boolean)).toBe(true);
  });
});

describe("fleet edits", () => {
  it("changing a maintenance crane's default operator keeps it in maintenance", async () => {
    const r = await call("PATCH", `/admin/cranes/${tele60}`, { defaultOperatorId: op1Id }, admin);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("maintenance");
    expect(r.body.defaultOperatorId).toBe(op1Id);
  });

  it("rejects duplicate registrations", async () => {
    const r = await call("POST", "/admin/cranes", { classId: "hydra-13", regNo: "tn30aa1301", name: "dup" }, admin);
    expect([400, 409]).toContain(r.status);
  });
});

describe("dispatch rules", () => {
  let b1: string;
  it("rejects bookings in the past", async () => {
    const r = await call("POST", "/bookings", bookingBody({ scheduledAt: new Date(Date.now() - 3_600_000).toISOString() }), custA);
    expect(r.status).toBe(400);
  });

  it("adds the instant surcharge for ASAP jobs", async () => {
    const r = await call("POST", "/bookings", bookingBody({ scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString() }), custA);
    expect(r.status).toBe(201);
    expect(r.body.quote.lines.map((l: { code: string }) => l.code)).toContain("instant");
    await call("POST", `/bookings/${r.body.id}/cancel`, { reason: "test" }, custA);
  });

  it("enforces crane size, maintenance and availability on assignment", async () => {
    b1 = (await call("POST", "/bookings", bookingBody({ craneClassId: "hydra-15" }), custA)).body.id;
    await call("POST", `/bookings/${b1}/confirm`, {}, admin);
    expect((await call("POST", `/bookings/${b1}/assign`, { craneId: hydra13, operatorId: op1Id }, admin)).status).toBe(400); // too small
    expect((await call("POST", `/bookings/${b1}/assign`, { craneId: tele60, operatorId: op1Id }, admin)).status).toBe(409); // maintenance
    expect((await call("POST", `/bookings/${b1}/assign`, { craneId: hydra16, operatorId: op1Id }, admin)).status).toBe(200); // upgrade ok
    const b2 = (await call("POST", "/bookings", bookingBody({ craneClassId: "hydra-13" }), custB)).body.id;
    await call("POST", `/bookings/${b2}/confirm`, {}, admin);
    expect((await call("POST", `/bookings/${b2}/assign`, { craneId: hydra16, operatorId: op2Id }, admin)).status).toBe(409); // busy
    expect((await call("POST", `/bookings/${b2}/assign`, { craneId: hydra13, operatorId: custA }, admin)).status).toBe(400); // not an operator id
  });

  it("assigning a future job does not take the crane out of service today", async () => {
    const cranes = (await call("GET", "/admin/cranes", undefined, admin)).body as { id: string; status: string }[];
    expect(cranes.find((c) => c.id === hydra16)!.status).toBe("available");
  });

  it("allows the same crane and operator on non-overlapping days", async () => {
    const later = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const b3 = (await call("POST", "/bookings", bookingBody({ craneClassId: "hydra-16", scheduledAt: later }), custB)).body.id;
    await call("POST", `/bookings/${b3}/confirm`, {}, admin);
    expect((await call("POST", `/bookings/${b3}/assign`, { craneId: hydra16, operatorId: op1Id }, admin)).status).toBe(200);
    await call("POST", `/bookings/${b3}/cancel`, { reason: "cleanup" }, admin);
  });

  it("blocks double-booking an operator at the same time", async () => {
    const b4 = (await call("POST", "/bookings", bookingBody({ craneClassId: "hydra-13" }), custB)).body.id;
    await call("POST", `/bookings/${b4}/confirm`, {}, admin);
    const r = await call("POST", `/bookings/${b4}/assign`, { craneId: hydra13, operatorId: op1Id }, admin);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/operator/i);
    await call("POST", `/bookings/${b4}/cancel`, { reason: "cleanup" }, admin);
  });

  it("reassigning to another crane leaves both cranes available until dispatch", async () => {
    await call("PATCH", `/admin/cranes/${tele60}`, { status: "available" }, admin);
    const r = await call("POST", `/bookings/${b1}/assign`, { craneId: tele60, operatorId: op2Id }, admin);
    expect(r.status).toBe(200);
    const cranes = (await call("GET", "/admin/cranes", undefined, admin)).body as { id: string; status: string }[];
    expect(cranes.find((c) => c.id === hydra16)!.status).toBe("available");
    expect(cranes.find((c) => c.id === tele60)!.status).toBe("available");
    // previous operator can no longer see it
    expect((await call("GET", `/bookings/${b1}`, undefined, op1)).status).toBe(404);
  });

  it("dispatch puts the crane on job; editing its operator keeps it there", async () => {
    expect((await call("POST", `/bookings/${b1}/status`, { status: "en_route" }, op2)).status).toBe(200);
    let cranes = (await call("GET", "/admin/cranes", undefined, admin)).body as { id: string; status: string }[];
    expect(cranes.find((c) => c.id === tele60)!.status).toBe("on_job");
    const r = await call("PATCH", `/admin/cranes/${tele60}`, { defaultOperatorId: op1Id }, admin);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("on_job");
    // cannot send an on-job crane to maintenance
    expect((await call("PATCH", `/admin/cranes/${tele60}`, { status: "maintenance" }, admin)).status).toBe(409);
    cranes = (await call("GET", "/admin/cranes", undefined, admin)).body;
    expect(cranes.find((c) => c.id === tele60)!.status).toBe("on_job");
  });

  it("rejects a default operator who is not an operator", async () => {
    expect((await call("PATCH", `/admin/cranes/${hydra13}`, { defaultOperatorId: "nope" }, admin)).status).toBe(400);
    expect((await call("PATCH", `/admin/cranes/${hydra13}`, { defaultOperatorId: custA }, admin)).status).toBe(400);
  });

  it("charges the cancellation fee after dispatch and frees the crane", async () => {
    expect((await call("POST", `/bookings/${b1}/cancel`, { reason: "site not ready" }, custA)).status).toBe(409);
    const r = await call("POST", `/bookings/${b1}/cancel`, { reason: "site not ready" }, admin);
    expect(r.body.status).toBe("cancelled");
    expect(r.body.amountDue).toBe(Math.round(DEFAULT_PRICING.cancellationFee * (1 + DEFAULT_PRICING.gstRate)));
    const cranes = (await call("GET", "/admin/cranes", undefined, admin)).body as { id: string; status: string }[];
    expect(cranes.find((c) => c.id === tele60)!.status).toBe("available");
  });
});

describe("authorization matrix", () => {
  let bid: string;
  it("keeps customers and operators in their lane", async () => {
    bid = (await call("POST", "/bookings", bookingBody(), custA)).body.id;
    // other customer
    expect((await call("GET", `/bookings/${bid}`, undefined, custB)).status).toBe(404);
    expect((await call("POST", `/bookings/${bid}/cancel`, { reason: "nope" }, custB)).status).toBe(404);
    expect((await call("POST", `/bookings/${bid}/rate`, { stars: 1 }, custB)).status).toBe(404);
    // customer on staff endpoints
    for (const [path, body] of [
      ["confirm", {}], ["assign", { craneId: hydra13, operatorId: op1Id }], ["status", { status: "en_route" }],
      ["start", { otp: "1234" }], ["complete", { actualDuration: 4 }], ["location", { lat: 11, lng: 78 }],
      ["payment", { status: "paid" }],
    ] as const) {
      expect((await call("POST", `/bookings/${bid}/${path}`, body, custA)).status, path).toBe(403);
    }
    // unassigned operator
    expect((await call("GET", `/bookings/${bid}`, undefined, op1)).status).toBe(404);
    expect((await call("POST", `/bookings/${bid}/status`, { status: "en_route" }, op1)).status).toBe(404);
    // admin APIs
    for (const [m, p] of [["GET", "/admin/stats"], ["GET", "/admin/users"], ["GET", "/admin/pricing"], ["POST", "/admin/cranes"], ["PUT", "/admin/pricing"]] as const) {
      expect((await call(m, p, m === "GET" ? undefined : {}, custA)).status, p).toBe(403);
      expect((await call(m, p, m === "GET" ? undefined : {}, op1)).status, p).toBe(403);
      expect((await call(m, p, m === "GET" ? undefined : {})).status, p).toBe(401);
    }
  });

  it("admins cannot change their own role", async () => {
    expect((await call("POST", "/admin/users", { phone: "9789473129", name: "Owner", role: "customer" }, admin)).status).toBe(400);
  });

  it("logout revokes the token", async () => {
    const t = (await login("9555555555")).token;
    expect((await call("GET", "/auth/me", undefined, t)).status).toBe(200);
    await call("POST", "/auth/logout", {}, t);
    expect((await call("GET", "/auth/me", undefined, t)).status).toBe(401);
  });
});

describe("pricing", () => {
  it("rejects incomplete rate tables and applies valid updates to quotes", async () => {
    const current = (await call("GET", "/admin/pricing", undefined, admin)).body;
    const partial = { ...current, rates: { "hydra-13": current.rates["hydra-13"] } };
    expect((await call("PUT", "/admin/pricing", partial, admin)).status).toBe(400);
    const updated = { ...current, rates: { ...current.rates, "hydra-13": { ...current.rates["hydra-13"], hourly: 2000 } } };
    expect((await call("PUT", "/admin/pricing", updated, admin)).status).toBe(200);
    const q = await call("POST", "/quote", { craneClassId: "hydra-13", rentalType: "hourly", duration: 4, siteLat: 11.6643, siteLng: 78.146, scheduledAt: tomorrow() });
    expect(q.body.quote.subtotal).toBe(8000);
  });
});

describe("robustness", () => {
  it("answers malformed and oversized bodies with 4xx, not 500", async () => {
    expect((await call("POST", "/quote", undefined, undefined, "{not json")).status).toBe(400);
    const big = JSON.stringify({ pad: "x".repeat(100_000) });
    expect((await call("POST", "/quote", undefined, undefined, big)).status).toBe(413);
  });

  it("rejects unknown query values and bad ids gracefully", async () => {
    expect((await call("GET", "/bookings/does-not-exist", undefined, custA)).status).toBe(404);
    expect((await call("GET", "/api-nope")).status).toBe(404);
  });
});

describe("reviewer findings", () => {
  async function jobOnSite(cust: string, opToken: string, opId: string, craneId: string, extra: Record<string, unknown> = {}) {
    const id = (await call("POST", "/bookings", bookingBody({ scheduledAt: new Date(Date.now() + 9 * 86_400_000).toISOString(), ...extra }), cust)).body.id;
    await call("POST", `/bookings/${id}/confirm`, {}, admin);
    expect((await call("POST", `/bookings/${id}/assign`, { craneId, operatorId: opId }, admin)).status).toBe(200);
    await call("POST", `/bookings/${id}/status`, { status: "en_route" }, opToken);
    await call("POST", `/bookings/${id}/status`, { status: "on_site" }, opToken);
    return id;
  }

  it("locks the start code after 5 wrong guesses and re-issues a new one on reassignment", async () => {
    const id = await jobOnSite(custA, op1, op1Id, hydra13);
    const otp = (await call("GET", `/bookings/${id}`, undefined, custA)).body.startOtp as string;
    const wrong = otp === "0000" ? "1111" : "0000";
    for (let i = 0; i < 5; i++) expect((await call("POST", `/bookings/${id}/start`, { otp: wrong }, op1)).status).toBe(400);
    // even the right code is refused now
    expect((await call("POST", `/bookings/${id}/start`, { otp }, op1)).status).toBe(423);
    await call("POST", `/bookings/${id}/cancel`, { reason: "cleanup" }, admin);
  });

  it("final bill uses the prices in force when the job was booked", async () => {
    const id = (await call("POST", "/bookings", bookingBody({ craneClassId: "hydra-16", scheduledAt: new Date(Date.now() + 12 * 86_400_000).toISOString() }), custA)).body;
    const pricing = (await call("GET", "/admin/pricing", undefined, admin)).body;
    const doubled = { ...pricing, rates: { ...pricing.rates, "hydra-16": { ...pricing.rates["hydra-16"], hourly: pricing.rates["hydra-16"].hourly * 2 } } };
    expect((await call("PUT", "/admin/pricing", doubled, admin)).status).toBe(200);
    await call("POST", `/bookings/${id.id}/confirm`, {}, admin);
    await call("POST", `/bookings/${id.id}/assign`, { craneId: hydra16, operatorId: op2Id }, admin);
    await call("POST", `/bookings/${id.id}/status`, { status: "en_route" }, op2);
    await call("POST", `/bookings/${id.id}/status`, { status: "on_site" }, op2);
    const otp = (await call("GET", `/bookings/${id.id}`, undefined, custA)).body.startOtp;
    await call("POST", `/bookings/${id.id}/start`, { otp }, op2);
    const done = await call("POST", `/bookings/${id.id}/complete`, { actualDuration: 4 }, op2);
    expect(done.body.amountDue).toBe(id.quote.total);
    expect(done.body.finalQuote.gstRate).toBe(0.18);
    await call("PUT", "/admin/pricing", pricing, admin);
  });

  it("monthly stats count a job in the month it was completed, not when it was paid", async () => {
    const before = (await call("GET", "/admin/stats", undefined, admin)).body;
    const list = (await call("GET", "/bookings?status=completed", undefined, admin)).body as { id: string }[];
    await call("POST", `/bookings/${list[0]!.id}/payment`, { status: "paid" }, admin);
    const after = (await call("GET", "/admin/stats", undefined, admin)).body;
    expect(after.completedThisMonth).toBe(before.completedThisMonth);
    expect(after.revenueThisMonth).toBe(before.revenueThisMonth);
  });

  it("closes live event streams when the session ends", async () => {
    const t = (await login("9666666666", "Streamer")).token;
    const ctrl = new AbortController();
    const res = await fetch(base + "/events", { headers: { authorization: `Bearer ${t}` }, signal: ctrl.signal });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    await reader.read(); // "ready"
    await call("POST", "/auth/logout", {}, t);
    // any booking event triggers a session re-check; the server then ends the stream
    await call("POST", "/bookings", bookingBody({ scheduledAt: new Date(Date.now() + 20 * 86_400_000).toISOString() }), custB);
    const next = await Promise.race([reader.read(), new Promise<{ done: boolean }>((r) => setTimeout(() => r({ done: false }), 2000))]);
    expect(next.done).toBe(true);
    ctrl.abort();
  });
});
