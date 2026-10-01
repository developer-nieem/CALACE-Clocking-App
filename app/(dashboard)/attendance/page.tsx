import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { readWorkforceState } from "@/lib/db/workforce";
import { attendanceRows } from "@/lib/phase3/reports";

export default async function AttendancePage() {
  const user = await requireSession();
  if (!user.permissions.includes("attendance.read") && !user.permissions.includes("time_clock.view_all")) {
    return <PageHeader title="Attendance" description="Attendance is limited to schedulers and administrators." />;
  }
  const state = await readWorkforceState();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const rows = attendanceRows({
    today,
    nowMinutes: now.getHours() * 60 + now.getMinutes(),
    shifts: state.shifts,
    entries: state.timeEntries,
    profiles: state.profiles,
    graceMinutes: state.settings.clockInLateGraceMinutes,
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Attendance" description="Statuses use the late grace period. An employee is not marked absent at the shift start." />
      <div className="flex justify-end">
        <a className="text-sm font-medium text-primary" href="/api/reports/csv?kind=attendance">Export CSV</a>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                {["Employee", "Type", "Shift", "Start", "Clock in", "Clock out", "Status"].map((label) => (
                  <th key={label} className="px-3 py-2 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.employee}-${row.shift}-${row.scheduledStart}`} className="border-b border-border">
                  <td className="px-3 py-2">{row.employee}</td>
                  <td className="px-3 py-2">{row.employeeType}</td>
                  <td className="px-3 py-2">{row.shift}</td>
                  <td className="px-3 py-2">{row.scheduledStart}</td>
                  <td className="px-3 py-2">{row.clockIn ? new Date(row.clockIn).toLocaleTimeString() : "—"}</td>
                  <td className="px-3 py-2">{row.clockOut ? new Date(row.clockOut).toLocaleTimeString() : "—"}</td>
                  <td className="px-3 py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
