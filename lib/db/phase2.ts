import { revalidatePath } from "next/cache";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { mutateWorkforceState, readWorkforceState } from "@/lib/db/workforce";
import { isManager } from "@/lib/permissions";
import {
  claimOpenShift,
  evaluateAssignment,
  generateSeriesDates,
  schedulingPolicy,
} from "@/lib/scheduling/engine";
import type {
  AvailabilityException,
  AvailabilityRule,
  Shift,
  ShiftTradeRequest,
} from "@/types";

function notify(
  state: { notifications: { id: string; userId: string; type: string; title: string; message: string; entityType: string | null; entityId: string | null; readAt: string | null; createdAt: string }[] },
  userId: string,
  title: string,
  message: string,
  entityId?: string,
) {
  state.notifications.unshift({
    id: crypto.randomUUID(),
    userId,
    type: "schedule",
    title,
    message,
    entityType: "shift",
    entityId: entityId ?? null,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
}

export async function saveAvailability(input: {
  userId?: string;
  rules?: Array<Pick<AvailabilityRule, "weekday" | "status" | "startTime" | "endTime">>;
  exceptions?: AvailabilityException[];
}) {
  const actor = await requireSession();
  const userId = input.userId && isManager(actor.roles) ? input.userId : actor.id;
  if (userId !== actor.id && !isManager(actor.roles)) {
    throw new Error("You can only edit your own availability.");
  }
  await mutateWorkforceState((state) => {
    if (input.rules) {
      state.availability = state.availability.filter((rule) => rule.userId !== userId);
      for (const rule of input.rules) {
        state.availability.push({
          id: crypto.randomUUID(),
          userId,
          weekday: rule.weekday,
          status: rule.status,
          startTime: rule.startTime,
          endTime: rule.endTime,
        });
      }
    }
    if (input.exceptions) {
      state.availabilityExceptions = state.availabilityExceptions.filter((item) => item.userId !== userId);
      state.availabilityExceptions.push(...input.exceptions.map((item) => ({ ...item, userId })));
    }
    if (userId !== actor.id) {
      state.activity.unshift({
        id: crypto.randomUUID(),
        actorId: actor.id,
        action: "updated_availability",
        entityType: "profile",
        entityId: userId,
        createdAt: new Date().toISOString(),
      });
    }
  });
  revalidatePath("/availability");
}

export async function requestTimeOff(input: {
  requestType: "vacation" | "sick" | "personal" | "training" | "other";
  startDate: string;
  endDate: string;
  isPartialDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  reason: string;
  notes?: string | null;
}) {
  const actor = await requireSession();
  await mutateWorkforceState((state) => {
    state.timeOff.unshift({
      id: crypto.randomUUID(),
      userId: actor.id,
      startDate: input.startDate,
      endDate: input.endDate,
      isPartialDay: input.isPartialDay,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      reason: input.reason,
      notes: input.notes ?? null,
      status: "pending",
      requestType: input.requestType,
    });
  });
  revalidatePath("/time-off");
}

export async function reviewTimeOff(id: string, status: "approved" | "rejected" | "cancelled", reviewNotes?: string) {
  const actor = await requireSession();
  if (status !== "cancelled") await requirePermission("time_off.approve");
  if (status === "rejected" && !reviewNotes?.trim()) {
    throw new Error("A rejection reason is required.");
  }
  await mutateWorkforceState((state) => {
    const request = state.timeOff.find((item) => item.id === id);
    if (!request) throw new Error("Request not found.");
    if (status === "cancelled" && request.userId !== actor.id && !isManager(actor.roles)) {
      throw new Error("You cannot cancel this request.");
    }
    request.status = status;
    request.reviewedBy = actor.id;
    request.reviewNotes = reviewNotes ?? null;
    const overlapping = state.shifts.filter(
      (shift) =>
        shift.status !== "cancelled" &&
        shift.instructorIds.includes(request.userId) &&
        shift.date >= request.startDate &&
        shift.date <= request.endDate,
    );
    notify(
      state,
      request.userId,
      status === "approved" ? "Time off approved" : "Time off updated",
      status === "approved"
        ? `Your time off ${request.startDate}–${request.endDate} was approved.`
        : reviewNotes || "Your time off request was updated.",
    );
    if (status === "approved" && overlapping.length) {
      for (const manager of state.profiles.filter((profile) =>
        profile.roles.some((role) => role === "admin" || role === "scheduler" || role === "super_admin"),
      )) {
        notify(
          state,
          manager.id,
          "Time off overlaps a shift",
          `${request.userId} has ${overlapping.length} existing shift(s) during approved time off. Shifts were not deleted.`,
          overlapping[0]?.id,
        );
      }
    }
  });
  revalidatePath("/time-off");
  revalidatePath("/schedule");
}

export async function publishWeek(start: string, end: string) {
  const actor = await requirePermission("schedules.publish");
  const count = await mutateWorkforceState((state) => {
    const targets = state.shifts.filter(
      (shift) => shift.status === "draft" && shift.date >= start && shift.date <= end,
    );
    for (const shift of targets) {
      shift.status = "published";
      shift.updatedAt = new Date().toISOString();
      for (const userId of shift.instructorIds) {
        notify(state, userId, "Shift published", `${shift.title} on ${shift.date} is now published.`, shift.id);
      }
    }
    state.activity.unshift({
      id: crypto.randomUUID(),
      actorId: actor.id,
      action: "published_week",
      entityType: "schedule",
      entityId: start,
      createdAt: new Date().toISOString(),
    });
    return targets.length;
  });
  revalidatePath("/schedule");
  return count;
}

export async function createRecurringShifts(input: {
  title: string;
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  locationId?: string | null;
  instructorIds?: string[];
  qualificationIds?: string[];
  breakDurationMinutes?: number;
}) {
  const actor = await requirePermission("schedules.manage");
  const seriesId = crypto.randomUUID();
  const instructorIds = input.instructorIds ?? [];
  const dates = generateSeriesDates({
    recurrenceType: "weekly",
    daysOfWeek: input.daysOfWeek,
    startDate: input.startDate,
    endDate: input.endDate,
    occurrenceCount: null,
  });
  await mutateWorkforceState((state) => {
    state.shiftSeries.unshift({
      id: seriesId,
      title: input.title,
      recurrenceType: "weekly",
      daysOfWeek: input.daysOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      startDate: input.startDate,
      endDate: input.endDate,
      occurrenceCount: dates.length,
      locationId: input.locationId ?? null,
      departmentId: null,
      qualificationIds: input.qualificationIds ?? [],
      requiredInstructors: Math.max(1, instructorIds.length),
      breakDurationMinutes: input.breakDurationMinutes ?? 0,
      createdBy: actor.id,
    });
    for (const date of dates) {
      state.shifts.push({
        id: crypto.randomUUID(),
        organizationId: actor.organizationId,
        templateId: null,
        seriesId,
        title: input.title,
        date,
        startTime: input.startTime,
        endTime: input.endTime,
        locationId: input.locationId ?? null,
        departmentId: null,
        classCohort: null,
        positionId: null,
        color: "#0D2A43",
        breakDurationMinutes: input.breakDurationMinutes ?? 0,
        notes: null,
        status: "draft",
        isOpen: instructorIds.length === 0,
        requiredInstructors: Math.max(1, instructorIds.length || 1),
        approvalRequired: true,
        instructorIds,
        tasks: [],
        qualificationIds: input.qualificationIds ?? [],
        createdBy: actor.id,
      });
    }
  });
  revalidatePath("/schedule");
  return dates.length;
}

export async function createShiftFromTemplate(input: {
  templateId: string;
  date: string;
  instructorIds: string[];
}) {
  const actor = await requirePermission("schedules.manage");
  await mutateWorkforceState((state) => {
    const template = state.templates.find((item) => item.id === input.templateId);
    if (!template) throw new Error("Template not found.");
    state.shifts.push({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      templateId: template.id,
      title: template.title,
      date: input.date,
      startTime: template.startTime,
      endTime: template.endTime,
      locationId: template.locationId,
      departmentId: template.departmentId,
      classCohort: template.classCohort,
      positionId: null,
      color: template.color,
      breakDurationMinutes: 0,
      notes: null,
      status: "draft",
      isOpen: input.instructorIds.length < template.requiredInstructors,
      requiredInstructors: template.requiredInstructors,
      approvalRequired: true,
      instructorIds: input.instructorIds,
      tasks: [],
      createdBy: actor.id,
    });
  });
  revalidatePath("/schedule");
}

export async function requestOpenShift(shiftId: string) {
  const actor = await requireSession();
  await mutateWorkforceState((state) => {
    if (state.settings.allowOpenShiftClaims === false) {
      throw new Error("Open shift claims are disabled.");
    }
    const shift = state.shifts.find((item) => item.id === shiftId);
    const employee = state.profiles.find((item) => item.id === actor.id);
    if (!shift || !employee) throw new Error("Shift not found.");
    const conflicts = evaluateAssignment({
      employee,
      shift,
      existingShifts: state.shifts,
      rules: state.availability,
      exceptions: state.availabilityExceptions,
      timeOff: state.timeOff,
      policy: schedulingPolicy(state.settings),
      qualifications: state.qualifications,
    }).filter((item) => item.level === "blocking");
    if (conflicts.length) throw new Error(conflicts[0].message);
    const decision = claimOpenShift({ shift, employee, requests: state.openShiftRequests });
    if (!decision.ok) throw new Error(decision.error);
    if (!shift.approvalRequired) {
      if (!shift.instructorIds.includes(actor.id)) shift.instructorIds.push(actor.id);
      if (shift.instructorIds.length >= shift.requiredInstructors) shift.isOpen = false;
      state.openShiftRequests.unshift({
        id: crypto.randomUUID(),
        shiftId,
        userId: actor.id,
        status: "approved",
        requestedAt: new Date().toISOString(),
        reviewedBy: actor.id,
      });
    } else {
      state.openShiftRequests.unshift({
        id: crypto.randomUUID(),
        shiftId,
        userId: actor.id,
        status: "pending",
        requestedAt: new Date().toISOString(),
      });
    }
  });
  revalidatePath("/open-shifts");
  revalidatePath("/schedule");
}

export async function reviewOpenShift(requestId: string, status: "approved" | "rejected", reviewNotes?: string) {
  const actor = await requirePermission("open_shifts.approve");
  await mutateWorkforceState((state) => {
    const request = state.openShiftRequests.find((item) => item.id === requestId);
    const shift = request ? state.shifts.find((item) => item.id === request.shiftId) : null;
    if (!request || !shift) throw new Error("Claim not found.");
    if (status === "approved") {
      const slots = new Set(shift.instructorIds);
      if (!slots.has(request.userId) && slots.size >= shift.requiredInstructors) {
        throw new Error("This shift is already full.");
      }
      if (!shift.instructorIds.includes(request.userId)) shift.instructorIds.push(request.userId);
      if (shift.instructorIds.length >= shift.requiredInstructors) shift.isOpen = false;
    }
    request.status = status;
    request.reviewedBy = actor.id;
    request.reviewNotes = reviewNotes ?? null;
    notify(
      state,
      request.userId,
      status === "approved" ? "Open shift approved" : "Open shift declined",
      status === "approved" ? `${shift.title} was added to your schedule.` : reviewNotes || "Your claim was declined.",
      shift.id,
    );
  });
  revalidatePath("/open-shifts");
}

export async function requestTrade(input: {
  shiftId: string;
  tradeType: "offer" | "swap";
  targetUserId?: string | null;
  targetShiftId?: string | null;
  reason?: string | null;
}) {
  const actor = await requireSession();
  await mutateWorkforceState((state) => {
    if (state.settings.allowShiftTrades === false) throw new Error("Shift trades are disabled.");
    const shift = state.shifts.find((item) => item.id === input.shiftId);
    if (!shift || !shift.instructorIds.includes(actor.id) || shift.status !== "published") {
      throw new Error("You can only trade your published shifts.");
    }
    state.trades.unshift({
      id: crypto.randomUUID(),
      shiftId: shift.id,
      fromUserId: actor.id,
      toUserId: input.targetUserId ?? null,
      targetShiftId: input.targetShiftId ?? null,
      tradeType: input.tradeType,
      status: input.tradeType === "swap" ? "pending" : "pending",
      employeeResponseStatus: input.tradeType === "swap" ? "pending" : null,
      reason: input.reason ?? null,
    });
    if (input.targetUserId) {
      notify(state, input.targetUserId, "Shift trade requested", `${actor.firstName} requested a ${input.tradeType}.`, shift.id);
    }
  });
  revalidatePath("/shift-trades");
}

export async function respondToTrade(id: string, accept: boolean) {
  const actor = await requireSession();
  await mutateWorkforceState((state) => {
    const trade = state.trades.find((item) => item.id === id);
    if (!trade || trade.toUserId !== actor.id) throw new Error("This trade is not waiting for you.");
    trade.employeeResponseStatus = accept ? "accepted" : "declined";
    if (!accept) trade.status = "rejected";
    notify(state, trade.fromUserId, accept ? "Trade accepted" : "Trade declined", accept ? "Waiting for admin approval." : "The other employee declined.", trade.shiftId);
  });
  revalidatePath("/shift-trades");
}

export async function reviewTrade(id: string, approve: boolean, reviewNotes?: string) {
  const actor = await requirePermission("shift_trades.approve");
  await mutateWorkforceState((state) => {
    const trade = state.trades.find((item) => item.id === id);
    if (!trade) throw new Error("Trade not found.");
    if (trade.tradeType === "swap" && trade.employeeResponseStatus !== "accepted" && approve) {
      throw new Error("The other employee must accept the swap before admin approval.");
    }
    const shift = state.shifts.find((item) => item.id === trade.shiftId);
    if (!shift) throw new Error("Shift not found.");
    if (!approve) {
      trade.status = "rejected";
      notify(state, trade.fromUserId, "Trade rejected", reviewNotes || "An admin rejected this trade.", shift.id);
      return;
    }
    const replacementId = trade.tradeType === "swap" ? trade.toUserId : trade.replacementUserId ?? trade.toUserId;
    if (!replacementId) throw new Error("Choose a replacement before approval.");
    const employee = state.profiles.find((item) => item.id === replacementId);
    if (!employee) throw new Error("Replacement not found.");
    const conflicts = evaluateAssignment({
      employee,
      shift,
      existingShifts: state.shifts.filter((item) => item.id !== shift.id),
      rules: state.availability,
      exceptions: state.availabilityExceptions,
      timeOff: state.timeOff,
      policy: schedulingPolicy(state.settings),
      qualifications: state.qualifications,
    }).filter((item) => item.level === "blocking");
    if (conflicts.length) throw new Error(conflicts[0].message);
    shift.instructorIds = shift.instructorIds.filter((userId) => userId !== trade.fromUserId);
    if (!shift.instructorIds.includes(replacementId)) shift.instructorIds.push(replacementId);
    if (trade.tradeType === "swap" && trade.targetShiftId && trade.toUserId) {
      const other = state.shifts.find((item) => item.id === trade.targetShiftId);
      if (other) {
        other.instructorIds = other.instructorIds.filter((userId) => userId !== trade.toUserId);
        if (!other.instructorIds.includes(trade.fromUserId)) other.instructorIds.push(trade.fromUserId);
      }
    }
    trade.status = "approved";
    notify(state, trade.fromUserId, "Trade approved", "Your shift assignment was updated.", shift.id);
    notify(state, replacementId, "Trade approved", `${shift.title} is now on your schedule.`, shift.id);
    state.activity.unshift({
      id: crypto.randomUUID(),
      actorId: actor.id,
      action: "approved_trade",
      entityType: "shift",
      entityId: shift.id,
      createdAt: new Date().toISOString(),
    });
  });
  revalidatePath("/shift-trades");
  revalidatePath("/schedule");
}

export async function offerReplacement(tradeId: string) {
  const actor = await requireSession();
  await mutateWorkforceState((state) => {
    const trade = state.trades.find((item) => item.id === tradeId);
    if (!trade || trade.tradeType !== "offer") throw new Error("Offer not found.");
    trade.replacementUserId = actor.id;
    trade.toUserId = actor.id;
    trade.employeeResponseStatus = "accepted";
    notify(state, trade.fromUserId, "Replacement requested", "A coworker requested your offered shift. Admin approval is still required.", trade.shiftId);
  });
  revalidatePath("/shift-trades");
}

export async function getScheduleWorkspace() {
  const actor = await requireSession();
  const state = await readWorkforceState();
  const manager = isManager(actor.roles);
  return {
    actor,
    manager,
    profiles: manager ? state.profiles : state.profiles.filter((profile) => profile.id === actor.id),
    shifts: manager
      ? state.shifts
      : state.shifts.filter((shift) => shift.status !== "draft" && (shift.instructorIds.includes(actor.id) || shift.isOpen)),
    availability: manager ? state.availability : state.availability.filter((rule) => rule.userId === actor.id),
    exceptions: manager
      ? state.availabilityExceptions
      : state.availabilityExceptions.filter((item) => item.userId === actor.id),
    timeOff: manager ? state.timeOff : state.timeOff.filter((item) => item.userId === actor.id),
    openShiftRequests: state.openShiftRequests,
    trades: manager
      ? state.trades
      : state.trades.filter((trade) => trade.fromUserId === actor.id || trade.toUserId === actor.id),
    templates: state.templates,
    qualifications: state.qualifications,
    locations: state.locations,
    departments: state.departments,
    positions: state.positions,
    settings: state.settings,
    notifications: state.notifications.filter((item) => item.userId === actor.id),
  };
}

export type { Shift, ShiftTradeRequest };
