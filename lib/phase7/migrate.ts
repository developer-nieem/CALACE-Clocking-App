import type { WorkforceState } from "@/lib/db/workforce";
import { countWorkforce, type WorkforceCounts } from "@/lib/phase7/domain";

export type MigrationPlan = {
  dryRun: boolean;
  organizationId: string | null;
  counts: WorkforceCounts;
  writes: number;
};

export function planJsonToRelationalMigration(
  state: WorkforceState,
  input: { dryRun: boolean; organizationId?: string | null; organizationCount?: number },
): MigrationPlan {
  const counts = countWorkforce(state, input.organizationCount ?? 1);
  const writes = counts.profiles + counts.shifts + counts.timeEntries + counts.tasks + counts.facilities + counts.invoices + counts.auditLogs;
  return {
    dryRun: input.dryRun,
    organizationId: input.organizationId ?? null,
    counts,
    writes: input.dryRun ? 0 : writes,
  };
}

export function formatMigrationReport(plan: MigrationPlan) {
  const lines = [
    plan.dryRun ? "DRY RUN — no writes" : "APPLY — relational upsert",
    plan.organizationId ? `Organization: ${plan.organizationId}` : "Organization: all",
    `Organizations: ${plan.counts.organizations}`,
    `Profiles: ${plan.counts.profiles}`,
    `Shifts: ${plan.counts.shifts}`,
    `Assignments: ${plan.counts.assignments}`,
    `Time Entries: ${plan.counts.timeEntries}`,
    `Tasks: ${plan.counts.tasks}`,
    `Facilities: ${plan.counts.facilities}`,
    `Invoices: ${plan.counts.invoices}`,
    `Notifications: ${plan.counts.notifications}`,
    `Audit logs: ${plan.counts.auditLogs}`,
    `Pay rates: ${plan.counts.payRates}`,
    `Facility rates: ${plan.counts.facilityRates}`,
    `Writes: ${plan.writes}`,
  ];
  return lines.join("\n");
}

export function relationalTotalsFromRows(input: {
  profiles: number;
  shifts: number;
  timeEntries: number;
  workedHours: number;
  payroll: number;
  billing: number;
}) {
  return input;
}
