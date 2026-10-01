import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { readWorkforceState } from "@/lib/db/workforce";
import { laborCost } from "@/lib/phase3/reports";
import { addDays, startOfWeekMonday, toISODate } from "@/lib/utils";

export default async function LaborCostPage() {
  await requirePermission("payroll.view");
  const state = await readWorkforceState();
  const start = toISODate(startOfWeekMonday(new Date()));
  const end = toISODate(addDays(startOfWeekMonday(new Date()), 6));
  const cost = laborCost({
    shifts: state.shifts,
    entries: state.timeEntries,
    breaks: state.timeBreaks,
    settings: state.settings,
    rates: state.payRates,
    profiles: state.profiles,
    from: start,
    to: end,
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Labor cost" description="Costs use the pay rate effective on each work date. This is an estimate." actions={<a className="text-sm font-medium text-primary" href="/api/reports/csv?kind=labor">Export CSV</a>} />
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Scheduled cost", cost.scheduled],
          ["Actual cost", cost.actual],
          ["Overtime cost", cost.overtime],
          ["Variance", cost.variance],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold">${Number(value).toFixed(2)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
