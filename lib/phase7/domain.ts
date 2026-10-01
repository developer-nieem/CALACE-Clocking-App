import { hoursToPay, roundHours, roundMoney } from "@/lib/money";
import { denyCrossTenant, isolateByOrganization } from "@/lib/phase6/domain";
import { claimOpenShift, filledSlots } from "@/lib/scheduling/engine";
import type { OpenShiftRequest, Profile, Shift, TimeEntry } from "@/types";

export type JsonStoreStatus = "dual_write" | "read_only" | "disabled";

export function jsonWritesEnabled(env: Record<string, string | undefined> = process.env) {
  return env.CALACE_JSON_WRITES !== "false";
}

export function jsonStoreStatus(env: Record<string, string | undefined> = process.env): JsonStoreStatus {
  if (env.CALACE_JSON_STORE === "disabled") return "disabled";
  if (!jsonWritesEnabled(env)) return "read_only";
  return "dual_write";
}

export function paginate<T>(rows: T[], page = 1, pageSize = 50) {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(500, Math.max(1, pageSize));
  const start = (safePage - 1) * safeSize;
  return {
    items: rows.slice(start, start + safeSize),
    total: rows.length,
    page: safePage,
    pageSize: safeSize,
    pageCount: Math.max(1, Math.ceil(rows.length / safeSize)),
  };
}

export type WorkforceCounts = {
  organizations: number;
  profiles: number;
  shifts: number;
  assignments: number;
  timeEntries: number;
  tasks: number;
  facilities: number;
  invoices: number;
  notifications: number;
  auditLogs: number;
  payRates: number;
  facilityRates: number;
};

export function countWorkforce(state: {
  profiles: Array<{ id: string }>;
  shifts: Array<{ instructorIds: string[] }>;
  timeEntries: Array<{ id: string }>;
  tasks?: Array<{ id: string }>;
  facilities?: Array<{ id: string }>;
  invoices?: Array<{ id: string }>;
  notifications?: Array<{ id: string }>;
  activity?: Array<{ id: string }>;
  payRates?: Array<{ id: string }>;
  facilityBillingRates?: Array<{ id: string }>;
}, organizations = 1): WorkforceCounts {
  return {
    organizations,
    profiles: state.profiles.length,
    shifts: state.shifts.length,
    assignments: state.shifts.reduce((sum, shift) => sum + shift.instructorIds.length, 0),
    timeEntries: state.timeEntries.length,
    tasks: state.tasks?.length ?? 0,
    facilities: state.facilities?.length ?? 0,
    invoices: state.invoices?.length ?? 0,
    notifications: state.notifications?.length ?? 0,
    auditLogs: state.activity?.length ?? 0,
    payRates: state.payRates?.length ?? 0,
    facilityRates: state.facilityBillingRates?.length ?? 0,
  };
}

export function workedHoursTotal(
  entries: Array<{ clockInAt: string; clockOutAt: string | null }>,
  breaks: Array<{ timeEntryId: string; breakStartAt: string; breakEndAt: string | null }>,
) {
  return roundHours(
    entries.reduce((sum, entry) => {
      if (!entry.clockOutAt) return sum;
      const breakSeconds = breaks
        .filter((item) => item.timeEntryId === (entry as TimeEntry).id && item.breakEndAt)
        .reduce(
          (inner, item) =>
            inner + (new Date(item.breakEndAt!).getTime() - new Date(item.breakStartAt).getTime()) / 1000,
          0,
        );
      const worked =
        (new Date(entry.clockOutAt).getTime() - new Date(entry.clockInAt).getTime()) / 3_600_000 -
        breakSeconds / 3600;
      return sum + Math.max(0, worked);
    }, 0),
  );
}

export type ParityReport = {
  field: string;
  json: number;
  sql: number;
  delta: number;
};

export function compareParity(json: Record<string, number>, sql: Record<string, number>): ParityReport[] {
  const keys = Array.from(new Set([...Object.keys(json), ...Object.keys(sql)]));
  return keys.map((field) => {
    const left = json[field] ?? 0;
    const right = sql[field] ?? 0;
    return { field, json: left, sql: right, delta: roundMoney(right - left) };
  });
}

export function parityHasLoss(rows: ParityReport[]) {
  return rows.some((row) => Math.abs(row.delta) > 0.009);
}

export function nextAllocatedInvoiceNumber(year: number, currentNext: number) {
  return `INV-${year}-${String(currentNext).padStart(4, "0")}`;
}

export function userFacingDatabaseError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: string }).message)
        : String(error);
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
  if (code === "23505" || /duplicate key|unique constraint/i.test(message)) {
    if (/one_open_time_entry|clock_out_at/i.test(message)) return "You are already clocked in.";
    if (/one_open_shift_claim|openShifts/i.test(message)) return "This shift has already been claimed.";
    if (/invoice/i.test(message)) return "This invoice number is already in use.";
    return "That record already exists.";
  }
  if (/invalid_grant|token.*expir/i.test(message)) {
    return "Your calendar connection expired. Please reconnect your calendar.";
  }
  if (/organization context is required/i.test(message)) {
    return "Your session is missing organization information. Sign in again.";
  }
  if (code === "ECONNREFUSED" || /ECONNREFUSED|the database system is starting/i.test(message)) {
    return "The local database is not running. Start it with npm run db:up, then refresh.";
  }
  return null;
}

export function memoryJobLock() {
  const locks = new Map<string, number>();
  return {
    acquire(name: string, ttlMs = 60_000, now = Date.now()) {
      const current = locks.get(name);
      if (current && current > now) return false;
      locks.set(name, now + ttlMs);
      return true;
    },
    release(name: string) {
      locks.delete(name);
    },
  };
}

export function simulateConcurrentClockIn(existing: TimeEntry[], candidates: TimeEntry[]) {
  const open = new Set(
    existing.filter((entry) => !entry.clockOutAt).map((entry) => `${entry.organizationId}:${entry.userId}`),
  );
  const accepted: TimeEntry[] = [];
  const rejected: TimeEntry[] = [];
  for (const entry of candidates) {
    const key = `${entry.organizationId}:${entry.userId}`;
    if (open.has(key)) {
      rejected.push(entry);
      continue;
    }
    open.add(key);
    accepted.push(entry);
  }
  return { accepted, rejected };
}

export function onlyOneOpenEntry(entries: TimeEntry[], userId: string) {
  return entries.filter((entry) => entry.userId === userId && !entry.clockOutAt).length <= 1;
}

export function concurrentOpenShiftClaims(input: {
  shift: Shift;
  employees: Profile[];
  requests: OpenShiftRequest[];
}) {
  const winners: string[] = [];
  const losers: string[] = [];
  let requests = [...input.requests];
  for (const employee of input.employees) {
    const decision = claimOpenShift({ shift: input.shift, employee, requests });
    if (!decision.ok) {
      losers.push(employee.id);
      continue;
    }
    if (!input.shift.approvalRequired) {
      input.shift.instructorIds.push(employee.id);
      if (input.shift.instructorIds.length >= input.shift.requiredInstructors) input.shift.isOpen = false;
    }
    requests = [
      {
        id: `req-${employee.id}`,
        shiftId: input.shift.id,
        userId: employee.id,
        status: input.shift.approvalRequired ? "pending" : "approved",
        requestedAt: new Date().toISOString(),
      },
      ...requests,
    ];
    winners.push(employee.id);
  }
  return {
    winners,
    losers,
    filled: filledSlots(input.shift, requests),
  };
}

export const TENANT_FIXTURE = {
  orgA: {
    id: "org-a-test",
    name: "CAL ACE Test A",
    admin: "admin-a",
    staff: "staff-a",
    instructor: "instructor-a",
  },
  orgB: {
    id: "org-b-test",
    name: "CAL ACE Test B",
    admin: "admin-b",
    staff: "staff-b",
    instructor: "instructor-b",
  },
};

export function crossTenantAccessDenied(actorOrgId: string, entityOrgId: string) {
  return denyCrossTenant(actorOrgId, entityOrgId);
}

export function filterTenantRows<T extends { organizationId: string }>(rows: T[], organizationId: string) {
  return isolateByOrganization(rows, organizationId);
}

export function demoSeedAllowed(env: Record<string, string | undefined> = process.env) {
  if (env.CALACE_SEED_DEMO === "false") return false;
  if (env.NODE_ENV === "production" && env.CALACE_SEED_DEMO !== "true") return false;
  return true;
}

export function e2eMoneyTotals() {
  const hours = roundHours(7.5);
  return {
    hours,
    payroll: hoursToPay(hours, 25),
    billing: hoursToPay(hours, 40),
    margin: roundMoney(hoursToPay(hours, 40) - hoursToPay(hours, 25)),
  };
}

export type GoLiveItem = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export function buildGoLiveChecklist(input: {
  database: boolean;
  relationalRuntime: boolean;
  jsonWrites: boolean;
  rlsVerified: boolean;
  adminAccount: boolean;
  distributedLimiter: boolean;
  cron: boolean;
  email: boolean;
  backupDocumented: boolean;
  demoSeedDisabled: boolean;
}) {
  const items: GoLiveItem[] = [
    { id: "database", label: "Production database", status: input.database ? "pass" : "fail", detail: input.database ? "Connected" : "Missing" },
    { id: "relational", label: "Relational runtime", status: input.relationalRuntime ? "pass" : "fail", detail: input.relationalRuntime ? "Active" : "JSON-only" },
    { id: "json", label: "JSON writes disabled", status: input.jsonWrites ? "warn" : "pass", detail: input.jsonWrites ? "Dual-write still on" : "JSON writes off" },
    { id: "rls", label: "RLS tenant test", status: input.rlsVerified ? "pass" : "warn", detail: input.rlsVerified ? "Verified" : "Not verified against two live tenants" },
    { id: "admin", label: "Admin account", status: input.adminAccount ? "pass" : "fail", detail: input.adminAccount ? "Present" : "Create with npm run admin:create" },
    { id: "limiter", label: "Distributed limiter", status: input.distributedLimiter ? "pass" : "warn", detail: input.distributedLimiter ? "Configured" : "Memory fallback" },
    { id: "cron", label: "Cron", status: input.cron ? "pass" : "warn", detail: input.cron ? "Secret set" : "Not configured" },
    { id: "email", label: "Email", status: input.email ? "pass" : "warn", detail: input.email ? "Configured" : "Not configured" },
    { id: "backup", label: "Backup configured", status: input.backupDocumented ? "pass" : "warn", detail: "See docs/BACKUP-RECOVERY.md" },
    { id: "demo", label: "Demo seeding disabled", status: input.demoSeedDisabled ? "pass" : "fail", detail: input.demoSeedDisabled ? "Off" : "Would seed demo users" },
  ];
  return items;
}

export function classifyReadiness(input: {
  typecheck: boolean;
  lint: boolean;
  unitTests: boolean;
  build: boolean;
  relationalRuntime: boolean;
  rlsLiveVerified: boolean;
  e2eCritical: boolean;
  gpsUat: boolean;
  cronVerified: boolean;
  liveIntegrationsVerified: boolean;
  uatSigned: boolean;
  remainingCritical: number;
}) {
  if (input.remainingCritical > 0 || !input.typecheck || !input.unitTests || !input.build) {
    return { classification: "BLOCKED" as const, reason: "Critical data, security, or quality failures remain." };
  }
  if (
    input.relationalRuntime &&
    input.rlsLiveVerified &&
    input.e2eCritical &&
    input.gpsUat &&
    input.cronVerified
  ) {
    if (input.liveIntegrationsVerified && input.uatSigned) {
      return {
        classification: "PRODUCTION READY" as const,
        reason: "Enabled integrations, tenant isolation, backup/rollback, and UAT all verified.",
      };
    }
    return {
      classification: "PILOT READY" as const,
      reason: "Relational runtime, RLS, critical E2E, GPS, and cron are verified for a limited controlled group.",
    };
  }
  return {
    classification: "STAGING READY" as const,
    reason: "Build and automated tests pass but production blockers, live integrations, or UAT remain.",
  };
}

export function featureAwareStatus(featureEnabled: boolean, configured: boolean) {
  if (!featureEnabled) return "Not Enabled";
  if (!configured) return "Misconfigured";
  return "Configured";
}

export function envGroup(name: string, env: Record<string, string | undefined> = process.env) {
  const core = ["DATABASE_URL", "NEXT_PUBLIC_APP_URL"];
  const production = ["CRON_SECRET", "APP_ENCRYPTION_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];
  const optional = ["RESEND_API_KEY", "GOOGLE_CLIENT_ID", "MICROSOFT_CLIENT_ID", "OPENAI_API_KEY", "SENTRY_DSN"];
  if (core.includes(name)) return "CORE REQUIRED";
  if (production.includes(name)) return "PRODUCTION REQUIRED";
  if (optional.includes(name)) return "FEATURE OPTIONAL";
  return env[name] ? "FEATURE OPTIONAL" : "UNKNOWN";
}

export function correlationId() {
  return crypto.randomUUID();
}

export function scrubSensitive(meta: Record<string, unknown>) {
  const blocked = [
    "password",
    "token",
    "secret",
    "authorization",
    "cookie",
    "refresh",
    "service_role",
    "latitude",
    "longitude",
    "gps",
    "chat",
    "pay",
    "hourly",
    "form",
  ];
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (blocked.some((name) => key.toLowerCase().includes(name))) continue;
    copy[key] = value;
  }
  return copy;
}
