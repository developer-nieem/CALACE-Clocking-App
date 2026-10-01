# GPS UAT

Automated Playwright geolocation is not a substitute for this checklist. Run on real devices on staging.

Environment: ________  Tester: ________  Date: ________

## Devices

- [ ] iPhone Safari
- [ ] Android Chrome

## Cases

| # | Test | Role | Expected | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Location allowed, inside geofence, Clock In | Staff | Clock in succeeds | | |
| 2 | Outside geofence | Staff | Warning or block per org policy | | |
| 3 | Location denied | Staff | Clear permission message, no false success | | |
| 4 | Low accuracy punch | Admin | Accuracy visible on the entry | | |
| 5 | Clock Out | Staff | Location recorded | | |
| 6 | Break start / end | Staff | Location captured if enabled | | |
| 7 | Network interruption | Staff | No false success | | |

## Result

Status: **NOT RUN** (no real-device GPS session was executed in Phase 7 engineering).

Do not mark PILOT READY until both devices pass.
