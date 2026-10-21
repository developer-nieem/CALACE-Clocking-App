import type {
  Automation,
  AutomationAction,
  AutomationCondition,
  AutomationRun,
  Profile,
  Shift,
} from "@/types";

export type AutomationContext = {
  entityId: string;
  eventTime: string;
  employeeType?: string;
  role?: string;
  departmentId?: string;
  locationId?: string;
  positionId?: string;
  shiftStatus?: string;
  weeklyHours?: number;
  userId?: string;
};

export function executionKey(automationId: string, entityId: string, eventTime: string) {
  return `${automationId}:${entityId}:${eventTime}`;
}

export function conditionsMatch(conditions: AutomationCondition[], context: AutomationContext) {
  return conditions.every((condition) => {
    const current = String(
      condition.field === "employee_type"
        ? context.employeeType
        : condition.field === "role"
          ? context.role
          : condition.field === "department"
            ? context.departmentId
            : condition.field === "location"
              ? context.locationId
              : condition.field === "position"
                ? context.positionId
                : condition.field === "shift_status"
                  ? context.shiftStatus
                  : condition.field === "weekly_hours"
                    ? context.weeklyHours
                    : "",
    );
    if (condition.operator === "eq") return current === condition.value;
    const left = Number(current);
    const right = Number(condition.value);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    return condition.operator === "gte" ? left >= right : left <= right;
  });
}

export function planAutomationRun(input: {
  automation: Automation;
  context: AutomationContext;
  existingKeys: string[];
  now: string;
}): { status: "success" | "skipped"; key: string; actions: AutomationAction[]; reason?: string } {
  const key = executionKey(input.automation.id, input.context.entityId, input.context.eventTime);
  if (!input.automation.isEnabled) return { status: "skipped", key, actions: [], reason: "disabled" };
  if (input.existingKeys.includes(key)) return { status: "skipped", key, actions: [], reason: "already_ran" };
  if (!conditionsMatch(input.automation.conditions, input.context)) {
    return { status: "skipped", key, actions: [], reason: "conditions" };
  }
  return { status: "success", key, actions: input.automation.actions };
}

export function builtinAutomationTemplates(organizationId: string, createdBy: string | null, now: string): Automation[] {
  const base = (name: string, triggerType: string, actions: AutomationAction[], description: string): Automation => ({
    id: crypto.randomUUID(),
    organizationId,
    name,
    description,
    triggerType,
    conditions: [],
    actions,
    isEnabled: false,
    createdBy,
    lastRunAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return [
    base("Clock-In Reminder", "shift_starting", [{ type: "notify_employee", message: "Your shift starts in about 2 hours. Clock in when you arrive." }], "2 hours before a shift."),
    base("Late Clock-In Alert", "late_clock_in", [{ type: "notify_employee" }, { type: "notify_admin" }], "Late grace period passed without a clock-in."),
    base("Missing Clock-Out", "missing_clock_out", [{ type: "notify_employee" }, { type: "notify_admin" }, { type: "timesheet_exception" }], "60 minutes after shift end without clock-out."),
    base("Overtime Warning", "overtime_risk", [{ type: "notify_scheduler", message: "Projected weekly hours exceed the warning threshold." }], "Projected weekly hours exceed the threshold."),
    base("Qualification Expiring", "qualification_expiring", [{ type: "notify_employee" }, { type: "notify_admin" }], "30 days before a qualification expires."),
    base("Document Expiring", "document_expiring", [{ type: "notify_employee" }], "30 days before a document expires."),
    base("Task Reminder", "task_due_soon", [{ type: "notify_employee" }], "24 hours before a task is due."),
    base("Open Shift Alert", "open_shift_created", [{ type: "notify_employee", message: "An open shift is available." }], "When an open shift is created."),
  ];
}

export const SHIFT_REMINDER_MINUTES = 120;
export const SHIFT_REMINDER_AUTOMATION_ID = "builtin-shift-reminder";
export const SHIFT_DAILY_REMINDER_AUTOMATION_ID = "builtin-shift-daily-reminder";

function formatInTimeZone(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

export function zonedShiftStartMs(date: string, startTime: string, timeZone: string) {
  const desired = `${date}T${startTime.length === 5 ? `${startTime}:00` : startTime}`;
  let guess = Date.parse(`${desired}Z`);
  if (Number.isNaN(guess)) return Number.NaN;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shown = formatInTimeZone(guess, timeZone);
    const delta = Date.parse(`${desired}Z`) - Date.parse(`${shown}Z`);
    if (delta === 0) return guess;
    guess += delta;
  }
  return guess;
}

function assigneeRows(
  shift: Shift,
  profiles: Profile[],
) {
  return shift.instructorIds
    .filter((userId) =>
      profiles.some(
        (profile) =>
          profile.id === userId &&
          profile.employmentStatus !== "inactive" &&
          profile.employmentStatus !== "terminated" &&
          profile.employmentStatus !== "archived",
      ),
    )
    .map((userId) => ({
      entityId: `${shift.id}:${userId}`,
      eventTime: `${shift.date}T${shift.startTime}`,
      userId,
      shift,
    }));
}

export function calendarDateInTimeZone(now: Date, timeZone = "America/Los_Angeles") {
  return formatInTimeZone(now.getTime(), timeZone).slice(0, 10);
}

export function addCalendarDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function dueShiftReminders(
  shifts: Shift[],
  profiles: Profile[],
  now: Date,
  minutesBefore = SHIFT_REMINDER_MINUTES,
  timeZone = "America/Los_Angeles",
) {
  const windowEnd = now.getTime() + minutesBefore * 60_000;
  return shifts
    .filter((shift) => shift.status === "published")
    .flatMap((shift) => {
      const start = zonedShiftStartMs(shift.date, shift.startTime, timeZone);
      if (!Number.isFinite(start) || start < now.getTime() || start > windowEnd) return [];
      return assigneeRows(shift, profiles);
    });
}

export function dueDailyShiftReminders(
  shifts: Shift[],
  profiles: Profile[],
  now: Date,
  timeZone = "America/Los_Angeles",
) {
  const today = calendarDateInTimeZone(now, timeZone);
  const tomorrow = addCalendarDays(today, 1);
  return shifts
    .filter((shift) => shift.status === "published" && shift.date === tomorrow)
    .flatMap((shift) => assigneeRows(shift, profiles));
}

export function recordRun(input: {
  organizationId: string;
  automationId: string;
  key: string;
  status: AutomationRun["status"];
  now: string;
  errorMessage?: string | null;
  inputData?: Record<string, string>;
}): AutomationRun {
  return {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    automationId: input.automationId,
    executionKey: input.key,
    triggeredAt: input.now,
    status: input.status,
    inputData: input.inputData ?? {},
    resultData: input.status === "success" ? { delivered: "true" } : null,
    errorMessage: input.errorMessage ?? null,
    completedAt: input.now,
  };
}
