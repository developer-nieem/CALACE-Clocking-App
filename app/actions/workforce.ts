"use server";

import { rateLimit, rateLimitKey, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { inviteUser, setUserStatus, updateUser, deleteUser } from "@/lib/db/users";
import {
  applyAutoFill,
  cancelShift,
  copyPreviousWeek,
  deleteShift,
  duplicateShift,
  evaluateShiftWarnings,
  proposeAutoFill,
  publishShift,
  saveShift,
} from "@/lib/db/shifts";
import {
  clockInUser,
  clockOutUser,
  correctTimeEntry,
  endUserBreak,
  startUserBreak,
  updateEmployeePayRate,
} from "@/lib/db/time-clock";
import {
  clockInSchema,
  correctionSchema,
  deviceLocationSchema,
  payRateSchema,
} from "@/lib/validations/time-clock";
import type { DeviceLocation } from "@/types";
import {
  updateClockSettings,
  updateWorkLocation,
} from "@/lib/db/settings";
import { ClockActionError } from "@/lib/time-clock/service";
import { getSessionUser, withSessionOrganization } from "@/lib/auth/session";
import { runWithOrganizationContext } from "@/lib/auth/org-context";
import { userFacingDatabaseError } from "@/lib/phase7/domain";
import { logEvent } from "@/lib/monitoring";
import { z } from "zod";

export async function inviteUserAction(input: unknown) {
  const limit = await rateLimit("invite-user");
  if (!limit.success) return { error: RATE_LIMIT_MESSAGE };
  try {
    const user = await withSessionOrganization(() => inviteUser(input));
    return { ok: true, user };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to invite user." };
  }
}

export async function updateUserAction(input: unknown) {
  try {
    const user = await withSessionOrganization(() => updateUser(input));
    return { ok: true, user };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update user." };
  }
}

export async function deactivateUserAction(id: string) {
  try {
    await withSessionOrganization(() => setUserStatus(id, "inactive"));
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to deactivate user." };
  }
}

export async function archiveUserAction(id: string) {
  try {
    await withSessionOrganization(async () => {
      const { terminateEmployee } = await import("@/lib/db/phase5");
      await terminateEmployee({ userId: id, mode: "archived" });
    });
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to archive user." };
  }
}

export async function deleteUserAction(id: string) {
  try {
    await withSessionOrganization(() => deleteUser(id));
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to delete user." };
  }
}

export async function saveShiftAction(input: unknown, publish: boolean) {
  try {
    return await withSessionOrganization(() => saveShift(input, publish));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save shift." };
  }
}

export async function deleteShiftAction(id: string) {
  try {
    await withSessionOrganization(() => deleteShift(id));
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to delete shift." };
  }
}

export async function cancelShiftAction(id: string) {
  try {
    const shift = await withSessionOrganization(() => cancelShift(id));
    return { ok: true, shift };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to cancel shift." };
  }
}

export async function duplicateShiftAction(id: string) {
  try {
    const shift = await withSessionOrganization(() => duplicateShift(id));
    return { ok: true, shift };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to duplicate shift." };
  }
}

export async function publishShiftAction(id: string, publish: boolean) {
  try {
    const shift = await withSessionOrganization(() => publishShift(id, publish));
    return { ok: true, shift };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update shift status." };
  }
}

export async function copyPreviousWeekAction(anchorDate: string) {
  try {
    const count = await withSessionOrganization(() => copyPreviousWeek(anchorDate));
    return { ok: true, count };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to copy week." };
  }
}

export async function applyAutoFillAction(
  assignments: Array<{ shiftId: string; instructorId: string }>,
) {
  try {
    await withSessionOrganization(() => applyAutoFill(assignments));
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to apply proposals." };
  }
}

export async function evaluateWarningsAction(input: Parameters<typeof evaluateShiftWarnings>[0]) {
  return evaluateShiftWarnings(input);
}

export async function proposeAutoFillAction(rangeStart: string, rangeEnd: string) {
  return proposeAutoFill(rangeStart, rangeEnd);
}

function safeError(error: unknown, fallback: string) {
  if (error instanceof ClockActionError) return { ok: false as const, error: error.message };
  const name = typeof error === "object" && error && "name" in error ? String((error as { name?: string }).name) : "";
  if (error instanceof z.ZodError || name === "ZodError") {
    return { ok: false as const, error: "Location could not be confirmed. Allow location for this site, then try again." };
  }
  const friendly = userFacingDatabaseError(error);
  if (friendly) return { ok: false as const, error: friendly };
  const message = error instanceof Error ? error.message : "";
  logEvent("error", "clock_action", { message: message || fallback });
  if (message && message.length <= 180) {
    return { ok: false as const, error: message };
  }
  return { ok: false as const, error: fallback };
}

export async function clockInAction(input: {
  shiftId?: string | null;
  location: DeviceLocation | null;
}) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in again." };
  const limited = await rateLimit(rateLimitKey(["clock", user.organizationId, user.id]), 20, 60_000);
  if (!limited.success) return { ok: false as const, error: RATE_LIMIT_MESSAGE };
  try {
    const parsed = clockInSchema.parse(input);
    await runWithOrganizationContext(
      {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
        permissions: user.permissions,
      },
      async () => {
        await clockInUser(parsed);
      },
    );
    return { ok: true as const };
  } catch (error) {
    return safeError(error, "We couldn't confirm your clock-in. Please check your connection and try again.");
  }
}

export async function startBreakAction(location: DeviceLocation | null) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in again." };
  const limited = await rateLimit(rateLimitKey(["clock", user.organizationId, user.id]), 20, 60_000);
  if (!limited.success) return { ok: false as const, error: RATE_LIMIT_MESSAGE };
  try {
    const parsed = deviceLocationSchema.parse(location);
    await runWithOrganizationContext(
      {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
        permissions: user.permissions,
      },
      async () => {
        await startUserBreak(parsed);
      },
    );
    return { ok: true as const };
  } catch (error) {
    return safeError(error, "We couldn't confirm your break. Please check your connection and try again.");
  }
}

export async function endBreakAction(location: DeviceLocation | null) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in again." };
  const limited = await rateLimit(rateLimitKey(["clock", user.organizationId, user.id]), 20, 60_000);
  if (!limited.success) return { ok: false as const, error: RATE_LIMIT_MESSAGE };
  try {
    const parsed = deviceLocationSchema.parse(location);
    await runWithOrganizationContext(
      {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
        permissions: user.permissions,
      },
      async () => {
        await endUserBreak(parsed);
      },
    );
    return { ok: true as const };
  } catch (error) {
    return safeError(error, "We couldn't confirm ending your break. Please check your connection and try again.");
  }
}

export async function clockOutAction(location: DeviceLocation | null) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in again." };
  const limited = await rateLimit(rateLimitKey(["clock", user.organizationId, user.id]), 20, 60_000);
  if (!limited.success) return { ok: false as const, error: RATE_LIMIT_MESSAGE };
  try {
    const parsed = deviceLocationSchema.parse(location);
    await runWithOrganizationContext(
      {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
        permissions: user.permissions,
      },
      async () => {
        await clockOutUser(parsed);
      },
    );
    return { ok: true as const };
  } catch (error) {
    return safeError(error, "We couldn't confirm your clock-out. Please check your connection and try again.");
  }
}

export async function correctTimeEntryAction(input: unknown) {
  try {
    const parsed = correctionSchema.parse(input);
    await withSessionOrganization(() => correctTimeEntry(parsed));
    return { ok: true as const };
  } catch (error) {
    return safeError(error, "Unable to correct time entry.");
  }
}

export async function updatePayRateAction(input: unknown) {
  try {
    const parsed = payRateSchema.parse(input);
    const rate = await withSessionOrganization(() => updateEmployeePayRate(parsed));
    return { ok: true as const, rate };
  } catch (error) {
    return safeError(error, "Unable to update pay rate.");
  }
}

export async function updateClockSettingsAction(input: unknown) {
  try {
    const parsed = z
      .object({
        requireLocationClockIn: z.boolean(),
        requireLocationClockOut: z.boolean(),
        geofenceEnforcement: z.enum(["strict", "warning", "disabled"]),
        allowUnscheduledClockIn: z.boolean(),
      })
      .parse(input);
    await withSessionOrganization(() => updateClockSettings(parsed));
    return { ok: true as const };
  } catch (error) {
    return safeError(error, "Unable to update clock settings.");
  }
}

export async function updateWorkLocationAction(input: unknown) {
  try {
    const parsed = z
      .object({
        id: z.string().min(1),
        latitude: z.number().min(-90).max(90).nullable(),
        longitude: z.number().min(-180).max(180).nullable(),
        geofenceRadiusMeters: z.number().min(10).max(100_000),
        geolocationRequired: z.boolean(),
      })
      .parse(input);
    await withSessionOrganization(() => updateWorkLocation(parsed));
    return { ok: true as const };
  } catch (error) {
    return safeError(error, "Unable to update work location.");
  }
}
