import { PageHeader } from "@/components/shared/page-header";
import { TradeBoard } from "@/components/schedule/workflow-boards";
import { getScheduleWorkspace } from "@/lib/db/phase2";

export default async function ShiftTradesPage() {
  const data = await getScheduleWorkspace();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Shift Trades"
        description="Offers and swaps keep the original assignment until the required approvals are complete."
      />
      <TradeBoard data={data} />
    </div>
  );
}
