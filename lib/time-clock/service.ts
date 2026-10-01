import { addDays, toISODate } from "@/lib/utils";
import { haversineDistanceMeters, payRateForDate } from "@/lib/time-clock/calculations";
import type {
  DeviceLocation,
  EmployeePayRate,
  GeofenceStatus,
  Location,
  OrganizationSettings,
  Profile,
  Shift,
  TimeBreak,
  TimeEntry,
  TimeEntryEdit,
} from "@/types";

export type ClockState = {
  profiles: Profile[];
  shifts: Shift[];
  locations: Location[];
  settings: OrganizationSettings;
  timeEntries: TimeEntry[];
  timeBreaks: TimeBreak[];
  timeEntryEdits: TimeEntryEdit[];
  payRates: EmployeePayRate[];
  activity: Array<{
    id: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
  }>;
};

export class ClockActionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

function clockDate(now: Date) {
  // Demo storage follows the server's date; production RPC uses organization timezone.
  return toISODate(now);
}

function geofence(
  workplace: Location | null,
  location: DeviceLocation | null,
  settings: OrganizationSettings,
) {
  if (settings.geofenceEnforcement === "disabled" || !workplace) {
    return { distance: null, status: "not_required" as GeofenceStatus };
  }
  if (
    !location ||
    workplace.latitude === null ||
    workplace.longitude === null
  ) {
    return { distance: null, status: "unavailable" as GeofenceStatus };
  }
  const distance = haversineDistanceMeters(
    location.latitude,
    location.longitude,
    workplace.latitude,
    workplace.longitude,
  );
  return {
    distance,
    status: distance <= workplace.geofenceRadiusMeters
      ? ("verified" as const)
      : ("outside_geofence" as const),
  };
}

function requiredLocation(
  action: "clock_in" | "clock_out" | "start_break" | "end_break",
  location: DeviceLocation | null,
) {
  if (location) return;
  const label =
    action === "clock_in"
      ? "clock in"
      : action === "clock_out"
        ? "clock out"
        : action === "start_break"
          ? "start a break"
          : "end a break";
  throw new ClockActionError(
    `Location access is required to ${label}. Enable location permission for this site and try again.`,
    "location_required",
  );
}

function activity(
  state: ClockState,
  actorId: string,
  action: string,
  entityId: string,
  now: Date,
) {
  state.activity.unshift({
    id: crypto.randomUUID(),
    actorId,
    action,
    entityType: "time_entry",
    entityId,
    createdAt: now.toISOString(),
  });
}

export function activeEntry(state: ClockState, userId: string) {
  return (
    state.timeEntries.find(
      (entry) => entry.userId === userId && entry.clockOutAt === null,
    ) ?? null
  );
}

export function clockIn(
  state: ClockState,
  userId: string,
  input: { shiftId?: string | null; location: DeviceLocation | null; now?: Date },
) {
  const now = input.now ?? new Date();
  if (activeEntry(state, userId)) {
    throw new ClockActionError("You are already clocked in.", "already_clocked_in");
  }
  const profile = state.profiles.find((item) => item.id === userId);
  if (!profile || profile.employmentStatus !== "active") {
    throw new ClockActionError("Employee is not active.", "inactive_employee");
  }
  const today = clockDate(now);
  const assignedShift =
    (input.shiftId
      ? state.shifts.find(
          (item) =>
            item.id === input.shiftId &&
            item.instructorIds.includes(userId) &&
            item.date === today,
        )
      : state.shifts.find(
          (item) =>
            item.date === today &&
            item.instructorIds.includes(userId) &&
            item.status === "published",
        )) ?? null;
  if (input.shiftId && !assignedShift) {
    throw new ClockActionError("This shift is not assigned to you today.", "invalid_shift");
  }
  if (!assignedShift && !state.settings.allowUnscheduledClockIn) {
    throw new ClockActionError("Unscheduled clock-in is not allowed.", "unscheduled_blocked");
  }

  requiredLocation("clock_in", input.location);
  const workplaceId = assignedShift?.locationId ?? profile.primaryLocationId;
  const workplace =
    state.locations.find((item) => item.id === workplaceId) ?? null;
  const geo = geofence(workplace, input.location, state.settings);
  if (
    state.settings.geofenceEnforcement === "strict" &&
    geo.status === "outside_geofence"
  ) {
    throw new ClockActionError("You are outside the approved work location.", "outside_geofence");
  }

  let clockStatus: TimeEntry["clockStatus"] = assignedShift ? "on_time" : "unscheduled";
  if (geo.status === "outside_geofence") clockStatus = "outside_geofence";
  if (assignedShift) {
    const scheduled = new Date(`${assignedShift.date}T${assignedShift.startTime}:00`);
    const differenceMinutes = (now.getTime() - scheduled.getTime()) / 60000;
    if (differenceMinutes < -state.settings.clockInEarlyMinutes) {
      if (state.settings.earlyClockInPolicy === "block") {
        throw new ClockActionError(
          `This shift starts at ${assignedShift.startTime}. Clock-in is available ${state.settings.clockInEarlyMinutes} minutes before the shift.`,
          "too_early",
        );
      }
      clockStatus = "early";
    } else if (differenceMinutes > state.settings.clockInLateGraceMinutes) {
      clockStatus = "late";
    }
  }

  const payRate =
    payRateForDate(state.payRates, userId, today) ?? profile.hourlyRate;
  const entry: TimeEntry = {
    id: crypto.randomUUID(),
    organizationId: profile.organizationId,
    userId,
    shiftId: assignedShift?.id ?? null,
    workDate: today,
    clockInAt: now.toISOString(),
    clockOutAt: null,
    clockInLatitude: input.location?.latitude ?? null,
    clockInLongitude: input.location?.longitude ?? null,
    clockInAccuracy: input.location?.accuracy ?? null,
    clockOutLatitude: null,
    clockOutLongitude: null,
    clockOutAccuracy: null,
    clockInLocationId: workplace?.id ?? null,
    clockOutLocationId: null,
    clockInDistanceMeters: geo.distance,
    clockOutDistanceMeters: null,
    clockInGeofenceStatus: geo.status,
    clockOutGeofenceStatus: null,
    status: "working",
    clockStatus,
    payRateSnapshot: profile.payType === "hourly" ? payRate : null,
    notes: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  state.timeEntries.unshift(entry);
  activity(state, userId, "clock_in", entry.id, now);
  return entry;
}

export function startBreak(
  state: ClockState,
  userId: string,
  input: { location: DeviceLocation | null; now?: Date },
) {
  const now = input.now ?? new Date();
  const entry = activeEntry(state, userId);
  if (!entry) throw new ClockActionError("Clock in before starting a break.", "not_clocked_in");
  if (entry.status === "on_break") {
    throw new ClockActionError("A break is already active.", "break_already_active");
  }
  requiredLocation("start_break", input.location);
  const item: TimeBreak = {
    id: crypto.randomUUID(),
    organizationId: entry.organizationId,
    timeEntryId: entry.id,
    userId,
    breakStartAt: now.toISOString(),
    breakEndAt: null,
    breakStartLatitude: input.location?.latitude ?? null,
    breakStartLongitude: input.location?.longitude ?? null,
    breakStartAccuracy: input.location?.accuracy ?? null,
    breakEndLatitude: null,
    breakEndLongitude: null,
    breakEndAccuracy: null,
    breakMinutes: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  state.timeBreaks.push(item);
  entry.status = "on_break";
  entry.updatedAt = now.toISOString();
  activity(state, userId, "start_break", entry.id, now);
  return item;
}

export function endBreak(
  state: ClockState,
  userId: string,
  input: { location: DeviceLocation | null; now?: Date },
) {
  const now = input.now ?? new Date();
  const entry = activeEntry(state, userId);
  if (!entry || entry.status !== "on_break") {
    throw new ClockActionError("There is no active break to end.", "no_active_break");
  }
  const item = state.timeBreaks.find(
    (candidate) =>
      candidate.timeEntryId === entry.id && candidate.breakEndAt === null,
  );
  if (!item) throw new ClockActionError("There is no active break to end.", "no_active_break");
  requiredLocation("end_break", input.location);
  item.breakEndAt = now.toISOString();
  item.breakEndLatitude = input.location?.latitude ?? null;
  item.breakEndLongitude = input.location?.longitude ?? null;
  item.breakEndAccuracy = input.location?.accuracy ?? null;
  item.breakMinutes = Math.floor(
    (now.getTime() - new Date(item.breakStartAt).getTime()) / 60000,
  );
  item.updatedAt = now.toISOString();
  entry.status = "working";
  entry.updatedAt = now.toISOString();
  activity(state, userId, "end_break", entry.id, now);
  return item;
}

export function clockOut(
  state: ClockState,
  userId: string,
  input: { location: DeviceLocation | null; now?: Date },
) {
  const now = input.now ?? new Date();
  const entry = activeEntry(state, userId);
  if (!entry) {
    throw new ClockActionError("There is no active time entry to clock out.", "not_clocked_in");
  }
  if (entry.status === "on_break") {
    endBreak(state, userId, { location: input.location, now });
  }
  requiredLocation("clock_out", input.location);
  const workplace =
    state.locations.find((item) => item.id === entry.clockInLocationId) ?? null;
  const geo = geofence(workplace, input.location, state.settings);
  entry.clockOutAt = now.toISOString();
  entry.clockOutLatitude = input.location?.latitude ?? null;
  entry.clockOutLongitude = input.location?.longitude ?? null;
  entry.clockOutAccuracy = input.location?.accuracy ?? null;
  entry.clockOutLocationId = workplace?.id ?? null;
  entry.clockOutDistanceMeters = geo.distance;
  entry.clockOutGeofenceStatus = geo.status;
  entry.status = "completed";
  if (geo.status === "outside_geofence") entry.clockStatus = "outside_geofence";
  entry.updatedAt = now.toISOString();
  activity(state, userId, "clock_out", entry.id, now);
  return entry;
}

const editableFields = new Set([
  "clockInAt",
  "clockOutAt",
  "breakStartAt",
  "breakEndAt",
]);

export function editTimeValue(
  state: ClockState,
  actorId: string,
  input: {
    timeEntryId: string;
    breakId?: string;
    fieldName: string;
    newValue: string;
    reason: string;
    now?: Date;
  },
) {
  if (!editableFields.has(input.fieldName)) {
    throw new ClockActionError("This field cannot be edited.", "invalid_field");
  }
  if (input.reason.trim().length < 3) {
    throw new ClockActionError("A correction reason is required.", "reason_required");
  }
  const now = input.now ?? new Date();
  const entry = state.timeEntries.find((item) => item.id === input.timeEntryId);
  if (!entry) throw new ClockActionError("Time entry not found.", "not_found");
  let oldValue: string | null;
  if (input.fieldName === "clockInAt" || input.fieldName === "clockOutAt") {
    oldValue = entry[input.fieldName];
    entry[input.fieldName] = input.newValue;
  } else {
    const item = state.timeBreaks.find(
      (candidate) =>
        candidate.id === input.breakId &&
        candidate.timeEntryId === input.timeEntryId,
    );
    if (!item) throw new ClockActionError("Break not found.", "not_found");
    const key = input.fieldName;
    oldValue = key === "breakStartAt" ? item.breakStartAt : item.breakEndAt;
    if (key === "breakStartAt") item.breakStartAt = input.newValue;
    else item.breakEndAt = input.newValue;
    if (item.breakEndAt) {
      item.breakMinutes = Math.max(
        0,
        Math.floor(
          (new Date(item.breakEndAt).getTime() -
            new Date(item.breakStartAt).getTime()) /
            60000,
        ),
      );
    }
    item.updatedAt = now.toISOString();
  }
  entry.status = "edited";
  entry.clockStatus = "admin_edited";
  entry.updatedAt = now.toISOString();
  state.timeEntryEdits.unshift({
    id: crypto.randomUUID(),
    organizationId: entry.organizationId,
    timeEntryId: entry.id,
    changedBy: actorId,
    fieldName: input.fieldName,
    oldValue,
    newValue: input.newValue,
    reason: input.reason.trim(),
    createdAt: now.toISOString(),
  });
  activity(state, actorId, "edited_time_entry", entry.id, now);
  return entry;
}

export function changePayRate(
  state: ClockState,
  actorId: string,
  input: { userId: string; hourlyRate: number; effectiveFrom: string; now?: Date },
) {
  if (!Number.isFinite(input.hourlyRate) || input.hourlyRate < 0) {
    throw new ClockActionError("Enter a valid hourly rate.", "invalid_rate");
  }
  const profile = state.profiles.find((item) => item.id === input.userId);
  if (!profile) throw new ClockActionError("Employee not found.", "not_found");
  const duplicate = state.payRates.find(
    (rate) =>
      rate.userId === input.userId &&
      rate.effectiveFrom === input.effectiveFrom,
  );
  if (duplicate) throw new ClockActionError("A rate already starts on this date.", "duplicate_rate");
  const previous = state.payRates
    .filter(
      (rate) =>
        rate.userId === input.userId &&
        rate.effectiveFrom < input.effectiveFrom &&
        !rate.effectiveTo,
    )
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if (previous) previous.effectiveTo = toISODate(addDays(new Date(`${input.effectiveFrom}T00:00:00`), -1));
  const now = input.now ?? new Date();
  const rate: EmployeePayRate = {
    id: crypto.randomUUID(),
    organizationId: profile.organizationId,
    userId: profile.id,
    hourlyRate: input.hourlyRate,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null,
    createdBy: actorId,
    createdAt: now.toISOString(),
  };
  state.payRates.push(rate);
  if (input.effectiveFrom <= clockDate(now)) profile.hourlyRate = input.hourlyRate;
  activity(state, actorId, "changed_pay_rate", profile.id, now);
  return rate;
}
