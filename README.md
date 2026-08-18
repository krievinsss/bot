# Secure Telegram Shop

Production-oriented Telegram commerce platform for lawful physical products. Customer interaction is inside Telegram; administrators use a private Next.js admin console.

## Included

- Telegram webhook bot with `/start`, Shopping, Add Funds, Account and Support
- City → product → purchase flow with server-side price checks
- PostgreSQL + Prisma persistence
- Serializable, idempotent wallet purchase flow
- Immutable wallet ledger
- PayPal Orders v2 + verified webhook crediting
- Encrypted private location fields using AES-256-GCM
- Public product images + private location-image support via Vercel Blob
- Admin authentication with scrypt password hashes, HTTP-only SameSite cookies, DB sessions, rate limiting
- Products, cities, locations, inventory, orders, users, payments, wallet, support, broadcasts, affiliates and audit pages
- Telegram webhook secret verification
- Security headers, no public stack traces, audit log
- Vercel cron endpoint for rate-controlled broadcasts
- Seed data and baseline security tests

## 1. Requirements

- Node.js 20+
- A PostgreSQL database. On Vercel, add a managed PostgreSQL integration (Prisma Postgres or another Marketplace Postgres provider).
- Telegram bot from BotFather
- PayPal Developer application
- Vercel Blob store

## 2. Local setup

```bash
cp .env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev
```

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" # DATA_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" # session / webhook / cron secrets
```

For local Telegram webhook testing, expose localhost with an HTTPS tunnel and set `APP_URL` to that HTTPS URL, then run:

```bash
node scripts/set-telegram-webhook.mjs
```

Production must use webhook mode.

## 3. Vercel deployment

1. Put this folder in a private Git repository (GitHub/GitLab/Bitbucket).
2. Import the repository into Vercel as a Next.js project.
3. In Vercel Marketplace, attach PostgreSQL. Ensure `DATABASE_URL` exists.
4. Create a Vercel Blob store and attach it to the project. Vercel injects `BLOB_READ_WRITE_TOKEN`.
5. Add all secrets from `.env.example` in Project → Settings → Environment Variables. Mark secrets as Sensitive where available.
6. Set `APP_URL=https://your-production-domain.example`.
7. Deploy once.
8. Run the schema on the production database from a trusted workstation:

```bash
vercel env pull .env.production.local
DATABASE_URL="...production value..." npx prisma db push
DATABASE_URL="...production value..." npm run db:seed
```

9. Immediately log in to `/admin/login`, then rotate/remove `SEED_ADMIN_PASSWORD` after the first account has been created. For a stricter production process, replace the seed password before running the seed.
10. Set the Telegram webhook:

```bash
APP_URL=https://your-domain.example BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... node scripts/set-telegram-webhook.mjs
```

11. In PayPal Developer Dashboard, add this webhook URL:

```text
https://your-domain.example/api/paypal/webhook
```

Subscribe at minimum to `PAYMENT.CAPTURE.COMPLETED`, then copy the webhook ID into `PAYPAL_WEBHOOK_ID`.
12. Start with `PAYPAL_MODE=sandbox`. Test Add Funds end-to-end. Switch to live credentials and `PAYPAL_MODE=production` only after sandbox validation.
13. Test a full Telegram purchase and confirm private pickup details are only returned after a successful atomic wallet purchase.

## 4. Private image note

Location image records are intentionally not present in any public catalog response. For private Blob objects, production delivery should be performed server-side after an authorized purchase. Depending on your Vercel Blob private-object configuration, a private object may require authenticated retrieval / a short-lived download URL. The current bot attempts to pass the stored reference directly to Telegram; if your Blob store blocks direct Telegram fetching, add a server-side authenticated fetch and upload the bytes to Telegram using multipart `sendPhoto`. Do not make private location images permanently public just to simplify delivery.

## 5. Payment integrity

A PayPal browser redirect never credits a wallet. The wallet is credited only when `/api/paypal/webhook` receives a PayPal event whose webhook signature validates, whose event has not already been processed, and whose amount/currency match the server-created Payment record.

## 6. Purchase integrity

Purchases run in a PostgreSQL serializable transaction. The server loads the real product price, checks an active stock row, conditionally debits the wallet, conditionally decrements stock, creates the immutable order snapshot, and writes the ledger transaction. Telegram callback-query ID is used as the purchase idempotency key.

## 7. Secret rotation

- Telegram: rotate the token with BotFather, update Vercel, redeploy, then reset the webhook.
- Telegram webhook secret: change the env var and call `setWebhook` again with the new secret.
- PayPal client secret: rotate in PayPal, update Vercel, redeploy.
- `ADMIN_SESSION_SECRET`: reserved for future stateless signing; current admin sessions are opaque DB-backed tokens. Rotate by clearing AdminSession rows.
- `DATA_ENCRYPTION_KEY`: **do not simply replace it** while encrypted location rows still use the old key. Implement key-version migration: decrypt with old v1 key, re-encrypt with v2 key, verify, then retire v1.
- Blob token: rotate in Vercel and redeploy.

## 8. Backup / recovery

Use the managed PostgreSQL provider's automated backups / PITR where available. Keep database backups and Blob storage lifecycle policies separate. Periodically test restoring into a non-production database. Encryption keys must be backed up in a secrets manager; losing `DATA_ENCRYPTION_KEY` makes encrypted location fields unrecoverable.

## 9. Security model

### Threat model
Public endpoints and application structure are assumed discoverable. Requests can be replayed, callbacks manipulated, webhooks forged, users can make simultaneous purchase attempts, and uploads can be malicious.

### Authentication / authorization
Telegram users are identified only from verified Telegram webhook updates. Admin routes require an opaque HTTP-only session whose hash is stored server-side. Admin APIs re-check authorization; sensitive owner actions require `OWNER`.

### Encryption
Exact address, coordinates and pickup instructions are encrypted server-side with AES-256-GCM, using a random 96-bit IV and authentication tag for each value. The key never enters browser code.

### Webhooks
Telegram requests require `X-Telegram-Bot-Api-Secret-Token`. PayPal events are verified against PayPal's `verify-webhook-signature` API and deduplicated by event ID.

### Private location protection
The public site has no location-detail API. Telegram receives private location data only from the server after a successful purchase. Admin pages intentionally do not print decrypted private addresses into list views.

## 10. Production hardening checklist

- Use a private Git repository.
- Never commit `.env`.
- Turn on Vercel Sensitive Environment Variables.
- Keep Next.js current on security releases.
- Add a managed rate-limit/KV service if traffic becomes high; the included login limiter is DB-backed.
- Add TOTP or WebAuthn before delegating admin access to multiple people.
- Add malware scanning if arbitrary file uploads are introduced beyond validated product/location images.
- Add provider-level alerting for unusual payment, login and error rates.
- Review audit logs and backup restore procedures regularly.

## 11. Tests

```bash
npm test
```

The repository includes crypto/password unit tests. Database integration tests for simultaneous purchases and webhook idempotency should be run against a disposable PostgreSQL test database before each production release.
