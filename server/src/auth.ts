import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Role, User } from "@crane/shared";
import type { AppConfig } from "./config.ts";
import { nowIso, type Db } from "./db.ts";
import { badRequest, forbidden, tooMany, unauthorized } from "./errors.ts";
import { RateLimiter } from "./rate-limit.ts";
import type { SmsSender } from "./sms.ts";

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 30 * 24 * 3_600_000;

export interface UserRow {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  company: string | null;
  gstin: string | null;
  created_at: string;
}

export const toUser = (r: UserRow): User => ({
  id: r.id,
  phone: r.phone,
  name: r.name,
  role: r.role,
  company: r.company,
  gstin: r.gstin,
  createdAt: r.created_at,
});

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function createAuth(db: Db, config: AppConfig, sms: SmsSender) {
  const perPhoneBurst = new RateLimiter(1, 30_000);
  const perPhoneHour = new RateLimiter(5, 3_600_000);
  const perIpHour = new RateLimiter(30, 3_600_000);
  const verifyPerIp = new RateLimiter(30, 15 * 60_000);

  const otpHash = (phone: string, code: string) =>
    crypto.createHmac("sha256", config.otpSecret).update(`${phone}:${code}`).digest("hex");

  async function requestOtp(phone: string, ip: string): Promise<{ devOtp?: string }> {
    perIpHour.check(`ip:${ip}`);
    perPhoneBurst.check(`p:${phone}`, "Please wait 30 seconds before requesting another OTP");
    perPhoneHour.check(`ph:${phone}`);
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    db.prepare(
      `INSERT INTO otp_codes (phone, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)
       ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`,
    ).run(phone, otpHash(phone, code), Date.now() + OTP_TTL_MS);
    await sms.sendOtp(phone, code);
    return config.devOtp ? { devOtp: code } : {};
  }

  function verifyOtp(phone: string, code: string, ip: string, name?: string): { token: string; user: User } {
    verifyPerIp.check(`v:${ip}`);
    const row = db.prepare("SELECT code_hash, expires_at, attempts FROM otp_codes WHERE phone = ?").get(phone) as
      | { code_hash: string; expires_at: number; attempts: number }
      | undefined;
    if (!row || row.expires_at < Date.now()) throw badRequest("OTP expired. Request a new one.");
    if (row.attempts >= OTP_MAX_ATTEMPTS) throw tooMany("Too many wrong attempts. Request a new OTP.");
    const expected = Buffer.from(row.code_hash, "hex");
    const actual = Buffer.from(otpHash(phone, code), "hex");
    if (!crypto.timingSafeEqual(expected, actual)) {
      db.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?").run(phone);
      throw badRequest("Incorrect OTP");
    }
    db.prepare("DELETE FROM otp_codes WHERE phone = ?").run(phone);

    let user = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone) as UserRow | undefined;
    if (!user) {
      const role: Role = config.adminPhones.includes(phone) ? "admin" : "customer";
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO users (id, phone, name, role, created_at) VALUES (?, ?, ?, ?, ?)").run(
        id,
        phone,
        name ?? null,
        role,
        nowIso(),
      );
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as UserRow;
    } else if (!user.name && name) {
      db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, user.id);
      user.name = name;
    }

    const token = crypto.randomBytes(32).toString("base64url");
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(
      sha256(token),
      user.id,
      Date.now() + SESSION_TTL_MS,
      nowIso(),
    );
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
    return { token, user: toUser(user) };
  }

  function userFromToken(token: string): User | undefined {
    const row = db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(sha256(token), Date.now()) as UserRow | undefined;
    return row ? toUser(row) : undefined;
  }

  function logout(token: string) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  }

  /** Attaches req.user when a valid bearer token is present. */
  function attachUser(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      const user = userFromToken(header.slice(7).trim());
      if (user) req.user = user;
    }
    next();
  }

  return { requestOtp, verifyOtp, userFromToken, logout, attachUser };
}

export function requireUser(req: Request): User {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function requireRole(req: Request, ...roles: Role[]): User {
  const user = requireUser(req);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  return h?.startsWith("Bearer ") ? h.slice(7).trim() : null;
}
