import { describe, expect, it } from "vitest";
import { QUALIFICATION_IDS, ORG_ID } from "@/lib/constants";
import {
  claimOpenShift,
  evaluateAssignment,
  generateSeriesDates,
  schedulerCannotViewPay,
  visibleToEmployee,
  weeklyScheduledMinutes,
} from "@/lib/scheduling/engine";
import { hasPermission, ROLE_PERMISSIONS } from "@/lib/permissions";
import type { Profile, Shift } from "@/types";

function employee(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "emp-1",
    organizationId: ORG_ID,
    email: "maria@calace.team",
    firstName: "Maria",
    lastName: "Santos",
    phone: null,
    avatarUrl: null,
    employeeType: "instructor",
    positionId: null,
    departmentId: null,
    primaryLocationId: null,
    employmentStatus: "active",
    hireDate: null,
    payType: "hourly",
    hourlyRate: 32,
    weeklyTargetHours: 40,
    maximumWeeklyHours: 40,
    defaultWeeklyHours: 40,
    maxWeeklyHours: 40,
    lastActiveAt: null,
    qualifications: [QUALIFICATION_IDS.clinicalInstructor],
    locationIds: [],
    roles: ["instructor"],
    ...overrides,
  };
}

function shift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: "shift-1",
    organizationId: ORG_ID,
    templateId: null,
    title: "CNA Theory",
    date: "2026-10-05",
    startTime: "10:00",
    endTime: "14:00",
    locationId: "loc-clinical",
    departmentId: null,
    classCohort: null,
    positionId: null,
    color: "#0D2A43",
    breakDurationMinutes: 0,
    notes: null,
    status: "published",
    isOpen: false,
    requiredInstructors: 1,
    approvalRequired: true,
    instructorIds: [],
    tasks: [],
    qualificationIds: [],
    ...overrides,
  };
}

describe("Phase 2 scheduling", () => {
  it("does not warn when a shift fits available hours", () => {
    const conflicts = evaluateAssignment({
      employee: employee(),
      shift: shift(),
      existingShifts: [],
      rules: [
        {
          id: "rule-1",
          userId: "emp-1",
          weekday: 1,
          status: "available",
          startTime: "09:00",
          endTime: "17:00",
        },
      ],
      exceptions: [],
      timeOff: [],
    });
    expect(conflicts.filter((item) => item.code.includes("avail"))).toHaveLength(0);
  });

  it("warns when a shift is outside availability", () => {
    const conflicts = evaluateAssignment({
      employee: employee(),
      shift: shift({ startTime: "18:00", endTime: "21:00" }),
      existingShifts: [],
      rules: [
        {
          id: "rule-1",
          userId: "emp-1",
          weekday: 1,
          status: "available",
          startTime: "09:00",
          endTime: "17:00",
        },
      ],
      exceptions: [],
      timeOff: [],
    });
    expect(conflicts.some((item) => item.code === "outside_availability" && item.level === "warning")).toBe(true);
  });

  it("blocks overlapping shifts", () => {
    const conflicts = evaluateAssignment({
      employee: employee(),
      shift: shift({ id: "new", startTime: "12:00", endTime: "16:00" }),
      existingShifts: [shift({ id: "old", startTime: "09:00", endTime: "13:00", instructorIds: ["emp-1"] })],
      rules: [],
      exceptions: [],
      timeOff: [],
    });
    expect(conflicts.find((item) => item.code === "overlap")?.level).toBe("blocking");
  });

  it("blocks approved time off", () => {
    const conflicts = evaluateAssignment({
      employee: employee(),
      shift: shift(),
      existingShifts: [],
      rules: [],
      exceptions: [],
      timeOff: [
        {
          id: "off-1",
          userId: "emp-1",
          startDate: "2026-10-05",
          endDate: "2026-10-05",
          isPartialDay: false,
          startTime: null,
          endTime: null,
          reason: "Vacation",
          notes: null,
          status: "approved",
        },
      ],
    });
    expect(conflicts.find((item) => item.code === "time_off")?.level).toBe("blocking");
  });

  it("warns when a required qualification is missing", () => {
    const conflicts = evaluateAssignment({
      employee: employee({ qualifications: [] }),
      shift: shift({ qualificationIds: [QUALIFICATION_IDS.clinicalInstructor] }),
      existingShifts: [],
      rules: [],
      exceptions: [],
      timeOff: [],
      policy: { qualificationEnforcement: "warning" },
      qualifications: [{ id: QUALIFICATION_IDS.clinicalInstructor, name: "Clinical Instructor" }],
    });
    expect(conflicts.find((item) => item.code === "qualification")?.level).toBe("warning");
  });

  it("generates weekday recurring dates", () => {
    const dates = generateSeriesDates({
      recurrenceType: "weekdays",
      daysOfWeek: [1, 2, 3, 4, 5],
      startDate: "2026-10-05",
      endDate: "2026-10-09",
      occurrenceCount: null,
    });
    expect(dates).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
  });

  it("does not let two claims exceed open-shift capacity", () => {
    const open = shift({ isOpen: true, requiredInstructors: 1, approvalRequired: false, instructorIds: [] });
    const first = claimOpenShift({ shift: open, employee: employee(), requests: [] });
    const second = claimOpenShift({
      shift: { ...open, instructorIds: ["emp-1"] },
      employee: employee({ id: "emp-2", firstName: "John", email: "john@calace.team" }),
      requests: [],
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
  });

  it("hides draft shifts from employees and shows published ones", () => {
    expect(visibleToEmployee(shift({ status: "draft", instructorIds: ["emp-1"] }), "emp-1")).toBe(false);
    expect(visibleToEmployee(shift({ status: "published", instructorIds: ["emp-1"] }), "emp-1")).toBe(true);
  });

  it("keeps scheduled hours separate from a 9-to-1 shift minus break", () => {
    const hours = weeklyScheduledMinutes(
      [shift({ instructorIds: ["emp-1"], startTime: "09:00", endTime: "13:00", breakDurationMinutes: 30 })],
      "emp-1",
      "2026-10-05",
    );
    expect(hours).toBe(210);
  });

  it("denies staff schedule management and scheduler pay access", () => {
    expect(hasPermission(["staff"], ROLE_PERMISSIONS.staff, "schedules.manage")).toBe(false);
    expect(schedulerCannotViewPay(ROLE_PERMISSIONS.scheduler)).toBe(true);
    expect(hasPermission(["scheduler"], ROLE_PERMISSIONS.scheduler, "pay.manage")).toBe(false);
  });
});
