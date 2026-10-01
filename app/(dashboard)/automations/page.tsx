import { AutomationsBoard } from "@/components/phase4/automations-board";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/session";
import { readWorkforceState } from "@/lib/db/workforce";

export default async function AutomationsPage() {
  await requirePermission("automations.manage");
  const state = await readWorkforceState();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Automations"
        description="Triggers, conditions, and actions. Disabled automations do not run. Reminders are processed by the scheduled job, not by an open browser."
      />
      <AutomationsBoard automations={state.automations} runs={state.automationRuns} profiles={state.profiles} />
    </div>
  );
}
