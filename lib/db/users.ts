import { revalidatePath } from "next/cache";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { isManager } from "@/lib/permissions";
import { denyCrossTenant } from "@/lib/phase6/domain";
import { paginate } from "@/lib/phase7/domain";
import { changePayRate } from "@/lib/time-clock/service";
import { mutateWorkforceState, readWorkforceState } from "@/lib/db/workforce";
import { inviteUserSchema, updateUserSchema } from "@/lib/validations/user";
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
  const profile = await mutateWorkforceState((state) => {
    const created: Profile = {
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      email: parsed.email,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      phone: parsed.phone ?? null,
      avatarUrl: null,
      employeeType: parsed.employeeType,
      positionId: parsed.positionId ?? null,
      departmentId: parsed.departmentId ?? null,
      primaryLocationId: parsed.primaryLocationId ?? null,
      employmentStatus: "invited",
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
    };
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
  }, actor.organizationId);
  revalidatePath("/users");
  return profile;
}

export async function updateUser(input: unknown) {
  const actor = await requirePermission("users.manage");
  const parsed = updateUserSchema.parse(input);
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
  }, actor.organizationId);
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
