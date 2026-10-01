import { PageHeader } from "@/components/shared/page-header";
import { AvailabilityBoard } from "@/components/schedule/workflow-boards";
import { getScheduleWorkspace } from "@/lib/db/phase2";

export default async function AvailabilityPage() {
  const data = await getScheduleWorkspace();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Availability"
        description="Set weekly hours and one-time exceptions. An exception overrides the recurring rule for that date."
      />
      <AvailabilityBoard data={data} />
    </div>
  );
}
