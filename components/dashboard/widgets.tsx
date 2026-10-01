import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLongDate, formatTimeRange, fullName } from "@/lib/utils";
import type { Profile, Shift, TaskItem, TimeOffRequest, ShiftTradeRequest } from "@/types";
import { StatusBadge } from "@/components/shared/status-badge";

export function DashboardWidgets({
  shifts,
  profiles,
  timeOff,
  trades,
  tasks,
  locations,
  hiddenWidgets = [],
}: {
  shifts: Shift[];
  profiles: Profile[];
  timeOff: TimeOffRequest[];
  trades: ShiftTradeRequest[];
  tasks: TaskItem[];
  locations: { id: string; name: string }[];
  hiddenWidgets?: string[];
}) {
  const show = (id: string) => !hiddenWidgets.includes(id);
  const upcoming = [...shifts]
    .filter((shift) => shift.status !== "cancelled")
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
    .slice(0, 5);
  const pendingTimeOff = timeOff.filter((item) => item.status === "pending");
  const pendingTrades = trades.filter((item) => item.status === "pending");
  const openShifts = shifts.filter((shift) => shift.isOpen && shift.status === "published");
  const attentionTasks = tasks.filter((task) => task.status !== "completed").slice(0, 4);

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {show("upcoming") ? (
      <Widget title="Upcoming Shifts" href="/schedule">
        {upcoming.map((shift) => (
          <div key={shift.id} className="flex items-start justify-between gap-3 py-2">
            <div>
              <p className="text-sm font-medium">{shift.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatLongDate(shift.date)} · {formatTimeRange(shift.startTime, shift.endTime)}
              </p>
            </div>
            <StatusBadge status={shift.status} />
          </div>
        ))}
      </Widget>
      ) : null}
      {show("pending") ? (
      <Widget title="Pending Requests" href="/time-off">
        {pendingTimeOff.length === 0 && pendingTrades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : null}
        {pendingTimeOff.map((item) => {
          const person = profiles.find((profile) => profile.id === item.userId);
          return (
            <p key={item.id} className="py-2 text-sm">
              {person ? fullName(person.firstName, person.lastName) : "Instructor"} requested time off
              <span className="block text-xs text-muted-foreground">
                {item.startDate} → {item.endDate}
              </span>
            </p>
          );
        })}
        {pendingTrades.map((item) => {
          const person = profiles.find((profile) => profile.id === item.fromUserId);
          return (
            <p key={item.id} className="py-2 text-sm">
              {person ? fullName(person.firstName, person.lastName) : "Instructor"} requested a shift trade
            </p>
          );
        })}
      </Widget>
      ) : null}
      {show("open_shifts") ? (
      <Widget title="Open Shifts" href="/open-shifts">
        {openShifts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open shifts.</p>
        ) : (
          openShifts.map((shift) => (
            <div key={shift.id} className="py-2">
              <p className="text-sm font-medium">{shift.title}</p>
              <p className="text-xs text-muted-foreground">
                {shift.date} · {formatTimeRange(shift.startTime, shift.endTime)} ·{" "}
                {locations.find((location) => location.id === shift.locationId)?.name}
              </p>
            </div>
          ))
        )}
      </Widget>
      ) : null}
      {show("tasks") ? (
      <Widget title="Tasks Requiring Attention" href="/tasks">
        {attentionTasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between py-2">
            <p className="text-sm">{task.title}</p>
            <StatusBadge status={task.priority} />
          </div>
        ))}
      </Widget>
      ) : null}
      {show("activity") ? (
      <Widget title="Recent Activity" href="/dashboard" className="xl:col-span-2">
        <p className="text-sm text-muted-foreground">
          Administrative changes are recorded in the activity log. Open a user or shift to see the
          related history.
        </p>
      </Widget>
      ) : null}
    </div>
  );
}

function Widget({
  title,
  href,
  children,
  className,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          View
        </Link>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
