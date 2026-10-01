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
    base("Clock-In Reminder", "shift_starting", [{ type: "notify_employee", message: "Your shift starts soon. Clock in when you arrive." }], "30 minutes before a shift."),
    base("Late Clock-In Alert", "late_clock_in", [{ type: "notify_employee" }, { type: "notify_admin" }], "Late grace period passed without a clock-in."),
    base("Missing Clock-Out", "missing_clock_out", [{ type: "notify_employee" }, { type: "notify_admin" }, { type: "timesheet_exception" }], "60 minutes after shift end without clock-out."),
    base("Overtime Warning", "overtime_risk", [{ type: "notify_scheduler", message: "Projected weekly hours exceed the warning threshold." }], "Projected weekly hours exceed the threshold."),
    base("Qualification Expiring", "qualification_expiring", [{ type: "notify_employee" }, { type: "notify_admin" }], "30 days before a qualification expires."),
    base("Document Expiring", "document_expiring", [{ type: "notify_employee" }], "30 days before a document expires."),
    base("Task Reminder", "task_due_soon", [{ type: "notify_employee" }], "24 hours before a task is due."),
    base("Open Shift Alert", "open_shift_created", [{ type: "notify_employee", message: "An open shift is available." }], "When an open shift is created."),
  ];
}

export function dueShiftReminders(shifts: Shift[], profiles: Profile[], now: Date, minutesBefore: number) {
  const windowEnd = now.getTime() + minutesBefore * 60_000;
  return shifts
    .filter((shift) => shift.status === "published")
    .flatMap((shift) => {
      const start = new Date(`${shift.date}T${shift.startTime}:00`).getTime();
      if (start < now.getTime() || start > windowEnd) return [];
      return shift.instructorIds
        .filter((userId) => profiles.some((profile) => profile.id === userId))
        .map((userId) => ({
          entityId: `${shift.id}:${userId}`,
          eventTime: `${shift.date}T${shift.startTime}`,
          userId,
          shift,
        }));
    });
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
