"use client";

import { formatMonthDay, formatTimeRange, formatWeekday, fullName, toISODate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Location, Profile, Shift } from "@/types";
import { cn } from "@/lib/utils";

export function WeekGrid({
  dates,
  instructors,
  shifts,
  locations,
  onShiftClick,
}: {
  dates: Date[];
  instructors: Profile[];
  shifts: Shift[];
  locations: Location[];
  onShiftClick: (shift: Shift) => void;
}) {
  return (
    <div className="overflow-auto rounded-xl border border-border bg-card">
      <div
        className={cn("grid", dates.length > 1 && "min-w-[920px]")}
        style={{
          gridTemplateColumns:
            dates.length === 1
              ? "160px minmax(0,1fr)"
              : `200px repeat(${dates.length}, minmax(140px, 1fr))`,
        }}
      >
        <div className="sticky left-0 z-10 border-b border-r border-border bg-card px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Employee
        </div>
        {dates.map((date) => (
          <div
            key={date.toISOString()}
            className="border-b border-border px-3 py-3 text-center"
          >
            <div className="text-[11px] font-semibold tracking-wide text-muted-foreground">
              {formatWeekday(date)}
            </div>
            <div className="text-sm font-semibold text-primary">{formatMonthDay(date)}</div>
          </div>
        ))}
        {instructors.map((instructor) => (
          <InstructorRow
            key={instructor.id}
            instructor={instructor}
            dates={dates}
            shifts={shifts.filter((shift) => shift.instructorIds.includes(instructor.id))}
            locations={locations}
            onShiftClick={onShiftClick}
          />
        ))}
        <div className="sticky left-0 z-10 border-t border-r border-border bg-muted/40 px-4 py-4 text-sm font-medium">
          Open / Unassigned
        </div>
        {dates.map((date) => {
          const iso = toISODate(date);
          const open = shifts.filter(
            (shift) =>
              shift.date === iso &&
              (shift.isOpen || shift.instructorIds.length === 0),
          );
          return (
            <div key={`open-${iso}`} className="min-h-24 border-t border-border p-2">
              {open.map((shift) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  instructorLabel="Unassigned"
                  locationName={locations.find((item) => item.id === shift.locationId)?.name}
                  onClick={() => onShiftClick(shift)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InstructorRow({
  instructor,
  dates,
  shifts,
  locations,
  onShiftClick,
}: {
  instructor: Profile;
  dates: Date[];
  shifts: Shift[];
  locations: Location[];
  onShiftClick: (shift: Shift) => void;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 border-t border-r border-border bg-card px-4 py-4">
        <div className="text-sm font-medium">
          {fullName(instructor.firstName, instructor.lastName)}
        </div>
        <div className="text-xs text-muted-foreground">
          {(
            shifts
              .filter((shift) => shift.instructorIds.includes(instructor.id) && shift.status !== "cancelled")
              .reduce((sum, shift) => {
                const [sh, sm] = shift.startTime.split(":").map(Number);
                const [eh, em] = shift.endTime.split(":").map(Number);
                return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm) - shift.breakDurationMinutes);
              }, 0) / 60
          ).toFixed(1)}
          h scheduled
        </div>
      </div>
      {dates.map((date) => {
        const iso = toISODate(date);
        const dayShifts = shifts.filter((shift) => shift.date === iso);
        return (
          <div key={`${instructor.id}-${iso}`} className="min-h-24 border-t border-border p-2">
            {dayShifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                instructorLabel={fullName(instructor.firstName, instructor.lastName)}
                locationName={locations.find((item) => item.id === shift.locationId)?.name}
                onClick={() => onShiftClick(shift)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

export function ShiftCard({
  shift,
  instructorLabel,
  locationName,
  onClick,
}: {
  shift: Shift;
  instructorLabel: string;
  locationName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mb-2 w-full rounded-lg border p-2 text-left shadow-sm hover:border-primary/40",
        shift.status === "draft" ? "border-dashed border-amber-400 bg-amber-50" : "border-border bg-white",
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: shift.color }}
        />
        <StatusBadge status={shift.status} />
      </div>
      <p className="text-xs font-semibold text-primary">{instructorLabel}</p>
      <p className="text-sm font-medium">{shift.title}</p>
      <p className="text-xs text-muted-foreground">
        {formatTimeRange(shift.startTime, shift.endTime)} · {shift.instructorIds.length}/{shift.requiredInstructors} assigned
      </p>
      {locationName ? (
        <p className="text-xs text-muted-foreground">{locationName}</p>
      ) : null}
    </button>
  );
}
