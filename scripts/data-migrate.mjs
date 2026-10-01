#!/usr/bin/env node
import pg from "pg";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--apply");
const orgArg = process.argv.find((item) => item.startsWith("--org="));
const organizationId = orgArg ? orgArg.slice("--org=".length) : null;

function print(label, value) {
  console.log(`${label}: ${value}`);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("DATABASE_URL is not set. Dry-run of live tables skipped.");
    console.log("Unit tests cover fixture counts via lib/phase7/migrate.ts.");
    process.exit(0);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const orgFilter = organizationId ? [organizationId] : [];
    const where = organizationId ? "where organization_id = $1" : "";
    const count = async (sql) => {
      const result = await client.query(sql, orgFilter);
      return Number(result.rows[0]?.n ?? 0);
    };
    const organizations = await count(
      organizationId
        ? "select count(*)::int as n from organizations where id = $1"
        : "select count(*)::int as n from organizations",
    );
    const profiles = await count(`select count(*)::int as n from profiles ${where}`);
    const shifts = await count(`select count(*)::int as n from shifts ${where}`);
    const assignments = await count(
      `select coalesce(sum(jsonb_array_length(payload->'instructorIds')), 0)::int as n from shifts ${where}`,
    );
    const timeEntries = await count(`select count(*)::int as n from time_entries ${where}`);
    const tasks = await count(
      `select count(*)::int as n from collection_items ${where ? `${where} and` : "where"} collection = 'tasks'`.replace(
        "where and",
        "where",
      ),
    );
    print(dryRun ? "DRY RUN — no writes" : "APPLY", dryRun ? "true" : "false");
    print("Organizations", organizations);
    print("Profiles", profiles);
    print("Shifts", shifts);
    print("Assignments", assignments);
    print("Time Entries", timeEntries);
    print("Tasks", tasks);
    if (dryRun) {
      console.log("No writes in dry-run.");
      return;
    }
    await client.query("begin");
    if (organizationId) {
      await client.query("select set_config('app.organization_id', $1, true)", [organizationId]);
    }
    await client.query(
      `insert into audit_logs (id, organization_id, actor_id, action, entity_type, entity_id, payload, created_at)
       select payload->>'id', organization_id, payload->>'actorId', coalesce(payload->>'action','activity'),
              coalesce(payload->>'entityType','unknown'), payload->>'entityId', payload,
              coalesce((payload->>'createdAt')::timestamptz, now())
       from collection_items
       where collection = 'activity'
       on conflict (id) do nothing`,
    );
    await client.query("commit");
    console.log("Relational upsert complete.");
  } catch {
    try {
      await client.query("rollback");
    } catch {
      // ignore
    }
    console.error("Migration failed.");
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();

