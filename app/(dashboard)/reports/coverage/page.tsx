import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth/session";
import { forbidden } from "next/navigation";
import { readWorkforceState } from "@/lib/db/workforce";
import { coverageReport } from "@/lib/phase4/reports";
import { addDays, startOfWeekMonday, toISODate } from "@/lib/utils";

export default async function CoverageReportPage() {
  const user = await requireSession();
  if (!user.permissions.includes("reports.advanced") && !user.permissions.includes("reports.read") && !user.permissions.includes("schedules.read")) {
    forbidden();
  }
  const state = await readWorkforceState();
  const start = toISODate(startOfWeekMonday(new Date()));
  const end = toISODate(addDays(startOfWeekMonday(new Date()), 6));
  const report = coverageReport(state.shifts, start, end);
  const metrics = [
    ["Total positions", report.positions],
    ["Filled", report.filled],
    ["Unfilled", report.unfilled],
    ["Coverage", `${report.coverage}%`],
    ["Open shifts", report.open],
    ["Cancelled", report.cancelled],
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Coverage" description={`${start} – ${end}`} />
      {report.positions === 0 ? <p className="text-sm text-muted-foreground">No shifts in this week.</p> : null}
      <div className="grid gap-3 md:grid-cols-3">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
