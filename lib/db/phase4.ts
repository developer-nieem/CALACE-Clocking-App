import { getOrganizationContext, runWithOrganizationContext } from "@/lib/auth/org-context";
import { mutateWorkforceState, readWorkforceState, type WorkforceState } from "@/lib/db/workforce";
import { isDatabaseMode } from "@/lib/env";
import { listOrganizationIds, withJobLock } from "@/lib/db/neon";
import { requirePermission } from "@/lib/auth/session";
import { sendNotificationEmail } from "@/lib/notifications/email";
import {
  builtinAutomationTemplates,
  dueDailyShiftReminders,
  dueShiftReminders,
  executionKey,
  planAutomationRun,
  recordRun,
  SHIFT_DAILY_REMINDER_AUTOMATION_ID,
  SHIFT_REMINDER_AUTOMATION_ID,
  SHIFT_REMINDER_MINUTES,
} from "@/lib/phase4/automations";
import {
  answerScheduleQuestion,
  applyRecommendationAssignments,
  autoFillSchedule,
  scheduleHealth,
  type SchedulerContext,
} from "@/lib/phase4/scheduler";
import { evaluateAssignment, schedulingPolicy } from "@/lib/scheduling/engine";
import { addDays, startOfWeekMonday, toISODate } from "@/lib/utils";
import type { AutomationAction, ScheduleRecommendation, ShiftCallout } from "@/types";

function contextOf(state: WorkforceState): SchedulerContext {
  return {
    employees: state.profiles,
    shifts: state.shifts,
    rules: state.availability,
    exceptions: state.availabilityExceptions ?? [],
    timeOff: state.timeOff,
    qualifications: state.qualifications,
    positions: state.positions,
    locations: state.locations,
    settings: state.settings,
  };
}

function log(state: WorkforceState, actorId: string, action: string, entityId: string) {
  state.activity.unshift({
    id: crypto.randomUUID(),
    actorId,
    action,
    entityType: "phase4",
    entityId,
    createdAt: new Date().toISOString(),
  });
}

function orgOf(state: WorkforceState) {
  return (
    getOrganizationContext()?.organizationId ??
    state.profiles[0]?.organizationId ??
    state.shifts[0]?.organizationId ??
    ""
  );
}

function notify(state: WorkforceState, userId: string, title: string, message: string, entityId: string) {
  const id = crypto.randomUUID();
  const organizationId = orgOf(state);
  state.notifications.unshift({
    id,
    userId,
    type: "automation",
    title,
    message,
    entityType: "automation",
    entityId,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
  state.notificationDeliveries.push({
    id: crypto.randomUUID(),
    organizationId,
    notificationId: id,
    channel: "in_app",
    status: "sent",
    provider: "in_app",
    attemptCount: 1,
    sentAt: new Date().toISOString(),
    failedAt: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
  });
  state.notificationDeliveries.push({
    id: crypto.randomUUID(),
    organizationId,
    notificationId: id,
    channel: "push",
    status: "not_configured",
    provider: null,
    attemptCount: 0,
    sentAt: null,
    failedAt: null,
    errorMessage: "Push delivery is not configured.",
    createdAt: new Date().toISOString(),
  });
}

export async function answerSchedule(question: string) {
  await requirePermission("schedules.auto_fill");
  const state = await readWorkforceState();
  const start = toISODate(startOfWeekMonday(new Date()));
  const end = toISODate(addDays(startOfWeekMonday(new Date()), 6));
  return answerScheduleQuestion(question, contextOf(state), start, end);
}

export async function generateAutoFill(start: string, end: string) {
  const actor = await requirePermission("schedules.auto_fill");
  return mutateWorkforceState((state) => {
    if (state.settings.autoFillEnabled === false) {
      throw new Error("Auto fill is turned off in scheduling settings.");
    }
    const proposals = autoFillSchedule(contextOf(state), start, end);
    const recommendation: ScheduleRecommendation = {
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      dateRangeStart: start,
      dateRangeEnd: end,
      createdBy: actor.id,
      status: "pending",
      createdAt: new Date().toISOString(),
      items: proposals.map((proposal) => ({
        id: crypto.randomUUID(),
        shiftId: proposal.shiftId,
        recommendedUserId: proposal.recommended!.userId,
        score: proposal.recommended!.score,
        reasons: [
          `${proposal.title} · ${proposal.date} ${proposal.startTime}–${proposal.endTime}`,
          ...proposal.recommended!.reasons,
        ],
        warnings: proposal.recommended!.warnings,
        alternatives: proposal.alternatives,
        acceptedAt: null,
        rejectedAt: null,
      })),
    };
    state.scheduleRecommendations.unshift(recommendation);
    log(state, actor.id, "auto_fill_generated", recommendation.id);
    return recommendation;
  });
}

export async function applyAutoFill(recommendationId: string, itemIds: string[]) {
  const actor = await requirePermission("schedules.auto_fill");
  return mutateWorkforceState((state) => {
    const recommendation = state.scheduleRecommendations.find((item) => item.id === recommendationId);
    if (!recommendation) throw new Error("Recommendation not found.");
    const chosen = recommendation.items.filter((item) => itemIds.includes(item.id) && !item.rejectedAt);
    const now = new Date().toISOString();
    for (const item of chosen) {
      const shift = state.shifts.find((candidate) => candidate.id === item.shiftId);
      const employee = state.profiles.find((candidate) => candidate.id === item.recommendedUserId);
      if (!shift || !employee) throw new Error("Shift or employee no longer exists.");
      const blocking = evaluateAssignment({
        employee,
        shift,
        existingShifts: state.shifts,
        rules: state.availability,
        exceptions: state.availabilityExceptions ?? [],
        timeOff: state.timeOff,
        policy: schedulingPolicy(state.settings),
        qualifications: state.qualifications,
      }).filter((conflict) => conflict.level === "blocking");
      if (blocking.length) throw new Error(blocking[0]!.message);
      item.acceptedAt = now;
    }
    applyRecommendationAssignments(
      state.shifts,
      chosen.map((item) => ({ shiftId: item.shiftId, userId: item.recommendedUserId })),
    );
    recommendation.status = chosen.length ? "applied" : recommendation.status;
    log(state, actor.id, "recommendation_accepted", recommendation.id);
    return recommendation;
  });
}

export async function rejectAutoFill(recommendationId: string, itemIds: string[]) {
  const actor = await requirePermission("schedules.auto_fill");
  return mutateWorkforceState((state) => {
    const recommendation = state.scheduleRecommendations.find((item) => item.id === recommendationId);
    if (!recommendation) throw new Error("Recommendation not found.");
    const now = new Date().toISOString();
    for (const item of recommendation.items) {
      if (itemIds.includes(item.id)) item.rejectedAt = now;
    }
    if (recommendation.items.every((item) => item.rejectedAt)) recommendation.status = "rejected";
    log(state, actor.id, "recommendation_rejected", recommendation.id);
    return recommendation;
  });
}

export async function currentScheduleHealth() {
  await requirePermission("schedules.auto_fill");
  const state = await readWorkforceState();
  const start = toISODate(startOfWeekMonday(new Date()));
  const end = toISODate(addDays(startOfWeekMonday(new Date()), 6));
  return scheduleHealth(contextOf(state), start, end);
}

export async function installAutomationTemplates() {
  const actor = await requirePermission("automations.manage");
  return mutateWorkforceState((state) => {
    const templates = builtinAutomationTemplates(actor.organizationId, actor.id, new Date().toISOString());
    state.automations.push(...templates);
    log(state, actor.id, "automation_created", "templates");
    return templates.length;
  });
}

export async function setAutomationEnabled(id: string, enabled: boolean) {
  const actor = await requirePermission("automations.manage");
  return mutateWorkforceState((state) => {
    const automation = state.automations.find((item) => item.id === id);
    if (!automation) throw new Error("Automation not found.");
    automation.isEnabled = enabled;
    automation.updatedAt = new Date().toISOString();
    log(state, actor.id, enabled ? "automation_enabled" : "automation_disabled", id);
    return automation;
  });
}

export async function duplicateAutomation(id: string) {
  const actor = await requirePermission("automations.manage");
  return mutateWorkforceState((state) => {
    const automation = state.automations.find((item) => item.id === id);
    if (!automation) throw new Error("Automation not found.");
    const copy = {
      ...automation,
      id: crypto.randomUUID(),
      name: `${automation.name} copy`,
      isEnabled: false,
      createdBy: actor.id,
      lastRunAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      conditions: automation.conditions.map((item) => ({ ...item })),
      actions: automation.actions.map((item) => ({ ...item })),
    };
    state.automations.unshift(copy);
    return copy;
  });
}

export async function createAutomation(input: {
  name: string;
  triggerType: string;
  conditions: { field: string; operator: "eq" | "gte" | "lte"; value: string }[];
  actions: AutomationAction[];
}) {
  const actor = await requirePermission("automations.manage");
  return mutateWorkforceState((state) => {
    const now = new Date().toISOString();
    const automation = {
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      name: input.name,
      description: null,
      triggerType: input.triggerType,
      conditions: input.conditions,
      actions: input.actions.map((action) => ({ type: action.type, message: action.message })),
      isEnabled: false,
      createdBy: actor.id,
      lastRunAt: null,
      createdAt: now,
      updatedAt: now,
    };
    state.automations.unshift(automation);
    log(state, actor.id, "automation_created", automation.id);
    return automation;
  });
}

export async function submitCallout(input: { shiftId: string; reasonType: ShiftCallout["reasonType"]; notes: string | null }) {
  const actor = await requirePermission("schedules.read");
  return mutateWorkforceState((state) => {
    const shift = state.shifts.find((item) => item.id === input.shiftId);
    if (!shift || !shift.instructorIds.includes(actor.id)) throw new Error("This shift is not assigned to you.");
    const callout: ShiftCallout = {
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      shiftId: shift.id,
      userId: actor.id,
      reasonType: input.reasonType,
      notes: input.notes,
      status: "pending",
      createdAt: new Date().toISOString(),
      reviewedBy: null,
      reviewedAt: null,
    };
    state.shiftCallouts.unshift(callout);
    for (const profile of state.profiles.filter((item) => item.roles.some((role) => ["admin", "scheduler", "super_admin"].includes(role)))) {
      notify(state, profile.id, "Shift call-out", `${actor.firstName} cannot work ${shift.title} on ${shift.date}.`, callout.id);
    }
    log(state, actor.id, "callout_submitted", callout.id);
    return callout;
  });
}

export async function reviewCallout(id: string, status: ShiftCallout["status"]) {
  const actor = await requirePermission("schedules.manage");
  return mutateWorkforceState((state) => {
    const callout = state.shiftCallouts.find((item) => item.id === id);
    if (!callout) throw new Error("Call-out not found.");
    const shift = state.shifts.find((item) => item.id === callout.shiftId);
    if (!shift) throw new Error("Shift not found.");
    callout.status = status;
    callout.reviewedBy = actor.id;
    callout.reviewedAt = new Date().toISOString();
    if (status === "removed" || status === "open_shift") {
      shift.instructorIds = shift.instructorIds.filter((userId) => userId !== callout.userId);
    }
    if (status === "open_shift" && state.settings.autoCreateOpenShift) {
      shift.isOpen = true;
    }
    log(state, actor.id, "callout_reviewed", callout.id);
    return callout;
  });
}

export async function confirmShift(shiftId: string) {
  const actor = await requirePermission("schedules.read");
  return mutateWorkforceState((state) => {
    const now = new Date().toISOString();
    const existing = state.shiftConfirmations.find((item) => item.shiftId === shiftId && item.userId === actor.id);
    if (existing) {
      existing.status = "confirmed";
      existing.confirmedAt = now;
      existing.acknowledgedAt = now;
      return existing;
    }
    const confirmation = {
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      shiftId,
      userId: actor.id,
      status: "confirmed" as const,
      viewedAt: now,
      confirmedAt: now,
      acknowledgedAt: now,
    };
    state.shiftConfirmations.push(confirmation);
    log(state, actor.id, "shift_confirmed", shiftId);
    return confirmation;
  });
}

export async function runDueAutomations(now = new Date()) {
  if (isDatabaseMode()) {
    const organizations = await listOrganizationIds();
    let ran = 0;
    let status: "success" | "skipped" | "locked" = "success";
    for (const organizationId of organizations) {
      const locked = await withJobLock(`cron:automations:${organizationId}`, 120, async () =>
        runWithOrganizationContext(
          {
            userId: "system-cron",
            organizationId,
            role: "super_admin",
            permissions: [],
          },
          () => runDueAutomationsForOrg(now),
        ),
      );
      if (!locked.acquired) {
        status = "locked";
        continue;
      }
      ran += locked.result?.ran ?? 0;
      if (locked.result?.status === "skipped" && ran === 0) status = "skipped";
    }
    return { ran, status };
  }
  return runDueAutomationsForOrg(now);
}

type PendingShiftReminderEmail = {
  to: string;
  title: string;
  date: string;
  startTime: string;
  kind: "two_hour" | "daily";
};

async function runDueAutomationsForOrg(now: Date) {
  const started = Date.now();
  const result = await mutateWorkforceState((state) => {
    const organizationId = orgOf(state);
    state.settings.lastAutomationRunAt = now.toISOString();
    state.settings.lastAutomationDurationMs = 0;
    state.settings.lastAutomationStatus = "running";
    if (state.settings.shiftReminderMinutes == null) {
      state.settings.shiftReminderMinutes = SHIFT_REMINDER_MINUTES;
    }
    const keys = state.automationRuns.filter((run) => run.status === "success").map((run) => run.executionKey);
    const timeZone = state.settings.timezone || "America/Los_Angeles";
    const reminders = dueShiftReminders(
      state.shifts,
      state.profiles,
      now,
      state.settings.shiftReminderMinutes ?? SHIFT_REMINDER_MINUTES,
      timeZone,
    );
    const dailyReminders = dueDailyShiftReminders(state.shifts, state.profiles, now, timeZone);
    const pendingEmails: PendingShiftReminderEmail[] = [];
    let ran = 0;
    const queueReminder = (
      reminder: (typeof reminders)[number],
      automationId: string,
      kind: PendingShiftReminderEmail["kind"],
      title: string,
      message: string,
    ) => {
      const key = executionKey(automationId, reminder.entityId, reminder.eventTime);
      if (keys.includes(key)) return;
      const profile = state.profiles.find((item) => item.id === reminder.userId);
      notify(state, reminder.userId, title, message, reminder.shift.id);
      if (profile?.email?.includes("@")) {
        pendingEmails.push({
          to: profile.email.trim().toLowerCase(),
          title: reminder.shift.title,
          date: reminder.shift.date,
          startTime: reminder.shift.startTime,
          kind,
        });
      }
      state.automationRuns.unshift(
        recordRun({
          organizationId,
          automationId,
          key,
          status: "success",
          now: now.toISOString(),
          inputData: { shiftId: reminder.shift.id, userId: reminder.userId },
        }),
      );
      keys.push(key);
      ran += 1;
    };
    for (const reminder of dailyReminders) {
      queueReminder(
        reminder,
        SHIFT_DAILY_REMINDER_AUTOMATION_ID,
        "daily",
        "Tomorrow's shift",
        `${reminder.shift.title} is tomorrow at ${reminder.shift.startTime}.`,
      );
    }
    for (const reminder of reminders) {
      queueReminder(
        reminder,
        SHIFT_REMINDER_AUTOMATION_ID,
        "two_hour",
        "Shift reminder",
        `${reminder.shift.title} starts at ${reminder.shift.startTime} on ${reminder.shift.date}. This is your 2-hour reminder.`,
      );
    }
    if (state.settings.automationEngineEnabled === false) {
      state.settings.lastAutomationStatus = ran > 0 ? "success" : "skipped";
      state.settings.lastAutomationDurationMs = Date.now() - started;
      return { ran, status: ran > 0 ? ("success" as const) : ("skipped" as const), pendingEmails };
    }
    for (const automation of state.automations.filter((item) => item.isEnabled && item.triggerType === "shift_starting")) {
      for (const reminder of reminders) {
        const planned = planAutomationRun({
          automation,
          context: {
            entityId: reminder.entityId,
            eventTime: reminder.eventTime,
            userId: reminder.userId,
            shiftStatus: reminder.shift.status,
            locationId: reminder.shift.locationId ?? undefined,
          },
          existingKeys: keys,
          now: now.toISOString(),
        });
        if (planned.status !== "success") continue;
        notify(
          state,
          reminder.userId,
          automation.name,
          planned.actions[0]?.message ?? `${reminder.shift.title} starts at ${reminder.shift.startTime}.`,
          reminder.shift.id,
        );
        state.automationRuns.unshift(
          recordRun({
            organizationId,
            automationId: automation.id,
            key: planned.key,
            status: "success",
            now: now.toISOString(),
            inputData: { shiftId: reminder.shift.id, userId: reminder.userId },
          }),
        );
        keys.push(executionKey(automation.id, reminder.entityId, reminder.eventTime));
        automation.lastRunAt = now.toISOString();
        ran += 1;
      }
    }
    state.settings.lastAutomationStatus = "success";
    state.settings.lastAutomationDurationMs = Date.now() - started;
    return { ran, status: "success" as const, pendingEmails };
  });
  for (const email of result.pendingEmails ?? []) {
    const safeTitle = email.title.replace(/[<>]/g, "");
    const daily = email.kind === "daily";
    await sendNotificationEmail({
      to: email.to,
      template: daily ? "shift_daily_reminder" : "shift_reminder",
      message: daily
        ? `Reminder: your shift "${safeTitle}" is tomorrow at ${email.startTime} (${email.date}).`
        : `Your shift "${safeTitle}" starts at ${email.startTime} on ${email.date}. This is your 2-hour reminder. Clock in when you arrive.`,
    }).catch(() => ({ sent: false as const, reason: "provider_error" as const }));
  }
  return { ran: result.ran, status: result.status };
}
