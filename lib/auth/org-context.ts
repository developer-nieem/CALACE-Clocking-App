import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import type { Permission } from "@/lib/permissions";

export type OrganizationContext = {
  userId: string;
  organizationId: string;
  role: string;
  permissions: Permission[];
};

const store = new AsyncLocalStorage<OrganizationContext>();

const requestSlot = cache(() => ({
  userId: null as string | null,
  organizationId: null as string | null,
  role: "staff",
  permissions: [] as Permission[],
}));

export function bindOrganizationContext(context: OrganizationContext) {
  try {
    const slot = requestSlot();
    slot.userId = context.userId;
    slot.organizationId = context.organizationId;
    slot.role = context.role;
    slot.permissions = context.permissions;
  } catch {
    // Outside a React request (scripts/cron). ALS is the fallback.
  }
}

export function runWithOrganizationContext<T>(context: OrganizationContext, fn: () => T): T {
  bindOrganizationContext(context);
  return store.run(context, fn);
}

export function getOrganizationContext(): OrganizationContext | null {
  const fromAls = store.getStore();
  if (fromAls?.organizationId) return fromAls;
  try {
    const slot = requestSlot();
    if (slot.organizationId && slot.userId) {
      return {
        userId: slot.userId,
        organizationId: slot.organizationId,
        role: slot.role,
        permissions: slot.permissions,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function requireOrganizationContext(): OrganizationContext {
  const context = getOrganizationContext();
  if (!context?.organizationId) {
    throw new Error("Organization context is required.");
  }
  return context;
}

export function resolveOrganizationId(explicit?: string | null) {
  if (explicit) return explicit;
  const fromContext = getOrganizationContext()?.organizationId;
  if (fromContext) return fromContext;
  throw new Error("Organization context is required.");
}
