# Deployment

## Single server (simplest)

Any VPS with Node 22.13+ (e.g. 1 vCPU / 1 GB):

```bash
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production OTP_SECRET=$(openssl rand -hex 32) DATA_DIR=/var/lib/cranego \
  SMS_PROVIDER=msg91 MSG91_AUTH_KEY=... MSG91_TEMPLATE_ID=... \
  ADMIN_PHONES=9789473129 pnpm start
```

Put it behind a TLS reverse proxy (Caddy, nginx). For server-sent events, turn off proxy
buffering for `/api/events` (the server sends `X-Accel-Buffering: no` for nginx).

## Docker

```bash
docker build -t cranego .
docker run -d -p 4100:4100 -v cranego-data:/data \
  -e OTP_SECRET=... -e ADMIN_PHONES=9789473129 -e SMS_PROVIDER=msg91 \
  -e MSG91_AUTH_KEY=... -e MSG91_TEMPLATE_ID=... cranego
```

## Environment

See [`.env.example`](../.env.example). Required in production: `OTP_SECRET`, an SMS provider,
`ADMIN_PHONES`. Recommended: `BUSINESS_GSTIN`, `BUSINESS_UPI_ID`, `BUSINESS_SAC`, `YARD_LAT/LNG`.

## Backups

All data is in `DATA_DIR/crane.db` (SQLite, WAL mode). Back it up with:

```bash
sqlite3 /var/lib/cranego/crane.db ".backup '/backups/crane-$(date +%F).db'"
```

## Production checklist

- [ ] `NODE_ENV=production`, strong `OTP_SECRET`, `DEV_OTP` unset
- [ ] Real SMS provider configured and tested
- [ ] HTTPS only; `CORS_ORIGINS` limited to your app origins
- [ ] Real rates in Admin → Pricing; GSTIN, SAC and tax split confirmed by your accountant
- [ ] Fleet and operators entered; test booking run end to end
- [ ] Daily database backup scheduled
- [ ] Privacy notice for customer phone numbers and location data (DPDP Act); see the market analysis risks section
