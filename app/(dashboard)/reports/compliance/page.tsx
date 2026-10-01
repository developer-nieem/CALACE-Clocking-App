import { CsvDownload } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ReportTable } from "@/components/phase5/report-table";
import { requirePermission } from "@/lib/auth/session";
import { getPhase5Context } from "@/lib/db/phase5";
import { expiringQualifications } from "@/lib/phase4/reports";
import { toISODate } from "@/lib/utils";

export default async function ComplianceReportPage() {
  await requirePermission("reports.advanced");
  const { state } = await getPhase5Context();
  const today = toISODate(new Date());
  const expiring = expiringQualifications(state.profiles, today, 30);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Document compliance"
        description="Qualifications and required documents."
        actions={<CsvDownload filename="compliance.csv" rows={expiring.map((row) => ({ Employee: row.name, Qualification: row.qualificationId, Expires: row.expirationDate }))} />}
      />
      <Card>
        <CardContent className="grid gap-2 p-4 text-sm sm:grid-cols-3">
          <p>Active qualifications: {state.profiles.reduce((sum, profile) => sum + (profile.qualificationRecords?.length ?? profile.qualifications.length), 0)}</p>
          <p>Expiring in 30 days: {expiring.length}</p>
          <p>Documents: {state.documents.length}</p>
        </CardContent>
      </Card>
      <ReportTable
        columns={["Employee", "Qualification", "Expires"]}
        rows={expiring.map((row) => [row.name, row.qualificationId, row.expirationDate])}
      />
    </div>
  );
}
