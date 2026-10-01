import { describe, expect, it } from "vitest";
import { csvCell, hoursToPay, roundMoney } from "@/lib/money";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { calculateEntryTotals } from "@/lib/time-clock/calculations";
import { shiftMinutes } from "@/lib/scheduling/engine";
import { laborMargin } from "@/lib/phase5/domain";
import {
  denyCrossTenant,
  e2eScenarioTotals,
  isolateByOrganization,
  payVisibleTo,
  schedulerPayrollBlocked,
  staffSeesOnlyOwnTime,
} from "@/lib/phase6/domain";
import type { OrganizationSettings, TimeBreak, TimeEntry } from "@/types";

const settings: OrganizationSettings = {
  currencyCode: "USD",
  timezone: "America/Los_Angeles",
  requireLocationClockIn: true,
  requireLocationClockOut: true,
  geofenceEnforcement: "warning",
  allowUnscheduledClockIn: true,
  clockInEarlyMinutes: 15,
  clockInLateGraceMinutes: 8,
  earlyClockInPolicy: "warning",
  missingClockOutHours: 14,
  dailyOvertimeEnabled: false,
  dailyOvertimeThresholdHours: 8,
  weeklyOvertimeEnabled: true,
  weeklyOvertimeThresholdHours: 40,
  overtimeMultiplier: 1.5,
  employeesCanViewEstimatedEarnings: true,
};

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "e1",
    organizationId: "org-a",
    userId: "emp-1",
    shiftId: null,
    workDate: "2026-10-01",
    clockInAt: "2026-10-01T16:00:00.000Z",
    clockOutAt: "2026-10-02T00:00:00.000Z",
    clockInLatitude: 34,
    clockInLongitude: -118,
    clockInAccuracy: 12,
    clockOutLatitude: 34,
    clockOutLongitude: -118,
    clockOutAccuracy: 10,
    clockInLocationId: null,
    clockOutLocationId: null,
    clockInDistanceMeters: 8,
    clockOutDistanceMeters: 8,
    clockInGeofenceStatus: "verified",
    clockOutGeofenceStatus: "verified",
    status: "completed",
    clockStatus: "on_time",
    payRateSnapshot: 25,
    notes: null,
    createdAt: "2026-10-01T16:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 6 production readiness", () => {
  it("counts overnight shifts as eight hours", () => {
    expect(shiftMinutes({ startTime: "22:00", endTime: "06:00", breakDurationMinutes: 0 })).toBe(480);
    expect(shiftMinutes({ startTime: "09:00", endTime: "17:00", breakDurationMinutes: 30 })).toBe(450);
  });

  it("computes 7.5 worked hours after a 30 minute break", () => {
    const breaks: TimeBreak[] = [
      {
        id: "b1",
        organizationId: "org-a",
        timeEntryId: "e1",
        userId: "emp-1",
        breakStartAt: "2026-10-01T20:00:00.000Z",
        breakEndAt: "2026-10-01T20:30:00.000Z",
        breakStartLatitude: null,
        breakStartLongitude: null,
        breakStartAccuracy: null,
        breakEndLatitude: null,
        breakEndLongitude: null,
        breakEndAccuracy: null,
        breakMinutes: 30,
        createdAt: "2026-10-01T20:00:00.000Z",
        updatedAt: "2026-10-01T20:30:00.000Z",
      },
    ];
    const totals = calculateEntryTotals(entry(), breaks, settings);
    expect(totals.workedSeconds).toBe(7.5 * 3600);
    expect(totals.estimatedPay).toBe(187.5);
  });

  it("keeps employee pay and facility billing separate for the 7.5 hour scenario", () => {
    const result = e2eScenarioTotals(7.5, 25, 40);
    expect(result.labor).toBe(187.5);
    expect(result.billing).toBe(300);
    expect(result.margin).toBe(112.5);
    expect(laborMargin({ approvedHours: 8, employeeHourlyRate: 25, facilityHourlyRate: 40 })).toEqual({
      laborCost: 200,
      revenue: 320,
      margin: 120,
      marginPercent: 37.5,
    });
  });

  it("blocks scheduler payroll and staff peeking at another employee time or pay", () => {
    expect(schedulerPayrollBlocked()).toBe(true);
    expect(ROLE_PERMISSIONS.scheduler.includes("payroll.view")).toBe(false);
    expect(staffSeesOnlyOwnTime({ id: "emp-1", permissions: ROLE_PERMISSIONS.staff }, "emp-2")).toBe(false);
    expect(payVisibleTo({ id: "emp-1", permissions: ROLE_PERMISSIONS.staff }, "emp-2")).toBe(false);
    expect(payVisibleTo({ id: "emp-1", permissions: ROLE_PERMISSIONS.staff }, "emp-1")).toBe(true);
  });

  it("filters cross-tenant rows and sanitizes CSV formulas", () => {
    const rows = isolateByOrganization(
      [
        { organizationId: "org-a", name: "A" },
        { organizationId: "org-b", name: "B" },
      ],
      "org-a",
    );
    expect(rows).toHaveLength(1);
    expect(denyCrossTenant("org-a", "org-b")).toBe(true);
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(hoursToPay(7.5, 25)).toBe(187.5);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });
});
