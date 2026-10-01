# Deployment

CAL ACE Workforce is a Next.js App Router app. Production data is Neon PostgreSQL (or compatible Postgres). Auth is the existing scrypt + `calace_session` cookie. Do not replace it.

## Ordered production setup

1. Create the production Postgres/Neon project (and a Supabase project if you use storage/RLS there).
2. Configure authentication (keep scrypt sessions).
3. Apply schema (`npm run db:setup` or first request) and additive migrations `0001`–`0007`.
4. Confirm RLS is enabled on business tables. Run two-tenant tests before setting `CALACE_RLS_VERIFIED=true`.
5. Create private storage buckets if you store employee files.
6. Set environment variables. Production must use `CALACE_SEED_DEMO=false`.
7. Configure Upstash Redis (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) for distributed rate limits. Production validation fails without them unless `CALACE_ALLOW_MEMORY_RATE_LIMIT=true`.
8. Run JSON→relational dry-run then apply: see [DATA-CUTOVER-CHECKLIST.md](./DATA-CUTOVER-CHECKLIST.md).
9. Create the first admin using [INITIAL-ADMIN.md](./INITIAL-ADMIN.md) (`npm run admin:create`).
10. Configure Resend and a verified sender domain if email is used. Test with `npm run integration:test-email -- --to=...`.
11. Configure Google OAuth callbacks on the staging/production URL only (no localhost in production).
12. Configure Microsoft OAuth callbacks on the staging/production URL only.
13. Set `CRON_SECRET` and Vercel cron for `/api/cron/automations` and `/api/cron/calendar-retry` with `Authorization: Bearer $CRON_SECRET`.
14. Set `SENTRY_DSN` or accept console structured logs. Do not claim verified until a staging event is seen.
15. Deploy the Next.js app on Vercel.
16. Run production verification: health, ready, login, clock, publish, payroll estimate, invoice draft.
17. Complete [GPS-UAT.md](./GPS-UAT.md) and [UAT-CHECKLIST.md](./UAT-CHECKLIST.md).
18. Enable staff access only after an admin uses `/settings/go-live` as a human decision.

Go-live is a human decision. The app does not auto-invite employees.

## Environment groups

Copy `.env.example`. Never commit real secrets.

- **CORE REQUIRED:** `DEMO_MODE=false`, `NEXT_PUBLIC_DEMO_MODE=false`, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `CALACE_SEED_DEMO=false`
- **PRODUCTION REQUIRED:** `CRON_SECRET`, `APP_ENCRYPTION_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **FEATURE OPTIONAL:** `RESEND_API_KEY`, `EMAIL_FROM`, Google/Microsoft OAuth, `OPENAI_API_KEY`, `SENTRY_DSN`, Supabase storage

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_`.

Staging must use a separate database, OAuth callbacks, `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_APP_ENV=staging` (shows a STAGING badge).

## Cron and public feeds

`proxy.ts` allows `/api/cron/*` and `/api/calendar/feed/*` without a user session. Cron still requires `CRON_SECRET`. ICS feeds require the per-user token.

```bash
curl -i "$APP_URL/api/cron/automations"
curl -i -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/automations"
```

Jobs run at most every 15–20 minutes (`vercel.json`). Concurrent runs take a database job lock.

## Relational cutover

See [PHASE-7-DATA-CUTOVER.md](./PHASE-7-DATA-CUTOVER.md). Do not set `CALACE_JSON_WRITES=false` until parity passes.

## AI

Auto-fill ranking works without `OPENAI_API_KEY`. Do not send pay, documents, chat, or GPS history to an external model.

## Build

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

Live Resend/Google/Microsoft/Sentry are **not** part of PR CI.

## Post-deployment

1. `GET /api/health` returns `{ ok, status, database, version, timestamp }` and no secrets.
2. `GET /api/ready` checks configuration without exposing secrets.
3. `/settings/system-health` and `/settings/go-live` show flags without secret values.
4. Confirm PWA icons and the Time Clock location notice.
5. Confirm Neon backups.
