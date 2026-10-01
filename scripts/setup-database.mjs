import { readFileSync } from "node:fs";
import { neonConfig, Pool as NeonPool } from "@neondatabase/serverless";
import pg from "pg";
import ws from "ws";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DATABASE_URL to your Neon or Docker Postgres connection string, then run this again.");
  process.exit(1);
}

const pool = connectionString.includes("neon.tech")
  ? new NeonPool({ connectionString, max: 1 })
  : new pg.Pool({ connectionString, max: 1 });

if (connectionString.includes("neon.tech")) {
  neonConfig.webSocketConstructor = ws;
}
const schema = readFileSync(new URL("../lib/db/schema.sql", import.meta.url), "utf8");

await pool.query(schema);
await pool.end();
console.log("Postgres schema is ready. The app seeds CAL ACE data on the first request.");
