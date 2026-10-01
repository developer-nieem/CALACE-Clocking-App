import { CompleteItemButton, OnboardingAdminForms } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPhase5Context } from "@/lib/db/phase5";
import { onboardingProgress } from "@/lib/phase5/domain";
import { fullName } from "@/lib/utils";

export default async function OnboardingPage() {
  const { user, state } = await getPhase5Context();
  const mine = state.employeeOnboarding.filter((item) => item.userId === user.id);
  const canManage = user.permissions.includes("onboarding.manage");
  return (
    <div className="space-y-6">
      <PageHeader title="Onboarding" description="Checklists stay incomplete until the actual requirement is met." />
      {mine.map((row) => {
        const template = state.onboardingTemplates.find((item) => item.id === row.templateId);
        const items = state.employeeOnboardingItems.filter((item) => item.employeeOnboardingId === row.id);
        const templateItems = state.onboardingTemplateItems.filter((item) => item.templateId === row.templateId);
        const progress = onboardingProgress(items, templateItems);
        return (
          <Card key={row.id}>
            <CardHeader>
              <CardTitle>{template?.name ?? "Onboarding"} · {progress.complete} / {progress.total} · {progress.percent}%</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((item) => {
                const meta = templateItems.find((rowItem) => rowItem.id === item.templateItemId);
                return (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">{meta?.title}</p>
                      <p className="text-xs text-muted-foreground">{item.status}{meta?.isRequired ? " · required" : ""}</p>
                    </div>
                    {item.status !== "complete" ? <CompleteItemButton itemId={item.id} /> : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
      {canManage ? (
        <Card>
          <CardHeader><CardTitle>Admin onboarding</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <OnboardingAdminForms
              templates={state.onboardingTemplates.map((item) => ({ id: item.id, name: item.name }))}
              employees={state.profiles.map((item) => ({ id: item.id, label: fullName(item.firstName, item.lastName) }))}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead><tr className="text-xs uppercase text-muted-foreground"><th className="py-2">Employee</th><th>Type</th><th>Start</th><th>Progress</th><th>Missing</th><th>Status</th></tr></thead>
                <tbody>
                  {state.employeeOnboarding.map((row) => {
                    const person = state.profiles.find((item) => item.id === row.userId);
                    const items = state.employeeOnboardingItems.filter((item) => item.employeeOnboardingId === row.id);
                    const templateItems = state.onboardingTemplateItems.filter((item) => item.templateId === row.templateId);
                    const progress = onboardingProgress(items, templateItems);
                    return (
                      <tr key={row.id} className="border-t border-border">
                        <td className="py-2">{person ? fullName(person.firstName, person.lastName) : row.userId}</td>
                        <td>{person?.employeeType}</td>
                        <td>{person?.hireDate ?? "—"}</td>
                        <td>{progress.percent}%</td>
                        <td>{progress.missing.map((item) => item.title).join(", ") || "—"}</td>
                        <td>{row.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
