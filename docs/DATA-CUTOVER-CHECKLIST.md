# Data cutover checklist

Do not delete the legacy JSON dataset during the first production cutover.

- [ ] Backup existing Postgres (Neon PITR / snapshot)
- [ ] Confirm `CALACE_SEED_DEMO=false` in production
- [ ] `npm run data:migrate -- --dry-run`
- [ ] Review printed counts (profiles, shifts, assignments, time entries, tasks)
- [ ] `npm run data:migrate -- --apply` (organization filter optional: `--org=...`)
- [ ] `npm run data:parity`
- [ ] Compare JSON vs SQL: users, shifts, time entries, worked hours, payroll estimate, billing
- [ ] Relational read confirmed on dashboard, schedule, attendance, payroll, billing
- [ ] Relational write confirmed (clock, shift save, invoice draft)
- [ ] Set `CALACE_JSON_WRITES=false` only after parity
- [ ] Smoke: login, clock, publish, payroll, invoice
- [ ] Keep `collection_items` rows (read-only fallback)
- [ ] Rollback plan ready: set `CALACE_JSON_WRITES=true` and redeploy

## Authoritative stores after Stage B

| Module | Authoritative |
| --- | --- |
| Profiles, locations, departments, positions, qualifications | Relational tables |
| Shifts | `shifts` (payload + work_date) |
| Time entries / breaks / edits | `time_entries`, `time_breaks`, `time_entry_edits` |
| Pay rates | `employee_pay_rates` |
| Facilities, invoices, pay periods, audit | Dual-written typed tables + collections until JSON writes off |
| Tasks, chat, forms, automations, calendar tokens | `collection_items` until a later typed cutover |

## Rollback

Leave `collection_items` intact. Restore `CALACE_JSON_WRITES=true` (dual-write). Do not drop tables. Restore from backup if counts diverge.
