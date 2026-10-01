import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth/session";
import { forbidden } from "next/navigation";
import { readWorkforceState } from "@/lib/db/workforce";
import { employeeHourRows, laborForecast } from "@/lib/phase4/reports";
import { addDays, startOfWeekMonday, toISODate } from "@/lib/utils";

export default async function EmployeeHoursPage() {
  const user = await requireSession();
  if (!user.permissions.includes("reports.advanced") && !user.permissions.includes("reports.read") && !user.permissions.includes("attendance.read")) {
    forbidden();
  }
  const canSeeCost = user.permissions.includes("payroll.view");
  const state = await readWorkforceState();
  const start = toISODate(startOfWeekMonday(new Date()));
  const end = toISODate(addDays(startOfWeekMonday(new Date()), 6));
  const rows = employeeHourRows({
    profiles: state.profiles,
    shifts: state.shifts,
    entries: state.timeEntries,
    breaks: state.timeBreaks,
    settings: state.settings,
    start,
    end,
  });
  const forecast = canSeeCost
    ? laborForecast({
        profiles: state.profiles,
        shifts: state.shifts,
        entries: state.timeEntries,
        breaks: state.timeBreaks,
        settings: state.settings,
        payRates: state.payRates,
        start,
        end,
      })
    : [];
  return (
    <div className="space-y-4">
      <PageHeader title="Employee hours" description={`${start} – ${end}. Variance is worked hours minus scheduled hours.`} />
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              {["Employee", "Scheduled", "Worked", "Variance", "Potential OT"].map((label) => (
                <th key={label} className="px-3 py-2">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className="border-b">
                <td className="px-3 py-3">{row.name}</td>
                <td className="px-3 py-3">{row.scheduled.toFixed(1)}</td>
                <td className="px-3 py-3">{row.worked.toFixed(1)}</td>
                <td className="px-3 py-3">{row.variance.toFixed(1)}</td>
                <td className="px-3 py-3">{row.potentialOvertime.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canSeeCost ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">Labor forecast</h2>
          <p className="mt-1 text-sm text-muted-foreground">Scheduled cost uses the pay rate effective on the shift date. This is an estimate, not a payout.</p>
          {forecast.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No scheduled or worked hours in this week.</p> : (
            <ul className="mt-3 space-y-1 text-sm">
              {forecast.map((day) => (
                <li key={day.date}>{day.date}: {day.scheduledPeople} scheduled, {day.scheduledHours.toFixed(1)} hours, estimated ${day.estimatedCost.toFixed(2)}, actual ${day.actualCost.toFixed(2)}</li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
