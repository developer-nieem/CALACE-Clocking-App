import { hoursToPay, roundHours, roundMoney } from "@/lib/money";
import { ROLE_PERMISSIONS, type Permission } from "@/lib/permissions";
import type { Profile } from "@/types";

export function shiftMinutes(startTime: string, endTime: string, breakDurationMinutes = 0) {
  const toMinutes = (time: string) => {
    const [hours, mins] = time.split(":").map(Number);
    return hours * 60 + mins;
  };
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const span = end > start ? end - start : end + 24 * 60 - start;
  return Math.max(0, span - breakDurationMinutes);
}

export function isolateByOrganization<T extends { organizationId: string }>(rows: T[], organizationId: string) {
  return rows.filter((row) => row.organizationId === organizationId);
}

export function denyCrossTenant(actorOrgId: string, entityOrgId: string | null | undefined) {
  return !entityOrgId || entityOrgId !== actorOrgId;
}

export function staffSeesOnlyOwnTime(actor: { id: string; permissions: Permission[] }, entryUserId: string) {
  if (actor.permissions.includes("time_clock.view_all") || actor.permissions.includes("time_clock.manage")) {
    return true;
  }
  return actor.id === entryUserId;
}

export function payVisibleTo(actor: { id: string; permissions: Permission[] }, employeeId: string) {
  if (actor.permissions.includes("pay.manage") || actor.permissions.includes("payroll.view")) return true;
  if (actor.permissions.includes("pay.read_own") && actor.id === employeeId) return true;
  return false;
}

export function schedulerPayrollBlocked() {
  const perms = ROLE_PERMISSIONS.scheduler;
  return (
    !perms.includes("payroll.view") &&
    !perms.includes("pay.manage") &&
    !perms.includes("facility_billing.view") &&
    !perms.includes("margin.view")
  );
}

export function rangesOverlap(fromA: string, toA: string | null, fromB: string, toB: string | null) {
  const endA = toA ?? "9999-12-31";
  const endB = toB ?? "9999-12-31";
  return fromA <= endB && fromB <= endA;
}

export function conflictingRateWindows(
  rows: Array<{ userId?: string; facilityId?: string; effectiveFrom: string; effectiveTo: string | null; id?: string }>,
  candidate: { userId?: string; facilityId?: string; effectiveFrom: string; effectiveTo?: string | null; id?: string },
) {
  return rows.filter((row) => {
    if (candidate.id && row.id === candidate.id) return false;
    if (candidate.userId && row.userId !== candidate.userId) return false;
    if (candidate.facilityId && row.facilityId !== candidate.facilityId) return false;
    return rangesOverlap(row.effectiveFrom, row.effectiveTo, candidate.effectiveFrom, candidate.effectiveTo ?? null);
  });
}

export function e2eScenarioTotals(hours = 7.5, payRate = 25, billRate = 40) {
  const labor = hoursToPay(hours, payRate);
  const billing = hoursToPay(hours, billRate);
  return {
    hours: roundHours(hours),
    labor,
    billing,
    margin: roundMoney(billing - labor),
  };
}

export function diagnostics(input: {
  entries: Array<{ id: string; userId: string; clockInAt: string; clockOutAt: string | null }>;
  breaks: Array<{ timeEntryId: string }>;
  invoices: Array<{ facilityId: string }>;
  facilities: Array<{ id: string }>;
  profiles: Profile[];
}) {
  const profileIds = new Set(input.profiles.map((item) => item.id));
  const facilityIds = new Set(input.facilities.map((item) => item.id));
  const impossible = input.entries.filter(
    (entry) => entry.clockOutAt && entry.clockOutAt < entry.clockInAt,
  );
  const orphanBreaks = input.breaks.filter((item) => !input.entries.some((entry) => entry.id === item.timeEntryId));
  const missingInvoiceFacilities = input.invoices.filter((item) => !facilityIds.has(item.facilityId));
  const unknownAssignees = input.profiles.filter((item) => !profileIds.has(item.id)).length;
  return {
    impossibleClockOuts: impossible.length,
    orphanBreaks: orphanBreaks.length,
    missingInvoiceFacilities: missingInvoiceFacilities.length,
    unknownAssignees,
  };
}
