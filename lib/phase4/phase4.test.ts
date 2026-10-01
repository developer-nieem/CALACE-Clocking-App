import { describe, expect, it } from "vitest";
import { ORG_ID } from "@/lib/constants";
import { hasPermission, ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  applyRecommendationAssignments,
  autoFillSchedule,
  rankEmployees,
  scheduleHealth,
  type SchedulerContext,
} from "@/lib/phase4/scheduler";
import { executionKey, planAutomationRun } from "@/lib/phase4/automations";
import type { OrganizationSettings, Profile, Shift } from "@/types";

const settings = {
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
  maximumWeeklyHours: 40,
  fairSchedulingEnabled: true,
  qualificationEnforcement: "strict",
} satisfies OrganizationSettings;

function employee(id: string, firstName: string, overrides: Partial<Profile> = {}): Profile {
  return {
    id,
    organizationId: ORG_ID,
    email: `${id}@calace.team`,
    firstName,
    lastName: "Test",
    phone: null,
    avatarUrl: null,
    employeeType: "instructor",
    positionId: "pos-theory",
    departmentId: null,
    primaryLocationId: "loc-main",
    employmentStatus: "active",
    hireDate: null,
    payType: "hourly",
    hourlyRate: 20,
    weeklyTargetHours: 32,
    maximumWeeklyHours: 40,
    defaultWeeklyHours: 32,
    maxWeeklyHours: 40,
    lastActiveAt: null,
    qualifications: ["qual-theory"],
    locationIds: ["loc-main"],
    roles: ["instructor"],
    ...overrides,
  };
}

function shift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: "shift-open",
    organizationId: ORG_ID,
    templateId: null,
    title: "CNA Theory",
    date: "2026-10-05",
    startTime: "09:00",
    endTime: "13:00",
    locationId: "loc-main",
    departmentId: null,
    classCohort: null,
    positionId: "pos-theory",
    color: "#0D2A43",
    breakDurationMinutes: 0,
    notes: null,
    status: "draft",
    isOpen: false,
    requiredInstructors: 1,
    approvalRequired: false,
    instructorIds: [],
    tasks: [],
    qualificationIds: ["qual-theory"],
    ...overrides,
  };
}

function hoursShift(id: string, userId: string, date: string): Shift {
  return shift({
    id,
    date,
    startTime: "08:00",
    endTime: "17:00",
    instructorIds: [userId],
    status: "published",
    qualificationIds: [],
  });
}

function context(extra: Partial<SchedulerContext> = {}): SchedulerContext {
  return {
    employees: [employee("maria", "Maria"), employee("emily", "Emily"), employee("john", "John")],
    shifts: [shift()],
    rules: ["maria", "emily", "john"].map((userId) => ({
      id: `rule-${userId}`,
      userId,
      weekday: 1,
      status: "available" as const,
      startTime: "08:00",
      endTime: "17:00",
      effectiveFrom: null,
      effectiveTo: null,
    })),
    exceptions: [],
    timeOff: [],
    qualifications: [{ id: "qual-theory", name: "Theory Instructor", slug: "theory" }],
    positions: [{ id: "pos-theory", name: "Theory Instructor" }],
    locations: [],
    settings,
    ...extra,
  };
}

describe("Phase 4 auto scheduler", () => {
  it("ranks the employee with fewer scheduled hours first", () => {
    const current = context({
      shifts: [
        shift(),
        hoursShift("m1", "maria", "2026-10-06"),
        hoursShift("m2", "maria", "2026-10-07"),
        hoursShift("m3", "maria", "2026-10-08"),
        hoursShift("m4", "maria", "2026-10-09"),
      ],
    });
    const ranked = rankEmployees(shift(), current).filter((item) => item.eligible);
    expect(ranked[0]?.name.startsWith("Emily") || ranked[0]?.name.startsWith("John")).toBe(true);
    expect(ranked.find((item) => item.userId === "maria")!.score).toBeLessThan(ranked[0]!.score);
    expect(ranked[0]?.reasons.join(" ")).toMatch(/hours|overtime|Available/i);
  });

  it("excludes an employee with approved time off", () => {
    const ranked = rankEmployees(
      shift(),
      context({
        timeOff: [
          {
            id: "off-1",
            userId: "emily",
            startDate: "2026-10-05",
            endDate: "2026-10-05",
            isPartialDay: false,
            startTime: null,
            endTime: null,
            reason: "Leave",
            notes: null,
            status: "approved",
          },
        ],
      }),
    );
    expect(ranked.find((item) => item.userId === "emily")?.eligible).toBe(false);
  });

  it("excludes an employee with an overlapping shift", () => {
    const ranked = rankEmployees(
      shift(),
      context({
        shifts: [shift(), shift({ id: "busy", instructorIds: ["john"], status: "published", startTime: "12:00", endTime: "16:00" })],
      }),
    );
    expect(ranked.find((item) => item.userId === "john")?.eligible).toBe(false);
  });

  it("penalizes a recommendation that crosses the weekly hour threshold", () => {
    const heavy = employee("heavy", "Heavy", { maximumWeeklyHours: 50, maxWeeklyHours: 50 });
    const current = context({
      employees: [heavy],
      shifts: [
        shift(),
        hoursShift("h1", "heavy", "2026-10-06"),
        hoursShift("h2", "heavy", "2026-10-07"),
        hoursShift("h3", "heavy", "2026-10-08"),
        hoursShift("h4", "heavy", "2026-10-09"),
        hoursShift("h5", "heavy", "2026-10-10"),
      ],
      rules: [{ id: "rule-heavy", userId: "heavy", weekday: 1, status: "available", startTime: "08:00", endTime: "17:00", effectiveFrom: null, effectiveTo: null }],
    });
    const row = rankEmployees(shift(), current)[0];
    expect(row?.warnings.join(" ")).toMatch(/overtime/i);
    expect(row?.eligible).toBe(true);
  });

  it("applies an accepted recommendation without publishing the draft", () => {
    const draft = shift();
    applyRecommendationAssignments([draft], [{ shiftId: draft.id, userId: "emily" }]);
    expect(draft.instructorIds).toEqual(["emily"]);
    expect(draft.status).toBe("draft");
  });

  it("does not assign a rejected recommendation", () => {
    const draft = shift();
    const accepted: Array<{ shiftId: string; userId: string }> = [];
    applyRecommendationAssignments([draft], accepted);
    expect(draft.instructorIds).toEqual([]);
  });

  it("reports unfilled positions in schedule health", () => {
    const health = scheduleHealth(context(), "2026-10-05", "2026-10-11");
    expect(health.unfilled).toBe(1);
    expect(health.coverage).toBe(0);
    expect(health.healthLabel).toMatch(/not an employee quality score/i);
  });

  it("returns recommendations for unassigned draft shifts", () => {
    const filled = autoFillSchedule(context(), "2026-10-05", "2026-10-11");
    expect(filled).toHaveLength(1);
    expect(filled[0]?.recommended?.reasons.length).toBeGreaterThan(0);
  });

  it("still ranks employees when no external AI provider is configured", () => {
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
    expect(rankEmployees(shift(), context()).some((item) => item.eligible)).toBe(true);
  });
});

describe("Phase 4 permissions", () => {
  it("lets a scheduler use auto fill and blocks payroll", () => {
    expect(hasPermission(["scheduler"], ROLE_PERMISSIONS.scheduler, "schedules.auto_fill")).toBe(true);
    expect(hasPermission(["scheduler"], ROLE_PERMISSIONS.scheduler, "payroll.view")).toBe(false);
    expect(hasPermission(["staff"], ROLE_PERMISSIONS.staff, "schedules.auto_fill")).toBe(false);
    expect(hasPermission(["instructor"], ROLE_PERMISSIONS.instructor, "automations.manage")).toBe(false);
  });
});

describe("Phase 4 automations", () => {
  it("runs a reminder once for the same shift event", () => {
    const automation = {
      id: "auto-1",
      organizationId: ORG_ID,
      name: "Clock-In Reminder",
      description: null,
      triggerType: "shift_starting",
      conditions: [],
      actions: [{ type: "notify_employee" as const }],
      isEnabled: true,
      createdBy: null,
      lastRunAt: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    const context = { entityId: "shift-1:maria", eventTime: "2026-10-05T09:00" };
    const first = planAutomationRun({ automation, context, existingKeys: [], now: "2026-10-05T08:30:00.000Z" });
    const second = planAutomationRun({
      automation,
      context,
      existingKeys: [executionKey(automation.id, context.entityId, context.eventTime)],
      now: "2026-10-05T08:31:00.000Z",
    });
    expect(first.status).toBe("success");
    expect(first.actions).toHaveLength(1);
    expect(second.status).toBe("skipped");
    expect(second.reason).toBe("already_ran");
  });

  it("does not run a disabled automation", () => {
    const result = planAutomationRun({
      automation: {
        id: "auto-2",
        organizationId: ORG_ID,
        name: "Off",
        description: null,
        triggerType: "missing_clock_out",
        conditions: [],
        actions: [{ type: "timesheet_exception" }],
        isEnabled: false,
        createdBy: null,
        lastRunAt: null,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
      context: { entityId: "entry-1", eventTime: "2026-10-05T18:00" },
      existingKeys: [],
      now: "2026-10-05T18:00:00.000Z",
    });
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("disabled");
  });
});
