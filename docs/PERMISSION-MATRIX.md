# Permission matrix

Y = allowed. Own = own records only. — = not granted by default.

| Feature | Super Admin | Admin | Scheduler | Instructor | Staff |
| --- | --- | --- | --- | --- | --- |
| View users | Y | Y | Y | Own | Own |
| Manage users | Y | Y | — | — | — |
| Edit pay rate | Y | Y | — | — | — |
| View pay rate | Y | Y | — | Own | Own |
| Manage schedule | Y | Y | Y | — | — |
| Publish schedule | Y | Y | Y | — | — |
| Clock in | Y | Y | — | Y | Y |
| Edit clock record | Y | Y | — | — | — |
| Approve timesheet | Y | Y | — | — | — |
| Export payroll | Y | Y | — | — | — |
| Lock pay period | Y | Y | — | — | — |
| Manage billing | Y | Y | — | — | — |
| View margin | Y | Y | — | — | — |
| Manage automations | Y | Y | — | — | — |
| View private documents | Y | Y | — | Own | Own |
| Manage forms | Y | Y | — | — | — |
| View form submissions | Y | Y | — | Own | Own |
| Submit forms | Y | Y | Y | Y | Y |
| Manage facilities | Y | Y | — | — | — |
| View facilities | Y | Y | Y | — | — |
| Manage facility billing | Y | Y | — | — | — |
| View knowledge base | Y | Y | Y | Audience | Audience |
| Manage onboarding | Y | Y | — | — | — |
| Data export / audit export | Y | Y | — | — | — |
| Security / system health | Y | Y | — | — | — |

Scheduler must not see payroll, pay rates, facility billing rates, or margin unless an operator later grants extra permissions (this app uses role defaults, not per-user extra grants).
