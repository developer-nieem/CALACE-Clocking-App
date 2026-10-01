import { PageHeader } from "@/components/shared/page-header";
import { OpenShiftBoard } from "@/components/schedule/workflow-boards";
import { getScheduleWorkspace } from "@/lib/db/phase2";

export default async function OpenShiftsPage() {
  const data = await getScheduleWorkspace();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Open Shifts"
        description="Claims are checked on the server, including capacity, so two people cannot take the last seat."
      />
      <OpenShiftBoard data={data} />
    </div>
  );
}
