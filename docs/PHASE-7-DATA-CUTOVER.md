# Phase 7 data cutover

Inspected 1 October 2026 against `lib/db/neon.ts` and `lib/db/workforce.ts`.

## Current runtime source of truth (Stage A/B)

Database mode still uses `mutateWorkforceState` (optimistic version) but **organization context comes from the signed-in user**, not a global `ORG_ID`.

1. Optimistic lock: `organization_runtime.version` per organization.
2. Snapshot rewrite scoped by `organization_id`.
3. Dual-write: relational tables **and** `collection_items` unless `CALACE_JSON_WRITES=false`.
4. Login/session lookups use `app.auth_lookup` so FORCE RLS does not hide other-org profiles during authentication.

Demo mode (`DEMO_MODE=true`) never hits Postgres.

## JSON-backed entities (`collection_items`)

templates, availability, timeOff, tasks, openShifts, trades, notifications, activity, availabilityExceptions, shiftSeries, scheduleOverrides, chatRooms, chatMessages, documents, calendarConnections, calendarFeeds, notificationPreferences, automations, automationRuns, attendanceExceptions, shiftCallouts, notificationDeliveries, scheduleRecommendations, calendarEventMappings, shiftConfirmations, and remaining Phase 5 collections.

## Relational entities written on every save

organizations, organization_settings, organization_runtime, profiles, locations, departments, positions, qualifications, shifts, time_entries, time_breaks, time_entry_edits, employee_pay_rates, sessions, audit_logs, plus dual-write of pay_periods, facilities, invoices when present.

## Production constraints added (0007)

- One open time entry per user (`one_open_time_entry`)
- One active open-shift claim per user/shift
- Invoice sequence `allocate_invoice_number`
- Job locks / job_runs
- Auth lookup policy for login
- Composite indexes for org+date / org+user+date / org+status

## Code still depending on JSON document mutation

All `mutateWorkforceState` callers. JSON is **not** the isolation boundary; RLS GUC + org-scoped SQL is. Do not leave split-brain: every module still goes through one mutate path that writes both stores.

## Stage

**Stage A+B in code.** Stage C (`CALACE_JSON_WRITES=false`) is opt-in after `npm run data:parity`. Stage D (delete collections) is not done.

Rollback: keep `collection_items`. Set `CALACE_JSON_WRITES=true`.

## Migration tool

```bash
npm run data:migrate -- --dry-run
npm run data:migrate -- --apply
npm run data:parity
```
