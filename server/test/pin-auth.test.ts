import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";
import { openDb } from "../src/db.ts";
import { createApp } from "../src/app.ts";

let server: Server;
let base: string;
let adminToken: string;
const ADMIN = "9789473129";

beforeAll(async () => {
  // Production-like PIN mode: no SMS gateway, no dev OTP.
  const config = loadConfig({
    NODE_ENV: "production",
    OTP_SECRET: "test-secret",
    ADMIN_PHONES: ADMIN,
    ADMIN_PIN: "246810",
    UI_DIST: "/nonexistent",
  });
  expect(config.authMode).toBe("pin");
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

describe("PIN mode", () => {
  it("refuses to boot in production without ADMIN_PIN", () => {
    expect(() => loadConfig({ NODE_ENV: "production", OTP_SECRET: "x" })).toThrow(/ADMIN_PIN/);
  });

  it("reports mode and disables SMS OTP", async () => {
    expect((await call("GET", "/auth/config")).body.mode).toBe("pin");
    expect((await call("POST", "/auth/otp/request", { phone: "9876543210" })).status).toBe(400);
  });

  it("admin first sign-in requires the setup PIN", async () => {
    expect((await call("POST", "/auth/pin/status", { phone: ADMIN })).body.state).toBe("admin_setup");
    expect((await call("POST", "/auth/pin/login", { phone: ADMIN, pin: "111111" })).status).toBe(400);
    const ok = await call("POST", "/auth/pin/login", { phone: ADMIN, pin: "246810", name: "Owner" });
    expect(ok.status).toBe(200);
    adminToken = ok.body.token;
    expect(ok.body.user.role).toBe("admin");
    expect((await call("POST", "/auth/pin/status", { phone: ADMIN })).body.state).toBe("login");
  });

  it("customers self-register with a PIN and sign in again", async () => {
    expect((await call("POST", "/auth/pin/status", { phone: "9876543210" })).body.state).toBe("register");
    const reg = await call("POST", "/auth/pin/login", { phone: "9876543210", pin: "135790", name: "Kumar" });
    expect(reg.body.user.role).toBe("customer");
    expect((await call("POST", "/auth/pin/login", { phone: "9876543210", pin: "000000" })).status).toBe(400);
    const again = await call("POST", "/auth/pin/login", { phone: "9876543210", pin: "135790" });
    expect(again.status).toBe(200);
    // change PIN
    expect((await call("POST", "/me/pin", { currentPin: "999999", newPin: "112233" }, again.body.token)).status).toBe(400);
    expect((await call("POST", "/me/pin", { currentPin: "135790", newPin: "112233" }, again.body.token)).status).toBe(200);
    expect((await call("POST", "/auth/pin/login", { phone: "9876543210", pin: "112233" })).status).toBe(200);
  });

  it("existing accounts without a PIN cannot be claimed by a stranger", async () => {
    const admin = adminToken;
    await call("POST", "/admin/users", { phone: "9444444444", name: "Real Customer", role: "customer" }, admin);
    expect((await call("POST", "/auth/pin/status", { phone: "9444444444" })).body.state).toBe("needs_admin");
    expect((await call("POST", "/auth/pin/login", { phone: "9444444444", pin: "222222" })).status).toBe(403);
  });

  it("ADMIN_PIN always recovers the admin account", async () => {
    // admin changes their own PIN, then forgets it
    const t = (await call("POST", "/auth/pin/login", { phone: ADMIN, pin: "246810" })).body.token;
    expect((await call("POST", "/me/pin", { currentPin: "246810", newPin: "987654" }, t)).status).toBe(200);
    expect((await call("POST", "/auth/pin/login", { phone: ADMIN, pin: "246810" })).status).toBe(200);
  });

  it("operators need a PIN set by the admin", async () => {
    const admin = adminToken;
    await call("POST", "/admin/users", { phone: "9000000001", name: "Murugan", role: "operator" }, admin);
    expect((await call("POST", "/auth/pin/status", { phone: "9000000001" })).body.state).toBe("needs_admin");
    expect((await call("POST", "/auth/pin/login", { phone: "9000000001", pin: "123456" })).status).toBe(403);
    await call("POST", "/admin/users", { phone: "9000000001", name: "Murugan", role: "operator", pin: "654321" }, admin);
    const op = await call("POST", "/auth/pin/login", { phone: "9000000001", pin: "654321" });
    expect(op.body.user.role).toBe("operator");
  });

  it("rate limits PIN guessing per phone", async () => {
    await call("POST", "/auth/pin/login", { phone: "9333333333", pin: "121212" });
    const results: number[] = [];
    for (let i = 0; i < 6; i++) results.push((await call("POST", "/auth/pin/login", { phone: "9333333333", pin: "000001" })).status);
    expect(results.slice(0, 4)).toEqual([400, 400, 400, 400]);
    expect(results.at(-1)).toBe(429);
  });
});
