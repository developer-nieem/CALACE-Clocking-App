#!/usr/bin/env node
import pg from "pg";

const orgArg = process.argv.find((item) => item.startsWith("--org="));
const organizationId = orgArg ? orgArg.slice("--org=".length) : null;

async function count(client, sql, params) {
  const result = await client.query(sql, params);
  return Number(result.rows[0]?.n ?? 0);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("DATABASE_URL is not set. Parity report skipped.");
    process.exit(0);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const params = organizationId ? [organizationId] : [];
    const where = organizationId ? "where organization_id = $1" : "";
    const jsonProfiles = await count(
      client,
      `select count(*)::int as n from collection_items ${where ? `${where} and` : "where"} collection = 'profiles'`.replace("where and", "where"),
      params,
    );
    const sqlProfiles = await count(client, `select count(*)::int as n from profiles ${where}`, params);
    const jsonShifts = await count(
      client,
      `select count(*)::int as n from collection_items ${where ? `${where} and` : "where"} collection = 'shifts'`.replace("where and", "where"),
      params,
    );
    const sqlShifts = await count(client, `select count(*)::int as n from shifts ${where}`, params);
    const sqlEntries = await count(client, `select count(*)::int as n from time_entries ${where}`, params);
    console.log(`User count JSON collections: ${jsonProfiles} SQL: ${sqlProfiles} delta: ${sqlProfiles - jsonProfiles}`);
    console.log(`Shift count JSON collections: ${jsonShifts} SQL: ${sqlShifts} delta: ${sqlShifts - jsonShifts}`);
    console.log(`Time entries SQL: ${sqlEntries}`);
    console.log("Worked hours / payroll / billing totals are compared in unit tests (lib/phase7).");
  } finally {
    await client.end();
  }
}

main().catch(() => {
  console.error("Parity report failed.");
  process.exitCode = 1;
});
