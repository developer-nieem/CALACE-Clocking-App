export const TIMESHEET_STATUSES = [
  "open",
  "submitted",
  "approved",
  "rejected",
  "payroll_exported",
] as const;

export const OVERTIME_WEEKLY_HOURS = 40;

export function splitRegularAndOvertime(workedMinutes: number, weeklyCapHours = OVERTIME_WEEKLY_HOURS) {
  const cap = weeklyCapHours * 60;
  const regularMinutes = Math.min(workedMinutes, cap);
  const overtimeMinutes = Math.max(0, workedMinutes - cap);
  return { regularMinutes, overtimeMinutes };
}
