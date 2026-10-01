"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { correctTimeEntryAction } from "@/app/actions/workforce";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GeoLink } from "@/components/time-clock/geo-link";
import {
  calculateEntryTotals,
  formatCurrency,
  formatDuration,
} from "@/lib/time-clock/calculations";
import { fullName, startOfWeekMonday, toISODate } from "@/lib/utils";
import type {
  Department,
  Location,
  OrganizationSettings,
  Position,
  Profile,
  Shift,
  TimeBreak,
  TimeEntry,
  TimeEntryEdit,
  TimeEntryTotals,
} from "@/types";

type ReportRow = {
  entry: TimeEntry;
  profile: Profile;
  breaks: TimeBreak[];
  totals: TimeEntryTotals;
};

export function TimeReport({
  entries,
  breaks,
  edits,
  profiles,
  shifts,
  locations,
  departments,
  positions,
  settings,
  canManage,
  initialUserId = "all",
}: {
  entries: TimeEntry[];
  breaks: TimeBreak[];
  edits: TimeEntryEdit[];
  profiles: Profile[];
  shifts: Shift[];
  locations: Location[];
  departments: Department[];
  positions: Position[];
  settings: OrganizationSettings;
  canManage: boolean;
  initialUserId?: string;
}) {
  const [employee, setEmployee] = useState(initialUserId);
  const [employeeType, setEmployeeType] = useState("all");
  const [department, setDepartment] = useState("all");
  const [location, setLocation] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<TimeEntry | null>(null);

  const rows = useMemo(() => {
    const priorByWeek = new Map<string, number>();
    return entries
      .filter((entry) => {
        const profile = profiles.find((item) => item.id === entry.userId);
        return (
          profile &&
          (employee === "all" || entry.userId === employee) &&
          (employeeType === "all" || profile.employeeType === employeeType) &&
          (department === "all" || profile.departmentId === department) &&
          (location === "all" ||
            entry.clockInLocationId === location ||
            entry.clockOutLocationId === location) &&
          (status === "all" ||
            entry.status === status ||
            entry.clockStatus === status) &&
          (!dateFrom || entry.workDate >= dateFrom) &&
          (!dateTo || entry.workDate <= dateTo)
        );
      })
      .sort((a, b) => a.clockInAt.localeCompare(b.clockInAt))
      .map((entry) => {
        const profile = profiles.find((item) => item.id === entry.userId)!;
        const entryBreaks = breaks.filter((item) => item.timeEntryId === entry.id);
        const week = toISODate(startOfWeekMonday(new Date(`${entry.workDate}T00:00:00`)));
        const key = `${entry.userId}-${week}`;
        const totals = calculateEntryTotals(entry, entryBreaks, settings, {
          priorWeeklyWorkedSeconds: priorByWeek.get(key) ?? 0,
        });
        priorByWeek.set(key, (priorByWeek.get(key) ?? 0) + totals.workedSeconds);
        return { entry, profile, breaks: entryBreaks, totals };
      })
      .sort((a, b) => b.entry.clockInAt.localeCompare(a.entry.clockInAt));
  }, [
    breaks,
    dateFrom,
    dateTo,
    department,
    employee,
    employeeType,
    entries,
    location,
    profiles,
    settings,
    status,
  ]);

  const summary = rows.reduce(
    (total, row) => ({
      employees: total.employees.add(row.profile.id),
      worked: total.worked + row.totals.workedSeconds,
      breaks: total.breaks + row.totals.breakSeconds,
      regular: total.regular + row.totals.regularSeconds,
      overtime: total.overtime + row.totals.overtimeSeconds,
      payroll: total.payroll + row.totals.estimatedPay,
    }),
    {
      employees: new Set<string>(),
      worked: 0,
      breaks: 0,
      regular: 0,
      overtime: 0,
      payroll: 0,
    },
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Summary label="Total Employees" value={String(summary.employees.size)} />
        <Summary label="Total Clocked Hours" value={formatDuration(summary.worked)} />
        <Summary label="Total Break Hours" value={formatDuration(summary.breaks)} />
        <Summary label="Regular Hours" value={formatDuration(summary.regular)} />
        <Summary label="Overtime Hours" value={formatDuration(summary.overtime)} />
        <Summary
          label="Estimated Payroll"
          value={formatCurrency(summary.payroll, settings.currencyCode)}
        />
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-7">
          <FilterSelect label="Employee" value={employee} onChange={setEmployee}>
            <option value="all">All employees</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {fullName(profile.firstName, profile.lastName)}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Type" value={employeeType} onChange={setEmployeeType}>
            <option value="all">All types</option>
            <option value="instructor">Instructor</option>
            <option value="staff">Staff</option>
          </FilterSelect>
          <FilterSelect label="Department" value={department} onChange={setDepartment}>
            <option value="all">All departments</option>
            {departments.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Location" value={location} onChange={setLocation}>
            <option value="all">All locations</option>
            {locations.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Status" value={status} onChange={setStatus}>
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="working">Working</option>
            <option value="on_break">On Break</option>
            <option value="outside_geofence">Outside Geofence</option>
            <option value="admin_edited">Admin Edited</option>
          </FilterSelect>
          <FilterDate label="Date From" value={dateFrom} onChange={setDateFrom} />
          <FilterDate label="Date To" value={dateTo} onChange={setDateTo} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock In Location</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Clock Out Location</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Worked</TableHead>
                <TableHead>Hourly Rate</TableHead>
                <TableHead>Estimated Pay</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.entry.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(row.entry)}
                >
                  <TableCell className="font-medium">
                    {fullName(row.profile.firstName, row.profile.lastName)}
                  </TableCell>
                  <TableCell>{row.entry.workDate}</TableCell>
                  <TableCell>{time(row.entry.clockInAt, settings.timezone)}</TableCell>
                  <TableCell>
                    <GeoLink
                      latitude={row.entry.clockInLatitude}
                      longitude={row.entry.clockInLongitude}
                    />
                    <div className="text-xs text-muted-foreground">
                      {locationLabel(row.entry.clockInGeofenceStatus)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.entry.clockOutAt
                      ? time(row.entry.clockOutAt, settings.timezone)
                      : "Missing"}
                  </TableCell>
                  <TableCell>
                    <GeoLink
                      latitude={row.entry.clockOutLatitude}
                      longitude={row.entry.clockOutLongitude}
                    />
                    <div className="text-xs text-muted-foreground">
                      {locationLabel(row.entry.clockOutGeofenceStatus)}
                    </div>
                  </TableCell>
                  <TableCell>{formatDuration(row.totals.breakSeconds)}</TableCell>
                  <TableCell>{formatDuration(row.totals.workedSeconds)}</TableCell>
                  <TableCell>
                    {row.entry.payRateSnapshot !== null
                      ? formatCurrency(row.entry.payRateSnapshot, settings.currencyCode)
                      : "Salary"}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(row.totals.estimatedPay, settings.currencyCode)}
                  </TableCell>
                  <TableCell className="capitalize">
                    {(row.entry.clockStatus ?? row.entry.status).replaceAll("_", " ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EntryDetail
        entry={selected}
        row={rows.find((item) => item.entry.id === selected?.id) ?? null}
        edits={edits.filter((item) => item.timeEntryId === selected?.id)}
        shift={shifts.find((item) => item.id === selected?.shiftId) ?? null}
        locations={locations}
        positions={positions}
        settings={settings}
        canManage={canManage}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}

function EntryDetail({
  entry,
  row,
  edits,
  shift,
  locations,
  settings,
  canManage,
  onOpenChange,
}: {
  entry: TimeEntry | null;
  row: ReportRow | null;
  edits: TimeEntryEdit[];
  shift: Shift | null;
  locations: Location[];
  positions: Position[];
  settings: OrganizationSettings;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [fieldName, setFieldName] = useState("clockInAt");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const router = useRouter();
  if (!entry || !row) return null;
  const workplace = locations.find((item) => item.id === entry.clockInLocationId);

  return (
    <Sheet open={Boolean(entry)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{fullName(row.profile.firstName, row.profile.lastName)}</SheetTitle>
          <SheetDescription>
            {entry.workDate} · {shift?.title ?? "Unscheduled work"}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 p-6">
          <DetailSection title="Clock In">
            <Detail label="Time" value={time(entry.clockInAt, settings.timezone)} />
            <Detail
              label="Coordinates"
              value={
                entry.clockInLatitude !== null
                  ? `${entry.clockInLatitude}, ${entry.clockInLongitude}`
                  : "Not captured"
              }
            />
            <Detail label="Accuracy" value={entry.clockInAccuracy !== null ? `${Math.round(entry.clockInAccuracy)} m` : "—"} />
            <Detail label="Assigned Location" value={workplace?.name ?? "—"} />
            <Detail label="Distance" value={entry.clockInDistanceMeters !== null ? `${Math.round(entry.clockInDistanceMeters)} m` : "—"} />
            <Detail label="Geofence" value={locationLabel(entry.clockInGeofenceStatus)} />
          </DetailSection>
          <DetailSection title="Breaks">
            {row.breaks.length ? row.breaks.map((item) => (
              <p key={item.id} className="text-sm">
                {time(item.breakStartAt, settings.timezone)} –{" "}
                {item.breakEndAt ? time(item.breakEndAt, settings.timezone) : "Active"} ·{" "}
                {item.breakMinutes ?? 0}m
              </p>
            )) : <p className="text-sm text-muted-foreground">No breaks recorded.</p>}
          </DetailSection>
          <DetailSection title="Clock Out">
            <Detail label="Time" value={entry.clockOutAt ? time(entry.clockOutAt, settings.timezone) : "Missing"} />
            <Detail
              label="Coordinates"
              value={
                entry.clockOutLatitude !== null
                  ? `${entry.clockOutLatitude}, ${entry.clockOutLongitude}`
                  : "Not captured"
              }
            />
            <Detail label="Accuracy" value={entry.clockOutAccuracy !== null ? `${Math.round(entry.clockOutAccuracy)} m` : "—"} />
            <Detail label="Distance" value={entry.clockOutDistanceMeters !== null ? `${Math.round(entry.clockOutDistanceMeters)} m` : "—"} />
            <Detail label="Geofence" value={locationLabel(entry.clockOutGeofenceStatus)} />
          </DetailSection>
          <DetailSection title="Totals">
            <Detail label="Gross Time" value={formatDuration(row.totals.grossSeconds)} />
            <Detail label="Total Break" value={formatDuration(row.totals.breakSeconds)} />
            <Detail label="Worked Time" value={formatDuration(row.totals.workedSeconds)} />
            <Detail label="Hourly Rate" value={entry.payRateSnapshot !== null ? formatCurrency(entry.payRateSnapshot, settings.currencyCode) : "Salary"} />
            <Detail label="Estimated Pay" value={formatCurrency(row.totals.estimatedPay, settings.currencyCode)} />
          </DetailSection>

          {canManage ? (
            <DetailSection title="Correct Time Entry">
              <div className="space-y-2">
                <Label>Field</Label>
                <select
                  className="h-10 w-full rounded-lg border bg-card px-3 text-sm"
                  value={fieldName}
                  onChange={(event) => setFieldName(event.target.value)}
                >
                  <option value="clockInAt">Clock In</option>
                  <option value="clockOutAt">Clock Out</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>New value</Label>
                <Input
                  type="datetime-local"
                  value={newValue}
                  onChange={(event) => setNewValue(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Reason for correction</Label>
                <Input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Required"
                />
              </div>
              <Button
                disabled={pending || !newValue || reason.trim().length < 3}
                onClick={() =>
                  startTransition(async () => {
                    const result = await correctTimeEntryAction({
                      timeEntryId: entry.id,
                      fieldName,
                      newValue: new Date(newValue).toISOString(),
                      reason,
                    });
                    if (!result.ok) toast.error(result.error);
                    else {
                      toast.success("Correction saved with audit history");
                      router.refresh();
                      onOpenChange(false);
                    }
                  })
                }
              >
                Save Correction
              </Button>
            </DetailSection>
          ) : null}

          {edits.length ? (
            <DetailSection title="Edit History">
              {edits.map((edit) => (
                <div key={edit.id} className="rounded-lg bg-muted p-3 text-xs">
                  <p className="font-medium">{edit.fieldName}</p>
                  <p>{edit.oldValue ?? "Empty"} → {edit.newValue ?? "Empty"}</p>
                  <p className="text-muted-foreground">{edit.reason}</p>
                </div>
              ))}
            </DetailSection>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-xl font-semibold text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        className="mt-1 h-10 w-full rounded-lg border bg-card px-2 text-sm text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function FilterDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-muted-foreground">
      {label}
      <Input
        className="mt-1"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function time(value: string, timezone: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function locationLabel(status: TimeEntry["clockInGeofenceStatus"]) {
  if (status === "verified") return "Verified";
  if (status === "outside_geofence") return "Outside geofence";
  if (status === "not_required") return "Not required";
  return "Unavailable";
}
