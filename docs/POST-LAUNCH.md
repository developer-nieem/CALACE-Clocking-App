# Post-launch monitoring

Do not treat go-live as automatic. An admin must invite employees.

## First 24 hours

Watch login failures, Time Clock errors, GPS denials, email (if configured), cron (`/settings/system-health`), automation failures, calendar connect errors, `GET /api/health`.

## First 3 days

Spot-check published shifts vs clock entries. Confirm overnight shifts show ~8 hours. Confirm notifications for assignments.

## First 7 days

Review open-shift claims, trades, and time-off approvals on a phone. Confirm no whole-page horizontal overflow on employee screens.

## First pay period

Manually reconcile a sample employee:

1. Clock records
2. Timesheet hours
3. Payroll estimate
4. Facility billing line items

Sign off before relying on exports.
