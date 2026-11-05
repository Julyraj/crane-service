import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import { z, ZodError } from "zod";
import {
  assignBookingSchema,
  cancelBookingSchema,
  completeJobSchema,
  confirmBookingSchema,
  craneUpsertSchema,
  craneUpdateSchema,
  createBookingSchema,
  CRANE_CLASSES,
  locationSchema,
  operatorStatusSchema,
  paymentSchema,
  pricingConfigSchema,
  quoteRequestSchema,
  rateSchema,
  recommendCrane,
  recommendSchema,
  requestOtpSchema,
  startJobSchema,
  updateProfileSchema,
  upsertUserSchema,
  verifyOtpSchema,
  pinStatusSchema,
  pinLoginSchema,
  changePinSchema,
  type CatalogResponse,
} from "@crane/shared";
import type { AppConfig } from "./config.ts";
import type { Db } from "./db.ts";
import { HttpError } from "./errors.ts";
import { bearerToken, createAuth, hashPin, requireRole, requireUser, toUser, type UserRow } from "./auth.ts";
import { createSmsSender, type SmsSender } from "./sms.ts";
import { RealtimeHub } from "./realtime.ts";
import { createBookingService } from "./services/bookings.ts";
import { createAdminService } from "./services/admin.ts";
import { getPricing, setPricing } from "./services/settings.ts";
import { RateLimiter } from "./rate-limit.ts";

export interface AppDeps {
  db: Db;
  config: AppConfig;
  sms?: SmsSender;
}

const param = (req: Request, name: string) => String(req.params[name]);

export function createApp({ db, config, sms }: AppDeps) {
  const app = express();
  const auth = createAuth(db, config, sms ?? createSmsSender(config));
  const hub = new RealtimeHub((token) => auth.userFromToken(token));
  const bookings = createBookingService(db, config, hub);
  const admin = createAdminService(db);
  const quoteLimiter = new RateLimiter(120, 60_000);

  app.disable("x-powered-by");
  app.set("trust proxy", "loopback, linklocal, uniquelocal");

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "geolocation=(self), camera=(), microphone=()");
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "img-src 'self' data: https://*.tile.openstreetmap.org",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
    if (config.production) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });

  // CORS for the Capacitor / Electron shells. Auth is bearer-token only (no cookies).
  app.use("/api", (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.corsOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") return void res.status(204).end();
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.use(express.json({ limit: "64kb" }));
  app.use(auth.attachUser);

  const api = express.Router();

  api.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  // ---------- Auth ----------
  api.get("/auth/config", (_req, res) => res.json({ mode: config.authMode }));

  api.post("/auth/pin/status", (req, res) => {
    const { phone } = pinStatusSchema.parse(req.body);
    res.json(auth.pinStatus(phone, req.ip ?? "unknown"));
  });

  api.post("/auth/pin/login", (req, res) => {
    const { phone, pin, name } = pinLoginSchema.parse(req.body);
    res.json(auth.pinLogin(phone, pin, req.ip ?? "unknown", name));
  });

  api.post("/me/pin", (req, res) => {
    const user = requireUser(req);
    const { newPin, currentPin } = changePinSchema.parse(req.body);
    auth.changePin(user.id, newPin, currentPin);
    res.json({ ok: true });
  });

  api.post("/auth/otp/request", async (req, res) => {
    const { phone } = requestOtpSchema.parse(req.body);
    const result = await auth.requestOtp(phone, req.ip ?? "unknown");
    res.json({ ok: true, expiresInSeconds: 300, ...result });
  });

  api.post("/auth/otp/verify", (req, res) => {
    const { phone, code, name } = verifyOtpSchema.parse(req.body);
    res.json(auth.verifyOtp(phone, code, req.ip ?? "unknown", name));
  });

  api.get("/auth/me", (req, res) => res.json({ user: requireUser(req) }));

  api.post("/auth/logout", (req, res) => {
    const token = bearerToken(req);
    if (token) auth.logout(token);
    res.json({ ok: true });
  });

  api.patch("/me", (req, res) => {
    const user = requireUser(req);
    const input = updateProfileSchema.parse(req.body);
    db.prepare("UPDATE users SET name = COALESCE(?, name), company = COALESCE(?, company), gstin = COALESCE(?, gstin) WHERE id = ?").run(
      input.name ?? null,
      input.company ?? null,
      input.gstin ?? null,
      user.id,
    );
    res.json({ user: toUser(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as unknown as UserRow) });
  });

  // ---------- Public catalog / quote ----------
  api.get("/catalog", (_req, res) => {
    const pricing = getPricing(db);
    const units = admin.availableUnits();
    const { rates, ...rest } = pricing;
    const body: CatalogResponse = {
      business: config.business,
      classes: CRANE_CLASSES.map((c) => ({ ...c, rates: rates[c.id]!, availableUnits: units[c.id] ?? 0 })),
      pricing: rest,
    };
    res.json(body);
  });

  api.post("/quote", (req, res) => {
    quoteLimiter.check(req.ip ?? "unknown");
    res.json(bookings.quote(quoteRequestSchema.parse(req.body)));
  });

  api.post("/recommend", (req, res) => {
    res.json(recommendCrane(recommendSchema.parse(req.body)));
  });

  // ---------- Bookings ----------
  api.post("/bookings", (req, res) => {
    const user = requireUser(req);
    res.status(201).json(bookings.create(user, createBookingSchema.parse(req.body)));
  });

  api.get("/bookings", (req, res) => {
    const user = requireUser(req);
    const q = z.object({ status: z.string().max(20).optional(), scope: z.enum(["mine", "all"]).optional() }).parse(req.query);
    res.json(bookings.list(user, q));
  });

  api.get("/bookings/:id", (req, res) => res.json(bookings.get(param(req, "id"), requireUser(req))));

  api.post("/bookings/:id/cancel", (req, res) => {
    const { reason } = cancelBookingSchema.parse(req.body);
    res.json(bookings.cancel(param(req, "id"), requireUser(req), reason));
  });

  api.post("/bookings/:id/confirm", (req, res) => {
    const user = requireRole(req, "admin");
    res.json(bookings.confirm(param(req, "id"), user, confirmBookingSchema.parse(req.body ?? {})));
  });

  api.post("/bookings/:id/assign", (req, res) => {
    const user = requireRole(req, "admin");
    res.json(bookings.assign(param(req, "id"), user, assignBookingSchema.parse(req.body)));
  });

  api.post("/bookings/:id/status", (req, res) => {
    const user = requireRole(req, "operator", "admin");
    res.json(bookings.operatorStatus(param(req, "id"), user, operatorStatusSchema.parse(req.body).status));
  });

  api.post("/bookings/:id/start", (req, res) => {
    const user = requireRole(req, "operator");
    res.json(bookings.start(param(req, "id"), user, startJobSchema.parse(req.body).otp));
  });

  api.post("/bookings/:id/complete", (req, res) => {
    const user = requireRole(req, "operator", "admin");
    res.json(bookings.complete(param(req, "id"), user, completeJobSchema.parse(req.body)));
  });

  api.post("/bookings/:id/location", (req, res) => {
    const user = requireRole(req, "operator");
    res.json(bookings.location(param(req, "id"), user, locationSchema.parse(req.body)));
  });

  api.post("/bookings/:id/rate", (req, res) => {
    res.json(bookings.rate(param(req, "id"), requireUser(req), rateSchema.parse(req.body)));
  });

  api.post("/bookings/:id/payment", (req, res) => {
    const user = requireRole(req, "admin");
    res.json(bookings.payment(param(req, "id"), user, paymentSchema.parse(req.body)));
  });

  // ---------- Realtime (SSE over fetch; bearer auth header) ----------
  api.get("/events", (req, res) => {
    const user = requireUser(req);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`event: ready\ndata: {}\n\n`);
    hub.add(bearerToken(req)!, user, res);
  });

  // ---------- Admin ----------
  api.get("/admin/stats", (req, res) => {
    requireRole(req, "admin");
    res.json(admin.stats());
  });

  api.get("/admin/cranes", (req, res) => {
    requireRole(req, "admin", "operator");
    res.json(admin.listCranes());
  });

  api.post("/admin/cranes", (req, res) => {
    requireRole(req, "admin");
    res.status(201).json(admin.createCrane(craneUpsertSchema.parse(req.body)));
  });

  api.patch("/admin/cranes/:id", (req, res) => {
    requireRole(req, "admin");
    res.json(admin.updateCrane(param(req, "id"), craneUpdateSchema.parse(req.body)));
  });

  api.delete("/admin/cranes/:id", (req, res) => {
    requireRole(req, "admin");
    admin.deleteCrane(param(req, "id"));
    res.status(204).end();
  });

  api.get("/admin/users", (req, res) => {
    requireRole(req, "admin");
    const role = z.enum(["customer", "operator", "admin"]).optional().parse(req.query.role);
    res.json(admin.listUsers(role));
  });

  api.post("/admin/users", (req, res) => {
    const actor = requireRole(req, "admin");
    const input = upsertUserSchema.parse(req.body);
    const user = admin.upsertUser(actor, input);
    if (input.pin) {
      db.prepare("UPDATE users SET pin_hash = ?, pin_failures = 0, pin_locked_until = NULL WHERE id = ?").run(hashPin(input.pin), user.id);
    }
    res.json(user);
  });

  api.get("/admin/pricing", (req, res) => {
    requireRole(req, "admin");
    res.json(getPricing(db));
  });

  api.put("/admin/pricing", (req, res) => {
    requireRole(req, "admin");
    const pricing = pricingConfigSchema.parse(req.body);
    setPricing(db, { ...getPricing(db), ...pricing, rates: { ...getPricing(db).rates, ...pricing.rates } });
    res.json(getPricing(db));
  });

  api.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use("/api", api);

  // ---------- Web UI (SPA) ----------
  const here = path.dirname(fileURLToPath(import.meta.url));
  const uiDist = config.uiDist ?? path.resolve(here, "../../ui/dist");
  if (fs.existsSync(path.join(uiDist, "index.html"))) {
    app.use(
      express.static(uiDist, {
        index: false,
        setHeaders(res, file) {
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        },
      }),
    );
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(uiDist, "index.html")));
  }

  // ---------- Errors ----------
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return void res.status(400).json({
        error: err.issues[0]?.message ?? "Invalid request",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message, details: err.details });
    if (err && typeof err === "object" && "type" in err && (err as { type: string }).type === "entity.parse.failed") {
      return void res.status(400).json({ error: "Malformed JSON" });
    }
    const status = (err as { status?: unknown } | null)?.status;
    if (typeof status === "number" && status >= 400 && status < 500) {
      // body-parser / express client errors (e.g. 413 payload too large)
      return void res.status(status).json({ error: status === 413 ? "Request too large" : "Bad request" });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  });

  const heartbeat = setInterval(() => hub.heartbeat(), 25_000);
  heartbeat.unref();

  return { app, hub, bookings, admin };
}
