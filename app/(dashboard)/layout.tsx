import { AppShell } from "@/components/layout/app-shell";
import { getDashboardData } from "@/lib/db/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await getDashboardData();
  const unreadCount = data.notifications.filter((item) => !item.readAt).length;

  return (
    <AppShell
      user={data.user}
      unreadCount={unreadCount}
      instructors={data.profiles}
      shifts={data.shifts}
      tasks={data.tasks}
      searchItems={data.searchItems}
    >
      {children}
    </AppShell>
  );
}
