# Phase 6 audit

Inspected 1 October 2026 against the running CAL ACE Workforce tree (Next.js 16.3.4, React 19, Vitest, Neon/Postgres or demo JSON). Findings below were verified in source. Items not reproduced in a browser or second-organization database are marked as such.

## Existing architecture

- App Router with `proxy.ts` (not `middleware.ts`) for session cookies.
- Auth: scrypt passwords + `calace_session` (database) or `calace_demo_user` (demo).
- Roles: super_admin, admin, scheduler, instructor, staff. Permissions are dotted strings on the role.
- Live workforce data is a versioned JSON document (`collection_items` / `loadWorkforce` / `mutateWorkforceState`) with optimistic concurrency (3 retries).
- Additive SQL migrations `0001`–`0006` document relational tables and RLS. Application writes still go through the JSON store.
- Time Clock, scheduling engine, automations, and Phase 5 domain logic live in TypeScript modules with Vitest coverage.
- PWA: manifest, PNG icons, service worker (icons only). Clock actions are online-only.
- Optional integrations: Resend, Google/Microsoft calendar OAuth, OpenAI, Sentry. Missing keys disable the feature rather than faking success.

Baseline commands before Phase 6 changes:

- `npm run typecheck` — pass (exit 0)
- Existing Phase 5 `npm run lint`, `npm test` (61 tests), `npm run build` — pass from the prior phase

## Critical issues

1. **`proxy.ts` blocks unauthenticated cron and ICS feed URLs.** Public paths are only `/login`, `/auth/callback`, and `/api/health`. Vercel cron has no session cookie, so `GET /api/cron/automations` would redirect to login even with a valid `CRON_SECRET`. Token-based `GET /api/calendar/feed/[token]` would also redirect. Verified in `proxy.ts`.
2. **Overnight shift duration is wrong.** `shiftMinutes` uses `end - start` and `Math.max(0, …)`. A 22:00–06:00 shift becomes 0 minutes. Clock totals use timestamps and are unaffected. Verified in `lib/scheduling/engine.ts`.
3. **Empty production databases auto-seed demo employees and `CalAce2026!`.** `prepareDatabase` seeds whenever `profiles` is empty. Verified in `lib/db/neon.ts`.

## High priority issues

- No HTTP security headers (`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`).
- No `app/error.tsx` or `app/global-error.tsx`. Users can see Next.js error UI.
- Clock buttons disable while pending, but labels do not say “Processing…”. Network failures in the catch path do not always tell the user to refresh server state.
- Clock mutations are not rate-limited (login and some Phase 5 actions are).
- CSV export does not neutralize formula-injection prefixes (`=`, `+`, `-`, `@`).
- Money math uses IEEE floats (`regularSeconds / 3600 * rate`) with no centralized rounding.
- No organization feature-flag object. Disabled integrations are env-based only.
- `/api/health` omits a timestamp. No `/api/ready`.
- In-memory rate limiter does not share state across Vercel instances (documented in Phase 5).
- Live writes remain JSON, so relational RLS does not enforce runtime isolation. Isolation is application `organizationId` plus one hardcoded `ORG_ID` in Neon transactions.

## Medium priority issues

- No `/settings/system-health` page for operators.
- Last cron/automation run is not shown in admin UI (runs exist on `automationRuns`).
- Sidebar hydration mismatch in development overlay (`usePathname` in a client sidebar). Not reproduced as a production crash.
- `/timesheets` is still the clock report; approval/lock lives on `/payroll`.
- Pool `max: 1` on Neon/pg. Nested connections would deadlock; cron must not open a second client around `mutateWorkforceState`.
- `createAdminClient()` exists for `SUPABASE_SERVICE_ROLE_KEY` but is unused. It is server-only (not imported from client files). Verified by repository search.
- No E2E framework (Playwright/Cypress) in `package.json`.
- Pagination for many lists is in-memory `.slice`.
- Feature-complete calendar OAuth event sync is still incomplete when credentials are missing (by design).

## Low priority issues

- Duplicate Lucide icons in nav (Forms/Policies, Training/Onboarding). Cosmetic.
- Health `runtime: "vercel"` even on local Docker Postgres.
- Widget customization covers a subset of possible widgets.
- Demo seed password is documented in README (acceptable for demo; not for production).

## Security risks

- Cron and public ICS feed blocked or, if someone removes proxy auth without keeping `CRON_SECRET`, cron would be public. Current code requires the secret *after* proxy; proxy never lets the request through.
- Formula injection in CSV opened in Excel.
- Auto-seed of known demo password on first empty production database.
- JSON store: a bug in application filters is the isolation boundary, not Postgres RLS, until cutover.
- Service role key is not in client bundles (unused module). Keep it that way.
- `safeError` returns `error.message` for clock actions; Zod/internal errors could leak if not filtered.

## Performance risks

- Dashboard/schedule/payroll load the whole workforce JSON document per request.
- FullCalendar and Recharts are client-side.
- Chat realtime: review unsubscribe on unmount (Phase 3/4 components).
- Single-row JSON grows with history; date filters and pagination are still in process.

## Data-integrity risks

- Overnight scheduled hours under-count availability/overtime warnings.
- Overlapping pay-rate ranges: `changePayRate` closes the previous open row; concurrent writers rely on JSON version retries.
- Invoice numbers are allocated inside `mutateWorkforceState` (versioned). Concurrent drafts retry; duplicates are unlikely but not a database unique constraint on the live path.
- Historical clock/payroll rows are not deleted on terminate/archive (verified in domain tests).

## Mobile UX issues

- PWA install path exists. Offline clock is correctly blocked.
- Sticky bottom nav + iOS `100vh` / keyboard overlap not fully retested in this audit.
- Admin tables on small screens: some pages use grids; others still use tables.

## Permission / RLS issues

- Role matrix is implemented in `ROLE_PERMISSIONS`. Scheduler does not receive `pay.manage`, `payroll.view`, `facility_billing.*`, or `margin.view` (unit-tested).
- `getUserById` forbids non-managers from other user IDs. `getTimeClockData` ignores requested IDs unless `time_clock.view_all`.
- RLS policies exist on Phase 5 tables in migration `0006` but are not the live write path.
- Cross-tenant tests against two real Supabase projects were **not** executed in this audit (single `ORG_ID` in Neon helper).

## Missing tests

- Overnight `shiftMinutes`
- 9:00–17:00 with 30-minute break → 7.5 hours payroll
- End-to-end margin 7.5h × $25 / $40
- CSV formula sanitization
- Cross-org filter helpers
- Cron proxy allowlist (cannot unit-test proxy easily without a request helper)
- No Playwright E2E

## Production blockers

1. Cron cannot run behind current `proxy.ts`.
2. Public calendar feed cannot be fetched by Google/Outlook without a session.
3. First empty production deploy seeds demo users unless seeding is gated.
4. Overnight shifts mis-measured for schedule policy.
5. External email/calendar/Sentry not configured until operators set env vars (not a code blocker).

## Post-launch backlog (not in Phase 6)

- Cut live writes to relational tables
- Redis/KV rate limits
- Full PDF invoice engine
- Two-way calendar event sync completion
- True multi-organization Neon `organization_id` per request (not a constant)
- Playwright E2E suite
- Full LMS, tax, and bank payroll (explicitly out of scope)
