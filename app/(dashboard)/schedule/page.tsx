import { AutoFillPanel } from "@/components/phase4/auto-fill-panel";
import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth/session";
import { listShifts, listTemplates } from "@/lib/db/shifts";
import { getLookups, getUserById, listUsers } from "@/lib/db/users";
import { addDays, startOfWeekMonday, toISODate } from "@/lib/utils";
import { isManager } from "@/lib/permissions";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ shift?: string }>;
}) {
  const user = await requireSession();
  const { shift } = await searchParams;
  const monday = startOfWeekMonday(new Date());
  const shifts = await listShifts(toISODate(addDays(monday, -7)), toISODate(addDays(monday, 21)));
  const templates = await listTemplates();
  const lookups = await getLookups();
  const users = isManager(user.roles) ? await listUsers() : [];
  const own = isManager(user.roles) ? null : await getUserById(user.id);
  const instructors = isManager(user.roles)
    ? users.filter((profile) => profile.employmentStatus === "active")
    : own
      ? [own]
      : [];

  return (
    <div>
      <PageHeader
        title="Schedule"
        description="Week view is the primary workspace. Click a shift to open the drawer."
        actions={
          isManager(user.roles) ? (
            <a href="/schedule/templates" className="text-sm font-medium text-primary hover:underline">
              Templates
            </a>
          ) : null
        }
      />
      {user.permissions.includes("schedules.auto_fill") ? <AutoFillPanel /> : null}
      <ScheduleBoard
        user={user}
        instructors={instructors}
        shifts={shifts}
        locations={lookups.locations}
        departments={lookups.departments}
        positions={lookups.positions}
        templates={templates}
        initialShiftId={shift}
      />
    </div>
  );
}
