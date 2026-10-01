import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth/session";
import { forbidden } from "next/navigation";
import { readWorkforceState } from "@/lib/db/workforce";
import { attendanceTrend } from "@/lib/phase4/reports";

export default async function AttendanceTrendsPage() {
  const user = await requireSession();
  if (!user.permissions.includes("reports.advanced") && !user.permissions.includes("attendance.read") && !user.permissions.includes("reports.read")) {
    forbidden();
  }
  const state = await readWorkforceState();
  const trend = attendanceTrend(state.timeEntries);
  const metrics = [
    ["On-time %", `${trend.onTimePercent}%`],
    ["Late", trend.late],
    ["Missing clock-out", trend.missingClockOut],
    ["Geofence exceptions", trend.geofence],
    ["Completed entries", trend.completed],
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Attendance trends" description="Operational counts. This report does not rank employees." />
      {state.timeEntries.length === 0 ? <p className="text-sm text-muted-foreground">No time entries yet.</p> : null}
      <div className="grid gap-3 md:grid-cols-3">
        {metrics.map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
