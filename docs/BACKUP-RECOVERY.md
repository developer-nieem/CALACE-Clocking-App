# Backup and recovery

## Database

Neon and most managed Postgres providers keep point-in-time backups. Enable them in the project dashboard before production traffic.

Local Docker (`calace-team-db` on host port 5433) is for development. Do not treat it as a backup.

Suggested dump:

```bash
pg_dump "$DATABASE_URL" --no-owner --format=custom --file=calace-$(date +%Y%m%d).dump
```

Restore:

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" calace-YYYYMMDD.dump
```

Do not reset the database to apply Phase 5. Use additive migrations only.

## Supabase backups

If you use Supabase in addition to Neon, enable daily backups in the Supabase project. Restore from the dashboard; then re-run `npm run db:setup` only if schema objects are missing. Never drop working RLS policies.

## Storage

Private documents are not fully stored as blobs in this phase (metadata lives in `collection_items`). If you add a storage bucket later, back it up separately and keep object keys org-scoped.

## Migration recovery

Migrations are additive:

- `0001`–`0005` existing
- `0006_phase5_operations.sql` Phase 5

If a migration fails, fix forward. Do not roll back earlier phases.

## Environment and secrets

Recover `.env` values from the host secret store (Vercel Environment Variables). Rotate any leaked `DATABASE_URL`, `CRON_SECRET`, OAuth secrets, or `RESEND_API_KEY`. The app does not embed secrets in the client bundle.

## Restore drill (staging)

1. Restore the latest dump into a **staging** database, never straight over production.
2. Set staging env vars (`NEXT_PUBLIC_APP_URL`, OAuth callbacks, `CALACE_SEED_DEMO=false`).
3. Apply additive migrations if the dump is older than the repo.
4. Sign in as a known admin.
5. Verify a sample user, a published shift, a clock entry, and a payroll estimate.
6. Only then plan a production restore window.

## Workforce JSON

Operational collections are versioned in `workforce_meta`. If a write conflicts, retry. Restore from a database backup if the JSON payload is corrupted.
