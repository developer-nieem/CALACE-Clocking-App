import { createHash, randomBytes } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { DEMO_PASSWORD, ORG_ID } from "@/lib/constants";
import { getOrganizationContext } from "@/lib/auth/org-context";
import { allowDemoSeed, jsonWritesEnabled } from "@/lib/env";
import { userFacingDatabaseError } from "@/lib/phase7/domain";
import {
  departments,
  locations,
  positions,
  profiles as seededAccounts,
  qualifications,
} from "@/lib/demo/data";
import { buildSeedState } from "@/lib/demo/store";
import { primaryRole } from "@/lib/permissions";
import { emptyPhase5 } from "@/lib/phase5/domain";
import { schemaSql } from "@/lib/db/schema-sql";
import type { WorkforceState } from "@/lib/db/workforce";
import type {
  ActivityLog,
  AttendanceException,
  Automation,
  AutomationRun,
  AvailabilityException,
  AvailabilityRule,
  CalendarConnection,
  CalendarEventMapping,
  CalendarFeed,
  ChatMessage,
  ChatRoom,
  Department,
  EmployeeDocument,
  EmployeePayRate,
  Location,
  NotificationDelivery,
  NotificationItem,
  NotificationPreference,
  OpenShiftRequest,
  OrganizationSettings,
  Position,
  Profile,
  Qualification,
  ScheduleOverride,
  ScheduleRecommendation,
  Shift,
  ShiftCallout,
  ShiftConfirmation,
  ShiftSeries,
  ShiftTemplate,
  ShiftTradeRequest,
  TaskItem,
  TimeBreak,
  TimeEntry,
  TimeEntryEdit,
  TimeOffRequest,
} from "@/types";

const ORG_NAME = "CAL ACE Team";

type QueryClient = Pick<PoolClient, "query">;

let pool: Pool | undefined;
let ready: Promise<void> | undefined;
let defaultPasswordHash: Promise<string> | undefined;

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add the Neon connection string on Vercel.");
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 10,
      ssl: connectionString.includes("neon.tech") ? { rejectUnauthorized: true } : undefined,
    });
  }
  return pool;
}

export async function pingDatabase() {
  await getPool().query("select 1");
}

function defaultHash() {
  defaultPasswordHash ??= hashPassword(DEMO_PASSWORD);
  return defaultPasswordHash;
}

function userFacingError(error: unknown) {
  const friendly = userFacingDatabaseError(error);
  if (friendly) return new Error(friendly);
  return error;
}

async function withSystemClient<T>(fn: (client: PoolClient) => Promise<T>) {
  let client: PoolClient;
  try {
    client = await getPool().connect();
  } catch (error) {
    throw userFacingError(error);
  }
  try {
    await client.query("begin");
    await client.query("select set_config('app.auth_lookup', '1', true)");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      /* connection already lost */
    }
    throw userFacingError(error);
  } finally {
    client.release();
  }
}

async function withOrg<T>(fn: (client: PoolClient, organizationId: string) => Promise<T>, organizationId?: string) {
  const orgId = organizationId ?? getOrganizationContext()?.organizationId;
  if (!orgId) {
    throw new Error("Organization context is required.");
  }
  let client: PoolClient;
  try {
    client = await getPool().connect();
  } catch (error) {
    throw userFacingError(error);
  }
  try {
    await client.query("begin");
    await client.query("select set_config('app.organization_id', $1, true)", [orgId]);
    const result = await fn(client, orgId);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      /* connection already lost */
    }
    throw userFacingError(error);
  } finally {
    client.release();
  }
}

export function ensureDatabase() {
  if (!ready) {
    ready = prepareDatabase().catch((error: unknown) => {
      ready = undefined;
      throw error;
    });
  }
  return ready;
}

async function schemaReady() {
  const result = await getPool().query<{ name: string | null }>("select to_regclass('public.profiles') as name");
  return Boolean(result.rows[0]?.name);
}

async function applySchema() {
  const database = getPool();
  try {
    await database.query(schemaSql);
  } catch {
    const statements = schemaSql
      .split(/;\s*\n/)
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await database.query(statement);
    }
  }
}

async function prepareDatabase() {
  if (!(await schemaReady())) {
    await applySchema();
  }
  await withOrg(async (client) => {
    await client.query("select pg_advisory_xact_lock(7042001)");
    const existing = await client.query<{ n: number }>("select count(*)::int as n from profiles");
    if ((existing.rows[0]?.n ?? 0) > 0) return;
    if (!allowDemoSeed()) return;
    await seedDatabase(client);
  }, ORG_ID);
}

async function seedDatabase(client: PoolClient) {
  const seeded = buildSeedState();
  const state: WorkforceState = {
    ...seeded,
    locations: structuredClone(locations),
    departments: structuredClone(departments),
    positions: structuredClone(positions),
    qualifications: structuredClone(qualifications),
  };
  const hashes = new Map<string, string>();
  for (const account of seededAccounts) {
    hashes.set(account.id, await hashPassword(account.password));
  }
  await client.query(
    `insert into organizations (id, name, timezone, currency_code)
     values ($1, $2, $3, $4)
     on conflict (id) do update set
       name = excluded.name,
       timezone = excluded.timezone,
       currency_code = excluded.currency_code,
       updated_at = now()`,
    [ORG_ID, ORG_NAME, state.settings.timezone, state.settings.currencyCode],
  );
  await client.query(
    `insert into workforce_meta (id, version)
     values (1, 1)
     on conflict (id) do update set version = 1, updated_at = now()`,
  );
  await writeState(client, state, hashes, ORG_ID);
  await client.query(
    `insert into organization_runtime (organization_id, version)
     values ($1, 1)
     on conflict (organization_id) do update set version = 1, updated_at = now()`,
    [ORG_ID],
  );
}

export async function loadWorkforce(organizationId?: string) {
  await ensureDatabase();
  return withOrg(async (client, orgId) => {
    await client.query(
      `insert into organization_runtime (organization_id, version, json_writes_enabled, json_store_status)
       values ($1, 1, true, 'dual_write')
       on conflict (organization_id) do nothing`,
      [orgId],
    );
    const versionResult = await client.query<{ version: number }>(
      "select version from organization_runtime where organization_id = $1",
      [orgId],
    );
    const version = versionResult.rows[0]?.version ?? 1;
    const profileRows = await client.query<{ payload: Profile }>(
      "select payload from profiles order by payload->>'lastName'",
    );
    const locationRows = await client.query<LocationRow>("select * from locations order by name");
    const departmentRows = await client.query<{ id: string; name: string }>(
      "select id, name from departments order by name",
    );
    const positionRows = await client.query<{ id: string; name: string }>(
      "select id, name from positions order by name",
    );
    const qualificationRows = await client.query<Qualification>(
      "select id, name, slug from qualifications order by name",
    );
    const settingsRows = await client.query<{ settings: OrganizationSettings }>(
      "select settings from organization_settings where organization_id = $1",
      [orgId],
    );
    const shiftRows = await client.query<{ payload: Shift }>(
      "select payload from shifts order by work_date, payload->>'startTime'",
    );
    const collectionRows = await client.query<{ collection: string; payload: unknown }>(
      "select collection, payload from collection_items where organization_id = $1",
      [orgId],
    );
    const entryRows = await client.query<TimeEntryRow>(
      "select * from time_entries order by clock_in_at desc",
    );
    const breakRows = await client.query<TimeBreakRow>(
      "select * from time_breaks order by break_start_at",
    );
    const editRows = await client.query<TimeEditRow>(
      "select * from time_entry_edits order by created_at desc",
    );
    const rateRows = await client.query<PayRateRow>(
      "select * from employee_pay_rates order by effective_from",
    );

    const collections = new Map<string, unknown[]>();
    for (const row of collectionRows.rows) {
      const list = collections.get(row.collection) ?? [];
      list.push(row.payload);
      collections.set(row.collection, list);
    }

    const state: WorkforceState = {
      profiles: profileRows.rows.map((row) => row.payload),
      shifts: shiftRows.rows.map((row) => row.payload),
      templates: (collections.get("templates") ?? []) as ShiftTemplate[],
      availability: (collections.get("availability") ?? []) as AvailabilityRule[],
      timeOff: (collections.get("timeOff") ?? []) as TimeOffRequest[],
      timeEntries: entryRows.rows.map(mapTimeEntry),
      timeBreaks: breakRows.rows.map(mapTimeBreak),
      timeEntryEdits: editRows.rows.map(mapTimeEdit),
      payRates: rateRows.rows.map(mapPayRate),
      settings: settingsRows.rows[0]?.settings ?? {
        currencyCode: "USD",
        timezone: "America/Los_Angeles",
        requireLocationClockIn: true,
        requireLocationClockOut: true,
        geofenceEnforcement: "warning",
        allowUnscheduledClockIn: true,
        clockInEarlyMinutes: 15,
        clockInLateGraceMinutes: 5,
        earlyClockInPolicy: "warning",
        missingClockOutHours: 16,
        dailyOvertimeEnabled: false,
        dailyOvertimeThresholdHours: 8,
        weeklyOvertimeEnabled: true,
        weeklyOvertimeThresholdHours: 40,
        overtimeMultiplier: 1.5,
        employeesCanViewEstimatedEarnings: true,
      },
      tasks: (collections.get("tasks") ?? []) as TaskItem[],
      openShiftRequests: (collections.get("openShifts") ?? []) as OpenShiftRequest[],
      trades: (collections.get("trades") ?? []) as ShiftTradeRequest[],
      notifications: (collections.get("notifications") ?? []) as NotificationItem[],
      activity: (collections.get("activity") ?? []) as ActivityLog[],
      availabilityExceptions: (collections.get("availabilityExceptions") ?? []) as AvailabilityException[],
      shiftSeries: (collections.get("shiftSeries") ?? []) as ShiftSeries[],
      scheduleOverrides: (collections.get("scheduleOverrides") ?? []) as ScheduleOverride[],
      chatRooms: (collections.get("chatRooms") ?? []) as ChatRoom[],
      chatMessages: (collections.get("chatMessages") ?? []) as ChatMessage[],
      documents: (collections.get("documents") ?? []) as EmployeeDocument[],
      calendarConnections: (collections.get("calendarConnections") ?? []) as CalendarConnection[],
      calendarFeeds: (collections.get("calendarFeeds") ?? []) as CalendarFeed[],
      notificationPreferences: (collections.get("notificationPreferences") ?? []) as NotificationPreference[],
      automations: (collections.get("automations") ?? []) as Automation[],
      automationRuns: (collections.get("automationRuns") ?? []) as AutomationRun[],
      attendanceExceptions: (collections.get("attendanceExceptions") ?? []) as AttendanceException[],
      shiftCallouts: (collections.get("shiftCallouts") ?? []) as ShiftCallout[],
      notificationDeliveries: (collections.get("notificationDeliveries") ?? []) as NotificationDelivery[],
      scheduleRecommendations: (collections.get("scheduleRecommendations") ?? []) as ScheduleRecommendation[],
      calendarEventMappings: (collections.get("calendarEventMappings") ?? []) as CalendarEventMapping[],
      shiftConfirmations: (collections.get("shiftConfirmations") ?? []) as ShiftConfirmation[],
      ...emptyPhase5(),
      ...Object.fromEntries(
        Object.keys(emptyPhase5()).map((key) => [key, collections.get(key) ?? emptyPhase5()[key as keyof ReturnType<typeof emptyPhase5>]]),
      ),
      locations: locationRows.rows.map(mapLocation),
      departments: departmentRows.rows as Department[],
      positions: positionRows.rows as Position[],
      qualifications: qualificationRows.rows,
    };
    return { state, version };
  }, organizationId);
}

export async function saveWorkforce(
  state: WorkforceState,
  version: number,
  organizationId?: string,
  passwordHashes?: Map<string, string>,
) {
  await ensureDatabase();
  return withOrg(async (client, orgId) => {
    const updated = await client.query(
      `update organization_runtime
       set version = version + 1, updated_at = now()
       where organization_id = $1 and version = $2`,
      [orgId, version],
    );
    if (updated.rowCount !== 1) return false;
    await writeState(client, state, passwordHashes ?? new Map(), orgId);
    return true;
  }, organizationId);
}

async function writeState(
  client: QueryClient,
  state: WorkforceState,
  passwordHashes: Map<string, string>,
  organizationId: string,
) {
  const fallbackHash = await defaultHash();
  const profiles = state.profiles.map((profile) => ({
    ...profile,
    organizationId: profile.organizationId || organizationId,
    role: primaryRole(profile.roles),
    passwordHash: passwordHashes.get(profile.id) ?? null,
  }));

  await client.query("delete from time_entry_edits where organization_id = $1", [organizationId]);
  await client.query("delete from time_breaks where organization_id = $1", [organizationId]);
  await client.query("delete from time_entries where organization_id = $1", [organizationId]);
  await client.query("delete from employee_pay_rates where organization_id = $1", [organizationId]);
  await client.query("delete from shifts where organization_id = $1", [organizationId]);
  if (jsonWritesEnabled()) {
    await client.query("delete from collection_items where organization_id = $1", [organizationId]);
  }
  await client.query("delete from locations where organization_id = $1", [organizationId]);
  await client.query("delete from departments where organization_id = $1", [organizationId]);
  await client.query("delete from positions where organization_id = $1", [organizationId]);
  await client.query("delete from qualifications where organization_id = $1", [organizationId]);

  await client.query(
    `insert into organizations (id, name, timezone, currency_code)
     values ($1, $2, $3, $4)
     on conflict (id) do update set
       timezone = excluded.timezone,
       currency_code = excluded.currency_code,
       updated_at = now()`,
    [organizationId, ORG_NAME, state.settings.timezone, state.settings.currencyCode],
  );
  await client.query(
    `insert into organization_settings (organization_id, currency_code, timezone, settings)
     values ($1, $2, $3, $4::jsonb)
     on conflict (organization_id) do update set
       currency_code = excluded.currency_code,
       timezone = excluded.timezone,
       settings = excluded.settings`,
    [
      organizationId,
      state.settings.currencyCode,
      state.settings.timezone,
      JSON.stringify(state.settings),
    ],
  );

  await client.query(
    `create temp table incoming_profiles (
       id text,
       organization_id text,
       email text,
       password_hash text,
       employee_type text,
       role text,
       pay_type text,
       hourly_rate numeric(10, 2),
       payload jsonb
     ) on commit drop`,
  );
  await client.query(
    `insert into incoming_profiles (
       id, organization_id, email, password_hash, employee_type, role, pay_type, hourly_rate, payload
     )
     select
       item->>'id',
       item->>'organizationId',
       lower(item->>'email'),
       nullif(item->>'passwordHash', ''),
       item->>'employeeType',
       item->>'role',
       item->>'payType',
       nullif(item->>'hourlyRate', '')::numeric(10, 2),
       item - 'passwordHash' - 'role'
     from jsonb_array_elements($1::jsonb) as item`,
    [JSON.stringify(profiles)],
  );
  await client.query(
    `update profiles as saved
     set organization_id = incoming.organization_id,
         email = incoming.email,
         password_hash = coalesce(incoming.password_hash, saved.password_hash),
         employee_type = incoming.employee_type,
         role = incoming.role,
         pay_type = incoming.pay_type,
         hourly_rate = incoming.hourly_rate,
         payload = incoming.payload,
         updated_at = now()
     from incoming_profiles as incoming
     where saved.id = incoming.id`,
  );
  await client.query(
    `insert into profiles (
       id, organization_id, email, password_hash, employee_type, role, pay_type, hourly_rate, payload
     )
     select
       incoming.id,
       incoming.organization_id,
       incoming.email,
       coalesce(incoming.password_hash, $1),
       incoming.employee_type,
       incoming.role,
       incoming.pay_type,
       incoming.hourly_rate,
       incoming.payload
     from incoming_profiles as incoming
     where not exists (select 1 from profiles as saved where saved.id = incoming.id)`,
    [fallbackHash],
  );
  await client.query(
    `delete from profiles
     where organization_id = $1
       and id not in (select item->>'id' from jsonb_array_elements($2::jsonb) as item)`,
    [organizationId, JSON.stringify(profiles)],
  );

  await insertJson(client, state.locations, locationInsertSql, true, organizationId);
  await insertJson(client, state.departments, departmentInsertSql, true, organizationId);
  await insertJson(client, state.positions, positionInsertSql, true, organizationId);
  await insertJson(client, state.qualifications, qualificationInsertSql, true, organizationId);
  await insertJson(client, state.shifts, shiftInsertSql);
  if (jsonWritesEnabled()) {
    await insertCollection(client, "templates", state.templates, organizationId);
    await insertCollection(client, "availability", state.availability, organizationId);
    await insertCollection(client, "timeOff", state.timeOff, organizationId);
    await insertCollection(client, "tasks", state.tasks, organizationId);
    await insertCollection(client, "openShifts", state.openShiftRequests, organizationId);
    await insertCollection(client, "trades", state.trades, organizationId);
    await insertCollection(client, "notifications", state.notifications, organizationId);
    await insertCollection(client, "activity", state.activity, organizationId);
    await insertCollection(client, "availabilityExceptions", state.availabilityExceptions ?? [], organizationId);
    await insertCollection(client, "shiftSeries", state.shiftSeries ?? [], organizationId);
    await insertCollection(client, "scheduleOverrides", state.scheduleOverrides ?? [], organizationId);
    await insertCollection(client, "chatRooms", state.chatRooms ?? [], organizationId);
    await insertCollection(client, "chatMessages", state.chatMessages ?? [], organizationId);
    await insertCollection(client, "documents", state.documents ?? [], organizationId);
    await insertCollection(client, "calendarConnections", state.calendarConnections ?? [], organizationId);
    await insertCollection(client, "calendarFeeds", state.calendarFeeds ?? [], organizationId);
    await insertCollection(client, "notificationPreferences", state.notificationPreferences ?? [], organizationId);
    await insertCollection(client, "automations", state.automations ?? [], organizationId);
    await insertCollection(client, "automationRuns", state.automationRuns ?? [], organizationId);
    await insertCollection(client, "attendanceExceptions", state.attendanceExceptions ?? [], organizationId);
    await insertCollection(client, "shiftCallouts", state.shiftCallouts ?? [], organizationId);
    await insertCollection(client, "notificationDeliveries", state.notificationDeliveries ?? [], organizationId);
    await insertCollection(client, "scheduleRecommendations", state.scheduleRecommendations ?? [], organizationId);
    await insertCollection(client, "calendarEventMappings", state.calendarEventMappings ?? [], organizationId);
    await insertCollection(client, "shiftConfirmations", state.shiftConfirmations ?? [], organizationId);
    const phase5 = emptyPhase5();
    for (const key of Object.keys(phase5) as Array<keyof typeof phase5>) {
      await insertCollection(client, key, (state[key] as Array<{ id: string }> | undefined) ?? [], organizationId);
    }
  }
  await insertJson(client, state.timeEntries, timeEntryInsertSql);
  await insertJson(client, state.timeBreaks, timeBreakInsertSql);
  await insertJson(client, state.timeEntryEdits, timeEditInsertSql);
  await insertJson(client, state.payRates, payRateInsertSql);
  await dualWriteTyped(client, state, organizationId);
}

async function insertJson(
  client: QueryClient,
  rows: unknown[],
  sql: string,
  includeOrganization = false,
  organizationId?: string,
) {
  if (rows.length === 0) return;
  await client.query(
    sql,
    includeOrganization ? [JSON.stringify(rows), organizationId] : [JSON.stringify(rows)],
  );
}

async function insertCollection(
  client: QueryClient,
  collection: string,
  rows: Array<{ id: string }>,
  organizationId: string,
) {
  if (rows.length === 0) return;
  await client.query(
    `insert into collection_items (organization_id, collection, id, payload)
     select $1, $2, item->>'id', item
     from jsonb_array_elements($3::jsonb) as item`,
    [organizationId, collection, JSON.stringify(rows)],
  );
}

async function dualWriteTyped(client: QueryClient, state: WorkforceState, organizationId: string) {
  await client.query("delete from audit_logs where organization_id = $1", [organizationId]);
  if (state.activity.length) {
    await client.query(
      `insert into audit_logs (id, organization_id, actor_id, action, entity_type, entity_id, payload, created_at)
       select
         item->>'id',
         $1,
         nullif(item->>'actorId', ''),
         coalesce(item->>'action', 'activity'),
         coalesce(item->>'entityType', 'unknown'),
         nullif(item->>'entityId', ''),
         item,
         coalesce((item->>'createdAt')::timestamptz, now())
       from jsonb_array_elements($2::jsonb) as item
       on conflict (id) do nothing`,
      [organizationId, JSON.stringify(state.activity)],
    );
  }
  if (state.payPeriods?.length) {
    await client.query("delete from pay_periods where organization_id = $1", [organizationId]);
    await client.query(
      `insert into pay_periods (id, organization_id, start_date, end_date, status, locked_at, locked_by, created_at, updated_at)
       select
         item->>'id',
         $1,
         (item->>'startDate')::date,
         (item->>'endDate')::date,
         item->>'status',
         nullif(item->>'lockedAt', '')::timestamptz,
         nullif(item->>'lockedBy', ''),
         coalesce((item->>'createdAt')::timestamptz, now()),
         now()
       from jsonb_array_elements($2::jsonb) as item
       on conflict (id) do update set
         status = excluded.status,
         locked_at = excluded.locked_at,
         locked_by = excluded.locked_by,
         updated_at = now()`,
      [organizationId, JSON.stringify(state.payPeriods)],
    );
  }
  if (state.facilities?.length) {
    await client.query("delete from facilities where organization_id = $1", [organizationId]);
    await client.query(
      `insert into facilities (id, organization_id, name, facility_type, status, billing_enabled, created_at, updated_at)
       select
         item->>'id',
         $1,
         item->>'name',
         coalesce(item->>'facilityType', 'other'),
         coalesce(item->>'status', 'active'),
         coalesce((item->>'billingEnabled')::boolean, false),
         coalesce((item->>'createdAt')::timestamptz, now()),
         now()
       from jsonb_array_elements($2::jsonb) as item
       on conflict (id) do update set
         name = excluded.name,
         status = excluded.status,
         billing_enabled = excluded.billing_enabled,
         updated_at = now()`,
      [organizationId, JSON.stringify(state.facilities)],
    );
  }
  if (state.invoices?.length) {
    await client.query("delete from invoice_items where organization_id = $1", [organizationId]);
    await client.query("delete from invoices where organization_id = $1", [organizationId]);
    await client.query(
      `insert into invoices (
         id, organization_id, facility_id, invoice_number, period_start, period_end,
         status, subtotal, adjustments, total, notes, created_by, created_at, updated_at
       )
       select
         item->>'id',
         $1,
         item->>'facilityId',
         item->>'invoiceNumber',
         (item->>'periodStart')::date,
         (item->>'periodEnd')::date,
         item->>'status',
         coalesce((item->>'subtotal')::numeric, 0),
         coalesce((item->>'adjustments')::numeric, 0),
         coalesce((item->>'total')::numeric, 0),
         nullif(item->>'notes', ''),
         nullif(item->>'createdBy', ''),
         coalesce((item->>'createdAt')::timestamptz, now()),
         now()
       from jsonb_array_elements($2::jsonb) as item
       on conflict (id) do update set
         status = excluded.status,
         subtotal = excluded.subtotal,
         total = excluded.total,
         updated_at = now()`,
      [organizationId, JSON.stringify(state.invoices)],
    );
  }
}

const locationInsertSql = `
  insert into locations (
    id, organization_id, name, address, latitude, longitude,
    geofence_radius_meters, geolocation_required, status, facility_id
  )
  select
    item->>'id',
    $2,
    item->>'name',
    item->>'address',
    nullif(item->>'latitude', '')::numeric(9, 6),
    nullif(item->>'longitude', '')::numeric(9, 6),
    coalesce(nullif(item->>'geofenceRadiusMeters', '')::integer, 200),
    coalesce((item->>'geolocationRequired')::boolean, false),
    coalesce(item->>'status', 'active'),
    nullif(item->>'facilityId', '')
  from jsonb_array_elements($1::jsonb) as item
`;

const departmentInsertSql = `
  insert into departments (id, organization_id, name)
  select item->>'id', $2, item->>'name'
  from jsonb_array_elements($1::jsonb) as item
`;

const positionInsertSql = `
  insert into positions (id, organization_id, name)
  select item->>'id', $2, item->>'name'
  from jsonb_array_elements($1::jsonb) as item
`;

const qualificationInsertSql = `
  insert into qualifications (id, organization_id, name, slug)
  select item->>'id', $2, item->>'name', item->>'slug'
  from jsonb_array_elements($1::jsonb) as item
`;

const shiftInsertSql = `
  insert into shifts (id, organization_id, work_date, payload)
  select item->>'id', item->>'organizationId', (item->>'date')::date, item
  from jsonb_array_elements($1::jsonb) as item
`;

const timeEntryInsertSql = `
  insert into time_entries (
    id, organization_id, user_id, shift_id, work_date, clock_in_at, clock_out_at,
    clock_in_latitude, clock_in_longitude, clock_in_accuracy,
    clock_out_latitude, clock_out_longitude, clock_out_accuracy,
    clock_in_location_id, clock_out_location_id,
    clock_in_distance_meters, clock_out_distance_meters,
    clock_in_geofence_status, clock_out_geofence_status,
    status, clock_status, pay_rate_snapshot, notes, created_at, updated_at
  )
  select
    item->>'id',
    item->>'organizationId',
    item->>'userId',
    nullif(item->>'shiftId', ''),
    (item->>'workDate')::date,
    (item->>'clockInAt')::timestamptz,
    nullif(item->>'clockOutAt', '')::timestamptz,
    nullif(item->>'clockInLatitude', '')::numeric(9, 6),
    nullif(item->>'clockInLongitude', '')::numeric(9, 6),
    nullif(item->>'clockInAccuracy', '')::numeric(12, 2),
    nullif(item->>'clockOutLatitude', '')::numeric(9, 6),
    nullif(item->>'clockOutLongitude', '')::numeric(9, 6),
    nullif(item->>'clockOutAccuracy', '')::numeric(12, 2),
    nullif(item->>'clockInLocationId', ''),
    nullif(item->>'clockOutLocationId', ''),
    nullif(item->>'clockInDistanceMeters', '')::numeric(12, 2),
    nullif(item->>'clockOutDistanceMeters', '')::numeric(12, 2),
    nullif(item->>'clockInGeofenceStatus', ''),
    nullif(item->>'clockOutGeofenceStatus', ''),
    item->>'status',
    nullif(item->>'clockStatus', ''),
    nullif(item->>'payRateSnapshot', '')::numeric(10, 2),
    nullif(item->>'notes', ''),
    (item->>'createdAt')::timestamptz,
    (item->>'updatedAt')::timestamptz
  from jsonb_array_elements($1::jsonb) as item
`;

const timeBreakInsertSql = `
  insert into time_breaks (
    id, organization_id, time_entry_id, user_id, break_start_at, break_end_at,
    break_start_latitude, break_start_longitude, break_start_accuracy,
    break_end_latitude, break_end_longitude, break_end_accuracy,
    break_minutes, created_at, updated_at
  )
  select
    item->>'id',
    item->>'organizationId',
    item->>'timeEntryId',
    item->>'userId',
    (item->>'breakStartAt')::timestamptz,
    nullif(item->>'breakEndAt', '')::timestamptz,
    nullif(item->>'breakStartLatitude', '')::numeric(9, 6),
    nullif(item->>'breakStartLongitude', '')::numeric(9, 6),
    nullif(item->>'breakStartAccuracy', '')::numeric(12, 2),
    nullif(item->>'breakEndLatitude', '')::numeric(9, 6),
    nullif(item->>'breakEndLongitude', '')::numeric(9, 6),
    nullif(item->>'breakEndAccuracy', '')::numeric(12, 2),
    nullif(item->>'breakMinutes', '')::integer,
    (item->>'createdAt')::timestamptz,
    (item->>'updatedAt')::timestamptz
  from jsonb_array_elements($1::jsonb) as item
`;

const timeEditInsertSql = `
  insert into time_entry_edits (
    id, organization_id, time_entry_id, changed_by, field_name, old_value, new_value, reason, created_at
  )
  select
    item->>'id',
    item->>'organizationId',
    item->>'timeEntryId',
    item->>'changedBy',
    item->>'fieldName',
    nullif(item->>'oldValue', ''),
    nullif(item->>'newValue', ''),
    item->>'reason',
    (item->>'createdAt')::timestamptz
  from jsonb_array_elements($1::jsonb) as item
`;

const payRateInsertSql = `
  insert into employee_pay_rates (
    id, organization_id, user_id, hourly_rate, effective_from, effective_to, created_by, created_at
  )
  select
    item->>'id',
    item->>'organizationId',
    item->>'userId',
    (item->>'hourlyRate')::numeric(10, 2),
    (item->>'effectiveFrom')::date,
    nullif(item->>'effectiveTo', '')::date,
    nullif(item->>'createdBy', ''),
    (item->>'createdAt')::timestamptz
  from jsonb_array_elements($1::jsonb) as item
`;

type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  geofence_radius_meters: number;
  geolocation_required: boolean;
  status: "active" | "inactive";
  facility_id?: string | null;
};

type TimeEntryRow = {
  id: string;
  organization_id: string;
  user_id: string;
  shift_id: string | null;
  work_date: string | Date;
  clock_in_at: string | Date;
  clock_out_at: string | Date | null;
  clock_in_latitude: string | number | null;
  clock_in_longitude: string | number | null;
  clock_in_accuracy: string | number | null;
  clock_out_latitude: string | number | null;
  clock_out_longitude: string | number | null;
  clock_out_accuracy: string | number | null;
  clock_in_location_id: string | null;
  clock_out_location_id: string | null;
  clock_in_distance_meters: string | number | null;
  clock_out_distance_meters: string | number | null;
  clock_in_geofence_status: TimeEntry["clockInGeofenceStatus"];
  clock_out_geofence_status: TimeEntry["clockOutGeofenceStatus"];
  status: TimeEntry["status"];
  clock_status: TimeEntry["clockStatus"];
  pay_rate_snapshot: string | number | null;
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type TimeBreakRow = {
  id: string;
  organization_id: string;
  time_entry_id: string;
  user_id: string;
  break_start_at: string | Date;
  break_end_at: string | Date | null;
  break_start_latitude: string | number | null;
  break_start_longitude: string | number | null;
  break_start_accuracy: string | number | null;
  break_end_latitude: string | number | null;
  break_end_longitude: string | number | null;
  break_end_accuracy: string | number | null;
  break_minutes: number | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type TimeEditRow = {
  id: string;
  organization_id: string;
  time_entry_id: string;
  changed_by: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  created_at: string | Date;
};

type PayRateRow = {
  id: string;
  organization_id: string;
  user_id: string;
  hourly_rate: string | number;
  effective_from: string | Date;
  effective_to: string | Date | null;
  created_by: string | null;
  created_at: string | Date;
};

function num(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stamp(value: string | Date | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function day(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapLocation(row: LocationRow): Location {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    geofenceRadiusMeters: row.geofence_radius_meters,
    geolocationRequired: row.geolocation_required,
    status: row.status,
    facilityId: row.facility_id ?? null,
  };
}

function mapTimeEntry(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    shiftId: row.shift_id,
    workDate: day(row.work_date),
    clockInAt: stamp(row.clock_in_at) ?? new Date(0).toISOString(),
    clockOutAt: stamp(row.clock_out_at),
    clockInLatitude: num(row.clock_in_latitude),
    clockInLongitude: num(row.clock_in_longitude),
    clockInAccuracy: num(row.clock_in_accuracy),
    clockOutLatitude: num(row.clock_out_latitude),
    clockOutLongitude: num(row.clock_out_longitude),
    clockOutAccuracy: num(row.clock_out_accuracy),
    clockInLocationId: row.clock_in_location_id,
    clockOutLocationId: row.clock_out_location_id,
    clockInDistanceMeters: num(row.clock_in_distance_meters),
    clockOutDistanceMeters: num(row.clock_out_distance_meters),
    clockInGeofenceStatus: row.clock_in_geofence_status,
    clockOutGeofenceStatus: row.clock_out_geofence_status,
    status: row.status,
    clockStatus: row.clock_status,
    payRateSnapshot: num(row.pay_rate_snapshot),
    notes: row.notes,
    createdAt: stamp(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: stamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function mapTimeBreak(row: TimeBreakRow): TimeBreak {
  return {
    id: row.id,
    organizationId: row.organization_id,
    timeEntryId: row.time_entry_id,
    userId: row.user_id,
    breakStartAt: stamp(row.break_start_at) ?? new Date(0).toISOString(),
    breakEndAt: stamp(row.break_end_at),
    breakStartLatitude: num(row.break_start_latitude),
    breakStartLongitude: num(row.break_start_longitude),
    breakStartAccuracy: num(row.break_start_accuracy),
    breakEndLatitude: num(row.break_end_latitude),
    breakEndLongitude: num(row.break_end_longitude),
    breakEndAccuracy: num(row.break_end_accuracy),
    breakMinutes: row.break_minutes,
    createdAt: stamp(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: stamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function mapTimeEdit(row: TimeEditRow): TimeEntryEdit {
  return {
    id: row.id,
    organizationId: row.organization_id,
    timeEntryId: row.time_entry_id,
    changedBy: row.changed_by,
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    reason: row.reason,
    createdAt: stamp(row.created_at) ?? new Date(0).toISOString(),
  };
}

function mapPayRate(row: PayRateRow): EmployeePayRate {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    hourlyRate: num(row.hourly_rate) ?? 0,
    effectiveFrom: day(row.effective_from),
    effectiveTo: row.effective_to ? day(row.effective_to) : null,
    createdBy: row.created_by,
    createdAt: stamp(row.created_at) ?? new Date(0).toISOString(),
  };
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function authenticate(email: string, password: string) {
  await ensureDatabase();
  return withSystemClient(async (client) => {
    const result = await client.query<{ id: string; password_hash: string; organization_id: string }>(
      "select id, password_hash, organization_id from profiles where email = lower($1) limit 1",
      [email],
    );
    const row = result.rows[0];
    if (!row) return null;
    const valid = await verifyPassword(password, row.password_hash);
    return valid ? row.id : null;
  });
}

export async function createSession(userId: string) {
  await ensureDatabase();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await withSystemClient(async (client) => {
    await client.query(
      "insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)",
      [tokenHash(token), userId, expiresAt.toISOString()],
    );
  });
  return token;
}

export async function readSessionUserId(token: string) {
  const session = await readSession(token);
  return session?.userId ?? null;
}

export async function readSession(token: string) {
  await ensureDatabase();
  return withSystemClient(async (client) => {
    const result = await client.query<{ user_id: string; organization_id: string }>(
      `select s.user_id, p.organization_id
       from sessions s
       join profiles p on p.id = s.user_id
       where s.token_hash = $1 and s.expires_at > now()`,
      [tokenHash(token)],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { userId: row.user_id, organizationId: row.organization_id };
  });
}

export async function deleteSession(token: string) {
  await ensureDatabase();
  await withSystemClient(async (client) => {
    await client.query("delete from sessions where token_hash = $1", [tokenHash(token)]);
  });
}

export async function deleteSessionsForUser(userId: string) {
  await ensureDatabase();
  await withSystemClient(async (client) => {
    await client.query("delete from sessions where user_id = $1", [userId]);
  });
}

export async function listOrganizationIds() {
  await ensureDatabase();
  return withSystemClient(async (client) => {
    const result = await client.query<{ id: string }>("select id from organizations order by created_at");
    return result.rows.map((row) => row.id);
  });
}

export async function allocateInvoiceNumber(organizationId: string, year: number) {
  await ensureDatabase();
  return withOrg(async (client) => {
    const result = await client.query<{ allocate_invoice_number: string }>(
      "select allocate_invoice_number($1, $2)",
      [organizationId, year],
    );
    return result.rows[0]?.allocate_invoice_number ?? `INV-${year}-0001`;
  }, organizationId);
}

export async function withJobLock<T>(jobName: string, ttlSeconds: number, fn: () => Promise<T>) {
  await ensureDatabase();
  const lockedBy = correlationIdSafe();
  const acquired = await withSystemClient(async (client) => {
    const result = await client.query<{ acquire_job_lock: boolean }>(
      "select acquire_job_lock($1, $2, $3)",
      [jobName, lockedBy, ttlSeconds],
    );
    return result.rows[0]?.acquire_job_lock === true;
  });
  if (!acquired) return { acquired: false as const, result: null as T | null };
  const started = new Date().toISOString();
  try {
    const result = await fn();
    await recordJobRun({
      jobName,
      status: "success",
      startedAt: started,
      recordsProcessed: typeof result === "object" && result && "ran" in result ? Number((result as { ran?: number }).ran ?? 0) : 0,
      errorCount: 0,
      correlationId: lockedBy,
    });
    return { acquired: true as const, result };
  } catch (error) {
    await recordJobRun({
      jobName,
      status: "failed",
      startedAt: started,
      recordsProcessed: 0,
      errorCount: 1,
      correlationId: lockedBy,
    });
    throw error;
  } finally {
    await withSystemClient(async (client) => {
      await client.query("delete from job_locks where job_name = $1 and locked_by = $2", [jobName, lockedBy]);
    });
  }
}

export async function recordJobRun(input: {
  jobName: string;
  status: string;
  startedAt: string;
  recordsProcessed: number;
  errorCount: number;
  correlationId: string;
  organizationId?: string;
}) {
  await ensureDatabase();
  await withSystemClient(async (client) => {
    await client.query(
      `insert into job_runs (
         id, job_name, organization_id, started_at, finished_at, status,
         records_processed, error_count, correlation_id
       ) values ($1, $2, $3, $4, now(), $5, $6, $7, $8)`,
      [
        crypto.randomUUID(),
        input.jobName,
        input.organizationId ?? null,
        input.startedAt,
        input.status,
        input.recordsProcessed,
        input.errorCount,
        input.correlationId,
      ],
    );
  });
}

export async function lastJobRun(jobName: string) {
  await ensureDatabase();
  return withSystemClient(async (client) => {
    const result = await client.query<{
      job_name: string;
      started_at: string;
      finished_at: string | null;
      status: string;
      records_processed: number;
      error_count: number;
    }>(
      `select job_name, started_at::text, finished_at::text, status, records_processed, error_count
       from job_runs
       where job_name = $1
       order by started_at desc
       limit 1`,
      [jobName],
    );
    return result.rows[0] ?? null;
  });
}

export async function createFirstAdmin(input: {
  email: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  organizationId?: string;
  passwordHash: string;
}) {
  await ensureDatabase();
  const organizationId = input.organizationId || crypto.randomUUID();
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  await withSystemClient(async (client) => {
    await client.query(
      `insert into organizations (id, name)
       values ($1, $2)
       on conflict (id) do update set name = excluded.name, updated_at = now()`,
      [organizationId, input.organizationName],
    );
    await client.query(
      `insert into organization_runtime (organization_id, version)
       values ($1, 1)
       on conflict (organization_id) do nothing`,
      [organizationId],
    );
    const payload = {
      id: userId,
      organizationId,
      email: input.email.toLowerCase(),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: null,
      avatarUrl: null,
      employeeType: "staff",
      positionId: null,
      departmentId: null,
      primaryLocationId: null,
      employmentStatus: "active",
      hireDate: now.slice(0, 10),
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
    await client.query(
      `insert into profiles (
         id, organization_id, email, password_hash, employee_type, role, pay_type, hourly_rate, payload
       ) values ($1, $2, $3, $4, 'staff', 'super_admin', 'salary', null, $5::jsonb)`,
      [userId, organizationId, input.email.toLowerCase(), input.passwordHash, JSON.stringify(payload)],
    );
  });
  return { userId, organizationId };
}

function correlationIdSafe() {
  return crypto.randomUUID();
}

