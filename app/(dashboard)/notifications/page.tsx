import { PageHeader } from "@/components/shared/page-header";
import { NotificationCenter } from "@/components/phase3/boards";
import { requireSession } from "@/lib/auth/session";
import { readWorkforceState } from "@/lib/db/workforce";
import Link from "next/link";

export default async function NotificationsPage() {
  const user = await requireSession();
  const state = await readWorkforceState();
  const items = state.notifications.filter((item) => item.userId === user.id);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Schedule, time clock, tasks, time off, and trades."
        actions={<Link href="/settings/notifications" className="text-sm font-medium text-primary">Preferences</Link>}
      />
      <NotificationCenter items={items} />
    </div>
  );
}
