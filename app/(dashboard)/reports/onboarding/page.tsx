import { CsvDownload } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ReportTable } from "@/components/phase5/report-table";
import { requirePermission } from "@/lib/auth/session";
import { getPhase5Context } from "@/lib/db/phase5";
import { onboardingProgress } from "@/lib/phase5/domain";
import { fullName } from "@/lib/utils";

export default async function OnboardingReportPage() {
  await requirePermission("onboarding.manage");
  const { state } = await getPhase5Context();
  const completed = state.employeeOnboarding.filter((item) => item.status === "completed").length;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Onboarding report"
        description="New hire progress and overdue checklist items."
        actions={<CsvDownload filename="onboarding.csv" rows={state.employeeOnboarding.map((row) => ({ status: row.status, userId: row.userId }))} />}
      />
      <Card>
        <CardContent className="grid gap-2 p-4 text-sm sm:grid-cols-3">
          <p>New employees: {state.employeeOnboarding.length}</p>
          <p>Completed: {completed}</p>
          <p>In progress: {state.employeeOnboarding.length - completed}</p>
        </CardContent>
      </Card>
      <ReportTable
        columns={["Employee", "Progress", "Missing", "Status"]}
        rows={state.employeeOnboarding.map((row) => {
          const person = state.profiles.find((item) => item.id === row.userId);
          const items = state.employeeOnboardingItems.filter((item) => item.employeeOnboardingId === row.id);
          const templateItems = state.onboardingTemplateItems.filter((item) => item.templateId === row.templateId);
          const progress = onboardingProgress(items, templateItems);
          return [
            person ? fullName(person.firstName, person.lastName) : row.userId,
            `${progress.percent}%`,
            progress.missing.map((item) => item.title).join(", ") || "—",
            row.status,
          ];
        })}
      />
    </div>
  );
}
