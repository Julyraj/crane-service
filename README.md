# CraneGo — crane booking for Sri Venkateswara Crane Service

On-demand and scheduled crane booking, modelled on Uber / Ola / Rapido / Porter, adapted to
crane hire: capacity recommendation, upfront line-item quotes, job-start OTP, live crane
tracking, dispatch and GST invoices.

One codebase runs on **web**, **mobile** (installable PWA + Capacitor Android/iOS) and
**desktop** (Electron for Windows/macOS/Linux).

| Role | What they do |
| --- | --- |
| **Customer** | Describe the lift → get a crane suggestion → pin the site on a map → see the upfront fare → book → track the crane live → share a 4-digit start OTP → rate → pay by UPI → download a GST invoice |
| **Operator** (crane driver) | See assigned jobs → navigate → share live GPS → mark arrived → start the job with the customer's OTP → enter actual hours → complete |
| **Admin / dispatcher** | Dashboard KPIs → confirm (optionally with a negotiated price) → assign crane + operator → track → mark payments → manage fleet, team and pricing |

Market research behind the feature set: [`docs/MARKET-ANALYSIS.md`](docs/MARKET-ANALYSIS.md).

## Quick start

Requires Node 22.13+ and pnpm 10.

```bash
pnpm install
cp .env.example .env          # set ADMIN_PHONES to the owner's mobile
pnpm seed:demo                # optional: demo fleet + 3 operators
pnpm dev                      # API on :4100, web UI on http://localhost:5173
```

In development the OTP is shown on the login screen (`DEV_OTP=true`). Sign in with the
`ADMIN_PHONES` number to get the admin dashboard. Demo operators are `9000000001`–`9000000003`.

Production-style run (one process serves the API and the built UI):

```bash
pnpm build
pnpm start                    # http://localhost:4100
```

## Repository map

Layout follows the [Paperclip](https://github.com/paperclipai/paperclip) monorepo conventions
(`server/` + `ui/` + `packages/shared`, shared validators and types, server serves the built UI).

```
packages/shared   Domain logic shared by server and UI: crane catalog, capacity recommender,
                  quote engine, booking state machine, zod validators, types
server            Express 5 REST API + SSE realtime, SQLite (node:sqlite), phone-OTP auth
ui                React 19 + Vite web app (customer, operator, admin) + PWA
apps/desktop      Electron shell
apps/mobile       Capacitor Android/iOS shell (Android project included)
docs              Market analysis, architecture, deployment
index.html, css/  The original static website (left unchanged)
```

## Commands

| Command | |
| --- | --- |
| `pnpm dev` | API (watch) + Vite dev server |
| `pnpm test` | Unit tests (pricing, recommender, state machine) + API integration tests |
| `pnpm typecheck` | TypeScript across all packages |
| `pnpm build` | Bundle server (`server/dist`) and UI (`ui/dist`) |
| `pnpm start` | Run the built server |
| `pnpm seed:demo` | Demo fleet and operators |

Desktop and mobile build steps: [`apps/desktop/README.md`](apps/desktop/README.md),
[`apps/mobile/README.md`](apps/mobile/README.md).
Deployment and production checklist: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
How it works: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Before going live

- Replace the **sample rates** in Admin → Pricing with your real tariffs.
- Set `BUSINESS_GSTIN`, `BUSINESS_UPI_ID`, and have your accountant confirm `BUSINESS_SAC` and the GST split.
- Configure a real SMS provider (`SMS_PROVIDER=msg91`); in production the console provider never reveals OTPs.
- Add your real cranes (registration numbers) in Admin → Fleet and your operators in Admin → Team.
