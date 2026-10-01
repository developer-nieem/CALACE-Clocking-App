# UAT checklist

Do not invite real employees until an admin signs this off. Estimates are not official tax payroll.

| Test | Role | Environment | Expected | Result | Tester | Date | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Login / logout | Admin | Staging | Session works, no redirect loop | | | | |
| Add staff and instructor | Admin | Staging | Visible in Users | | | | |
| Set pay rate with effective date | Admin | Staging | New rate used after date | | | | |
| Add facility and billing rate | Admin | Staging | $40 rate stored | | | | |
| Create and publish schedule | Admin | Staging | Employee sees shift | | | | |
| Approve time off | Admin | Staging | Conflict on overlapping shift | | | | |
| Clock in / break / clock out (real GPS) | Staff | Staging mobile | See [GPS-UAT.md](./GPS-UAT.md) | | | | |
| Review attendance | Admin | Staging | Accuracy visible | | | | |
| Correct a clock record | Admin | Staging | Edit logged | | | | |
| Approve timesheet | Admin | Staging | Status approved | | | | |
| Lock pay period | Admin | Staging | Employee cannot edit | | | | |
| Payroll estimate $187.50 | Admin | Staging | 7.5h × $25 | | | | |
| Billing $300 / margin $112.50 | Admin | Staging | 7.5h × $40 | | | | |
| Generate invoice draft | Admin | Staging | Line totals match | | | | |
| Scheduler payroll URL | Scheduler | Staging | Access denied | | | | |
| Staff opens another employee | Staff | Staging | Access denied | | | | |
| Org A opens Org B URLs | Admin A | Staging DB | Denied | | | | |
| PWA install | Staff | iPhone + Android | Homescreen icon | | | | |
| Mobile: dashboard, clock, schedule, tasks, chat, notifications, time off, open shifts, forms, documents | Staff | Real phone | Usable, no horizontal overflow | | | | |

## End-to-end staff money check

Staff $25/hr, facility $40/hr, 9:00–17:00 with 30-minute break:

- Worked 7.5h
- Payroll estimate $187.50
- Billing $300.00
- Difference $112.50

## End-to-end instructor

Admin creates instructor, assigns Theory or Clinical Instructor, sets availability, creates shift, Auto Fill, publish, notification, optional email/calendar, mobile schedule, clock, task, timesheet.

## Sign-off

Admin: ________  Date: ________  Environment: ________
