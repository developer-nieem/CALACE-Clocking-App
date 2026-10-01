#!/usr/bin/env node
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCallback);

function arg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function main() {
  const email = arg("email").toLowerCase();
  const firstName = arg("first-name") || "Admin";
  const lastName = arg("last-name") || "User";
  const organizationName = arg("org-name") || "CAL ACE";
  const organizationId = arg("org-id") || crypto.randomUUID();
  if (!email || !email.includes("@")) {
    console.error("Usage: npm run admin:create -- --email=admin@example.com --first-name=Pat --last-name=Lee");
    process.exit(1);
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error("Set ADMIN_PASSWORD in the environment. It is not logged and must not be committed.");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const payload = {
      id: userId,
      organizationId,
      email,
      firstName,
      lastName,
      phone: null,
      avatarUrl: null,
      employeeType: "staff",
      positionId: null,
      departmentId: null,
      primaryLocationId: null,
      employmentStatus: "active",
      hireDate: new Date().toISOString().slice(0, 10),
      payType: "salary",
      hourlyRate: null,
      weeklyTargetHours: 40,
      maximumWeeklyHours: 40,
      defaultWeeklyHours: 40,
      maxWeeklyHours: 40,
      lastActiveAt: null,
      qualifications: [],
      locationIds: [],
      roles: ["super_admin"],
    };
    await client.query("begin");
    await client.query("select set_config('app.auth_lookup', '1', true)");
    await client.query(
      `insert into organizations (id, name) values ($1, $2)
       on conflict (id) do update set name = excluded.name, updated_at = now()`,
      [organizationId, organizationName],
    );
    await client.query(
      `insert into organization_runtime (organization_id, version) values ($1, 1)
       on conflict (organization_id) do nothing`,
      [organizationId],
    );
    await client.query(
      `insert into profiles (id, organization_id, email, password_hash, employee_type, role, pay_type, hourly_rate, payload)
       values ($1, $2, $3, $4, 'staff', 'super_admin', 'salary', null, $5::jsonb)`,
      [userId, organizationId, email, passwordHash, JSON.stringify(payload)],
    );
    await client.query("commit");
    console.log("Admin created.");
    console.log(`organizationId=${organizationId}`);
    console.log(`userId=${userId}`);
    console.log(`email=${email}`);
    console.log("Sign in, then rotate the password.");
  } catch {
    await client.query("rollback").catch(() => undefined);
    console.error("Could not create admin.");
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
