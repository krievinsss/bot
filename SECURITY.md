# Security Notes

This repository assumes public endpoints and architecture are discoverable. Security must not depend on obscurity.

## High-value controls
- Telegram webhook secret header validation.
- PayPal webhook cryptographic verification through PayPal REST API.
- Database-backed webhook deduplication.
- Serializable wallet/inventory purchase transaction with conditional updates.
- Immutable wallet ledger for every balance change.
- AES-256-GCM application-layer encryption for exact pickup address, coordinates and instructions.
- Private Blob storage for location images; images are fetched server-side after purchase.
- Opaque admin sessions stored hashed in PostgreSQL.
- HTTP-only, Secure, SameSite=Strict admin session cookie.
- DB-backed brute-force limiting for admin login.
- Origin validation on admin mutation APIs.
- Owner-only wallet adjustments with mandatory reason and audit logging.
- Generic public errors; sensitive data is not included in public APIs.

## Before production
1. Change all example secrets.
2. Use PayPal Sandbox first.
3. Use a private Git repository.
4. Enable database backups / PITR.
5. Restrict Vercel project access and enable 2FA for the Vercel/PayPal/Telegram owner accounts.
6. Add TOTP or WebAuthn if multiple admin operators are introduced.
7. Run database concurrency and webhook replay integration tests against a staging PostgreSQL database.
8. Run `npm audit` and update Next.js on every security release.

## Key rotation
The encrypted location format starts with a version (`v1`). Do not overwrite `DATA_ENCRYPTION_KEY` until all existing ciphertext has been migrated to a new key version.
