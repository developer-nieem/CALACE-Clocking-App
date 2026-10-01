import { AdjustmentForm, PayrollActions } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireSession } from "@/lib/auth/session";
import { ensurePayPeriod, getPhase5Context } from "@/lib/db/phase5";
import { getPayPeriod } from "@/lib/phase3/domain";
import { toISODate } from "@/lib/utils";
import { fullName } from "@/lib/utils";

export default async function PayrollPage() {
  const user = await requireSession();
  if (!user.permissions.includes("payroll.view") && !user.permissions.includes("payroll.approve") && !user.permissions.includes("pay.read_own")) {
    const { forbidden } = await import("next/navigation");
    forbidden();
  }
  const range = getPayPeriod(toISODate(new Date()), "weekly");
  const period = user.permissions.includes("payroll.view")
    ? await ensurePayPeriod(range.start, range.end)
    : (await getPhase5Context()).state.payPeriods.find((item) => item.startDate === range.start) ?? {
        id: "current",
        startDate: range.start,
        endDate: range.end,
        status: "open" as const,
      };
  const { state } = await getPhase5Context();
  const canViewAll = user.permissions.includes("payroll.view");
  const sheets = canViewAll ? state.employeeTimesheets : state.employeeTimesheets.filter((item) => item.userId === user.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Payroll" description="Estimates only. No bank transfers or tax filing." />
      <Tabs defaultValue="current">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="current">Current period</TabsTrigger>
          <TabsTrigger value="previous">Previous periods</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
          <Card>
            <CardHeader><CardTitle>{period.startDate} – {period.endDate} · {period.status}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <PayrollActions
                periodId={period.id}
                timesheetId={sheets.find((item) => item.payPeriodId === period.id)?.id}
                canApprove={user.permissions.includes("payroll.approve")}
                canLock={user.permissions.includes("payroll.lock")}
                canExport={user.permissions.includes("payroll.export")}
              />
              {canViewAll ? (
                <AdjustmentForm
                  periodId={period.id}
                  employees={state.profiles.map((item) => ({ id: item.id, label: fullName(item.firstName, item.lastName) }))}
                />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="previous">
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              {state.payPeriods.map((item) => <p key={item.id}>{item.startDate} – {item.endDate} · {item.status}</p>)}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="approvals">
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              {sheets.map((sheet) => {
                const person = state.profiles.find((item) => item.id === sheet.userId);
                return <p key={sheet.id}>{person ? fullName(person.firstName, person.lastName) : sheet.userId} · {sheet.status} {sheet.rejectionReason ? `· ${sheet.rejectionReason}` : ""}</p>;
              })}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="exports">
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              {state.payrollExports.map((item) => <p key={item.id}>{item.createdAt.slice(0, 16)} · {item.recordCount} rows · {item.fileHash?.slice(0, 8)}</p>)}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="exceptions">
          <p className="text-sm text-muted-foreground">Rejected timesheets and locked-period edit attempts appear in Activity.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
