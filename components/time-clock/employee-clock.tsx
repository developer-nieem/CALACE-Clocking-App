"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Coffee, LocateFixed, LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  clockInAction,
  clockOutAction,
  endBreakAction,
  startBreakAction,
} from "@/app/actions/workforce";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cachedDeviceLocation,
  readDeviceLocation,
  startLocationWatch,
} from "@/lib/time-clock/browser-location";
import {
  calculateEntryTotals,
  formatCurrency,
  formatDuration,
} from "@/lib/time-clock/calculations";
import { formatTimeRange, fullName, initials, toISODate } from "@/lib/utils";
import type {
  DeviceLocation,
  Location,
  OrganizationSettings,
  Profile,
  Shift,
  TimeBreak,
  TimeEntry,
} from "@/types";

export function EmployeeClock({
  profile,
  entries,
  breaks,
  shifts,
  locations,
  settings,
}: {
  profile: Profile;
  entries: TimeEntry[];
  breaks: TimeBreak[];
  shifts: Shift[];
  locations: Location[];
  settings: OrganizationSettings;
}) {
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());
  const router = useRouter();
  const active = entries.find((entry) => entry.clockOutAt === null) ?? null;
  const today = toISODate(now);
  const todayShifts = shifts.filter(
    (shift) =>
      shift.date === today &&
      shift.status === "published" &&
      shift.instructorIds.includes(profile.id),
  );
  const [chosenShiftId, setChosenShiftId] = useState("");
  const todayShift =
    todayShifts.find((shift) => shift.id === chosenShiftId) ?? todayShifts[0] ?? null;
  const activeBreak = active
    ? breaks.find(
        (item) => item.timeEntryId === active.id && item.breakEndAt === null,
      ) ?? null
    : null;
  const todayEntries = entries.filter((entry) => entry.workDate === today);
  const todayTotals = todayEntries.reduce(
    (totals, entry) => {
      const value = calculateEntryTotals(
        entry,
        breaks.filter((item) => item.timeEntryId === entry.id),
        settings,
        { asOf: now },
      );
      return {
        worked: totals.worked + value.workedSeconds,
        break: totals.break + value.breakSeconds,
        pay: totals.pay + value.estimatedPay,
      };
    },
    { worked: 0, break: 0, pay: 0 },
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => startLocationWatch(), []);

  const status = active?.status ?? "off_clock";
  const workplace = locations.find(
    (item) => item.id === (todayShift?.locationId ?? profile.primaryLocationId),
  );

  async function getLocation(required: boolean): Promise<DeviceLocation | null> {
    const cached = cachedDeviceLocation();
    if (cached) return cached;
    try {
      return await readDeviceLocation();
    } catch {
      if (required) {
        throw new Error(
          "Location access is required to clock in for this workplace. Please enable location permission for this site and try again.",
        );
      }
      return null;
    }
  }

  function perform(
    operation: "clock_in" | "start_break" | "end_break" | "clock_out",
  ) {
    startTransition(async () => {
      try {
        if (!navigator.onLine) {
          toast.error("You are offline. Clock actions require an internet connection.");
          return;
        }
        const location = await getLocation(true);
        const result =
          operation === "clock_in"
            ? await clockInAction({ shiftId: todayShift?.id, location })
            : operation === "start_break"
              ? await startBreakAction(location)
              : operation === "end_break"
                ? await endBreakAction(location)
                : await clockOutAction(location);
        if (!result.ok) {
          toast.error(result.error);
          router.refresh();
          return;
        }
        toast.success(
          operation === "clock_in"
            ? "Clocked in"
            : operation === "clock_out"
              ? "Clocked out"
              : operation === "start_break"
                ? "Break started"
                : "Break ended",
        );
        router.refresh();
      } catch {
        toast.error("We couldn't confirm your clock action. Please check your connection and try again.");
        router.refresh();
      }
    });
  }

  const activeTotals = active
    ? calculateEntryTotals(
        active,
        breaks.filter((item) => item.timeEntryId === active.id),
        settings,
        { asOf: now },
      )
    : null;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-primary px-5 py-6 text-white">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback>{initials(profile.firstName, profile.lastName)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{fullName(profile.firstName, profile.lastName)}</p>
              <p className="text-sm capitalize text-white/70">{profile.employeeType}</p>
            </div>
            <Badge variant={status === "off_clock" ? "secondary" : status === "on_break" ? "warning" : "success"} className="ml-auto">
              {status === "off_clock"
                ? "Off Clock"
                : status === "on_break"
                  ? "On Break"
                  : "Working"}
            </Badge>
          </div>
          <p className="mt-5 text-sm text-white/70">
            {now.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              timeZone: settings.timezone,
            })}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {activeTotals ? formatDuration(activeTotals.workedSeconds) : "0m"}
          </p>
          <p className="text-xs text-white/60">Current worked duration</p>
        </div>
        <CardContent className="space-y-5 p-5">
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <div className="flex gap-2">
              <LocateFixed className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                CAL ACE uses your location when you clock in or out to verify that
                you are at an approved work location. Your location is not
                continuously tracked.
              </p>
            </div>
          </div>

          {todayShift ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Today&apos;s Shift
              </p>
              {todayShifts.length > 1 ? (
                <select
                  className="mt-2 h-10 w-full rounded-md border border-border bg-card px-2 text-sm"
                  value={todayShift.id}
                  onChange={(event) => setChosenShiftId(event.target.value)}
                >
                  {todayShifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.title} · {formatTimeRange(shift.startTime, shift.endTime)}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 font-semibold">{todayShift.title}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {formatTimeRange(todayShift.startTime, todayShift.endTime)}
                {workplace ? ` · ${workplace.name}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No scheduled shift today. Unscheduled clock-in is{" "}
              {settings.allowUnscheduledClockIn ? "allowed" : "disabled"}.
            </p>
          )}

          {active ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric
                label="Clock In"
                value={new Date(active.clockInAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: settings.timezone,
                })}
              />
              <Metric
                label="Current Break"
                value={
                  activeBreak
                    ? formatDuration(
                        (now.getTime() -
                          new Date(activeBreak.breakStartAt).getTime()) /
                          1000,
                      )
                    : "—"
                }
              />
            </div>
          ) : null}

          {status === "off_clock" ? (
            <Button
              size="lg"
              className="h-16 w-full text-lg"
              disabled={pending || (!todayShift && !settings.allowUnscheduledClockIn)}
              onClick={() => perform("clock_in")}
            >
              <Clock3 className="h-5 w-5" />
              Clock In
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                variant="accent"
                className="h-14"
                disabled={pending}
                onClick={() => perform(status === "on_break" ? "end_break" : "start_break")}
              >
                <Coffee className="h-5 w-5" />
                {status === "on_break" ? "End break" : "Break"}
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="h-14"
                disabled={pending}
                onClick={() => perform("clock_out")}
              >
                <LogOut className="h-5 w-5" />
                End
              </Button>
            </div>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            Your location is collected only when you perform a time-clock action, such as Clock In or Clock Out, when required by your workplace settings. CAL ACE Workforce does not continuously track your location.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Today</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="Worked" value={formatDuration(todayTotals.worked)} />
          <Metric label="Break" value={formatDuration(todayTotals.break)} />
          {profile.payType === "hourly" &&
          settings.employeesCanViewEstimatedEarnings ? (
            <Metric
              label="Estimated"
              value={formatCurrency(todayTotals.pay, settings.currencyCode)}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
