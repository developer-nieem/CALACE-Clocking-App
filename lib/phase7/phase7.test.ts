import { describe, expect, it } from "vitest";
import { ORG_ID } from "@/lib/constants";
import { allowDemoSeed } from "@/lib/env";
import { memoryRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { claimOpenShift } from "@/lib/scheduling/engine";
import { clockIn, type ClockState } from "@/lib/time-clock/service";
import {
  buildGoLiveChecklist,
  classifyReadiness,
  compareParity,
  concurrentOpenShiftClaims,
  countWorkforce,
  crossTenantAccessDenied,
  demoSeedAllowed,
  e2eMoneyTotals,
  featureAwareStatus,
  filterTenantRows,
  jsonStoreStatus,
  jsonWritesEnabled,
  memoryJobLock,
  nextAllocatedInvoiceNumber,
  onlyOneOpenEntry,
  paginate,
  parityHasLoss,
  simulateConcurrentClockIn,
  TENANT_FIXTURE,
  userFacingDatabaseError,
} from "@/lib/phase7/domain";
import { formatMigrationReport, planJsonToRelationalMigration } from "@/lib/phase7/migrate";
import { calendarRetryAction } from "@/lib/calendar/provider";
import { executionKey, planAutomationRun } from "@/lib/phase4/automations";
import type { OpenShiftRequest, Profile, Shift, TimeEntry } from "@/types";

const settings = {
  currencyCode: "USD",
  timezone: "America/Los_Angeles",
  requireLocationClockIn: false,
  requireLocationClockOut: false,
      geofenceEnforcement: "disabled" as const,
  allowUnscheduledClockIn: true,
  clockInEarlyMinutes: 15,
  clockInLateGraceMinutes: 8,
  earlyClockInPolicy: "warning" as const,
  missingClockOutHours: 14,
  dailyOvertimeEnabled: false,
  dailyOvertimeThresholdHours: 8,
  weeklyOvertimeEnabled: true,
  weeklyOvertimeThresholdHours: 40,
  overtimeMultiplier: 1.5,
  employeesCanViewEstimatedEarnings: true,
};

function profile(id: string, organizationId = TENANT_FIXTURE.orgA.id): Profile {
  return {
    id,
    organizationId,
    email: `${id}@example.com`,
    firstName: id,
    lastName: "Test",
    phone: null,
    avatarUrl: null,
    employeeType: "staff",
    positionId: null,
    departmentId: null,
    primaryLocationId: null,
    employmentStatus: "active",
    hireDate: "2026-01-01",
    payType: "hourly",
    hourlyRate: 25,
    weeklyTargetHours: 40,
    maximumWeeklyHours: 40,
    defaultWeeklyHours: 40,
    maxWeeklyHours: 40,
    lastActiveAt: null,
    qualifications: [],
    locationIds: [],
    roles: ["staff"],
  };
}

function entry(userId: string, open = true): TimeEntry {
  return {
    id: crypto.randomUUID(),
    organizationId: TENANT_FIXTURE.orgA.id,
    userId,
    shiftId: null,
    workDate: "2026-10-01",
    clockInAt: "2026-10-01T16:00:00.000Z",
    clockOutAt: open ? null : "2026-10-02T00:00:00.000Z",
    clockInLatitude: null,
    clockInLongitude: null,
    clockInAccuracy: null,
    clockOutLatitude: null,
    clockOutLongitude: null,
    clockOutAccuracy: null,
    clockInLocationId: null,
    clockOutLocationId: null,
    clockInDistanceMeters: null,
    clockOutDistanceMeters: null,
    clockInGeofenceStatus: "not_required",
    clockOutGeofenceStatus: null,
    status: open ? "working" : "completed",
    clockStatus: "unscheduled",
    payRateSnapshot: 25,
    notes: null,
    createdAt: "2026-10-01T16:00:00.000Z",
    updatedAt: "2026-10-01T16:00:00.000Z",
  };
}

describe("Phase 7 cutover", () => {
  it("plans a dry-run migration with counts and no writes", () => {
    const state = {
      profiles: [profile("a"), profile("b")],
      shifts: [{ instructorIds: ["a", "b"] }],
      timeEntries: [entry("a", false)],
      tasks: [{ id: "t1" }],
      facilities: [{ id: "f1" }],
      invoices: [{ id: "i1" }],
      notifications: [{ id: "n1" }],
      activity: [{ id: "l1" }],
      payRates: [{ id: "r1" }],
      facilityBillingRates: [{ id: "br1" }],
    };
    const plan = planJsonToRelationalMigration(state as never, { dryRun: true, organizationCount: 1 });
    expect(plan.writes).toBe(0);
    expect(plan.counts.profiles).toBe(2);
    expect(plan.counts.assignments).toBe(2);
    expect(formatMigrationReport(plan)).toContain("DRY RUN");
    expect(countWorkforce(state).timeEntries).toBe(1);
  });

  it("flags JSON vs SQL parity differences", () => {
    const rows = compareParity(
      { users: 12, shifts: 10, timeEntries: 8, hours: 7.5, payroll: 187.5, billing: 300 },
      { users: 12, shifts: 10, timeEntries: 8, hours: 7.5, payroll: 187.5, billing: 300 },
    );
    expect(parityHasLoss(rows)).toBe(false);
    expect(compareParity({ users: 12 }, { users: 11 })[0].delta).toBe(-1);
  });

  it("treats JSON writes as dual-write unless explicitly disabled", () => {
    expect(jsonWritesEnabled({ CALACE_JSON_WRITES: "false" })).toBe(false);
    expect(jsonStoreStatus({ CALACE_JSON_WRITES: "false" })).toBe("read_only");
    expect(jsonStoreStatus({})).toBe("dual_write");
  });

  it("accepts only one concurrent clock-in per user", () => {
    const first = entry("staff-1");
    const second = entry("staff-1");
    const result = simulateConcurrentClockIn([], [first, second]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(onlyOneOpenEntry([...result.accepted], "staff-1")).toBe(true);
  });

  it("clock-in domain rejects a second active entry", () => {
    const actor = profile("staff-1");
    const location = { latitude: 34, longitude: -118, accuracy: 10, timestamp: 1 };
    const state: ClockState = {
      profiles: [actor],
      shifts: [],
      timeEntries: [],
      timeBreaks: [],
      timeEntryEdits: [],
      payRates: [],
      activity: [],
      locations: [],
      settings: { ...settings, geofenceEnforcement: "disabled" },
    };
    clockIn(state, actor.id, { location, now: new Date("2026-10-01T16:00:00.000Z") });
    expect(() => clockIn(state, actor.id, { location, now: new Date("2026-10-01T16:01:00.000Z") })).toThrow(
      /already clocked in/i,
    );
  });

  it("lets only one employee claim the last open-shift slot", () => {
    const shift: Shift = {
      id: "s1",
      organizationId: TENANT_FIXTURE.orgA.id,
      templateId: null,
      title: "Open",
      date: "2026-10-01",
      startTime: "09:00",
      endTime: "17:00",
      breakDurationMinutes: 30,
      locationId: null,
      facilityId: null,
      departmentId: null,
      classCohort: null,
      positionId: null,
      qualificationIds: [],
      notes: null,
      color: "#0D2A43",
      status: "published",
      isOpen: true,
      requiredInstructors: 1,
      approvalRequired: false,
      instructorIds: [],
      tasks: [],
      createdBy: "admin",
    };
    const a = profile("emp-a");
    const b = profile("emp-b");
    const first = claimOpenShift({ shift, employee: a, requests: [] });
    expect(first.ok).toBe(true);
    const claimed: OpenShiftRequest[] = [
      { id: "r1", shiftId: shift.id, userId: a.id, status: "approved", requestedAt: "2026-10-01T00:00:00.000Z" },
    ];
    shift.instructorIds = [a.id];
    const second = claimOpenShift({ shift, employee: b, requests: claimed });
    expect(second.ok).toBe(false);
    const concurrent = concurrentOpenShiftClaims({ shift: { ...shift, instructorIds: [], isOpen: true }, employees: [a, b], requests: [] });
    expect(concurrent.winners).toHaveLength(1);
    expect(concurrent.losers).toHaveLength(1);
  });

  it("denies cross-tenant profile and time-entry access", () => {
    expect(crossTenantAccessDenied(TENANT_FIXTURE.orgA.id, TENANT_FIXTURE.orgB.id)).toBe(true);
    const rows = filterTenantRows(
      [
        { organizationId: TENANT_FIXTURE.orgA.id, id: "1" },
        { organizationId: TENANT_FIXTURE.orgB.id, id: "2" },
      ],
      TENANT_FIXTURE.orgA.id,
    );
    expect(rows).toHaveLength(1);
  });

  it("rate-limits independent keys in memory and supports distributed keying", () => {
    const key = rateLimitKey(["clock", "org-a", "user-1", String(Date.now())]);
    expect(memoryRateLimit(key, 2, 60_000).success).toBe(true);
    expect(memoryRateLimit(key, 2, 60_000).success).toBe(true);
    expect(memoryRateLimit(key, 2, 60_000).success).toBe(false);
  });

  it("allocates sequential invoice numbers and maps unique violations", () => {
    expect(nextAllocatedInvoiceNumber(2026, 1)).toBe("INV-2026-0001");
    expect(userFacingDatabaseError({ code: "23505", message: "duplicate key one_open_shift_claim" })).toBe(
      "This shift has already been claimed.",
    );
    expect(userFacingDatabaseError({ message: "invalid_grant" })).toMatch(/calendar connection expired/i);
    expect(userFacingDatabaseError({ code: "ECONNREFUSED", message: "connect ECONNREFUSED 127.0.0.1:5433" })).toMatch(
      /npm run db:up/i,
    );
  });

  it("does not seed demo users in production unless explicitly enabled", () => {
    expect(demoSeedAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(allowDemoSeed()).toBe(process.env.CALACE_SEED_DEMO === "true" || process.env.NODE_ENV !== "production");
  });

  it("skips duplicate automation executions with the same key", () => {
    const key = executionKey("auto-1", "shift-1", "2026-10-01T16:00:00.000Z");
    const planned = planAutomationRun({
      automation: {
        id: "auto-1",
        organizationId: ORG_ID,
        name: "Reminder",
        description: null,
        triggerType: "shift_starting",
        conditions: [],
        actions: [{ type: "notify_employee", message: "Soon" }],
        isEnabled: true,
        createdBy: null,
        lastRunAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      context: { entityId: "shift-1", eventTime: "2026-10-01T16:00:00.000Z" },
      existingKeys: [key],
      now: "2026-10-01T15:30:00.000Z",
    });
    expect(planned.status).toBe("skipped");
    const lock = memoryJobLock();
    expect(lock.acquire("cron:automations")).toBe(true);
    expect(lock.acquire("cron:automations")).toBe(false);
  });

  it("avoids duplicate calendar events on retry", () => {
    expect(calendarRetryAction({ failed: true, existingExternalId: "evt-1" })).toBe("update");
    expect(calendarRetryAction({ failed: true })).toBe("create");
    expect(calendarRetryAction({ failed: false })).toBe("skip");
  });

  it("paginates large lists and matches the 7.5h money scenario", () => {
    const page = paginate(Array.from({ length: 120 }, (_, index) => index), 2, 50);
    expect(page.items).toHaveLength(50);
    expect(page.pageCount).toBe(3);
    expect(e2eMoneyTotals()).toEqual({ hours: 7.5, payroll: 187.5, billing: 300, margin: 112.5 });
  });

  it("classifies readiness without calling the system production ready on tests alone", () => {
    const staging = classifyReadiness({
      typecheck: true,
      lint: true,
      unitTests: true,
      build: true,
      relationalRuntime: true,
      rlsLiveVerified: false,
      e2eCritical: false,
      gpsUat: false,
      cronVerified: false,
      liveIntegrationsVerified: false,
      uatSigned: false,
      remainingCritical: 0,
    });
    expect(staging.classification).toBe("STAGING READY");
    expect(featureAwareStatus(true, false)).toBe("Misconfigured");
    expect(featureAwareStatus(false, false)).toBe("Not Enabled");
    const items = buildGoLiveChecklist({
      database: true,
      relationalRuntime: true,
      jsonWrites: true,
      rlsVerified: false,
      adminAccount: true,
      distributedLimiter: false,
      cron: true,
      email: false,
      backupDocumented: true,
      demoSeedDisabled: true,
    });
    expect(items.find((item) => item.id === "json")?.status).toBe("warn");
  });
});
