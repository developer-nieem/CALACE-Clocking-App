import { CsvDownload } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { ReportTable } from "@/components/phase5/report-table";
import { requirePermission } from "@/lib/auth/session";
import { getPhase5Context, marginRows } from "@/lib/db/phase5";
import { getPayPeriod } from "@/lib/phase3/domain";
import { toISODate } from "@/lib/utils";

export default async function FacilityReportPage() {
  await requirePermission("facilities.view");
  const { state } = await getPhase5Context();
  const period = getPayPeriod(toISODate(new Date()));
  const rows = marginRows(state, period.start, period.end);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Facility report"
        description="Scheduled, worked, and billable hours by facility."
        actions={<CsvDownload filename="facilities.csv" rows={rows.map((row) => ({ Facility: row.facility, Hours: row.hours, Revenue: row.revenue, Labor: row.labor }))} />}
      />
      <ReportTable
        columns={["Facility", "Scheduled hours", "Worked hours", "Billable hours", "Revenue", "Labor cost", "Open shifts"]}
        rows={state.facilities.map((facility) => {
          const margin = rows.find((row) => row.facility === facility.name);
          const shifts = state.shifts.filter((shift) => shift.facilityId === facility.id);
          const scheduled = shifts.reduce((sum, shift) => {
            const [startH, startM] = shift.startTime.split(":").map(Number);
            const [endH, endM] = shift.endTime.split(":").map(Number);
            return sum + Math.max(0, endH * 60 + endM - startH * 60 - startM) / 60;
          }, 0);
          return [
            facility.name,
            Math.round(scheduled * 100) / 100,
            margin?.hours ?? 0,
            margin?.hours ?? 0,
            margin?.revenue ?? 0,
            margin?.labor ?? 0,
            shifts.filter((shift) => shift.isOpen).length,
          ];
        })}
      />
    </div>
  );
}
