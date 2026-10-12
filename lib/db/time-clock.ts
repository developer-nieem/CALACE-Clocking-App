import { revalidatePath } from "next/cache";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { assertTimeEditAllowed } from "@/lib/db/phase5";
import { mutateWorkforceState, readWorkforceState } from "@/lib/db/workforce";
import { redactSmtpSecrets } from "@/lib/notifications/smtp";
import { toISODate } from "@/lib/utils";
import {
  changePayRate,
  clockIn,
  clockOut,
  editTimeValue,
  endBreak,
  startBreak,
} from "@/lib/time-clock/service";
import type {
  Department,
  DeviceLocation,
  EmployeePayRate,
  Location,
  OrganizationSettings,
  Position,
  Profile,
  SessionUser,
  Shift,
  TimeBreak,
  TimeEntry,
  TimeEntryEdit,
} from "@/types";

export type TimeClockData = {
  actor: SessionUser;
  profile: Profile;
  entries: TimeEntry[];
  breaks: TimeBreak[];
  edits: TimeEntryEdit[];
  payRates: EmployeePayRate[];
  shifts: Shift[];
  profiles: Profile[];
  allEntries: TimeEntry[];
  allBreaks: TimeBreak[];
  settings: OrganizationSettings;
  locations: Location[];
  departments: Department[];
  positions: Position[];
  canManage: boolean;
  canManagePay: boolean;
};

function refreshClockViews(userId?: string) {
  revalidatePath("/time-clock");
  revalidatePath("/timesheets");
  revalidatePath("/dashboard");
  if (userId) revalidatePath(`/users/${userId}`);
}

export async function getTimeClockData(
  requestedUserId?: string,
): Promise<TimeClockData> {
  const actor = await requireSession();
  const canViewAll =
    actor.permissions.includes("time_clock.view_all") ||
    actor.permissions.includes("time_clock.manage");
  const userId = requestedUserId && canViewAll ? requestedUserId : actor.id;

  const state = await readWorkforceState();
  const profile = state.profiles.find((item) => item.id === userId);
  if (!profile) throw new Error("Employee not found.");
  const entries = state.timeEntries
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => b.clockInAt.localeCompare(a.clockInAt));
  const entryIds = new Set(entries.map((entry) => entry.id));
  return {
    actor,
    profile,
    entries,
    breaks: state.timeBreaks.filter((item) => entryIds.has(item.timeEntryId)),
    edits: canViewAll
      ? state.timeEntryEdits
      : state.timeEntryEdits.filter((item) => entryIds.has(item.timeEntryId)),
    payRates: state.payRates
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)),
    shifts: canViewAll
      ? state.shifts
      : state.shifts.filter((shift) => shift.instructorIds.includes(userId)),
    profiles: canViewAll ? state.profiles : [profile],
    allEntries: canViewAll ? state.timeEntries : entries,
    allBreaks: canViewAll
      ? state.timeBreaks
      : state.timeBreaks.filter((item) => entryIds.has(item.timeEntryId)),
    settings: redactSmtpSecrets(state.settings),
    locations: state.locations,
    departments: state.departments,
    positions: state.positions,
    canManage: actor.permissions.includes("time_clock.manage"),
    canManagePay: actor.permissions.includes("pay.manage"),
  };
}

export async function clockInUser(input: {
  shiftId?: string | null;
  location: DeviceLocation | null;
}) {
  const actor = await requirePermission("time_clock.use");
  await assertTimeEditAllowed(actor, toISODate(new Date()));
  const entry = await mutateWorkforceState(
    (state) => clockIn(state, actor.id, input),
    actor.organizationId,
  );
  refreshClockViews(actor.id);
  return entry;
}

export async function startUserBreak(location: DeviceLocation | null) {
  const actor = await requirePermission("time_clock.use");
  const item = await mutateWorkforceState(
    (state) => startBreak(state, actor.id, { location }),
    actor.organizationId,
  );
  refreshClockViews(actor.id);
  return item;
}

export async function endUserBreak(location: DeviceLocation | null) {
  const actor = await requirePermission("time_clock.use");
  const item = await mutateWorkforceState(
    (state) => endBreak(state, actor.id, { location }),
    actor.organizationId,
  );
  refreshClockViews(actor.id);
  return item;
}

export async function clockOutUser(location: DeviceLocation | null) {
  const actor = await requirePermission("time_clock.use");
  const entry = await mutateWorkforceState(
    (state) => clockOut(state, actor.id, { location }),
    actor.organizationId,
  );
  refreshClockViews(actor.id);
  return entry;
}

export async function correctTimeEntry(input: {
  timeEntryId: string;
  breakId?: string;
  fieldName: string;
  newValue: string;
  reason: string;
}) {
  const actor = await requirePermission("time_clock.manage");
  const current = (await readWorkforceState()).timeEntries.find((item) => item.id === input.timeEntryId);
  if (current) await assertTimeEditAllowed(actor, current.workDate);
  const entry = await mutateWorkforceState((state) => editTimeValue(state, actor.id, input), actor.organizationId);
  refreshClockViews(entry.userId);
  return entry;
}

export async function updateEmployeePayRate(input: {
  userId: string;
  hourlyRate: number;
  effectiveFrom: string;
}) {
  const actor = await requirePermission("pay.manage");
  const rate = await mutateWorkforceState((state) => changePayRate(state, actor.id, input), actor.organizationId);
  refreshClockViews(input.userId);
  return rate;
}
