import { describe, expect, it } from "vitest";
import { buildIcsCalendar } from "@/lib/calendar/ics";
import { evaluateAssignment } from "@/lib/scheduling/engine";
import { hasPermission, ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  canReadRoom,
  canViewDocument,
  checklistForUser,
  classifyAttendance,
  documentStatus,
  estimatePayroll,
  findDirectRoom,
  getPayPeriod,
  groupSearch,
  shiftsForCalendar,
  toCsv,
  visibleTasks,
} from "@/lib/phase3/domain";
import type { ChatRoom, EmployeePayRate, Profile, Shift, TaskItem } from "@/types";
import { ORG_ID, QUALIFICATION_IDS } from "@/lib/constants";

function person(id: string, first: string): Profile {
  return {
    id,
    organizationId: ORG_ID,
    email: `${first}@calace.team`,
    firstName: first,
    lastName: "Santos",
    phone: null,
    avatarUrl: null,
    employeeType: "staff",
    positionId: null,
    departmentId: null,
    primaryLocationId: null,
    employmentStatus: "active",
    hireDate: null,
    payType: "hourly",
    hourlyRate: 22,
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

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "task-1",
    title: "Submit clinical report",
    description: null,
    dueAt: null,
    priority: "normal",
    status: "open",
    assigneeIds: ["staff-1"],
    shiftId: null,
    ...overrides,
  };
}

describe("Phase 3 operations", () => {
  it("shows a task only to the assigned staff member", () => {
    const tasks = [task()];
    expect(visibleTasks(tasks, "staff-1", false)).toHaveLength(1);
    expect(visibleTasks(tasks, "other", false)).toHaveLength(0);
  });

  it("tracks checklist completion per assignee", () => {
    const item = task({
      checklist: [{ id: "c1", title: "Verify attendance", sortOrder: 1, isRequired: true }],
      completions: [{ id: "done", checklistItemId: "c1", userId: "staff-1", completedAt: "2026-10-05T17:00:00Z" }],
      status: "completed",
    });
    expect(checklistForUser(item, "staff-1").complete).toBe(true);
    expect(checklistForUser(item, "staff-2").complete).toBe(false);
  });

  it("links a shift task to the assigned instructor", () => {
    const linked = task({ shiftId: "shift-1", assigneeIds: ["inst-1"] });
    expect(visibleTasks([linked], "inst-1", false)[0]?.shiftId).toBe("shift-1");
  });

  it("limits chat visibility to room members", () => {
    const room: ChatRoom = {
      id: "room-1",
      type: "direct",
      name: null,
      memberIds: ["a", "b"],
      createdBy: "a",
      createdAt: "2026-10-01T00:00:00Z",
    };
    expect(canReadRoom(room, "a")).toBe(true);
    expect(canReadRoom(room, "c")).toBe(false);
    expect(findDirectRoom([room], "b", "a")?.id).toBe("room-1");
  });

  it("exports published shifts and omits drafts from ICS", () => {
    const shifts = [
      { id: "pub", title: "CNA Theory", date: "2026-10-05", startTime: "09:00", endTime: "13:00", status: "published", notes: null, locationId: null },
      { id: "draft", title: "Hidden", date: "2026-10-06", startTime: "09:00", endTime: "13:00", status: "draft", notes: null, locationId: null },
    ] as Shift[];
    const ics = buildIcsCalendar(shiftsForCalendar(shifts));
    expect(ics).toContain("CNA Theory");
    expect(ics).not.toContain("Hidden");
  });

  it("classifies working, break, late, and completed attendance", () => {
    expect(classifyAttendance({ nowMinutes: 10 * 60, shiftStart: "09:00", shiftEnd: "17:00", clockedIn: true, clockedOut: false, onBreak: false, late: false, outsideGeofence: false, unscheduled: false, adminEdited: false, graceMinutes: 10 })).toBe("Working");
    expect(classifyAttendance({ nowMinutes: 10 * 60, shiftStart: "09:00", shiftEnd: "17:00", clockedIn: true, clockedOut: false, onBreak: true, late: false, outsideGeofence: false, unscheduled: false, adminEdited: false, graceMinutes: 10 })).toBe("On Break");
    expect(classifyAttendance({ nowMinutes: 9 * 60 + 20, shiftStart: "09:00", shiftEnd: "17:00", clockedIn: false, clockedOut: false, onBreak: false, late: false, outsideGeofence: false, unscheduled: false, adminEdited: false, graceMinutes: 10 })).toBe("Late");
    expect(classifyAttendance({ nowMinutes: 18 * 60, shiftStart: "09:00", shiftEnd: "17:00", clockedIn: true, clockedOut: true, onBreak: false, late: false, outsideGeofence: false, unscheduled: false, adminEdited: false, graceMinutes: 10 })).toBe("Completed");
  });

  it("flags a missing clock-out after the shift ends", () => {
    expect(classifyAttendance({ nowMinutes: 18 * 60, shiftStart: "09:00", shiftEnd: "17:00", clockedIn: true, clockedOut: false, onBreak: false, late: false, outsideGeofence: false, unscheduled: false, adminEdited: false, graceMinutes: 10 })).toBe("Missing Clock Out");
  });

  it("uses the rate effective on each work date inside one pay period", () => {
    const rates: EmployeePayRate[] = [
      { id: "r1", organizationId: ORG_ID, userId: "emp", hourlyRate: 22, effectiveFrom: "2026-06-01", effectiveTo: "2026-06-30", createdBy: null, createdAt: "2026-06-01T00:00:00Z" },
      { id: "r2", organizationId: ORG_ID, userId: "emp", hourlyRate: 25, effectiveFrom: "2026-07-01", effectiveTo: null, createdBy: null, createdAt: "2026-07-01T00:00:00Z" },
    ];
    const rows = estimatePayroll(
      [
        { userId: "emp", workDate: "2026-06-30", regularHours: 8, overtimeHours: 0, breakHours: 0.5 },
        { userId: "emp", workDate: "2026-07-01", regularHours: 8, overtimeHours: 0, breakHours: 0.5 },
      ],
      rates,
      1.5,
    );
    expect(rows[0]?.regularPay).toBe(376);
    expect(getPayPeriod("2026-06-30", "weekly").start).toBe("2026-06-29");
  });

  it("keeps payroll CSV totals aligned with the on-screen rows", () => {
    const rows = estimatePayroll(
      [{ userId: "emp", workDate: "2026-10-05", regularHours: 8, overtimeHours: 2, breakHours: 0.5 }],
      [{ id: "r", organizationId: ORG_ID, userId: "emp", hourlyRate: 20, effectiveFrom: "2026-01-01", effectiveTo: null, createdBy: null, createdAt: "2026-01-01T00:00:00Z" }],
      1.5,
    );
    const csv = toCsv(rows.map((row) => ({ employee: row.userId, gross: row.estimatedGross })));
    expect(csv).toContain("220");
    expect(rows[0]?.estimatedGross).toBe(220);
  });

  it("denies payroll export to a scheduler", () => {
    expect(hasPermission(["scheduler"], ROLE_PERMISSIONS.scheduler, "payroll.view")).toBe(false);
    expect(hasPermission(["scheduler"], ROLE_PERMISSIONS.scheduler, "payroll.export")).toBe(false);
    expect(hasPermission(["admin"], ROLE_PERMISSIONS.admin, "payroll.export")).toBe(true);
  });

  it("hides another employee's document", () => {
    expect(canViewDocument({ userId: "owner" }, { id: "owner", canManage: false })).toBe(true);
    expect(canViewDocument({ userId: "owner" }, { id: "other", canManage: false })).toBe(false);
  });

  it("warns when a required qualification expires before the shift", () => {
    const employee = person("emp-1", "Maria");
    employee.employeeType = "instructor";
    employee.qualifications = [QUALIFICATION_IDS.clinicalInstructor];
    employee.qualificationRecords = [
      {
        qualificationId: QUALIFICATION_IDS.clinicalInstructor,
        issuedDate: "2024-01-01",
        expirationDate: "2026-10-01",
        credentialNumber: null,
        notes: null,
      },
    ];
    const conflicts = evaluateAssignment({
      employee,
      shift: {
        id: "shift",
        date: "2026-10-12",
        startTime: "09:00",
        endTime: "13:00",
        breakDurationMinutes: 0,
        qualificationIds: [QUALIFICATION_IDS.clinicalInstructor],
        locationId: null,
      },
      existingShifts: [],
      rules: [],
      exceptions: [],
      timeOff: [],
    });
    expect(conflicts.some((item) => item.code === "qualification_expired")).toBe(true);
  });

  it("groups a person search result", () => {
    const results = groupSearch("maria", { people: [person("emp-1", "Maria")], shifts: [], tasks: [] });
    expect(results[0]).toMatchObject({ group: "People", label: "Maria Santos" });
  });

  it("marks a document expiring inside the alert window", () => {
    expect(documentStatus("2026-10-20", "2026-10-01", 30)).toBe("Expiring Soon");
    expect(documentStatus("2026-09-01", "2026-10-01", 30)).toBe("Expired");
  });
});
