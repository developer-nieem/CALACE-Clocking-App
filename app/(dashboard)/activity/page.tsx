import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { readWorkforceState } from "@/lib/db/workforce";
import { isManager } from "@/lib/permissions";

export default async function ActivityPage() {
  const user = await requireSession();
  if (!isManager(user.roles)) {
    return <PageHeader title="Activity" description="Activity history is limited to administrators and schedulers." />;
  }
  const state = await readWorkforceState();
  return (
    <div className="space-y-4">
      <PageHeader title="Activity" description="Schedule, clock, task, time-off, and document changes." />
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {state.activity.slice(0, 80).map((item) => (
            <div key={item.id} className="px-4 py-3 text-sm">
              <p className="font-medium">{item.action.replaceAll("_", " ")}</p>
              <p className="text-muted-foreground">{item.entityType} · {new Date(item.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
