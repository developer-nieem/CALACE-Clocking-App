import { shiftMinutes } from "@/lib/scheduling/engine";
import { calculateEntryTotals, payRateForDate } from "@/lib/time-clock/calculations";
import type {
  EmployeeDocument,
  EmployeePayRate,
  OrganizationSettings,
  Profile,
  Shift,
  TimeBreak,
  TimeEntry,
} from "@/types";

export function coverageReport(shifts: Shift[], start: string, end: string) {
  const range = shifts.filter((shift) => shift.date >= start && shift.date <= end);
  const active = range.filter((shift) => shift.status !== "cancelled");
  const positions = active.reduce((sum, shift) => sum + shift.requiredInstructors, 0);
  const filled = active.reduce((sum, shift) => sum + Math.min(shift.instructorIds.length, shift.requiredInstructors), 0);
  const open = active.filter((shift) => shift.isOpen || shift.instructorIds.length < shift.requiredInstructors).length;
  const cancelled = range.filter((shift) => shift.status === "cancelled").length;
  return {
    positions,
    filled,
    unfilled: Math.max(0, positions - filled),
    coverage: positions === 0 ? 100 : Math.round((filled / positions) * 100),
    open,
    cancelled,
  };
}

export function overtimeRows(input: {
  profiles: Profile[];
  shifts: Shift[];
  entries: TimeEntry[];
  breaks: TimeBreak[];
  settings: OrganizationSettings;
  start: string;
  end: string;
}) {
  const threshold = input.settings.maximumWeeklyHours ?? input.settings.weeklyOvertimeThresholdHours;
  return input.profiles
    .filter((profile) => profile.employmentStatus === "active")
    .map((profile) => {
      const scheduled = input.shifts
        .filter(
          (shift) =>
            shift.status !== "cancelled" &&
            shift.date >= input.start &&
            shift.date <= input.end &&
            shift.instructorIds.includes(profile.id),
        )
        .reduce((sum, shift) => sum + shiftMinutes(shift), 0) / 3600;
      const worked = input.entries
        .filter((entry) => entry.userId === profile.id && entry.workDate >= input.start && entry.workDate <= input.end)
        .reduce((sum, entry) => {
          const totals = calculateEntryTotals(
            entry,
            input.breaks.filter((item) => item.timeEntryId === entry.id),
            input.settings,
          );
          return sum + totals.workedSeconds / 3600;
        }, 0);
      const projected = Math.max(scheduled, worked);
      return {
        userId: profile.id,
        name: `${profile.firstName} ${profile.lastName}`,
        scheduled,
        worked,
        projected,
        threshold,
        potentialOvertime: Math.max(0, projected - threshold),
        actualOvertime: Math.max(0, worked - threshold),
      };
    });
}

export function employeeHourRows(input: Parameters<typeof overtimeRows>[0]) {
  return overtimeRows(input).map((row) => ({
    ...row,
    variance: row.worked - row.scheduled,
  }));
}

export function laborForecast(input: {
  profiles: Profile[];
  shifts: Shift[];
  entries: TimeEntry[];
  breaks: TimeBreak[];
  settings: OrganizationSettings;
  payRates: EmployeePayRate[];
  start: string;
  end: string;
}) {
  const days = new Map<string, { scheduledHours: number; scheduledPeople: number; estimatedCost: number; actualCost: number }>();
  for (const shift of input.shifts.filter((item) => item.status !== "cancelled" && item.date >= input.start && item.date <= input.end)) {
    const current = days.get(shift.date) ?? { scheduledHours: 0, scheduledPeople: 0, estimatedCost: 0, actualCost: 0 };
    const hours = shiftMinutes(shift) / 60;
    current.scheduledHours += hours * Math.max(shift.instructorIds.length, 0);
    current.scheduledPeople += shift.instructorIds.length;
    for (const userId of shift.instructorIds) {
      const profile = input.profiles.find((item) => item.id === userId);
      const rate = payRateForDate(input.payRates, userId, shift.date) ?? profile?.hourlyRate ?? 0;
      current.estimatedCost += hours * (rate ?? 0);
    }
    days.set(shift.date, current);
  }
  for (const entry of input.entries.filter((item) => item.workDate >= input.start && item.workDate <= input.end)) {
    const current = days.get(entry.workDate) ?? { scheduledHours: 0, scheduledPeople: 0, estimatedCost: 0, actualCost: 0 };
    const totals = calculateEntryTotals(
      entry,
      input.breaks.filter((item) => item.timeEntryId === entry.id),
      input.settings,
    );
    const rate = payRateForDate(input.payRates, entry.userId, entry.workDate) ?? entry.payRateSnapshot ?? 0;
    current.actualCost += (totals.workedSeconds / 3600) * (rate ?? 0);
    days.set(entry.workDate, current);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, ...value, variance: value.actualCost - value.estimatedCost }));
}

export function expiringQualifications(profiles: Profile[], today: string, withinDays: number) {
  const limit = addDays(today, withinDays);
  const rows: Array<{ userId: string; name: string; qualificationId: string; expirationDate: string }> = [];
  for (const profile of profiles) {
    for (const record of profile.qualificationRecords ?? []) {
      if (!record.expirationDate) continue;
      if (record.expirationDate >= today && record.expirationDate <= limit) {
        rows.push({
          userId: profile.id,
          name: `${profile.firstName} ${profile.lastName}`,
          qualificationId: record.qualificationId,
          expirationDate: record.expirationDate,
        });
      }
    }
  }
  return rows;
}

export function expiringDocuments(documents: EmployeeDocument[], today: string, withinDays: number) {
  const limit = addDays(today, withinDays);
  return documents.filter(
    (document) => document.expirationDate && document.expirationDate >= today && document.expirationDate <= limit,
  );
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function attendanceTrend(entries: TimeEntry[]) {
  const late = entries.filter((entry) => entry.clockStatus === "late").length;
  const missing = entries.filter((entry) => entry.clockOutAt === null && entry.clockStatus === "missing_clock_out").length;
  const geofence = entries.filter((entry) => entry.clockInGeofenceStatus === "outside_geofence").length;
  const completed = entries.filter((entry) => entry.status === "completed").length;
  const onTime = entries.filter((entry) => entry.clockStatus === "on_time").length;
  const counted = onTime + late;
  return {
    onTimePercent: counted === 0 ? 0 : Math.round((onTime / counted) * 100),
    late,
    missingClockOut: missing,
    geofence,
    completed,
  };
}
