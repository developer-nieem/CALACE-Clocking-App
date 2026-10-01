import { CsvDownload } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { ReportTable } from "@/components/phase5/report-table";
import { requirePermission } from "@/lib/auth/session";
import { getPhase5Context, marginRows } from "@/lib/db/phase5";
import { getPayPeriod } from "@/lib/phase3/domain";
import { toISODate } from "@/lib/utils";

export default async function MarginReportPage() {
  await requirePermission("margin.view");
  const { state } = await getPhase5Context();
  const period = getPayPeriod(toISODate(new Date()));
  const rows = marginRows(state, period.start, period.end);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Margin"
        description="Client revenue versus employee labor cost. Taxes and overhead are not included."
        actions={<CsvDownload filename="margin.csv" rows={rows.map((row) => ({ Facility: row.facility, Hours: row.hours, Revenue: row.revenue, Labor: row.labor, Margin: row.margin, "Margin %": row.marginPercent }))} />}
      />
      <ReportTable
        columns={["Facility", "Billable hours", "Revenue", "Labor cost", "Gross margin", "Margin %"]}
        rows={rows.map((row) => [row.facility, row.hours, row.revenue, row.labor, row.margin, row.marginPercent])}
      />
    </div>
  );
}
