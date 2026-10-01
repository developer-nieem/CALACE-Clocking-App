import { DataExportButtons } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";

export default async function DataExportPage() {
  await requirePermission("exports.manage");
  return (
    <div className="space-y-6">
      <PageHeader title="Data export" description="CSV exports omit passwords, OAuth tokens, API keys, and private storage URLs." />
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">Authorized administrators can export employees, schedules, attendance, timesheets, tasks, facilities, invoices, and audit logs.</p>
          <DataExportButtons />
        </CardContent>
      </Card>
    </div>
  );
}
