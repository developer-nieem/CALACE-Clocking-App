import { PageHeader } from "@/components/shared/page-header";
import { TimeOffBoard } from "@/components/schedule/workflow-boards";
import { getScheduleWorkspace } from "@/lib/db/phase2";

export default async function TimeOffPage() {
  const data = await getScheduleWorkspace();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Time Off"
        description="Approved leave blocks new assignments and stays visible on the schedule. Existing shifts are not deleted."
      />
      <TimeOffBoard data={data} />
    </div>
  );
}
