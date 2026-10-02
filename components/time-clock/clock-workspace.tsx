"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Clock3, MapPin, Palmtree, TimerReset } from "lucide-react";
import { toast } from "sonner";
import {
  clockInAction,
  clockOutAction,
  endBreakAction,
  startBreakAction,
} from "@/app/actions/workforce";
import { GeoLink } from "@/components/time-clock/geo-link";
import { calculateEntryTotals } from "@/lib/time-clock/calculations";
import { readDeviceLocation } from "@/lib/time-clock/browser-location";
import { addDays, formatTimeRange, parseISODate, startOfWeekMonday, toISODate } from "@/lib/utils";
import type {
  DeviceLocation,
  Location,
  OrganizationSettings,
  Profile,
  Shift,
  TimeBreak,
  TimeEntry,
} from "@/types";

function formatHms(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hours, minutes, secs].map((part) => String(part).padStart(2, "0")).join(":");
}

function formatHm(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function clockTime(value: string, timeZone: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function ClockWorkspace({
  profile,
  entries,
  breaks,
  shifts,
  locations,
  settings,
  variant = "full",
}: {
  profile: Profile;
  entries: TimeEntry[];
  breaks: TimeBreak[];
  shifts: Shift[];
  locations: Location[];
  settings: OrganizationSettings;
  variant?: "full" | "card";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [rangeStart, setRangeStart] = useState(() => addDays(startOfWeekMonday(new Date()), -7));
  const [chosenShiftId, setChosenShiftId] = useState("");
  const [tab, setTab] = useState<"note" | "log">("note");
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const clockNow = now ?? new Date(0);
  const today = toISODate(now ?? new Date());
  const active = entries.find((entry) => entry.clockOutAt === null) ?? null;
  const todayShifts = shifts.filter(
    (shift) =>
      shift.date === today &&
      shift.status === "published" &&
      shift.instructorIds.includes(profile.id),
  );
  const todayShift = todayShifts.find((shift) => shift.id === chosenShiftId) ?? todayShifts[0] ?? null;
  const workplace = locations.find(
    (item) => item.id === (active?.clockInLocationId ?? todayShift?.locationId ?? profile.primaryLocationId),
  );
  const activeBreak = active
    ? breaks.find((item) => item.timeEntryId === active.id && item.breakEndAt === null) ?? null
    : null;
  const onBreak = Boolean(activeBreak);
  const activeTotals = active
    ? calculateEntryTotals(
        active,
        breaks.filter((item) => item.timeEntryId === active.id),
        settings,
        { asOf: clockNow },
      )
    : null;
  const todayWorked = entries
    .filter((entry) => entry.workDate === today || entry.clockOutAt === null)
    .reduce((sum, entry) => {
      const totals = calculateEntryTotals(
        entry,
        breaks.filter((item) => item.timeEntryId === entry.id),
        settings,
        { asOf: clockNow },
      );
      return sum + totals.workedSeconds;
    }, 0);

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, index) => addDays(rangeStart, index)),
    [rangeStart],
  );
  const rangeEnd = days[13];
  const sheet = useMemo(() => buildSheet(days, entries, breaks, shifts, locations, settings, clockNow), [
    breaks,
    clockNow,
    days,
    entries,
    locations,
    settings,
    shifts,
  ]);

  async function getLocation(required: boolean): Promise<DeviceLocation | null> {
    try {
      return await readDeviceLocation();
    } catch {
      if (required) {
        throw new Error("Location permission is required. Allow location for this site, then try again.");
      }
      return null;
    }
  }

  async function perform(operation: "clock_in" | "start_break" | "end_break" | "clock_out") {
    if (pending) return;
    setPending(true);
    setActionError(null);
    try {
      if (!navigator.onLine) {
        throw new Error("You are offline. Clock actions require an internet connection.");
      }
      const location =
        operation === "clock_in"
          ? await getLocation(true)
          : await getLocation(true).catch(() => {
              if (
                active &&
                active.clockInLatitude !== null &&
                active.clockInLongitude !== null
              ) {
                return {
                  latitude: active.clockInLatitude,
                  longitude: active.clockInLongitude,
                  accuracy: active.clockInAccuracy ?? 0,
                  timestamp: Date.now(),
                };
              }
              throw new Error("Location permission is required. Allow location for this site, then try again.");
            });
      const payload = location
        ? (JSON.parse(JSON.stringify(location)) as DeviceLocation)
        : null;
      const result =
        operation === "clock_in"
          ? await clockInAction({ shiftId: todayShift?.id, location: payload })
          : operation === "start_break"
            ? await startBreakAction(payload)
            : operation === "end_break"
              ? await endBreakAction(payload)
              : await clockOutAction(payload);
      if (!result.ok) {
        setActionError(result.error);
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
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't confirm your clock action. Please check your connection and try again.";
      setActionError(message);
      toast.error(message);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const cardOnly = variant === "card";

  return (
    <div className={cardOnly ? "h-full min-w-0" : "min-w-0 space-y-4"}>
      <div className={cardOnly ? "h-full min-w-0" : "grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"}>
        <section className={`min-w-0 overflow-hidden rounded-xl border border-border bg-card ${cardOnly ? "h-full" : ""}`}>
          <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
            <h2 className="text-base font-semibold text-primary">Today&apos;s clock</h2>
            <p className="text-sm text-muted-foreground">
              Total work hours today{" "}
              <span suppressHydrationWarning className="font-semibold text-foreground">
                {now ? formatHm(todayWorked) : "00:00"}
              </span>
            </p>
          </div>
          <div className="p-4 sm:p-5">
            {active && activeTotals ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-400 px-4 py-4 text-white sm:px-6 sm:py-5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{onBreak ? "Break time" : "Work time on"}</span>
                    <span className="max-w-full truncate rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                      {todayShift?.title ?? "Shift"}
                    </span>
                  </div>
                  <p suppressHydrationWarning className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                    {now ? formatHms(onBreak ? activeTotals.breakSeconds : activeTotals.workedSeconds) : "00:00:00"}
                  </p>
                  <p className="mt-3 flex min-w-0 items-start gap-1 text-sm text-white">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    {active.clockInLatitude !== null && active.clockInLongitude !== null ? (
                      <GeoLink
                        latitude={active.clockInLatitude}
                        longitude={active.clockInLongitude}
                        tooltip
                        className="whitespace-normal break-words text-white underline decoration-white/50"
                      />
                    ) : (
                      <span className="break-words">{workplace?.name ?? "Work location"}</span>
                    )}
                  </p>
                  <p suppressHydrationWarning className="mt-1 text-sm text-white/80">
                    Total work hours for{" "}
                    {(now ?? new Date()).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" "}
                    {now ? formatHm(todayWorked) : "00:00"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => perform(onBreak ? "end_break" : "start_break")}
                    className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-2 text-sm font-semibold text-amber-900 transition hover:border-amber-400 hover:bg-amber-100 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <TimerReset className="h-4 w-4 shrink-0" />
                    {pending ? "Processing..." : onBreak ? "End break" : "Break"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => perform("clock_out")}
                    className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-red-500 px-2 text-sm font-semibold text-white transition hover:bg-red-600 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Clock3 className="h-4 w-4 shrink-0" />
                    {pending ? "Processing..." : "End"}
                  </button>
                </div>
                {actionError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {actionError}
                  </p>
                ) : null}
                <div className="rounded-xl border border-border">
                  <div className="flex border-b border-border text-sm">
                    <button type="button" className={`cursor-pointer px-4 py-2 ${tab === "note" ? "border-b-2 border-sky-500 font-medium" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setTab("note")}>
                      Note
                    </button>
                    <button type="button" className={`cursor-pointer px-4 py-2 ${tab === "log" ? "border-b-2 border-sky-500 font-medium" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setTab("log")}>
                      My day log
                    </button>
                  </div>
                  {tab === "note" ? (
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="(Blank)"
                      className="min-h-16 w-full resize-none bg-transparent px-4 py-3 text-sm outline-none"
                    />
                  ) : (
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                      Clocked in at {clockTime(active.clockInAt, settings.timezone)}
                      {onBreak ? " · On break" : ""}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col-reverse items-center gap-5 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 sm:flex-row sm:justify-center sm:gap-8 sm:px-6 sm:py-8">
                <div className="w-full max-w-sm text-center text-sm text-muted-foreground sm:max-w-xs sm:text-left">
                  {todayShift ? (
                    <>
                      <p className="font-medium text-foreground">{todayShift.title}</p>
                      <p>{formatTimeRange(todayShift.startTime, todayShift.endTime)}</p>
                      <p className="break-words">{workplace?.name}</p>
                    </>
                  ) : (
                    <p>Nothing&apos;s scheduled for today</p>
                  )}
                  {todayShifts.length > 1 ? (
                    <select
                      className="mt-3 h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground"
                      value={todayShift?.id ?? ""}
                      onChange={(event) => setChosenShiftId(event.target.value)}
                    >
                      {todayShifts.map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {shift.title}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <p className="mt-3">Location permission is required to clock in.</p>
                  <p className="mt-2 text-xs leading-5">
                    Your location is collected only when you perform a time-clock action, such as Clock In or Clock Out, when required by your workplace settings. CAL ACE Workforce does not continuously track your location.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending || (!todayShift && !settings.allowUnscheduledClockIn)}
                  onClick={() => perform("clock_in")}
                  className="flex h-24 w-24 shrink-0 cursor-pointer flex-col items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-cyan-400 text-white shadow-md transition hover:from-sky-500 hover:to-cyan-500 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:h-28 sm:w-28"
                >
                  <Clock3 className="h-5 w-5" />
                  <span className="mt-1 text-sm font-semibold">{pending ? "Processing..." : "Clock in"}</span>
                </button>
              </div>
            )}
            {actionError && !(active && activeTotals) ? (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {actionError}
              </p>
            ) : null}
          </div>
        </section>

        {cardOnly ? null : (
        <aside className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-base font-semibold text-primary">Requests</h2>
          <div className="mt-4 space-y-2">
            <Link href="/open-shifts" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted">
              <CalendarPlus className="h-4 w-4 text-sky-500" />
              Add a shift request
            </Link>
            <Link href="/time-off" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted">
              <Palmtree className="h-4 w-4 text-emerald-500" />
              Add an absence request
            </Link>
            <Link href="/time-off" className="mt-3 flex h-10 items-center justify-center rounded-full bg-sky-50 text-sm font-medium text-sky-700">
              View your requests
            </Link>
          </div>
        </aside>
        )}
      </div>

      {cardOnly ? null : (
      <section className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-primary">Timesheet</h2>
            <div className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-sm">
              <button type="button" className="px-2" onClick={() => setRangeStart(addDays(rangeStart, -7))} aria-label="Previous range">
                ‹
              </button>
              <span className="whitespace-nowrap">
                {rangeStart.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })}
                {" – "}
                {rangeEnd.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })}
              </span>
              <button type="button" className="px-2" onClick={() => setRangeStart(addDays(rangeStart, 7))} aria-label="Next range">
                ›
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 text-sm sm:px-5">
          <Stat label="Regular" value={formatHm(sheet.regular)} />
          <Stat label="Overtime" value={formatHm(sheet.overtime)} />
          <Stat label="Paid time off" value="00:00" />
          <Stat label="Total paid hours" value={formatHm(sheet.worked)} />
        </div>
        <div className="space-y-2 px-4 pb-4 md:hidden">
          {sheet.weeks.some((week) => week.rows.some((row) => row.total !== "—")) ? (
            sheet.weeks.flatMap((week) =>
              week.rows
                .filter((row) => row.total !== "—")
                .map((row) => (
                  <div key={row.key} className="rounded-lg border border-border px-3 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{row.dateLabel}</p>
                      <p className="tabular-nums font-semibold">{row.total}</p>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {row.type} · {row.start ? clockTime(row.start, settings.timezone) : "—"}
                      {row.end ? ` – ${clockTime(row.end, settings.timezone)}` : " – now"}
                    </p>
                    <p className="mt-1 break-words text-xs text-muted-foreground">{row.location}</p>
                  </div>
                )),
            )
          ) : (
            <p className="text-sm text-muted-foreground">No punches in this range.</p>
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-y border-border text-xs text-muted-foreground">
              <tr>
                {["Date", "Type", "Location", "Start", "End", "Total hours", "Daily total", "Overtime", "Weekly total", "Total regular"].map((label) => (
                  <th key={label} className="px-3 py-2 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.weeks.map((week) => (
                <WeekRows key={week.label} week={week} timeZone={settings.timezone} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-semibold tabular-nums">{value}</span>{" "}
      <span className="text-muted-foreground">{label}</span>
    </p>
  );
}

function WeekRows({
  week,
  timeZone,
}: {
  week: SheetWeek;
  timeZone: string;
}) {
  return (
    <>
      <tr className="bg-muted/60">
        <td colSpan={10} className="px-3 py-2 text-center text-xs text-muted-foreground">
          {week.label}
        </td>
      </tr>
      {week.rows.map((row) => (
        <tr key={row.key} className="border-b border-border">
          <td className="px-3 py-3">{row.dateLabel}</td>
          <td className="px-3 py-3">{row.type}</td>
          <td className="px-3 py-3">
            {row.latitude !== null ? (
              <GeoLink
                latitude={row.latitude}
                longitude={row.longitude}
                className="text-xs text-primary underline"
              />
            ) : (
              row.location
            )}
            {row.latitude !== null && row.location !== "—" ? (
              <div className="text-xs text-muted-foreground">{row.location}</div>
            ) : null}
          </td>
          <td className="px-3 py-3">{row.start ? clockTime(row.start, timeZone) : "—"}</td>
          <td className="px-3 py-3">{row.end ? clockTime(row.end, timeZone) : "—"}</td>
          <td className="px-3 py-3 tabular-nums">{row.total}</td>
          <td className={`px-3 py-3 font-medium tabular-nums ${row.overtime !== "—" && row.overtime !== "00:00" ? "text-red-600" : ""}`}>
            {row.daily}
          </td>
          <td className="px-3 py-3 tabular-nums">{row.overtime}</td>
          <td className="px-3 py-3 font-medium tabular-nums">{row.weekly}</td>
          <td className="px-3 py-3 tabular-nums">{row.regular}</td>
        </tr>
      ))}
    </>
  );
}

type SheetRow = {
  key: string;
  dateLabel: string;
  type: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  start: string | null;
  end: string | null;
  total: string;
  daily: string;
  overtime: string;
  weekly: string;
  regular: string;
};

type SheetWeek = { label: string; rows: SheetRow[] };

function buildSheet(
  days: Date[],
  entries: TimeEntry[],
  breaks: TimeBreak[],
  shifts: Shift[],
  locations: Location[],
  settings: OrganizationSettings,
  now: Date,
) {
  const newestFirst = [...days].reverse();
  const groups = new Map<string, Date[]>();
  for (const day of newestFirst) {
    const start = startOfWeekMonday(day);
    const key = toISODate(start);
    groups.set(key, [...(groups.get(key) ?? []), day]);
  }
  let worked = 0;
  let regular = 0;
  let overtime = 0;
  const weeks: SheetWeek[] = [];
  for (const [key, weekDays] of groups) {
    const start = parseISODate(key);
    const end = addDays(start, 6);
    let weekWorked = 0;
    let weekRegular = 0;
    const rows: SheetRow[] = weekDays.map((day) => {
      const date = toISODate(day);
      const entry = entries.find((item) => item.workDate === date);
      if (!entry) {
        return {
          key: date,
          dateLabel: day.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" }),
          type: "—",
          location: "—",
          latitude: null,
          longitude: null,
          start: null,
          end: null,
          total: "—",
          daily: "—",
          overtime: "—",
          weekly: "",
          regular: "—",
        };
      }
      const totals = calculateEntryTotals(
        entry,
        breaks.filter((item) => item.timeEntryId === entry.id),
        settings,
        { asOf: now },
      );
      worked += totals.workedSeconds;
      regular += totals.regularSeconds;
      overtime += totals.overtimeSeconds;
      weekWorked += totals.workedSeconds;
      weekRegular += totals.regularSeconds;
      const shift = shifts.find((item) => item.id === entry.shiftId);
      const location = locations.find((item) => item.id === (entry.clockInLocationId ?? shift?.locationId));
      return {
        key: entry.id,
        dateLabel: day.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" }),
        type: shift ? "Shift" : entry.shiftId ? "Shift" : "Unscheduled",
        location: location?.name ?? "—",
        latitude: entry.clockInLatitude,
        longitude: entry.clockInLongitude,
        start: entry.clockInAt,
        end: entry.clockOutAt,
        total: formatHm(totals.workedSeconds),
        daily: formatHm(totals.workedSeconds),
        overtime: formatHm(totals.overtimeSeconds),
        weekly: "",
        regular: formatHm(totals.regularSeconds),
      };
    });
    const lastFilled = [...rows].reverse().find((row) => row.total !== "—");
    if (lastFilled) {
      lastFilled.weekly = formatHm(weekWorked);
      lastFilled.regular = formatHm(weekRegular);
    }
    weeks.push({
      label: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      rows,
    });
  }
  return { weeks, worked, regular, overtime };
}
