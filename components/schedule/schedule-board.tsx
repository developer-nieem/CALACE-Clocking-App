"use client";

import { useMemo, useState, useTransition } from "react";
import { addDays, formatLongDate, startOfWeekMonday, toISODate, weekDates } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeekGrid } from "@/components/schedule/week-grid";
import { ShiftDrawer } from "@/components/schedule/shift-drawer";
import { AutoFillDialog } from "@/components/schedule/auto-fill-dialog";
import { formatTimeRange, fullName } from "@/lib/utils";
import { copyPreviousWeekAction } from "@/app/actions/workforce";
import { publishWeekAction } from "@/app/actions/phase2";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import type {
  Department,
  Location,
  Position,
  Profile,
  SessionUser,
  Shift,
  ShiftTemplate,
} from "@/types";

type View = "day" | "week" | "month" | "list";

export function ScheduleBoard({
  user,
  instructors,
  shifts,
  locations,
  departments,
  positions,
  templates,
  initialShiftId,
}: {
  user: SessionUser;
  instructors: Profile[];
  shifts: Shift[];
  locations: Location[];
  departments: Department[];
  positions: Position[];
  templates: ShiftTemplate[];
  initialShiftId?: string;
}) {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(new Date());
  const [drawerOpen, setDrawerOpen] = useState(Boolean(initialShiftId));
  const [selected, setSelected] = useState<Shift | null>(
    shifts.find((shift) => shift.id === initialShiftId) ?? null,
  );
  const [employeeType, setEmployeeType] = useState<"all" | "instructor" | "staff">("all");
  const [status, setStatus] = useState("all");
  const [locationId, setLocationId] = useState("all");
  const [pending, startTransition] = useTransition();
  const dates = weekDates(anchor);
  const canManage = user.permissions.includes("schedules.manage");
  const canPublish = user.permissions.includes("schedules.publish");
  const filteredShifts = shifts.filter((shift) => {
    if (!canManage && shift.status === "draft") return false;
    if (status !== "all" && shift.status !== status) return false;
    if (locationId !== "all" && shift.locationId !== locationId) return false;
    return true;
  });

  const visibleInstructors = useMemo(() => {
    return instructors.filter((item) => {
      if (employeeType !== "all" && item.employeeType !== employeeType) return false;
      if (!canManage) return item.id === user.id;
      return true;
    });
  }, [instructors, user.id, canManage, employeeType]);

  const dayShifts = filteredShifts.filter((shift) => shift.date === toISODate(anchor));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">
            {view === "week"
              ? `${formatLongDate(dates[0])} – ${formatLongDate(dates[6])}`
              : formatLongDate(anchor)}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAnchor(addDays(anchor, view === "month" ? -30 : -7))}>
            Previous
          </Button>
          <Button variant="outline" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <Button variant="outline" onClick={() => setAnchor(addDays(anchor, view === "month" ? 30 : 7))}>
            Next
          </Button>
          <Tabs value={view} onValueChange={(value) => setView(value as View)}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
          {canManage ? (
            <>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await copyPreviousWeekAction(toISODate(startOfWeekMonday(anchor)));
                    if ("error" in result && result.error) toast.error(result.error);
                    else toast.success(`Copied ${result.count} shifts as drafts`);
                  })
                }
              >
                Copy previous week
              </Button>
              <AutoFillDialog
                rangeStart={toISODate(dates[0])}
                rangeEnd={toISODate(dates[6])}
                instructors={instructors}
              />
              <Button
                onClick={() => {
                  setSelected(null);
                  setDrawerOpen(true);
                }}
              >
                + Add Shift
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={employeeType} onChange={(event) => setEmployeeType(event.target.value as "all" | "instructor" | "staff")}>
          <option value="all">All employees</option>
          <option value="instructor">Instructors</option>
          <option value="staff">Staff</option>
        </select>
        <select className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
          <option value="all">All locations</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
        </select>
        {canPublish ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => startTransition(async () => {
              const result = await publishWeekAction(toISODate(dates[0]), toISODate(dates[6]));
              if ("error" in result && result.error) toast.error(result.error);
              else toast.success(`Published ${"count" in result ? result.count : 0} draft shifts`);
            })}
          >
            Publish week
          </Button>
        ) : null}
      </div>

      {view === "week" ? (
        <WeekGrid
          dates={dates}
          instructors={visibleInstructors}
          shifts={filteredShifts}
          locations={locations}
          onShiftClick={(shift) => {
            setSelected(shift);
            setDrawerOpen(true);
          }}
        />
      ) : null}

      {view === "day" ? (
        <WeekGrid
          dates={[anchor]}
          instructors={visibleInstructors}
          shifts={dayShifts}
          locations={locations}
          onShiftClick={(shift) => {
            setSelected(shift);
            setDrawerOpen(true);
          }}
        />
      ) : null}

      {view === "month" ? (
        <MonthCounts
          anchor={anchor}
          shifts={filteredShifts}
          onSelectDay={(day) => {
            setAnchor(day);
            setView("day");
          }}
        />
      ) : null}

      {view === "list" ? (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {filteredShifts
              .slice()
              .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
              .map((shift) => (
                <button
                  key={shift.id}
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/50"
                  onClick={() => {
                    setSelected(shift);
                    setDrawerOpen(true);
                  }}
                >
                  <div>
                    <p className="font-medium">{shift.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {shift.date} · {formatTimeRange(shift.startTime, shift.endTime)} ·{" "}
                      {locations.find((item) => item.id === shift.locationId)?.name ?? "No location"} ·{" "}
                      {shift.instructorIds
                        .map((id) => {
                          const person = instructors.find((item) => item.id === id);
                          return person ? fullName(person.firstName, person.lastName) : "Open";
                        })
                        .join(", ") || "Unassigned"}
                    </p>
                  </div>
                  <StatusBadge status={shift.status} />
                </button>
              ))}
          </CardContent>
        </Card>
      ) : null}

      <ShiftDrawer
        key={selected?.id ?? (drawerOpen ? "new-open" : "new-closed")}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        shift={selected}
        instructors={instructors}
        locations={locations}
        departments={departments}
        positions={positions}
        templates={templates}
        user={user}
        defaultDate={toISODate(anchor)}
      />
    </div>
  );
}

function MonthCounts({
  anchor,
  shifts,
  onSelectDay,
}: {
  anchor: Date;
  shifts: Shift[];
  onSelectDay: (day: Date) => void;
}) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: lead + days }, (_, index) => {
    if (index < lead) return null;
    const day = new Date(year, month, index - lead + 1);
    const key = toISODate(day);
    return { day, key, count: shifts.filter((shift) => shift.date === key).length };
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((cell, index) =>
            cell ? (
              <button
                key={cell.key}
                type="button"
                className="min-h-16 rounded-md border border-border bg-card p-2 text-left text-sm hover:bg-muted/50"
                onClick={() => onSelectDay(cell.day)}
              >
                <span className="font-medium">{cell.day.getDate()}</span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cell.count === 0 ? "—" : `${cell.count} shift${cell.count === 1 ? "" : "s"}`}
                </p>
              </button>
            ) : (
              <div key={`pad-${index}`} />
            ),
          )}
        </div>
      </CardContent>
    </Card>
  );
}
