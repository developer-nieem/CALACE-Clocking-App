import { revalidatePath } from "next/cache";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { isManager } from "@/lib/permissions";
import { denyCrossTenant } from "@/lib/phase6/domain";
import { paginate } from "@/lib/phase7/domain";
import { changePayRate } from "@/lib/time-clock/service";
import { mutateWorkforceState, readWorkforceState } from "@/lib/db/workforce";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { inviteUserSchema, updateUserSchema } from "@/lib/validations/user";
import { changePasswordSchema } from "@/lib/validations/auth";
import { readPasswordHash, setPasswordHash } from "@/lib/db/neon";
import { isDatabaseMode } from "@/lib/env";
import type { Profile } from "@/types";

export async function listUsers() {
  const user = await requirePermission("users.read");
  const state = await readWorkforceState(user.organizationId);
  const scoped = isManager(user.roles) ? state.profiles : state.profiles.filter((profile) => profile.id === user.id);
  return paginate(scoped, 1, 500).items;
}

export async function getUserById(id: string) {
  const user = await requireSession();
  if (!isManager(user.roles) && user.id !== id) {
    const { forbidden } = await import("next/navigation");
    forbidden();
  }
  const state = await readWorkforceState(user.organizationId);
  const profile = state.profiles.find((item) => item.id === id) ?? null;
  if (!profile) return null;
  if (denyCrossTenant(user.organizationId, profile.organizationId)) {
    const { forbidden } = await import("next/navigation");
    forbidden();
  }
  return profile;
}

export async function getLookups() {
  const state = await readWorkforceState();
  return {
    locations: state.locations,
    departments: state.departments,
    positions: state.positions,
    qualifications: state.qualifications,
    organizationSettings: state.settings,
  };
}

export async function inviteUser(input: unknown) {
  const actor = await requirePermission("users.invite");
  const parsed = inviteUserSchema.parse(input);
  const passwordHash = await hashPassword(parsed.password);
  const hashes = new Map<string, string>();
  const profile = await mutateWorkforceState((state) => {
    if (state.profiles.some((item) => item.email.toLowerCase() === parsed.email.toLowerCase())) {
      throw new Error("An employee with this email already exists.");
    }
    const created: Profile = {
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      email: parsed.email.toLowerCase(),
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      phone: parsed.phone ?? null,
      avatarUrl: null,
      employeeType: parsed.employeeType,
      positionId: parsed.positionId ?? null,
      departmentId: parsed.departmentId ?? null,
      primaryLocationId: parsed.primaryLocationId ?? null,
      employmentStatus: "active",
      hireDate: parsed.hireDate ?? null,
      payType: parsed.payType,
      hourlyRate: parsed.payType === "hourly" ? parsed.hourlyRate : null,
      weeklyTargetHours: parsed.weeklyTargetHours,
      maximumWeeklyHours: parsed.maximumWeeklyHours,
      defaultWeeklyHours: parsed.weeklyTargetHours ?? 40,
      maxWeeklyHours: parsed.maximumWeeklyHours ?? 40,
      lastActiveAt: null,
      qualifications: [],
      locationIds: [],
      roles: [parsed.role],
      screenCaptureEnabled: Boolean(parsed.screenCaptureEnabled),
    };
    hashes.set(created.id, passwordHash);
    state.profiles.unshift(created);
    if (created.payType === "hourly" && created.hourlyRate !== null) {
      changePayRate(state, actor.id, {
        userId: created.id,
        hourlyRate: created.hourlyRate,
        effectiveFrom: parsed.hireDate ?? new Date().toISOString().slice(0, 10),
      });
    }
    state.activity.unshift({
      id: crypto.randomUUID(),
      actorId: actor.id,
      action: "invited_user",
      entityType: "user",
      entityId: created.id,
      createdAt: new Date().toISOString(),
    });
    return created;
  }, actor.organizationId, hashes);
  revalidatePath("/users");
  return profile;
}

export async function updateUser(input: unknown) {
  const actor = await requirePermission("users.manage");
  const parsed = updateUserSchema.parse(input);
  const hashes = new Map<string, string>();
  if (parsed.password) {
    hashes.set(parsed.id, await hashPassword(parsed.password));
  }
  const profile = await mutateWorkforceState((state) => {
    const index = state.profiles.findIndex((item) => item.id === parsed.id);
    if (index === -1) throw new Error("User not found.");
    const previous = state.profiles[index];
    const rateChanged =
      parsed.payType === "hourly" &&
      parsed.hourlyRate !== null &&
      parsed.hourlyRate !== previous.hourlyRate;
    state.profiles[index] = {
      ...previous,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email,
      phone: parsed.phone ?? null,
      employeeType: parsed.employeeType,
      positionId: parsed.positionId ?? null,
      departmentId: parsed.departmentId ?? null,
      primaryLocationId: parsed.primaryLocationId ?? null,
      employmentStatus: parsed.employmentStatus,
      hireDate: parsed.hireDate ?? null,
      payType: parsed.payType,
      hourlyRate: parsed.payType === "hourly" ? parsed.hourlyRate : null,
      weeklyTargetHours: parsed.weeklyTargetHours,
      maximumWeeklyHours: parsed.maximumWeeklyHours,
      defaultWeeklyHours: parsed.weeklyTargetHours ?? 40,
      maxWeeklyHours: parsed.maximumWeeklyHours ?? 40,
      roles: [parsed.role],
      screenCaptureEnabled: Boolean(parsed.screenCaptureEnabled),
    };
    if (rateChanged && parsed.hourlyRate !== null) {
      changePayRate(state, actor.id, {
        userId: parsed.id,
        hourlyRate: parsed.hourlyRate,
        effectiveFrom: new Date().toISOString().slice(0, 10),
      });
    }
    state.activity.unshift({
      id: crypto.randomUUID(),
      actorId: actor.id,
      action: "updated_user",
      entityType: "user",
      entityId: parsed.id,
      createdAt: new Date().toISOString(),
    });
    return state.profiles[index];
  }, actor.organizationId, hashes);
  revalidatePath("/users");
  revalidatePath(`/users/${parsed.id}`);
  return profile;
}

export async function setUserStatus(id: string, status: Profile["employmentStatus"]) {
  const actor = await requirePermission("users.manage");
  const profile = await mutateWorkforceState((state) => {
    const current = state.profiles.find((item) => item.id === id);
    if (!current) throw new Error("User not found.");
    current.employmentStatus = status;
    state.activity.unshift({
      id: crypto.randomUUID(),
      actorId: actor.id,
      action:
        status === "terminated"
          ? "employee_terminated"
          : status === "archived"
            ? "employee_archived"
            : status === "inactive"
              ? "deactivated_user"
              : "updated_user",
      entityType: "user",
      entityId: id,
      createdAt: new Date().toISOString(),
    });
    return current;
  }, actor.organizationId);
  revalidatePath("/users");
  return profile;
}

export async function deleteUser(id: string) {
  const actor = await requirePermission("users.manage");
  if (actor.id === id) {
    throw new Error("You cannot delete your own account.");
  }
  await mutateWorkforceState((state) => {
    const index = state.profiles.findIndex((item) => item.id === id);
    if (index === -1) throw new Error("User not found.");
    const removedEntries = new Set(state.timeEntries.filter((item) => item.userId === id).map((item) => item.id));
    state.profiles.splice(index, 1);
    state.timeEntries = state.timeEntries.filter((item) => item.userId !== id);
    state.timeBreaks = state.timeBreaks.filter((item) => !removedEntries.has(item.timeEntryId));
    state.timeEntryEdits = state.timeEntryEdits.filter((item) => !removedEntries.has(item.timeEntryId));
    state.payRates = state.payRates.filter((item) => item.userId !== id);
    state.timeOff = state.timeOff.filter((item) => item.userId !== id);
    state.availability = state.availability.filter((item) => item.userId !== id);
    state.documents = state.documents.filter((item) => item.userId !== id);
    for (const shift of state.shifts) {
      shift.instructorIds = shift.instructorIds.filter((userId) => userId !== id);
    }
    for (const task of state.tasks) {
      task.assigneeIds = task.assigneeIds.filter((userId) => userId !== id);
    }
    state.activity.unshift({
      id: crypto.randomUUID(),
      actorId: actor.id,
      action: "deleted_user",
      entityType: "user",
      entityId: id,
      createdAt: new Date().toISOString(),
    });
  }, actor.organizationId);
  const { deleteSessionsForUser } = await import("@/lib/db/neon");
  await deleteSessionsForUser(id);
  revalidatePath("/users");
}

export async function changeOwnPassword(input: unknown) {
  const user = await requireSession();
  const parsed = changePasswordSchema.parse(input);
  if (!isDatabaseMode()) {
    throw new Error("Password changes are saved when the app is connected to the database.");
  }
  const stored = await readPasswordHash(user.id, user.organizationId);
  if (!stored || !(await verifyPassword(parsed.currentPassword, stored))) {
    throw new Error("Current password is incorrect.");
  }
  const nextHash = await hashPassword(parsed.newPassword);
  await setPasswordHash(user.id, user.organizationId, nextHash);
}
