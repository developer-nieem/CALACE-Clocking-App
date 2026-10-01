import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth/session";
import { forbidden } from "next/navigation";
import { readWorkforceState } from "@/lib/db/workforce";
import { overtimeRows } from "@/lib/phase4/reports";
import { addDays, startOfWeekMonday, toISODate } from "@/lib/utils";

export default async function OvertimeReportPage() {
  const user = await requireSession();
  if (!user.permissions.includes("reports.advanced") && !user.permissions.includes("reports.read") && !user.permissions.includes("attendance.read")) {
    forbidden();
  }
  const state = await readWorkforceState();
  const start = toISODate(startOfWeekMonday(new Date()));
  const end = toISODate(addDays(startOfWeekMonday(new Date()), 6));
  const rows = overtimeRows({
    profiles: state.profiles,
    shifts: state.shifts,
    entries: state.timeEntries,
    breaks: state.timeBreaks,
    settings: state.settings,
    start,
    end,
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Overtime" description={`${start} – ${end}. Hours only. This page does not show pay rates.`} />
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              {["Employee", "Scheduled", "Worked", "Projected", "Threshold", "Potential OT", "Actual OT"].map((label) => (
                <th key={label} className="px-3 py-2">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No active employees.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.userId} className="border-b">
                <td className="px-3 py-3">{row.name}</td>
                <td className="px-3 py-3">{row.scheduled.toFixed(1)}</td>
                <td className="px-3 py-3">{row.worked.toFixed(1)}</td>
                <td className="px-3 py-3">{row.projected.toFixed(1)}</td>
                <td className="px-3 py-3">{row.threshold}</td>
                <td className="px-3 py-3">{row.potentialOvertime.toFixed(1)}</td>
                <td className="px-3 py-3">{row.actualOvertime.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
