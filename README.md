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

## Go live in one click

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Julyraj/crane-service)

1. Click the button and sign in to Render with your GitHub account.
2. When asked, type a 6-digit **ADMIN_PIN** (your first admin sign-in code). Optionally add your UPI ID and GSTIN.
3. Add a payment card (the Starter instance + 1 GB disk keeps your data safe) and click **Apply**.
4. After about 5 minutes, open the `https://cranego-….onrender.com` link, sign in with **9789473129** and your ADMIN_PIN.
5. In the app: set your real prices (Pricing), add cranes (Fleet), and add operators with their PINs (Team).

No SMS account is needed: customers create an account with their mobile number and a 6-digit PIN.
SMS OTP login can be switched on later (see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)).

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
- Sign-in uses mobile + 6-digit PIN by default (no SMS gateway needed). To use SMS OTP instead, set `AUTH_MODE=otp` and configure `SMS_PROVIDER=msg91` after DLT registration.
- Add your real cranes (registration numbers) in Admin → Fleet and your operators in Admin → Team.
