# Permissions

Roles stay distinct from employee type (instructor vs staff).

| Role | Scope |
| --- | --- |
| Super Admin | Full organization access |
| Admin | Operational administration including payroll and billing |
| Scheduler | Scheduling and workforce operations. No pay, payroll, billing rates, or margin |
| Instructor | Self-service plus forms, knowledge, and own onboarding |
| Staff | Self-service plus forms, knowledge, and own onboarding |

## Phase 5 additions

- `facilities.view` / `facilities.manage`
- `facility_billing.view` / `facility_billing.manage`
- `forms.manage` / `forms.submissions.view` / `forms.submit`
- `knowledge.manage` / `knowledge.view`
- `onboarding.manage` / `onboarding.view`
- `payroll.approve` / `payroll.lock`
- `billing.manage` / `margin.view`
- `exports.manage` / `security.manage` / `audit.export`

Existing payroll permissions remain separate: `pay.read_own`, `pay.manage`, `payroll.view`, `payroll.export`.

Schedulers receive `facilities.view` so they can schedule at client sites. They do not receive facility billing, payroll, or margin permissions.
