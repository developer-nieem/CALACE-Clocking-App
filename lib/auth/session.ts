import { cookies } from "next/headers";
import { DEMO_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { runWithOrganizationContext, bindOrganizationContext } from "@/lib/auth/org-context";
import { toSessionUser } from "@/lib/demo/data";
import { findDemoProfile } from "@/lib/demo/store";
import { readSession } from "@/lib/db/neon";
import { readWorkforceState } from "@/lib/db/workforce";
import { isDatabaseMode } from "@/lib/env";
import {
  hasPermission,
  primaryRole,
  ROLE_PERMISSIONS,
  type Permission,
} from "@/lib/permissions";
import type { SessionUser } from "@/types";

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isDatabaseMode()) {
    const cookieStore = await cookies();
    const userId = cookieStore.get(DEMO_COOKIE)?.value;
    if (!userId) return null;
    const profile = findDemoProfile(userId);
    if (!profile) return null;
    const user = toSessionUser(profile);
    bindOrganizationContext({
      userId: profile.id,
      organizationId: profile.organizationId,
      role: user.role,
      permissions: user.permissions,
    });
    return user;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await readSession(token);
  if (!session) return null;
  const user = await runWithOrganizationContext(
    {
      userId: session.userId,
      organizationId: session.organizationId,
      role: "staff",
      permissions: [],
    },
    async () => {
      const state = await readWorkforceState();
      const profile = state.profiles.find((item) => item.id === session.userId);
      if (!profile || profile.employmentStatus === "inactive" || profile.employmentStatus === "terminated" || profile.employmentStatus === "archived") {
        return null;
      }
      const role = primaryRole(profile.roles);
      const position = state.positions.find((item) => item.id === profile.positionId);
      return {
        id: profile.id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        avatarUrl: profile.avatarUrl,
        role,
        roles: profile.roles,
        permissions: ROLE_PERMISSIONS[role],
        organizationId: profile.organizationId,
        organizationName: "CAL ACE Team",
        positionName: position?.name ?? null,
        employeeType: profile.employeeType,
        featureFlags: state.settings.featureFlags,
      } satisfies SessionUser;
    },
  );
  if (user) {
    bindOrganizationContext({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      permissions: user.permissions,
    });
  }
  return user;
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireSession();
  if (!hasPermission(user.roles, user.permissions, permission)) {
    const { forbidden } = await import("next/navigation");
    forbidden();
    throw new Error("Forbidden");
  }
  return user;
}

export function can(user: SessionUser, permission: Permission) {
  return hasPermission(user.roles, user.permissions, permission);
}
