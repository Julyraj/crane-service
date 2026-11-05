# Deployment

## Sign-in modes

| `AUTH_MODE` | How people sign in | Needs |
| --- | --- | --- |
| `pin` (default in production) | Mobile number + 6-digit PIN. Customers create their own account; admins set operators' PINs in Team; the first admin uses `ADMIN_PIN`. | `ADMIN_PIN` |
| `otp` | Mobile number + SMS code | `SMS_PROVIDER=msg91`, MSG91 keys, DLT-registered template |

PIN mode trade-off: it does not prove the customer owns the phone number. Dispatch confirms each
booking by phone before sending a crane, and an admin can reset any PIN from Team. PINs are
stored as scrypt hashes, guessing is rate limited, and accounts lock after 10 wrong PINs.

## Render (one click)

`render.yaml` describes the service: Singapore region, Starter instance, 1 GB disk at `/var/data`,
health check, and generated `OTP_SECRET`. Use the button in the README, enter `ADMIN_PIN`, and apply.
Every push to the default branch redeploys automatically.

## Single server (simplest)

Any VPS with Node 22.13+ (e.g. 1 vCPU / 1 GB):

```bash
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production OTP_SECRET=$(openssl rand -hex 32) DATA_DIR=/var/lib/cranego \
  ADMIN_PHONES=9789473129 ADMIN_PIN=246810 pnpm start
```

Put it behind a TLS reverse proxy (Caddy, nginx). For server-sent events, turn off proxy
buffering for `/api/events` (the server sends `X-Accel-Buffering: no` for nginx).

## Docker

```bash
docker build -t cranego .
docker run -d -p 4100:4100 -v cranego-data:/data \
  -e OTP_SECRET=... -e ADMIN_PHONES=9789473129 -e ADMIN_PIN=... cranego
```

## Environment

See [`.env.example`](../.env.example). Required in production: `OTP_SECRET`, `ADMIN_PHONES`,
and `ADMIN_PIN` (PIN mode) or an SMS provider (OTP mode). Recommended: `BUSINESS_GSTIN`, `BUSINESS_UPI_ID`, `BUSINESS_SAC`, `YARD_LAT/LNG`.

## Backups

All data is in `DATA_DIR/crane.db` (SQLite, WAL mode). Back it up with:

```bash
sqlite3 /var/lib/cranego/crane.db ".backup '/backups/crane-$(date +%F).db'"
```

## Production checklist

- [ ] `NODE_ENV=production`, strong `OTP_SECRET`, `DEV_OTP` unset
- [ ] `ADMIN_PIN` set (PIN mode) or SMS provider configured and tested (OTP mode)
- [ ] HTTPS only; `CORS_ORIGINS` limited to your app origins
- [ ] Real rates in Admin → Pricing; GSTIN, SAC and tax split confirmed by your accountant
- [ ] Fleet and operators entered; test booking run end to end
- [ ] Daily database backup scheduled
- [ ] Privacy notice for customer phone numbers and location data (DPDP Act); see the market analysis risks section
