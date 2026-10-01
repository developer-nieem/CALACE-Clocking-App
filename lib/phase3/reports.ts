import { payRateForDate, calculateEntryTotals } from "@/lib/time-clock/calculations";
import { classifyAttendance, estimatePayroll, getPayPeriod, toCsv } from "@/lib/phase3/domain";
import type { EmployeePayRate, OrganizationSettings, Profile, Shift, TimeBreak, TimeEntry } from "@/types";

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + (minute || 0);
}

export function attendanceRows(input: {
  today: string;
  nowMinutes: number;
  shifts: Shift[];
  entries: TimeEntry[];
  profiles: Profile[];
  graceMinutes: number;
}) {
  return input.shifts
    .filter((shift) => shift.date === input.today && shift.status === "published")
    .flatMap((shift) =>
      shift.instructorIds.map((userId) => {
        const person = input.profiles.find((item) => item.id === userId);
        const entry = input.entries.find((item) => item.userId === userId && item.workDate === input.today && (item.shiftId === shift.id || item.shiftId === null));
        const status = classifyAttendance({
          nowMinutes: input.nowMinutes,
          shiftStart: shift.startTime,
          shiftEnd: shift.endTime,
          clockedIn: Boolean(entry),
          clockedOut: Boolean(entry?.clockOutAt),
          onBreak: entry?.status === "on_break",
          late: entry?.clockStatus === "late",
          outsideGeofence: entry?.clockInGeofenceStatus === "outside_geofence",
          unscheduled: !entry?.shiftId,
          adminEdited: entry?.status === "edited",
          graceMinutes: input.graceMinutes,
        });
        return {
          employee: person ? `${person.firstName} ${person.lastName}` : userId,
          employeeType: person?.employeeType ?? "",
          shift: shift.title,
          scheduledStart: shift.startTime,
          clockIn: entry?.clockInAt ?? "",
          clockOut: entry?.clockOutAt ?? "",
          status,
        };
      }),
    );
}

export function timesheetDays(input: {
  entries: TimeEntry[];
  breaks: TimeBreak[];
  settings: OrganizationSettings;
  rates: EmployeePayRate[];
  from: string;
  to: string;
}) {
  return input.entries
    .filter((entry) => entry.workDate >= input.from && entry.workDate <= input.to && entry.clockOutAt)
    .map((entry) => {
      const totals = calculateEntryTotals(
        entry,
        input.breaks.filter((item) => item.timeEntryId === entry.id),
        input.settings,
      );
      const rate = payRateForDate(input.rates, entry.userId, entry.workDate) ?? entry.payRateSnapshot ?? 0;
      return {
        userId: entry.userId,
        workDate: entry.workDate,
        regularHours: totals.regularSeconds / 3600,
        overtimeHours: totals.overtimeSeconds / 3600,
        breakHours: totals.breakSeconds / 3600,
        workedHours: totals.workedSeconds / 3600,
        rate,
        missingClockOut: false,
        outsideGeofence: entry.clockInGeofenceStatus === "outside_geofence",
        unscheduled: !entry.shiftId,
        adminEdited: entry.status === "edited",
        late: entry.clockStatus === "late",
      };
    });
}

export function payrollCsv(input: {
  entries: TimeEntry[];
  breaks: TimeBreak[];
  settings: OrganizationSettings;
  rates: EmployeePayRate[];
  profiles: Profile[];
  date: string;
}) {
  const period = getPayPeriod(input.date, input.settings.payPeriodType ?? "weekly");
  const days = timesheetDays({ ...input, from: period.start, to: period.end });
  const rows = estimatePayroll(days, input.rates, input.settings.overtimeMultiplier);
  const table = rows.map((row) => {
    const person = input.profiles.find((item) => item.id === row.userId);
    return {
      employeeId: row.userId,
      employeeName: person ? `${person.firstName} ${person.lastName}` : row.userId,
      payPeriodStart: period.start,
      payPeriodEnd: period.end,
      regularHours: row.regularHours.toFixed(2),
      overtimeHours: row.overtimeHours.toFixed(2),
      regularPay: row.regularPay.toFixed(2),
      overtimePay: row.overtimePay.toFixed(2),
      estimatedGrossPay: row.estimatedGross.toFixed(2),
    };
  });
  return { period, table, csv: toCsv(table) };
}

export function scheduleVersusActual(input: {
  shifts: Shift[];
  entries: TimeEntry[];
  breaks: TimeBreak[];
  settings: OrganizationSettings;
  profiles: Profile[];
  from: string;
  to: string;
}) {
  return input.profiles.map((person) => {
    const scheduled = input.shifts
      .filter((shift) => shift.instructorIds.includes(person.id) && shift.date >= input.from && shift.date <= input.to && shift.status !== "draft" && shift.status !== "cancelled")
      .reduce((sum, shift) => sum + Math.max(0, minutes(shift.endTime) - minutes(shift.startTime) - shift.breakDurationMinutes) / 60, 0);
    const days = timesheetDays({
      entries: input.entries.filter((entry) => entry.userId === person.id),
      breaks: input.breaks,
      settings: input.settings,
      rates: [],
      from: input.from,
      to: input.to,
    });
    const worked = days.reduce((sum, day) => sum + day.workedHours, 0);
    return {
      employee: `${person.firstName} ${person.lastName}`,
      scheduled: scheduled.toFixed(2),
      worked: worked.toFixed(2),
      difference: (worked - scheduled).toFixed(2),
      lateStarts: days.filter((day) => day.late).length,
      missingClockOuts: input.entries.filter((entry) => entry.userId === person.id && !entry.clockOutAt && entry.workDate >= input.from && entry.workDate <= input.to).length,
      outsideGeofence: days.filter((day) => day.outsideGeofence).length,
    };
  });
}

export function laborCost(input: {
  shifts: Shift[];
  entries: TimeEntry[];
  breaks: TimeBreak[];
  settings: OrganizationSettings;
  rates: EmployeePayRate[];
  profiles: Profile[];
  from: string;
  to: string;
}) {
  const scheduled = input.shifts
    .filter((shift) => shift.date >= input.from && shift.date <= input.to && shift.status !== "draft" && shift.status !== "cancelled")
    .reduce((sum, shift) => {
      const hours = Math.max(0, minutes(shift.endTime) - minutes(shift.startTime) - shift.breakDurationMinutes) / 60;
      return sum + shift.instructorIds.reduce((inner, userId) => inner + hours * (payRateForDate(input.rates, userId, shift.date) ?? 0), 0);
    }, 0);
  const days = timesheetDays({ ...input, from: input.from, to: input.to });
  const actual = days.reduce((sum, day) => sum + (day.regularHours + day.overtimeHours * input.settings.overtimeMultiplier) * day.rate, 0);
  const overtime = days.reduce((sum, day) => sum + day.overtimeHours * day.rate * input.settings.overtimeMultiplier, 0);
  return {
    scheduled: Math.round(scheduled * 100) / 100,
    actual: Math.round(actual * 100) / 100,
    overtime: Math.round(overtime * 100) / 100,
    variance: Math.round((actual - scheduled) * 100) / 100,
  };
}
