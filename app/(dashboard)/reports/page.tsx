import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";

const cards = [
  ["Attendance", "/attendance", "Who is working, late, or missing a clock-out."],
  ["Time & Hours", "/timesheets", "Worked, break, regular, and overtime hours."],
  ["Payroll Estimate", "/reports/payroll", "Estimated gross pay from configured rules."],
  ["Schedule vs Actual", "/reports/schedule-vs-actual", "Scheduled hours compared with clocked hours."],
  ["Labor Cost", "/reports/labor-cost", "Scheduled and actual labor cost."],
  ["Overtime", "/reports/overtime", "Scheduled, worked, and projected hours against the weekly threshold."],
  ["Coverage", "/reports/coverage", "Filled and unfilled shift positions."],
  ["Attendance Trends", "/reports/attendance-trends", "On-time, late, missing clock-out, and geofence counts."],
  ["Employee Hours", "/reports/employee-hours", "Scheduled hours, worked hours, and variance."],
  ["Margin", "/reports/margin", "Client revenue versus employee labor cost."],
  ["Facilities", "/reports/facilities", "Hours, revenue, and open shifts by facility."],
  ["Onboarding", "/reports/onboarding", "New hire checklist progress."],
  ["Compliance", "/reports/compliance", "Expiring qualifications and documents."],
];

export default async function ReportsPage() {
  const user = await requireSession();
  if (!user.permissions.includes("reports.read") && !user.permissions.includes("attendance.read") && !user.permissions.includes("payroll.view")) {
    return <PageHeader title="Reports" description="You do not have access to reports." />;
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Reports" description="Operational reports. Payroll figures are estimates, not a payroll run." />
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map(([title, href, description]) => (
          <Link key={href} href={href}>
            <Card>
              <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{description}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
