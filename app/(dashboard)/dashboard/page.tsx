import { StatCards } from "@/components/dashboard/stat-cards";
import { AttendanceTable } from "@/components/dashboard/attendance-table";
import { DashboardWidgets } from "@/components/dashboard/widgets";
import { PageHeader } from "@/components/shared/page-header";
import { getDashboardData } from "@/lib/db/dashboard";
import { getTimeClockData } from "@/lib/db/time-clock";
import { toISODate } from "@/lib/utils";
import { ClockWorkspace } from "@/components/time-clock/clock-workspace";
import { LiveAttendance } from "@/components/time-clock/live-attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/time-clock/calculations";
import { getPhase5Context } from "@/lib/db/phase5";
import { onboardingProgress } from "@/lib/phase5/domain";
import { DashboardCustomize } from "@/components/phase5/forms";
import Link from "next/link";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const today = toISODate(new Date());
  const nextShift =
    data.shifts.find(
      (shift) =>
        shift.instructorIds.includes(data.user.id) &&
        shift.date >= today &&
        shift.status !== "cancelled",
    ) ?? null;

  if (data.user.role === "instructor" || data.user.role === "staff") {
    const clock = await getTimeClockData();
    const myTimeOff = data.timeOff.filter((item) => item.userId === data.user.id).slice(0, 3);
    const myTrades = data.trades.filter(
      (item) => item.fromUserId === data.user.id || item.toUserId === data.user.id,
    ).slice(0, 3);
    const openShifts = data.shifts
      .filter((shift) => shift.isOpen && shift.status === "published" && shift.date >= today)
      .slice(0, 3);
    const recent = clock.entries.slice(0, 5);
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Good ${greeting()}, ${data.user.firstName}`}
          description={
            data.user.role === "staff"
              ? "Your workday, hours, tasks, and time clock."
              : "Your classes, shifts, time clock, and assigned tasks."
          }
        />
        <OnboardingSummary userId={data.user.id} />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ClockWorkspace
            profile={clock.profile}
            entries={clock.entries}
            breaks={clock.breaks}
            shifts={clock.shifts}
            locations={clock.locations}
            settings={clock.settings}
            variant="card"
          />
          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {data.user.role === "instructor" ? "Upcoming Classes" : "Next Shift"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nextShift ? (
                  <>
                    <p className="font-medium">{nextShift.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {nextShift.date} · {nextShift.startTime}–{nextShift.endTime}
                    </p>
                    <Link
                      href="/schedule"
                      className="mt-3 inline-flex cursor-pointer text-sm font-medium text-primary hover:underline"
                    >
                      View schedule
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming shift.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>My Tasks</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.tasks.length
                  ? data.tasks.slice(0, 5).map((task) => (
                      <p key={task.id} className="truncate">{task.title}</p>
                    ))
                  : <p className="text-muted-foreground">No assigned tasks.</p>}
                <Link href="/tasks" className="mt-1 inline-flex cursor-pointer text-sm font-medium text-primary hover:underline">
                  Open tasks
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Requests</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Link href="/open-shifts" className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-muted">
                  <span>Open shifts</span>
                  <span className="text-muted-foreground">{openShifts.length}</span>
                </Link>
                <Link href="/time-off" className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-muted">
                  <span>Time off</span>
                  <span className="text-muted-foreground">{myTimeOff.length}</span>
                </Link>
                <Link href="/shift-trades" className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-muted">
                  <span>Shift trades</span>
                  <span className="text-muted-foreground">{myTrades.length}</span>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Recent Clock History</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {recent.length ? recent.map((entry) => {
                  const total = entry.clockOutAt
                    ? Math.max(
                        0,
                        (new Date(entry.clockOutAt).getTime() - new Date(entry.clockInAt).getTime()) / 1000,
                      )
                    : null;
                  return (
                    <div key={entry.id} className="flex justify-between gap-3">
                      <span>{entry.workDate}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {total === null ? "Working" : formatDuration(total)}
                      </span>
                    </div>
                  );
                }) : (
                  <p className="text-muted-foreground">No recent punches.</p>
                )}
                <Link href="/time-clock" className="mt-1 inline-flex cursor-pointer text-sm font-medium text-primary hover:underline">
                  Open time clock
                </Link>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    );
  }

  const phase5 = await getPhase5Context();
  const hiddenWidgets =
    phase5.state.dashboardPreferences.find((item) => item.userId === data.user.id)?.hiddenWidgets ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations dashboard"
        description="Live snapshot of instructors, attendance, and pending workforce requests."
      />
      {data.user.permissions.includes("settings.manage") ? (
        <DashboardCustomize hidden={hiddenWidgets} />
      ) : null}
      <StatCards stats={data.stats} />
      {!hiddenWidgets.includes("attendance") ? (
        <>
          <LiveAttendance
            profiles={data.profiles}
            entries={data.timeEntries}
            breaks={data.timeBreaks}
            shifts={data.shifts}
            positions={data.positions}
            locations={data.locations}
            settings={data.settings}
          />
          <AttendanceTable
            rows={data.attendance}
            profiles={data.profiles}
            shifts={data.shifts}
          />
        </>
      ) : null}
      <DashboardWidgets
        shifts={data.shifts}
        profiles={data.profiles}
        timeOff={data.timeOff}
        trades={data.trades}
        tasks={data.tasks}
        locations={data.locations}
        hiddenWidgets={hiddenWidgets}
      />
    </div>
  );
}

async function OnboardingSummary({ userId }: { userId: string }) {
  const { state } = await getPhase5Context();
  const row = state.employeeOnboarding.find((item) => item.userId === userId && item.status !== "completed");
  if (!row) return null;
  const items = state.employeeOnboardingItems.filter((item) => item.employeeOnboardingId === row.id);
  const templateItems = state.onboardingTemplateItems.filter((item) => item.templateId === row.templateId);
  const progress = onboardingProgress(items, templateItems);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <p>{progress.complete} / {progress.total} complete · {progress.percent}%</p>
        <Link className="mt-2 inline-block text-primary" href="/onboarding">Continue checklist</Link>
      </CardContent>
    </Card>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
