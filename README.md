# CAL ACE Team

Workforce management for CAL ACE instructors and staff: scheduling, geolocation time clock, estimated hourly pay, facilities, onboarding, forms, and payroll/billing drafts.

On a phone, open the site in Chrome (Android) or Safari (iPhone) and install the web app: Android shows **Install app**; iPhone uses Share → **Add to Home Screen**. This is a PWA, not an App Store or Play Store native build. Time Clock still needs an internet connection.

The app is a Next.js frontend and server backend. Deploy it on Vercel. Production data lives in Neon PostgreSQL.

## Local demo

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo mode is the default (`DEMO_MODE=true`) and does not need a database.

Password for every demo account: `CalAce2026!`

| Role | Email |
| --- | --- |
| Super Admin | superadmin@calace.team |
| Admin | admin@calace.team |
| Scheduler | scheduler@calace.team |
| Instructor | maria.santos@calace.team |
| Staff | olivia.wilson@calace.team |

## Local database with Docker Desktop

Postgres for this app runs on port **5433** so it does not conflict with other local databases.

```bash
npm run db:up
npm run db:setup
npm run dev
```

`.env.local` should contain:

```
DEMO_MODE=false
NEXT_PUBLIC_DEMO_MODE=false
DATABASE_URL=postgresql://calace:calace_dev@localhost:5433/calace_team
```

`GET /api/health` returns `{ "database": "postgres" }`.

Production databases must set `CALACE_SEED_DEMO=false` so an empty database is **not** filled with demo employees. Create the first admin using [docs/INITIAL-ADMIN.md](docs/INITIAL-ADMIN.md).

## Deploy on Vercel with Neon

1. Push this repository to GitHub.
2. In Vercel, import the project. Framework preset: Next.js.
3. In the Vercel project, open **Storage** and create a **Neon Postgres** database. Vercel adds `DATABASE_URL` automatically. Use the pooled connection string.
4. Set these environment variables for Production and Preview:

```
DEMO_MODE=false
NEXT_PUBLIC_DEMO_MODE=false
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
CALACE_SEED_DEMO=false
CRON_SECRET=generate-a-long-random-string
```

5. Deploy. The first request creates the tables in `lib/db/schema.sql`. It does **not** seed demo staff when `CALACE_SEED_DEMO=false`.

You can also apply the schema yourself:

```bash
npm run db:setup
```

`GET /api/health` returns `{ "database": "neon" }` when the connection works.

After seeding a **development** database, demo emails work with `CalAce2026!`. Production must use [docs/INITIAL-ADMIN.md](docs/INITIAL-ADMIN.md) instead. Coordinates are not hardcoded. Set workplace latitude, longitude, and geofence radius in Settings after deploy.

Money is stored as `numeric(10,2)`. Clock timestamps are `timestamptz` in UTC and shown in `America/Los_Angeles`.

Row Level Security isolates business tables by `app.organization_id`. The server sets that value on every database transaction, so one organization cannot read another organization's rows.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build used by Vercel
- `npm run db:setup` — apply the Neon schema
- `npm test` — time clock workflow tests
- `npm run typecheck` — TypeScript
- `npm run lint` — ESLint

## Docs

- [Deployment](docs/DEPLOYMENT.md)
- [Backup and recovery](docs/BACKUP-RECOVERY.md)
- [Production checklist](docs/PRODUCTION-CHECKLIST.md)
- [Security](docs/SECURITY.md)
- [Permissions](docs/PERMISSIONS.md)
- [Permission matrix](docs/PERMISSION-MATRIX.md)
- [Privacy data map](docs/PRIVACY-DATA-MAP.md)
- [UAT checklist](docs/UAT-CHECKLIST.md)
- [Initial admin](docs/INITIAL-ADMIN.md)
- [Phase 6 audit](docs/PHASE-6-AUDIT.md)
- [Post-launch](docs/POST-LAUNCH.md)
- [Post-launch backlog](docs/POST-LAUNCH-BACKLOG.md)

## Mobile / PWA

`app/manifest.ts` plus `/icon-192.png`, `/icon-512.png`, and `/apple-touch-icon.png` make the site installable. A service worker at `/sw.js` caches icons only. Clock actions stay online-only.
