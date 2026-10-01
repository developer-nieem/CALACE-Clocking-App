# Initial admin

Do not ship a default production password in source. Demo accounts (`CalAce2026!`) exist only when demo seed runs.

## Empty production database

1. Set `DEMO_MODE=false`, `NEXT_PUBLIC_DEMO_MODE=false`, `CALACE_SEED_DEMO=false`.
2. Deploy and confirm `GET /api/health` is ok.
3. Create the first administrator:

```bash
ADMIN_PASSWORD='use-a-password-manager' npm run admin:create -- --email=you@example.com --first-name=Pat --last-name=Lee --org-name="CAL ACE"
```

The script never prints the password. It is read from `ADMIN_PASSWORD`. Do not commit it.

Alternatively invite via your Postgres operator after hashing with `lib/auth/password.ts` (`hashPassword`).

4. Sign in, open Settings → Security, and confirm the session cookie is HTTPS-only.
5. Rotate the password after first login (or send a reset if you add that flow later).

## If you accidentally seeded demo users

Identify rows with emails `@calace.team` and change those passwords immediately or archive them before inviting real staff. Do not leave `CalAce2026!` on a public URL.

## Staging

Staging may set `CALACE_SEED_DEMO=true` so trainers can use README demo logins. Production must not.
