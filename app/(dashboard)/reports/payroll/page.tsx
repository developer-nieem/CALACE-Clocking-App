import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { readWorkforceState } from "@/lib/db/workforce";
import { payrollCsv } from "@/lib/phase3/reports";
import { toISODate } from "@/lib/utils";

export default async function PayrollReportPage() {
  await requirePermission("payroll.view");
  const state = await readWorkforceState();
  const report = payrollCsv({
    entries: state.timeEntries,
    breaks: state.timeBreaks,
    settings: state.settings,
    rates: state.payRates,
    profiles: state.profiles,
    date: toISODate(new Date()),
  });
  const gross = report.table.reduce((sum, row) => sum + Number(row.estimatedGrossPay), 0);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Payroll estimate"
        description="Estimated payroll based on configured organization rules. This does not pay anyone."
        actions={<a className="text-sm font-medium text-primary" href="/api/reports/csv?kind=payroll">Export CSV</a>}
      />
      <Card>
        <CardContent className="p-4 text-sm">
          <p>{report.period.start} – {report.period.end}</p>
          <p className="mt-1 font-medium">Estimated gross: ${gross.toFixed(2)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                {["Employee", "Regular hours", "OT hours", "Regular pay", "OT pay", "Estimated gross"].map((label) => (
                  <th key={label} className="px-3 py-2 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.table.map((row) => (
                <tr key={row.employeeId} className="border-b border-border">
                  <td className="px-3 py-2">{row.employeeName}</td>
                  <td className="px-3 py-2">{row.regularHours}</td>
                  <td className="px-3 py-2">{row.overtimeHours}</td>
                  <td className="px-3 py-2">${row.regularPay}</td>
                  <td className="px-3 py-2">${row.overtimePay}</td>
                  <td className="px-3 py-2">${row.estimatedGrossPay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
