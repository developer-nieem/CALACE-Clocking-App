import type {
  AvailabilityException,
  AvailabilityRule,
  EmployeeType,
  OpenShiftRequest,
  OrganizationSettings,
  Profile,
  Shift,
  ShiftSeries,
  TimeOffRequest,
} from "@/types";

export type ConflictLevel = "info" | "warning" | "blocking";

export type ScheduleConflict = {
  code: string;
  level: ConflictLevel;
  message: string;
};

type Policy = {
  qualificationEnforcement: "strict" | "warning" | "disabled";
  maximumDailyHours: number;
  maximumWeeklyHours: number;
  requiredRestHours: number;
  overtimeWarningEnabled: boolean;
};

export function schedulingPolicy(settings?: Partial<OrganizationSettings> | null): Policy {
  return {
    qualificationEnforcement: settings?.qualificationEnforcement ?? "warning",
    maximumDailyHours: settings?.maximumDailyHours ?? 12,
    maximumWeeklyHours: settings?.maximumWeeklyHours ?? 40,
    requiredRestHours: settings?.requiredRestHours ?? 8,
    overtimeWarningEnabled: settings?.overtimeWarningEnabled ?? true,
  };
}

function minutes(time: string) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function spanMinutes(startTime: string, endTime: string) {
  const start = minutes(startTime);
  const end = minutes(endTime);
  return end > start ? end - start : end + 24 * 60 - start;
}

function intervals(startTime: string, endTime: string) {
  const start = minutes(startTime);
  const end = minutes(endTime);
  if (end > start) return [[start, end]];
  return [
    [start, 24 * 60],
    [0, end],
  ];
}

export function shiftMinutes(shift: Pick<Shift, "startTime" | "endTime" | "breakDurationMinutes">) {
  return Math.max(0, spanMinutes(shift.startTime, shift.endTime) - (shift.breakDurationMinutes ?? 0));
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return intervals(aStart, aEnd).some(([as, ae]) =>
    intervals(bStart, bEnd).some(([bs, be]) => as < be && ae > bs),
  );
}

function weekday(date: string) {
  return new Date(`${date}T00:00:00`).getDay();
}

export function effectiveAvailability(input: {
  userId: string;
  date: string;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
}) {
  const exception = input.exceptions.find(
    (item) => item.userId === input.userId && item.date === input.date,
  );
  if (exception) return exception;
  const day = weekday(input.date);
  return (
    input.rules.find(
      (rule) =>
        rule.userId === input.userId &&
        rule.weekday === day &&
        (!rule.effectiveFrom || rule.effectiveFrom <= input.date) &&
        (!rule.effectiveTo || rule.effectiveTo >= input.date),
    ) ?? null
  );
}

export function evaluateAssignment(input: {
  employee: Profile;
  shift: Pick<
    Shift,
    | "id"
    | "date"
    | "startTime"
    | "endTime"
    | "breakDurationMinutes"
    | "qualificationIds"
    | "locationId"
  >;
  existingShifts: Shift[];
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  timeOff: TimeOffRequest[];
  policy?: Partial<Policy>;
  qualifications?: Array<{ id: string; name: string }>;
  qualificationRecords?: Array<{ qualificationId: string; expirationDate: string | null }>;
}): ScheduleConflict[] {
  const policy = { ...schedulingPolicy(), ...input.policy };
  const conflicts: ScheduleConflict[] = [];
  const name = `${input.employee.firstName} ${input.employee.lastName}`;
  if (input.employee.employmentStatus !== "active") {
    conflicts.push({
      code: "inactive_employee",
      level: "blocking",
      message: `${name} is ${input.employee.employmentStatus} and cannot be scheduled.`,
    });
  }
  const availability = effectiveAvailability({
    userId: input.employee.id,
    date: input.shift.date,
    rules: input.rules,
    exceptions: input.exceptions,
  });

  if (availability?.status === "unavailable") {
    conflicts.push({
      code: "unavailable",
      level: "warning",
      message: `${name} is marked unavailable on this date.`,
    });
  } else if (
    availability?.status === "available" &&
    availability.startTime &&
    availability.endTime &&
    (minutes(input.shift.startTime) < minutes(availability.startTime) ||
      minutes(input.shift.endTime) > minutes(availability.endTime))
  ) {
    conflicts.push({
      code: "outside_availability",
      level: "warning",
      message: `${name} is only available ${availability.startTime}–${availability.endTime}.`,
    });
  } else if (availability?.status === "preferred") {
    conflicts.push({
      code: "preferred_mismatch",
      level: "info",
      message: `${name} marked these hours as preferred, not guaranteed.`,
    });
  }

  const overlapping = input.existingShifts.filter(
    (item) =>
      item.id !== input.shift.id &&
      item.status !== "cancelled" &&
      item.date === input.shift.date &&
      item.instructorIds.includes(input.employee.id) &&
      overlaps(item.startTime, item.endTime, input.shift.startTime, input.shift.endTime),
  );
  if (overlapping[0]) {
    const overlapStart = Math.max(minutes(overlapping[0].startTime), minutes(input.shift.startTime));
    const overlapEnd = Math.min(minutes(overlapping[0].endTime), minutes(input.shift.endTime));
    conflicts.push({
      code: "overlap",
      level: "blocking",
      message: `${name} is already scheduled for ${overlapping[0].title} ${overlapping[0].startTime}–${overlapping[0].endTime}. Overlap: ${overlapEnd - overlapStart} minutes.`,
    });
  }

  const leave = input.timeOff.find(
    (item) =>
      item.userId === input.employee.id &&
      item.status === "approved" &&
      item.startDate <= input.shift.date &&
      item.endDate >= input.shift.date,
  );
  if (leave) {
    conflicts.push({
      code: "time_off",
      level: "blocking",
      message: `${name} has approved time off on ${input.shift.date}.`,
    });
  }

  const required = input.shift.qualificationIds ?? [];
  const missing = required.filter((id) => !input.employee.qualifications.includes(id));
  if (missing.length && policy.qualificationEnforcement !== "disabled") {
    const labels = missing.map(
      (id) => input.qualifications?.find((item) => item.id === id)?.name ?? "required qualification",
    );
    conflicts.push({
      code: "qualification",
      level: policy.qualificationEnforcement === "strict" ? "blocking" : "warning",
      message: `${name} is missing ${labels.join(", ")}.`,
    });
  }
  const records = input.qualificationRecords ?? input.employee.qualificationRecords ?? [];
  const expired = required.filter((id) =>
    records.some(
      (record) =>
        record.qualificationId === id &&
        record.expirationDate &&
        record.expirationDate < input.shift.date,
    ),
  );
  if (expired.length && policy.qualificationEnforcement !== "disabled") {
    conflicts.push({
      code: "qualification_expired",
      level: "warning",
      message: `${name} has a required qualification that expires before ${input.shift.date}.`,
    });
  }

  const weekly = weeklyScheduledMinutes(input.existingShifts, input.employee.id, input.shift.date);
  const added = shiftMinutes(input.shift);
  const projectedHours = (weekly + added) / 60;
  const personalMax = input.employee.maximumWeeklyHours ?? input.employee.maxWeeklyHours;
  if (projectedHours > personalMax) {
    conflicts.push({
      code: "max_weekly_hours",
      level: "blocking",
      message: `${name} would reach ${projectedHours.toFixed(1)} scheduled hours, above the ${personalMax} hour maximum.`,
    });
  } else if (policy.overtimeWarningEnabled && projectedHours > policy.maximumWeeklyHours) {
    conflicts.push({
      code: "overtime",
      level: "warning",
      message: `${name} would reach ${projectedHours.toFixed(1)} scheduled hours.`,
    });
  }

  const sameDay = input.existingShifts
    .filter(
      (item) =>
        item.id !== input.shift.id &&
        item.date === input.shift.date &&
        item.status !== "cancelled" &&
        item.instructorIds.includes(input.employee.id),
    )
    .reduce((sum, item) => sum + shiftMinutes(item), 0);
  if ((sameDay + added) / 60 > policy.maximumDailyHours) {
    conflicts.push({
      code: "max_daily_hours",
      level: "warning",
      message: `${name} would exceed ${policy.maximumDailyHours} scheduled hours in one day.`,
    });
  }

  return conflicts;
}

export function weeklyScheduledMinutes(shifts: Shift[], userId: string, date: string) {
  const anchor = new Date(`${date}T00:00:00`);
  const day = anchor.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(anchor);
  start.setDate(anchor.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startIso = iso(start);
  const endIso = iso(end);
  return shifts
    .filter(
      (shift) =>
        shift.status !== "cancelled" &&
        shift.instructorIds.includes(userId) &&
        shift.date >= startIso &&
        shift.date <= endIso,
    )
    .reduce((sum, shift) => sum + shiftMinutes(shift), 0);
}

function iso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function generateSeriesDates(series: Pick<ShiftSeries, "startDate" | "endDate" | "occurrenceCount" | "daysOfWeek" | "recurrenceType">) {
  const dates: string[] = [];
  const cursor = new Date(`${series.startDate}T00:00:00`);
  const end = series.endDate ? new Date(`${series.endDate}T00:00:00`) : null;
  const limit = series.occurrenceCount ?? 62;
  while (dates.length < limit) {
    if (end && cursor > end) break;
    const day = cursor.getDay();
    const selected =
      series.recurrenceType === "daily" ||
      (series.recurrenceType === "weekdays" && day >= 1 && day <= 5) ||
      series.daysOfWeek.includes(day);
    if (selected) dates.push(iso(cursor));
    cursor.setDate(cursor.getDate() + 1);
    if (!end && !series.occurrenceCount && dates.length >= 31) break;
    if (cursor.getTime() - new Date(`${series.startDate}T00:00:00`).getTime() > 1000 * 60 * 60 * 24 * 370) {
      break;
    }
  }
  return dates;
}

export function filledSlots(shift: Shift, requests: OpenShiftRequest[]) {
  const assigned = new Set(shift.instructorIds);
  for (const request of requests) {
    if (request.shiftId === shift.id && request.status === "approved") assigned.add(request.userId);
  }
  return assigned.size;
}

export function claimOpenShift(input: {
  shift: Shift;
  employee: Profile;
  requests: OpenShiftRequest[];
  now?: string;
}) {
  if (!input.shift.isOpen || input.shift.status !== "published") {
    return { ok: false as const, error: "This shift is not open." };
  }
  if (input.shift.claimDeadline && input.now && input.now > input.shift.claimDeadline) {
    return { ok: false as const, error: "The claim deadline has passed." };
  }
  const eligible = input.shift.eligibleEmployeeTypes;
  if (eligible && !eligible.includes(input.employee.employeeType)) {
    return { ok: false as const, error: "This open shift is not available for your employee type." };
  }
  if (input.requests.some((item) => item.shiftId === input.shift.id && item.userId === input.employee.id && item.status !== "rejected" && item.status !== "cancelled")) {
    return { ok: false as const, error: "You already requested this shift." };
  }
  const slots = filledSlots(input.shift, input.requests);
  const pending = input.requests.filter(
    (item) => item.shiftId === input.shift.id && item.status === "pending",
  ).length;
  const reserved = input.shift.approvalRequired ? slots + pending : slots;
  if (reserved >= input.shift.requiredInstructors) {
    return { ok: false as const, error: "This shift is already fully requested." };
  }
  return { ok: true as const };
}

export function visibleToEmployee(shift: Shift, userId: string, employeeType?: EmployeeType) {
  if (shift.status === "draft") return false;
  if (shift.instructorIds.includes(userId)) return shift.status !== "cancelled" || true;
  if (shift.isOpen && shift.status === "published") {
    if (shift.eligibleEmployeeTypes && employeeType && !shift.eligibleEmployeeTypes.includes(employeeType)) {
      return false;
    }
    return true;
  }
  return false;
}

export function canViewPay(permissions: string[]) {
  return permissions.includes("pay.manage") || permissions.includes("pay.view");
}

export function schedulerCannotViewPay(permissions: string[]) {
  return !canViewPay(permissions);
}
