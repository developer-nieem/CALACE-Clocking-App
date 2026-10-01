import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { readWorkforceState } from "@/lib/db/workforce";
import { scheduleVersusActual } from "@/lib/phase3/reports";
import { addDays, startOfWeekMonday, toISODate } from "@/lib/utils";

export default async function ScheduleActualPage() {
  const user = await requireSession();
  if (!user.permissions.includes("reports.read") && !user.permissions.includes("attendance.read")) {
    return <PageHeader title="Schedule vs actual" description="This report is limited to schedulers and administrators." />;
  }
  const state = await readWorkforceState();
  const start = toISODate(startOfWeekMonday(new Date()));
  const end = toISODate(addDays(startOfWeekMonday(new Date()), 6));
  const rows = scheduleVersusActual({
    shifts: state.shifts,
    entries: state.timeEntries,
    breaks: state.timeBreaks,
    settings: state.settings,
    profiles: state.profiles,
    from: start,
    to: end,
  }).filter((row) => Number(row.scheduled) > 0 || Number(row.worked) > 0);
  return (
    <div className="space-y-4">
      <PageHeader title="Schedule vs actual" description={`${start} – ${end}. Scheduled hours stay separate from clocked hours.`} actions={<a className="text-sm font-medium text-primary" href="/api/reports/csv?kind=schedule">Export CSV</a>} />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                {["Employee", "Scheduled", "Worked", "Difference", "Late", "Missing clock-out", "Outside geofence"].map((label) => (
                  <th key={label} className="px-3 py-2 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employee} className="border-b border-border">
                  <td className="px-3 py-2">{row.employee}</td>
                  <td className="px-3 py-2">{row.scheduled}</td>
                  <td className="px-3 py-2">{row.worked}</td>
                  <td className="px-3 py-2">{row.difference}</td>
                  <td className="px-3 py-2">{row.lateStarts}</td>
                  <td className="px-3 py-2">{row.missingClockOuts}</td>
                  <td className="px-3 py-2">{row.outsideGeofence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
