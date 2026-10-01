import Link from "next/link";
import { Clock, CalendarDays, ClipboardCheck, RefreshCcw, MessageSquare, CalendarOff, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatTimeRange, fullName } from "@/lib/utils";
import type { SessionUser, Shift, TaskItem } from "@/types";

export function InstructorMobileHome({
  user,
  todayShifts,
  nextShift,
  tasks,
  openShifts,
}: {
  user: SessionUser;
  todayShifts: Shift[];
  nextShift: Shift | null;
  tasks: TaskItem[];
  openShifts: Shift[];
}) {
  const current = todayShifts[0];
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="text-2xl font-semibold text-primary">
          {fullName(user.firstName, user.lastName)}
        </h1>
      </div>
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-5">
          <p className="text-xs uppercase tracking-wide text-white/70">Today&apos;s Shift</p>
          {current ? (
            <>
              <h2 className="mt-2 text-xl font-semibold">{current.title}</h2>
              <p className="mt-1 text-sm text-white/80">
                {formatTimeRange(current.startTime, current.endTime)}
              </p>
              <Button asChild size="lg" variant="accent" className="mt-5 w-full">
                <Link href="/time-clock">Clock In</Link>
              </Button>
            </>
          ) : (
            <p className="mt-3 text-sm text-white/80">You have no shifts today.</p>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <QuickLink href="/schedule" icon={CalendarDays} label="My Schedule" />
        <QuickLink href="/tasks" icon={ClipboardCheck} label="My Tasks" count={tasks.length} />
        <QuickLink href="/open-shifts" icon={RefreshCcw} label="Open Shifts" count={openShifts.length} />
        <QuickLink href="/chat" icon={MessageSquare} label="Messages" />
        <QuickLink href="/time-off" icon={CalendarOff} label="Time Off" />
        <QuickLink href="/availability" icon={CalendarClock} label="Availability" />
      </div>
      {nextShift ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Next Shift</p>
            <p className="mt-1 font-medium">{nextShift.title}</p>
            <p className="text-sm text-muted-foreground">
              {nextShift.date} · {formatTimeRange(nextShift.startTime, nextShift.endTime)}
            </p>
          </CardContent>
        </Card>
      ) : null}
      <Button asChild variant="outline">
        <Link href="/time-clock">
          <Clock className="h-4 w-4" />
          Open Time Clock
        </Link>
      </Button>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  count,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-24 flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <Icon className="h-5 w-5 text-primary" />
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {typeof count === "number" ? (
          <span className="text-xs text-muted-foreground">{count}</span>
        ) : null}
      </div>
    </Link>
  );
}
