# Live integration results

Do not mark an item VERIFIED unless a real staging/production call succeeded.

| Integration | Status | Evidence |
| --- | --- | --- |
| Resend | NOT CONFIGURED | No `RESEND_API_KEY` / `EMAIL_FROM` were present in this Phase 7 run. Use `npm run integration:test-email -- --to=you@example.com` or Settings → System health → Send Test Email. |
| Google Calendar | NOT CONFIGURED | OAuth start exists; no live connect/publish/update/disconnect was performed. |
| Microsoft Calendar | NOT CONFIGURED | OAuth start exists; no live Graph test was performed. |
| Cron | CONFIGURED NOT VERIFIED | Routes require `Authorization: Bearer $CRON_SECRET` and no session cookie. Live Vercel invocation was not executed here. |
| Sentry | NOT CONFIGURED | Events are scrubbed and logged. Staging probe: `GET /api/internal/sentry-test` only when `NEXT_PUBLIC_APP_ENV=staging` or `CALACE_ALLOW_ERROR_TEST=true`. |
| Storage | NOT CONFIGURED | Supabase storage keys were not live-tested. |
| GPS | NOT RUN | See [GPS-UAT.md](./GPS-UAT.md). |

## Cron test commands (secret never committed)

```bash
curl -i https://STAGING_HOST/api/cron/automations
# expect 401

curl -i -H "Authorization: Bearer $CRON_SECRET" https://STAGING_HOST/api/cron/automations
# expect 200, ran once

curl -i -H "Authorization: Bearer $CRON_SECRET" https://STAGING_HOST/api/cron/automations
# expect 200, duplicate reminders skipped via executionKey + job lock
```

## Email failure behavior

`sendNotificationEmail` returns `{ sent: false }` and does not throw. Shift publish, time-off approval, and task creation must not roll back because of email.
