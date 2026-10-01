import { beforeEach, describe, expect, it } from "vitest";
import { LOCATION_IDS, USER_IDS } from "@/lib/constants";
import { locations } from "@/lib/demo/data";
import { getDemoState, resetDemoState } from "@/lib/demo/store";
import { canAccessEmployeeRecord } from "@/lib/permissions";
import {
  calculateEntryTotals,
  payRateForDate,
} from "@/lib/time-clock/calculations";
import {
  changePayRate,
  clockIn,
  clockOut,
  editTimeValue,
  endBreak,
  startBreak,
  type ClockState,
} from "@/lib/time-clock/service";

const onsite = {
  latitude: 34,
  longitude: -118,
  accuracy: 12,
  timestamp: 1,
};
const outside = {
  latitude: 35,
  longitude: -119,
  accuracy: 20,
  timestamp: 1,
};

function state(): ClockState {
  return { ...getDemoState(), locations };
}

function todayAt(hour: number, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

beforeEach(() => {
  resetDemoState();
  const main = locations.find((item) => item.id === LOCATION_IDS.main)!;
  main.latitude = onsite.latitude;
  main.longitude = onsite.longitude;
  main.geofenceRadiusMeters = 200;
  main.geolocationRequired = false;
});

describe("Phase 1 time clock workflows", () => {
  it("staff clocks in, records multiple breaks, and clocks out with server totals", () => {
    const current = state();
    const entry = clockIn(current, USER_IDS.olivia, {
      shiftId: "shift-today-olivia",
      location: onsite,
      now: todayAt(8, 55),
    });
    startBreak(current, USER_IDS.olivia, {
      location: onsite,
      now: todayAt(12),
    });
    endBreak(current, USER_IDS.olivia, {
      location: onsite,
      now: todayAt(12, 30),
    });
    startBreak(current, USER_IDS.olivia, {
      location: onsite,
      now: todayAt(15),
    });
    endBreak(current, USER_IDS.olivia, {
      location: onsite,
      now: todayAt(15, 15),
    });
    clockOut(current, USER_IDS.olivia, {
      location: onsite,
      now: todayAt(17, 5),
    });
    const totals = calculateEntryTotals(
      entry,
      current.timeBreaks.filter((item) => item.timeEntryId === entry.id),
      current.settings,
    );
    expect(entry.status).toBe("completed");
    expect(current.timeBreaks.filter((item) => item.timeEntryId === entry.id)).toHaveLength(2);
    expect(totals.breakSeconds).toBe(45 * 60);
    expect(totals.workedSeconds).toBe(7 * 3600 + 25 * 60);
  });

  it("links an instructor clock entry to today's assigned shift", () => {
    const entry = clockIn(state(), USER_IDS.maria, {
      shiftId: "shift-today-maria",
      location: onsite,
      now: todayAt(9),
    });
    expect(entry.shiftId).toBe("shift-today-maria");
    expect(entry.payRateSnapshot).toBe(32);
  });

  it("warning-only mode records outside_geofence without blocking clock-in", () => {
    const current = state();
    current.settings.geofenceEnforcement = "warning";
    const entry = clockIn(current, USER_IDS.olivia, {
      shiftId: "shift-today-olivia",
      location: outside,
      now: todayAt(8, 55),
    });
    expect(entry.clockInGeofenceStatus).toBe("outside_geofence");
    expect(entry.clockInDistanceMeters).toBeGreaterThan(200);
    expect(entry.status).toBe("working");
  });

  it("calculates report hours, rate snapshot, and estimated pay", () => {
    const current = state();
    const entry = current.timeEntries.find(
      (item) => item.id === "time-olivia-yesterday",
    )!;
    const totals = calculateEntryTotals(
      entry,
      current.timeBreaks.filter((item) => item.timeEntryId === entry.id),
      current.settings,
    );
    expect(entry.payRateSnapshot).toBe(25);
    expect(totals.workedSeconds).toBe(7 * 3600 + 25 * 60);
    expect(totals.estimatedPay).toBe(185.5);
  });

  it("preserves historical entry rate after a future pay-rate change", () => {
    const current = state();
    const historical = current.timeEntries.find(
      (item) => item.id === "time-olivia-yesterday",
    )!;
    const effectiveFrom = new Date(`${historical.workDate}T00:00:00`);
    effectiveFrom.setDate(effectiveFrom.getDate() + 1);
    const nextRateDate = [
      effectiveFrom.getFullYear(),
      String(effectiveFrom.getMonth() + 1).padStart(2, "0"),
      String(effectiveFrom.getDate()).padStart(2, "0"),
    ].join("-");
    changePayRate(current, USER_IDS.admin, {
      userId: USER_IDS.olivia,
      hourlyRate: 27,
      effectiveFrom: nextRateDate,
    });
    expect(historical.payRateSnapshot).toBe(25);
    expect(payRateForDate(current.payRates, USER_IDS.olivia, historical.workDate)).toBe(25);
    expect(payRateForDate(current.payRates, USER_IDS.olivia, nextRateDate)).toBe(27);
  });

  it("requires a correction reason and records immutable edit history", () => {
    const current = state();
    const entry = current.timeEntries.find(
      (item) => item.id === "time-olivia-yesterday",
    )!;
    const original = entry.clockInAt;
    const replacement = new Date(new Date(original).getTime() + 5 * 60_000).toISOString();
    editTimeValue(current, USER_IDS.admin, {
      timeEntryId: entry.id,
      fieldName: "clockInAt",
      newValue: replacement,
      reason: "Employee confirmed delayed arrival",
    });
    expect(current.timeEntryEdits[0]).toMatchObject({
      oldValue: original,
      newValue: replacement,
      changedBy: USER_IDS.admin,
    });
    expect(entry.clockStatus).toBe("admin_edited");
  });

  it("rejects a double clock-in", () => {
    const current = state();
    clockIn(current, USER_IDS.olivia, {
      shiftId: "shift-today-olivia",
      location: onsite,
      now: todayAt(9),
    });
    expect(() =>
      clockIn(current, USER_IDS.olivia, {
        shiftId: "shift-today-olivia",
        location: onsite,
        now: todayAt(9, 1),
      }),
    ).toThrow("already clocked in");
  });

  it("rejects a second break while already on break", () => {
    const current = state();
    clockIn(current, USER_IDS.olivia, {
      shiftId: "shift-today-olivia",
      location: onsite,
      now: todayAt(9),
    });
    startBreak(current, USER_IDS.olivia, {
      location: onsite,
      now: todayAt(12),
    });
    expect(() =>
      startBreak(current, USER_IDS.olivia, {
        location: onsite,
        now: todayAt(12, 1),
      }),
    ).toThrow("already active");
  });

  it("rejects clock-out without an active time entry", () => {
    expect(() =>
      clockOut(state(), USER_IDS.olivia, {
        location: onsite,
        now: todayAt(17),
      }),
    ).toThrow("no active time entry");
  });

  it("rejects clock-in without a device location", () => {
    expect(() =>
      clockIn(state(), USER_IDS.olivia, {
        shiftId: "shift-today-olivia",
        location: null,
        now: todayAt(9),
      }),
    ).toThrow("Location access is required");
  });

  it("lets staff clock out from a previous-day open punch even outside a strict geofence", () => {
    const current = state();
    current.settings.geofenceEnforcement = "strict";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 33, 0, 0);
    const entry = clockIn(current, USER_IDS.olivia, {
      location: onsite,
      now: yesterday,
    });
    startBreak(current, USER_IDS.olivia, {
      location: outside,
      now: new Date(),
    });
    clockOut(current, USER_IDS.olivia, {
      location: outside,
      now: new Date(),
    });
    expect(entry.clockOutAt).not.toBeNull();
    expect(entry.status).toBe("completed");
    expect(entry.clockOutGeofenceStatus).toBe("outside_geofence");
    expect(current.timeBreaks.some((item) => item.timeEntryId === entry.id && item.breakEndAt === null)).toBe(false);
  });

  it("denies a staff user access to another employee's time/pay record", () => {
    expect(
      canAccessEmployeeRecord(
        { id: USER_IDS.olivia, roles: ["staff"] },
        USER_IDS.maria,
      ),
    ).toBe(false);
    expect(
      canAccessEmployeeRecord(
        { id: USER_IDS.admin, roles: ["admin"] },
        USER_IDS.maria,
      ),
    ).toBe(true);
  });
});
