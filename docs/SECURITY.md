# Security

## Authentication

Passwords use scrypt. Sessions are httpOnly cookies (`calace_session`). Terminated, archived, and inactive employees cannot sign in.

## Sessions

Database mode stores hashed tokens with an expiry. Demo mode uses `calace_demo_user`. This architecture does not expose a full multi-device session inventory. Users sign out the current session. Organization settings can store idle timeout and “reauth for sensitive actions.”

## Sensitive actions

Pay rate changes, pay-period unlock, payroll export, employee archive/terminate, OAuth, and data export require dedicated permissions.

## E-signatures

Signature fields store signer id, method, time, user agent, form version, and consent text. The authenticated user is always the signer. Admins cannot silently sign as an employee. This is an evidence foundation, not a claim of full legal e-signature compliance.

## Search and exports

Search and CSV export omit payroll and billing unless the actor has those permissions. Exports redact passwords, OAuth tokens, API keys, and private storage URLs.

## Uploads

Validate extension, size, and file name. Do not trust client MIME type alone.

## Rate limits

In-memory limits cover login, invites, clock actions, form submit, invoices, and exports. Replace with Redis/KV for multi-instance production.

## HTTP headers

`next.config.ts` sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` (geolocation self), and a conservative CSP. Test calendar/OAuth if you tighten CSP further.

## CSV

Exported cells that start with `=`, `+`, `-`, or `@` are prefixed so spreadsheets do not execute formulas.

## Cron

`/api/cron/automations` is excluded from session redirect but still requires `CRON_SECRET`.

## Monitoring

`lib/monitoring` logs structured JSON without secrets. Set `SENTRY_DSN` to send exceptions to Sentry. Until then, logs go to the server console.

## RLS

Relational Phase 5 tables are org-scoped. Billing, invoices, pay periods, and admin notes are admin-only. Form submissions and onboarding rows are own-or-admin. Live writes still go through `collection_items` with the same organization id.
