# Privacy data map

CAL ACE Workforce stores workforce operations data for a single organization at a time in the current Neon helper (`app.organization_id`). Categories:

| Category | Examples | Who can see it | Retention |
| --- | --- | --- | --- |
| Profile data | Name, email, phone, role, employee type | Managers; employee sees self | Until archived + retention policy |
| Schedule | Shifts, assignments, templates | Managers; employees see assigned/published | Historical shifts kept |
| Time data | Clock in/out, breaks | Managers with time-clock view; employee sees self | Keep for payroll history |
| Geolocation events | Lat/long/accuracy on clock actions only | Time-clock managers; not continuous tracking | Same as time entries |
| Pay information | Hourly rate history, estimates | pay.manage / payroll.view; employee own rate if pay.read_own | Keep with timesheets |
| Documents | Qualification files, IDs | documents.manage or owner | Per retention settings |
| Chat | Room messages | Room members only | Chat retention days if set |
| Forms / signatures | Submissions, signature evidence | Form managers or submitter | Keep signed records |
| OAuth tokens | Calendar refresh tokens | Server only, never exported | Until disconnect |
| Audit records | Activity log | Admins; no ordinary delete | Keep |

Location notice shown on Time Clock:

> Your location is collected only when you perform a time-clock action, such as Clock In or Clock Out, when required by your workplace settings. CAL ACE Workforce does not continuously track your location.

Do not log precise GPS, chat bodies, form answers, or secrets in structured server logs.
