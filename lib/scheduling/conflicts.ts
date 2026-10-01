import { minutesToHoursLabel } from "@/lib/utils";
import type {
  AvailabilityRule,
  SchedulingWarning,
  Shift,
  TimeOffRequest,
  Profile,
} from "@/types";

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(aEnd) > toMinutes(bStart);
}

function shiftMinutes(shift: Shift) {
  return Math.max(0, toMinutes(shift.endTime) - toMinutes(shift.startTime) - shift.breakDurationMinutes);
}

function weekdayFromISO(date: string) {
  return new Date(`${date}T00:00:00`).getDay();
}

export function getAssignmentWarnings(input: {
  instructor: Profile;
  shift: Pick<Shift, "date" | "startTime" | "endTime" | "id">;
  existingShifts: Shift[];
  availability: AvailabilityRule[];
  timeOff: TimeOffRequest[];
  weeklyMinutes: number;
}): SchedulingWarning[] {
  const warnings: SchedulingWarning[] = [];
  const { instructor, shift, existingShifts, availability, timeOff, weeklyMinutes } = input;
  const weekday = weekdayFromISO(shift.date);
  const rule = availability.find(
    (item) => item.userId === instructor.id && item.weekday === weekday,
  );

  if (rule?.status === "unavailable") {
    warnings.push({
      code: "unavailable",
      severity: "warning",
      message: `${instructor.firstName} ${instructor.lastName} is unavailable during this time.`,
    });
  } else if (rule?.startTime && rule.endTime) {
    if (
      toMinutes(shift.startTime) < toMinutes(rule.startTime) ||
      toMinutes(shift.endTime) > toMinutes(rule.endTime)
    ) {
      warnings.push({
        code: "outside_availability",
        severity: "warning",
        message: `${instructor.firstName} ${instructor.lastName} is only available ${rule.startTime}–${rule.endTime} on this day.`,
      });
    }
  }

  const overlapping = existingShifts.filter(
    (item) =>
      item.id !== shift.id &&
      item.date === shift.date &&
      item.status !== "cancelled" &&
      item.instructorIds.includes(instructor.id) &&
      overlaps(item.startTime, item.endTime, shift.startTime, shift.endTime),
  );

  if (overlapping.length > 0) {
    warnings.push({
      code: "overlap",
      severity: "warning",
      message: `${instructor.firstName} ${instructor.lastName} already has another shift at this time.`,
    });
  }

  const approvedLeave = timeOff.find(
    (item) =>
      item.userId === instructor.id &&
      item.status === "approved" &&
      item.startDate <= shift.date &&
      item.endDate >= shift.date,
  );
  if (approvedLeave) {
    warnings.push({
      code: "time_off",
      severity: "warning",
      message: `${instructor.firstName} ${instructor.lastName} has approved time off.`,
    });
  }

  const pendingMinutes = shiftMinutes({
    ...shift,
    breakDurationMinutes: 0,
    color: "",
    organizationId: "",
    templateId: null,
    title: "",
    locationId: null,
    departmentId: null,
    classCohort: null,
    positionId: null,
    notes: null,
    status: "draft",
    isOpen: false,
    requiredInstructors: 1,
    approvalRequired: true,
    instructorIds: [],
    tasks: [],
  } as Shift);

  const projected = weeklyMinutes + pendingMinutes;
  const maxMinutes = instructor.maxWeeklyHours * 60;
  if (projected > maxMinutes) {
    warnings.push({
      code: "max_hours",
      severity: "warning",
      message: `Assigning this shift will exceed ${instructor.maxWeeklyHours} hours/week (${minutesToHoursLabel(projected)}).`,
    });
  } else if (projected > 40 * 60) {
    warnings.push({
      code: "overtime",
      severity: "warning",
      message: `Assigning this shift will exceed 40 hours/week.`,
    });
  }

  const sameDayMinutes = existingShifts
    .filter(
      (item) =>
        item.date === shift.date &&
        item.id !== shift.id &&
        item.instructorIds.includes(instructor.id) &&
        item.status !== "cancelled",
    )
    .reduce((sum, item) => sum + shiftMinutes(item), 0);
  if (sameDayMinutes + pendingMinutes > 12 * 60) {
    warnings.push({
      code: "daily_hours",
      severity: "warning",
      message: `${instructor.firstName} ${instructor.lastName} would exceed 12 working hours on this day.`,
    });
  }

  return warnings;
}

export function rankInstructorsForShift(input: {
  shift: Shift;
  instructors: Profile[];
  existingShifts: Shift[];
  availability: AvailabilityRule[];
  timeOff: TimeOffRequest[];
}) {
  return input.instructors
    .map((instructor) => {
      const weeklyMinutes = input.existingShifts
        .filter((item) => item.instructorIds.includes(instructor.id) && item.status !== "cancelled")
        .reduce((sum, item) => sum + shiftMinutes(item), 0);
      const warnings = getAssignmentWarnings({
        instructor,
        shift: input.shift,
        existingShifts: input.existingShifts,
        availability: input.availability,
        timeOff: input.timeOff,
        weeklyMinutes,
      });
      const weekday = weekdayFromISO(input.shift.date);
      const rule = input.availability.find(
        (item) => item.userId === instructor.id && item.weekday === weekday,
      );
      let score = 100;
      const reasons: string[] = [];
      if (rule?.status === "preferred") {
        score += 20;
        reasons.push("Preferred hours");
      }
      if (rule?.status === "available") {
        score += 10;
        reasons.push("Available");
      }
      if (rule?.status === "unavailable") {
        score -= 40;
        reasons.push("Unavailable");
      }
      score -= warnings.length * 15;
      score -= weeklyMinutes / 30;
      if (weeklyMinutes < instructor.defaultWeeklyHours * 60) {
        reasons.push("Below target hours");
        score += 8;
      }
      return {
        shiftId: input.shift.id,
        instructorId: instructor.id,
        score,
        reasons,
        warnings,
      };
    })
    .sort((a, b) => b.score - a.score);
}
