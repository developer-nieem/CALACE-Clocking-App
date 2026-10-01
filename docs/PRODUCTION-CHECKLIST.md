# Production checklist

- [ ] TypeScript clean (`npm run typecheck`)
- [ ] Lint clean (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] Production build passes (`npm run build`)
- [ ] No secrets committed (`.env.local` is gitignored)
- [ ] `DEMO_MODE=false` and `NEXT_PUBLIC_DEMO_MODE=false`
- [ ] `CALACE_SEED_DEMO=false` in production
- [ ] `DATABASE_URL` pooled production database
- [ ] `NEXT_PUBLIC_APP_URL` is the public HTTPS origin (not localhost)
- [ ] Additive migrations applied (`0001`–`0007`)
- [ ] RLS enabled on business tables
- [ ] Runtime is relational (org-scoped SQL + dual-write)
- [ ] JSON writes disabled (`CALACE_JSON_WRITES=false`) after parity
- [ ] Real RLS tenant test passed (`CALACE_RLS_VERIFIED=true`)
- [ ] Hardcoded `ORG_ID` removed from production runtime paths
- [ ] Distributed rate limiter active (Upstash) or `CALACE_ALLOW_MEMORY_RATE_LIMIT` documented
- [ ] Playwright critical suite passed
- [ ] Live GPS UAT passed
- [ ] Cron live-tested
- [ ] Production admin created
- [ ] Demo seeding disabled
- [ ] Private storage configured if files are stored
- [ ] Production admin created (not demo password on a public URL)
- [ ] Email domain verified if Resend is used
- [ ] OAuth callbacks are production URLs only
- [ ] `CRON_SECRET` set and Vercel cron authorized
- [ ] `/api/cron/automations` reachable without a user cookie
- [ ] Monitoring: `SENTRY_DSN` or accept console logs
- [ ] Neon backups / PITR enabled
- [ ] SSL active
- [ ] `GET /api/health` ok, no secrets
- [ ] Rate limiting in place for login, clock, forms, exports
- [ ] Security headers present
- [ ] PWA tested (Android install / iPhone Add to Home Screen)
- [ ] Time Clock + geolocation tested online; offline does not fake success
- [ ] Overnight shift duration (22:00–06:00) is 8 hours
- [ ] Payroll and billing estimates match the 7.5h / $25 / $40 scenario
- [ ] Scheduler cannot see payroll or facility billing rates
- [ ] Staff cannot see another employee’s pay
- [ ] UAT checklist signed
- [ ] Admin explicitly decides to invite real employees (go-live)

## Go-live

Do not automatically activate production for real employees. After the boxes above, an admin invites staff.
