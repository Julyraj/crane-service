# AGENTS.md

Guidance for human and AI contributors.

## Purpose

CraneGo is the booking platform for Sri Venkateswara Crane Service (Salem, Tamil Nadu):
customers book cranes, operators run jobs, admins dispatch. Read `README.md`, then
`docs/ARCHITECTURE.md`. Product reasoning is in `docs/MARKET-ANALYSIS.md`.

## Repo map

- `packages/shared/` — domain rules shared by server and UI. Change pricing, statuses or validation **here only**.
- `server/` — Express API (`src/app.ts` routes, `src/services/*` logic, `src/db.ts` migrations).
- `ui/` — React app (`src/pages/*`, `src/components/*`).
- `apps/desktop`, `apps/mobile` — native shells, installed separately from the pnpm workspace.

## Rules

1. Validate all API input with a zod schema from `@crane/shared`.
2. Check authorization in the service layer; never trust the client role.
3. Booking status changes go through `canTransition` and write a `booking_events` row.
4. Database changes: append a new entry to `MIGRATIONS` in `server/src/db.ts`; never edit a shipped migration.
5. Money is whole rupees, and GST is computed once in `computeQuote`.
6. Never expose the job start OTP to operators.

## Before you push

```bash
pnpm typecheck && pnpm test && pnpm build
```
