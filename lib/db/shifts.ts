import { requirePermission, requireSession } from "@/lib/auth/session";
import { mutateWorkforceState, readWorkforceState } from "@/lib/db/workforce";
import { canOverrideWarnings, isManager } from "@/lib/permissions";
import { evaluateAssignment } from "@/lib/scheduling/engine";
import { rankInstructorsForShift } from "@/lib/scheduling/conflicts";
import { shiftSchema, type ShiftInput } from "@/lib/scheduling";
import { addDays, startOfWeekMonday, toISODate } from "@/lib/utils";
import type { Shift } from "@/types";

function pushNotice(
  state: {
    notifications: Array<{
      id: string;
      userId: string;
      type: string;
      title: string;
      message: string;
      entityType: string | null;
      entityId: string | null;
      readAt: string | null;
      createdAt: string;
    }>;
  },
  userId: string,
  title: string,
  message: string,
  entityId: string,
) {
  state.notifications.unshift({
    id: crypto.randomUUID(),
    userId,
    type: "schedule",
    title,
    message,
    entityType: "shift",
    entityId,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
}
import { revalidatePath } from "next/cache";

export async function listShifts(rangeStart: string, rangeEnd: string) {
  const user = await requireSession();
  const state = await readWorkforceState();
  const shifts = state.shifts.filter((shift) => shift.date >= rangeStart && shift.date <= rangeEnd);

  if (!isManager(user.roles)) {
    return shifts.filter((shift) => {
      if (shift.status === "draft") return false;
      return (
        shift.instructorIds.includes(user.id) ||
        (shift.isOpen && shift.status === "published")
      );
    });
  }
  return shifts;
}

export async function getShiftById(id: string) {
  await requireSession();
  const state = await readWorkforceState();
  return state.shifts.find((shift) => shift.id === id) ?? null;
}

export async function listTemplates() {
  await requirePermission("schedules.read");
  const state = await readWorkforceState();
  return state.templates;
}

function weeklyMinutesFor(userId: string, date: string, shifts: Shift[]) {
  const start = startOfWeekMonday(new Date(`${date}T00:00:00`));
  const end = toISODate(addDays(start, 6));
  const startDate = toISODate(start);
  return shifts
    .filter(
      (shift) =>
        shift.instructorIds.includes(userId) &&
        shift.status !== "cancelled" &&
        shift.date >= startDate &&
        shift.date <= end,
    )
    .reduce((sum, shift) => {
      const [startH, startM] = shift.startTime.split(":").map(Number);
      const [endH, endM] = shift.endTime.split(":").map(Number);
      return sum + (endH * 60 + endM - (startH * 60 + startM) - shift.breakDurationMinutes);
    }, 0);
}

export async function evaluateShiftWarnings(input: ShiftInput) {
  const state = await readWorkforceState();
  const warnings = [];
  for (const instructorId of input.instructorIds) {
    const instructor = state.profiles.find((profile) => profile.id === instructorId);
    if (!instructor) continue;
    const weeklyMinutes = weeklyMinutesFor(instructorId, input.date, state.shifts);
    warnings.push(
      ...evaluateAssignment({
        employee: instructor,
        shift: {
          id: input.id ?? "new",
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          breakDurationMinutes: input.breakDurationMinutes,
          qualificationIds: [],
          locationId: input.locationId ?? null,
        },
        existingShifts: state.shifts,
        rules: state.availability,
        exceptions: state.availabilityExceptions ?? [],
        timeOff: state.timeOff,
        policy: state.settings,
        qualifications: state.qualifications,
      }).map((conflict) => ({
        code: conflict.code,
        message: conflict.message,
        level: conflict.level,
        severity:
          conflict.level === "blocking"
            ? ("error" as const)
            : conflict.level === "info"
              ? ("info" as const)
              : ("warning" as const),
      })),
    );
    void weeklyMinutes;
  }
  return warnings;
}

export async function saveShift(input: unknown, publish: boolean) {
  const actor = await requirePermission("schedules.manage");
  const parsed = shiftSchema.parse(input);
  if (publish) {
    await requirePermission("schedules.publish");
    parsed.status = "published";
  }

  const warnings = await evaluateShiftWarnings(parsed);
  const blocking = warnings.filter((warning) => warning.severity === "error");
  if (blocking.length > 0 && !parsed.overrideWarnings) {
    return { ok: false as const, warnings };
  }
  if (blocking.length > 0 && parsed.overrideWarnings && !canOverrideWarnings(actor.roles)) {
    return { ok: false as const, warnings };
  }

  const shift = await mutateWorkforceState((state) => {
  const previous = parsed.id ? state.shifts.find((item) => item.id === parsed.id) ?? null : null;
  const shift: Shift = {
    id: parsed.id ?? crypto.randomUUID(),
    organizationId: actor.organizationId,
    templateId: previous?.templateId ?? null,
    title: parsed.title,
    date: parsed.date,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    locationId: parsed.locationId ?? null,
    facilityId:
      state.locations.find((item) => item.id === parsed.locationId)?.facilityId ??
      parsed.facilityId ??
      previous?.facilityId ??
      null,
    departmentId: parsed.departmentId ?? null,
    classCohort: parsed.classCohort ?? null,
    positionId: parsed.positionId ?? null,
    color: parsed.color,
    breakDurationMinutes: parsed.breakDurationMinutes,
    notes: parsed.notes ?? null,
    status: parsed.status,
    isOpen: parsed.isOpen || parsed.instructorIds.length === 0,
    requiredInstructors: parsed.requiredInstructors,
    approvalRequired: previous?.approvalRequired ?? true,
    instructorIds: parsed.instructorIds,
    tasks: parsed.tasks,
    qualificationIds: previous?.qualificationIds,
    seriesId: previous?.seriesId ?? null,
    createdBy: previous?.createdBy ?? actor.id,
    updatedAt: new Date().toISOString(),
    claimDeadline: previous?.claimDeadline ?? null,
    eligibleEmployeeTypes: previous?.eligibleEmployeeTypes,
  };

  const index = state.shifts.findIndex((item) => item.id === shift.id);
  if (index >= 0) state.shifts[index] = shift;
  else state.shifts.push(shift);

  if (previous && (previous.status === "published" || shift.status === "published")) {
    const changed =
      previous.startTime !== shift.startTime ||
      previous.endTime !== shift.endTime ||
      previous.date !== shift.date ||
      previous.locationId !== shift.locationId;
    if (changed) {
      for (const userId of previous.instructorIds) {
        pushNotice(
          state,
          userId,
          "Shift changed",
          `Your ${shift.title} shift changed from ${previous.startTime} to ${shift.startTime}.`,
          shift.id,
        );
      }
    }
    for (const userId of shift.instructorIds.filter((id) => !previous.instructorIds.includes(id))) {
      pushNotice(state, userId, "Shift assigned", `You were assigned to ${shift.title} on ${shift.date}.`, shift.id);
    }
  }

  if (parsed.saveAsTemplate) {
    state.templates.unshift({
      id: crypto.randomUUID(),
      name: shift.title,
      title: shift.title,
      startTime: shift.startTime,
      endTime: shift.endTime,
      locationId: shift.locationId,
      departmentId: shift.departmentId,
      classCohort: shift.classCohort,
      color: shift.color,
      requiredInstructors: shift.requiredInstructors,
    });
  }

  state.activity.unshift({
    id: crypto.randomUUID(),
    actorId: actor.id,
    action: previous ? "updated_shift" : "created_shift",
    entityType: "shift",
    entityId: shift.id,
    createdAt: new Date().toISOString(),
  });
  if (parsed.overrideWarnings) {
    state.scheduleOverrides.unshift({
      id: crypto.randomUUID(),
      shiftId: shift.id,
      userId: parsed.instructorIds[0] ?? actor.id,
      conflictType: "override",
      reason: parsed.overrideReason?.trim() || "Emergency coverage",
      overriddenBy: actor.id,
      createdAt: new Date().toISOString(),
    });
  }
  return shift;
  });

  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  return { ok: true as const, shift, warnings };
}

export async function deleteShift(id: string) {
  const actor = await requirePermission("schedules.manage");
  await mutateWorkforceState((state) => {
    const index = state.shifts.findIndex((shift) => shift.id === id);
    if (index === -1) throw new Error("Shift not found.");
    if (state.shifts[index].status !== "draft") {
      throw new Error("Only draft shifts can be deleted. Cancel a published shift instead.");
    }
    state.shifts.splice(index, 1);
    state.activity.unshift({
      id: crypto.randomUUID(),
      actorId: actor.id,
      action: "deleted_shift",
      entityType: "shift",
      entityId: id,
      createdAt: new Date().toISOString(),
    });
  });
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
}

export async function cancelShift(id: string) {
  const actor = await requirePermission("schedules.manage");
  const shift = await mutateWorkforceState((state) => {
    const current = state.shifts.find((item) => item.id === id);
    if (!current) throw new Error("Shift not found.");
    current.status = "cancelled";
    current.updatedAt = new Date().toISOString();
    for (const userId of current.instructorIds) {
      pushNotice(state, userId, "Shift cancelled", `${current.title} on ${current.date} was cancelled.`, current.id);
    }
    state.activity.unshift({
      id: crypto.randomUUID(),
      actorId: actor.id,
      action: "cancelled_shift",
      entityType: "shift",
      entityId: id,
      createdAt: new Date().toISOString(),
    });
    return current;
  });
  revalidatePath("/schedule");
  return shift;
}

export async function duplicateShift(id: string) {
  await requirePermission("schedules.manage");
  const copy = await mutateWorkforceState((state) => {
    const original = state.shifts.find((shift) => shift.id === id);
    if (!original) throw new Error("Shift not found.");
    const next: Shift = {
      ...original,
      id: crypto.randomUUID(),
      status: "draft",
      title: `${original.title} (copy)`,
    };
    state.shifts.push(next);
    return next;
  });
  revalidatePath("/schedule");
  return copy;
}

export async function publishShift(id: string, publish = true) {
  const actor = await requirePermission("schedules.publish");
  const shift = await mutateWorkforceState((state) => {
    const current = state.shifts.find((item) => item.id === id);
    if (!current) throw new Error("Shift not found.");
    current.status = publish ? "published" : "draft";
    if (publish) {
      for (const userId of current.instructorIds) {
        pushNotice(
          state,
          userId,
          "Shift published",
          `${current.title} on ${current.date} (${current.startTime}–${current.endTime}) is now on your schedule.`,
          current.id,
        );
      }
    }
    state.activity.unshift({
      id: crypto.randomUUID(),
      actorId: actor.id,
      action: publish ? "published_shift" : "unpublished_shift",
      entityType: "shift",
      entityId: id,
      createdAt: new Date().toISOString(),
    });
    return current;
  });
  revalidatePath("/schedule");
  return shift;
}

export async function copyPreviousWeek(anchorDate: string) {
  await requirePermission("schedules.manage");
  const copies = await mutateWorkforceState((state) => {
  const currentMonday = startOfWeekMonday(new Date(`${anchorDate}T00:00:00`));
  const previousMonday = addDays(currentMonday, -7);
  const previousStart = toISODate(previousMonday);
  const previousEnd = toISODate(addDays(previousMonday, 6));
  const copies = state.shifts
    .filter((shift) => shift.date >= previousStart && shift.date <= previousEnd)
    .map((shift) => {
      const offset =
        (new Date(`${shift.date}T00:00:00`).getTime() - previousMonday.getTime()) /
        86400000;
      return {
        ...shift,
        id: crypto.randomUUID(),
        date: toISODate(addDays(currentMonday, offset)),
        status: "draft" as const,
      };
    });
  state.shifts.push(...copies);
  return copies.length;
  });
  revalidatePath("/schedule");
  return copies;
}

export async function proposeAutoFill(rangeStart: string, rangeEnd: string) {
  await requirePermission("schedules.manage");
  const state = await readWorkforceState();
  const openOrUnassigned = state.shifts.filter(
    (shift) =>
      shift.date >= rangeStart &&
      shift.date <= rangeEnd &&
      shift.status !== "cancelled" &&
      (shift.isOpen || shift.instructorIds.length === 0),
  );
  const instructors = state.profiles.filter((profile) =>
    profile.roles.includes("instructor"),
  );
  return openOrUnassigned.map((shift) => {
    const ranked = rankInstructorsForShift({
      shift,
      instructors,
      existingShifts: state.shifts,
      availability: state.availability,
      timeOff: state.timeOff,
    });
    return {
      shift,
      proposals: ranked.slice(0, 3),
    };
  });
}

export async function applyAutoFill(assignments: Array<{ shiftId: string; instructorId: string }>) {
  await requirePermission("schedules.manage");
  await mutateWorkforceState((state) => {
  for (const assignment of assignments) {
    const shift = state.shifts.find((item) => item.id === assignment.shiftId);
    if (!shift) continue;
    if (!shift.instructorIds.includes(assignment.instructorId)) {
      shift.instructorIds = [...shift.instructorIds, assignment.instructorId].slice(
        0,
        shift.requiredInstructors,
      );
    }
    shift.isOpen = shift.instructorIds.length < shift.requiredInstructors;
    shift.status = "draft";
  }
  });
  revalidatePath("/schedule");
}
