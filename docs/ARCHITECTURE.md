# Architecture

## Overview

```
 Customer / Operator / Admin
   │  web (React)   PWA   Capacitor app   Electron app
   ▼
 Express 5 server ── /api/*  REST (JSON, zod-validated, bearer token)
   │                 /api/events  server-sent events (booking + location updates)
   │                 /*  serves ui/dist (SPA)
   ▼
 SQLite (node:sqlite, WAL)  ── users, otp_codes, sessions, cranes, bookings, booking_events, settings
```

`packages/shared` holds every rule that both sides need, so the UI's live quote and the
server's stored quote use the same code: `computeQuote`, `recommendCrane`, `canTransition`,
and the zod schemas used to validate API input.

## Booking lifecycle

```
requested ──admin──▶ confirmed ──admin──▶ assigned ──operator──▶ en_route ──operator──▶ on_site
    │                    │                   │  ▲ admin reassign                          │
    └──customer/admin────┴───────────────────┴──▶ cancelled ◀── admin (fee if dispatched) │
                                                                                           ▼
                                completed ◀──operator/admin── in_progress ◀── operator + start OTP
```

- Transitions and the roles allowed to make them live in `packages/shared/src/booking-status.ts`.
- On **assign** the server creates a 4-digit start OTP. Only the customer and admins can see it;
  the operator must get it from the site contact to move `on_site → in_progress`.
- On **complete** the final bill is recomputed from actual duration (minimum hours still apply).
  If the admin agreed a negotiated price at confirmation, that price stands and only overtime
  beyond the quoted duration is added.
- Cancelling after dispatch charges the configured cancellation fee plus GST.
- Every change writes a `booking_events` row (timeline) and is pushed over SSE to the customer,
  the assigned operator and all admins, each receiving a payload redacted for their role.

## Pricing (`packages/shared/src/pricing.ts`)

| Line | Rule |
| --- | --- |
| Rental | hourly: `max(hours, minHours) × rate`; daily: `days × rate` (8-hour shift); monthly: `months × rate` |
| Mobilisation | `(km − freeKm) × 2 × perKm`; km = straight-line yard→site × 1.3 road factor |
| Night | +15% of rental if an hourly job starts 22:00–06:00 IST |
| Instant | +10% of rental if the crane is needed within 2 hours |
| Operator bata | per day for daily (days) and monthly (26 days/month) rentals |
| GST | 18% on the subtotal |

All values are editable in Admin → Pricing (stored in `settings`).

## Capacity recommender

`capacityAtRadius = rated × ratedRadius / max(radius, ratedRadius)`; a crane qualifies when
75% of that figure covers the load and its height/radius limits cover the lift. The smallest
qualifying crane is suggested. This is deliberately conservative and is labelled as planning
guidance; the operator confirms against the manufacturer's load chart.

## API

| Method & path | Who | Purpose |
| --- | --- | --- |
| `POST /api/auth/otp/request` | public | Send OTP (rate limited per phone and IP) |
| `POST /api/auth/otp/verify` | public | Verify OTP → bearer token (30-day session) |
| `GET /api/auth/me`, `POST /api/auth/logout`, `PATCH /api/me` | user | Session and profile |
| `GET /api/catalog` | public | Business info, crane classes, live rates, availability |
| `POST /api/quote`, `POST /api/recommend` | public | Upfront fare, crane suggestion |
| `POST /api/bookings`, `GET /api/bookings`, `GET /api/bookings/:id` | user | Create / list / view (scoped by role) |
| `POST /api/bookings/:id/cancel` | customer, admin | Cancel |
| `POST /api/bookings/:id/confirm`, `/assign`, `/payment` | admin | Dispatch and payments |
| `POST /api/bookings/:id/status`, `/start`, `/complete`, `/location` | operator | Job execution |
| `POST /api/bookings/:id/rate` | customer, operator | Two-way rating |
| `GET /api/events` | user | SSE stream (fetch with `Authorization` header) |
| `GET/POST/PATCH/DELETE /api/admin/cranes` | admin | Fleet |
| `GET/POST /api/admin/users` | admin | Team, roles |
| `GET/PUT /api/admin/pricing`, `GET /api/admin/stats` | admin | Pricing and KPIs |

## Security

- Phone-OTP login: 6-digit codes stored as HMAC, 5-minute expiry, 5 attempts, per-phone and per-IP rate limits, constant-time comparison.
- Sessions: random 256-bit bearer tokens, stored as SHA-256 hashes, 30-day expiry. No cookies, so no CSRF surface; CORS is an explicit allowlist.
- Authorization is checked server-side on every route; customers and operators only see their own bookings (other bookings return 404).
- The start OTP is never sent to the operator.
- Strict CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS in production, 64 KB JSON limit, zod validation on all input.
- Production refuses to start with `DEV_OTP=true` or without `OTP_SECRET`.
- Known limitations: rate limits are in-memory (single node), and the UI stores the token in `localStorage`.

## How Paperclip was used

[Paperclip](https://github.com/paperclipai/paperclip) (MIT) is an orchestration platform for
AI-agent companies, not a booking engine, so CraneGo does not fork its code. It reuses
Paperclip's structure and conventions:

| Paperclip | CraneGo |
| --- | --- |
| pnpm monorepo: `server/`, `ui/`, `packages/shared` | same layout |
| `packages/shared`: types, validators, constants used by server and UI | crane catalog, pricing, state machine, zod schemas |
| Express REST API + React/Vite board UI | Express 5 API + React 19/Vite app |
| Server serves the built UI in production | `server` serves `ui/dist` |
| `AGENTS.md` contributor guide, docs-first specs | `AGENTS.md`, `docs/` |

Optional next step: run a Paperclip "company" next to CraneGo and give its agents the CraneGo
admin API for back-office work, such as chasing unpaid invoices or reporting on weekly fleet use.
