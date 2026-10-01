import {
  effectiveAvailability,
  evaluateAssignment,
  schedulingPolicy,
  shiftMinutes,
  weeklyScheduledMinutes,
} from "@/lib/scheduling/engine";
import type {
  AvailabilityException,
  AvailabilityRule,
  Location,
  OrganizationSettings,
  Position,
  Profile,
  Qualification,
  SchedulingWeights,
  Shift,
  TimeOffRequest,
} from "@/types";

export const DEFAULT_SCHEDULING_WEIGHTS: SchedulingWeights = {
  availability: 30,
  preferredAvailability: 15,
  qualification: 30,
  position: 15,
  location: 10,
  weeklyHours: 10,
  overtimePenalty: 25,
  fairness: 10,
  preferredHours: 5,
};

export type SchedulerContext = {
  employees: Profile[];
  shifts: Shift[];
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  timeOff: TimeOffRequest[];
  qualifications: Qualification[];
  positions: Position[];
  locations: Location[];
  settings: OrganizationSettings;
};

export type RankedEmployee = {
  userId: string;
  name: string;
  score: number;
  eligible: boolean;
  reasons: string[];
  warnings: string[];
};

export function schedulingWeights(settings?: OrganizationSettings | null): SchedulingWeights {
  return { ...DEFAULT_SCHEDULING_WEIGHTS, ...settings?.schedulingWeights };
}

function nameOf(employee: Profile) {
  return `${employee.firstName} ${employee.lastName}`;
}

export function rankEmployees(shift: Shift, context: SchedulerContext): RankedEmployee[] {
  const weights = schedulingWeights(context.settings);
  const policy = schedulingPolicy(context.settings);
  const fairnessOn = context.settings.fairSchedulingEnabled !== false;
  const active = context.employees.filter((employee) => employee.employmentStatus === "active");
  const weeklyHours = new Map(
    active.map((employee) => [employee.id, weeklyScheduledMinutes(context.shifts, employee.id, shift.date) / 60]),
  );
  const lowestHours = Math.min(...[...weeklyHours.values(), 0]);

  return active
    .map((employee) => {
      const conflicts = evaluateAssignment({
        employee,
        shift,
        existingShifts: context.shifts,
        rules: context.rules,
        exceptions: context.exceptions,
        timeOff: context.timeOff,
        policy,
        qualifications: context.qualifications,
        qualificationRecords: employee.qualificationRecords,
      });
      const blocking = conflicts.filter((item) => item.level === "blocking");
      const wrongType =
        shift.eligibleEmployeeTypes?.length &&
        !shift.eligibleEmployeeTypes.includes(employee.employeeType);
      if (wrongType) {
        blocking.push({
          code: "employee_type",
          level: "blocking",
          message: `${nameOf(employee)} is not the employee type required for this shift.`,
        });
      }
      const reasons: string[] = [];
      const warnings = conflicts.filter((item) => item.level !== "blocking").map((item) => item.message);
      let score = 0;
      if (blocking.length) {
        return {
          userId: employee.id,
          name: nameOf(employee),
          score: 0,
          eligible: false,
          reasons: blocking.map((item) => item.message),
          warnings,
        };
      }

      const availability = effectiveAvailability({
        userId: employee.id,
        date: shift.date,
        rules: context.rules,
        exceptions: context.exceptions,
      });
      const covers =
        !availability?.startTime ||
        !availability.endTime ||
        (availability.startTime <= shift.startTime && availability.endTime >= shift.endTime);
      if (availability?.status === "available" && covers) {
        score += weights.availability;
        reasons.push("Available during shift");
      } else if (availability?.status === "preferred" && covers) {
        score += weights.availability + weights.preferredAvailability;
        reasons.push("Preferred availability covers this shift");
      }
      if ((shift.qualificationIds ?? []).length && conflicts.every((item) => item.code !== "qualification")) {
        score += weights.qualification;
        reasons.push("Has the required qualification");
      }
      if (shift.positionId && employee.positionId === shift.positionId) {
        score += weights.position;
        const position = context.positions.find((item) => item.id === shift.positionId);
        reasons.push(position ? `Matches ${position.name}` : "Matches the required position");
      }
      if (shift.locationId && employee.primaryLocationId === shift.locationId) {
        score += weights.location;
        reasons.push("Assigned to this location previously");
      } else if (shift.locationId && employee.primaryLocationId && employee.primaryLocationId !== shift.locationId) {
        score -= weights.location;
        warnings.push("Primary location does not match this shift");
      }
      const hours = weeklyHours.get(employee.id) ?? 0;
      const projected = hours + shiftMinutes(shift) / 60;
      const threshold = policy.maximumWeeklyHours;
      if (hours < threshold * 0.6) {
        score += weights.weeklyHours;
        reasons.push(`${hours.toFixed(0)} scheduled hours this week`);
      }
      if (projected <= threshold) {
        score += Math.round(weights.overtimePenalty * 0.6);
        reasons.push("No overtime risk");
      } else {
        score -= weights.overtimePenalty;
        warnings.push(`Potential overtime: ${(projected - threshold).toFixed(1)} hours`);
      }
      if (fairnessOn && hours <= lowestHours + 0.01) {
        score += weights.fairness;
        reasons.push("Lower scheduled hours than other eligible employees");
      }
      if (availability?.status === "preferred") score += weights.preferredHours;
      if (!reasons.length) reasons.push("No blocking conflicts");
      return { userId: employee.id, name: nameOf(employee), score, eligible: true, reasons, warnings };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function autoFillSchedule(context: SchedulerContext, start: string, end: string) {
  return context.shifts
    .filter(
      (shift) =>
        shift.status === "draft" &&
        shift.date >= start &&
        shift.date <= end &&
        shift.instructorIds.length < shift.requiredInstructors,
    )
    .map((shift) => {
      const ranked = rankEmployees(shift, context).filter((item) => item.eligible);
      const recommended = ranked[0] ?? null;
      return {
        shiftId: shift.id,
        title: shift.title,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        recommended,
        alternatives: ranked.slice(1, 4).map((item) => ({
          userId: item.userId,
          name: item.name,
          score: item.score,
        })),
      };
    })
    .filter((item) => item.recommended);
}

export function applyRecommendationAssignments(
  shifts: Shift[],
  items: Array<{ shiftId: string; userId: string }>,
) {
  for (const item of items) {
    const shift = shifts.find((candidate) => candidate.id === item.shiftId);
    if (!shift || shift.status === "cancelled") continue;
    if (!shift.instructorIds.includes(item.userId)) shift.instructorIds.push(item.userId);
  }
}

export function scheduleHealth(context: SchedulerContext, start: string, end: string) {
  const shifts = context.shifts.filter(
    (shift) => shift.status !== "cancelled" && shift.date >= start && shift.date <= end,
  );
  const positions = shifts.reduce((sum, shift) => sum + shift.requiredInstructors, 0);
  const filled = shifts.reduce(
    (sum, shift) => sum + Math.min(shift.instructorIds.length, shift.requiredInstructors),
    0,
  );
  let conflicts = 0;
  let qualificationWarnings = 0;
  let timeOffConflicts = 0;
  let overtimeRisks = 0;
  for (const shift of shifts) {
    for (const userId of shift.instructorIds) {
      const employee = context.employees.find((item) => item.id === userId);
      if (!employee) continue;
      const found = evaluateAssignment({
        employee,
        shift,
        existingShifts: context.shifts,
        rules: context.rules,
        exceptions: context.exceptions,
        timeOff: context.timeOff,
        policy: schedulingPolicy(context.settings),
        qualifications: context.qualifications,
      });
      conflicts += found.filter((item) => item.level === "blocking").length;
      qualificationWarnings += found.filter((item) => item.code.startsWith("qualification")).length;
      timeOffConflicts += found.filter((item) => item.code === "time_off").length;
      overtimeRisks += found.filter((item) => item.code === "overtime").length;
    }
  }
  const coverage = positions === 0 ? 100 : Math.round((filled / positions) * 100);
  const unfilled = Math.max(0, positions - filled);
  const healthScore = Math.max(
    0,
    coverage - conflicts * 5 - qualificationWarnings * 3 - timeOffConflicts * 8 - overtimeRisks * 4,
  );
  return {
    coverage,
    unfilled,
    overtimeRisks,
    conflicts,
    qualificationWarnings,
    timeOffConflicts,
    healthScore,
    healthLabel: "Coverage minus documented conflict, qualification, time-off, and overtime counts. This is not an employee quality score.",
    insights: [
      unfilled ? `${unfilled} shift positions are still unfilled.` : null,
      overtimeRisks ? `${overtimeRisks} employees may exceed configured weekly hours.` : null,
      qualificationWarnings ? `${qualificationWarnings} qualification warnings are on the current schedule.` : null,
      timeOffConflicts ? `${timeOffConflicts} assignments overlap approved time off.` : null,
    ].filter((item): item is string => Boolean(item)),
  };
}

export function answerScheduleQuestion(question: string, context: SchedulerContext, start: string, end: string) {
  const text = question.toLowerCase();
  if (text.includes("unfilled") || text.includes("open")) {
    const open = context.shifts.filter(
      (shift) =>
        shift.status !== "cancelled" &&
        shift.date >= start &&
        shift.date <= end &&
        shift.instructorIds.length < shift.requiredInstructors,
    );
    return {
      answer: open.length ? `${open.length} shifts still need coverage.` : "Every shift in this range has its required coverage.",
      rows: open.map((shift) => `${shift.date} ${shift.startTime}–${shift.endTime} ${shift.title}`),
    };
  }
  if (text.includes("overtime")) {
    const threshold = schedulingPolicy(context.settings).maximumWeeklyHours;
    const rows = context.employees
      .map((employee) => ({
        employee,
        hours: weeklyScheduledMinutes(context.shifts, employee.id, start) / 60,
      }))
      .filter((item) => item.hours >= threshold - 4);
    return {
      answer: rows.length
        ? `${rows.length} employees are within 4 hours of the ${threshold} hour weekly threshold.`
        : "No employees are close to the weekly hour threshold.",
      rows: rows.map((item) => `${item.employee.firstName} ${item.employee.lastName}: ${item.hours.toFixed(1)} scheduled hours`),
    };
  }
  const sample = context.shifts.find((shift) => shift.date >= start && shift.date <= end && shift.status !== "cancelled");
  if (!sample) return { answer: "There are no shifts in this date range.", rows: [] as string[] };
  const ranked = rankEmployees(sample, context).filter((item) => item.eligible).slice(0, 5);
  return {
    answer: `Eligible employees for ${sample.title} on ${sample.date}, using scheduling rules only.`,
    rows: ranked.map((item) => `${item.name} (${item.score}): ${item.reasons[0] ?? "Eligible"}`),
  };
}
