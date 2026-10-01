"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDuration } from "@/lib/time-clock/calculations";
import { formatTimeRange, fullName } from "@/lib/utils";
import { GeoLink } from "@/components/time-clock/geo-link";
import type {
  Location,
  OrganizationSettings,
  Position,
  Profile,
  Shift,
  TimeBreak,
  TimeEntry,
} from "@/types";

export function LiveAttendance({
  profiles,
  entries,
  breaks,
  shifts,
  positions,
  locations,
  settings,
}: {
  profiles: Profile[];
  entries: TimeEntry[];
  breaks: TimeBreak[];
  shifts: Shift[];
  positions: Position[];
  locations: Location[];
  settings: OrganizationSettings;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const live = entries
    .filter((entry) => entry.clockOutAt === null)
    .sort((a, b) => a.clockInAt.localeCompare(b.clockInAt));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who&apos;s Working Now</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Scheduled Shift</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Elapsed Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Clock-in location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {live.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No employees are currently clocked in.
                </TableCell>
              </TableRow>
            ) : (
              live.map((entry) => {
                const profile = profiles.find((item) => item.id === entry.userId);
                const shift = shifts.find((item) => item.id === entry.shiftId);
                const location = locations.find(
                  (item) => item.id === entry.clockInLocationId,
                );
                const activeBreak = breaks.find(
                  (item) =>
                    item.timeEntryId === entry.id && item.breakEndAt === null,
                );
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Link
                        href={`/users/${entry.userId}`}
                        className="font-medium hover:underline"
                      >
                        {profile
                          ? fullName(profile.firstName, profile.lastName)
                          : "Unknown"}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">
                      {profile?.employeeType ?? "—"}
                    </TableCell>
                    <TableCell>
                      {positions.find((item) => item.id === profile?.positionId)?.name ??
                        "—"}
                    </TableCell>
                    <TableCell>
                      {shift
                        ? formatTimeRange(shift.startTime, shift.endTime)
                        : "Unscheduled"}
                    </TableCell>
                    <TableCell>
                      {new Date(entry.clockInAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: settings.timezone,
                      })}
                    </TableCell>
                    <TableCell>
                      {formatDuration(
                        (now.getTime() - new Date(entry.clockInAt).getTime()) / 1000,
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={activeBreak ? "on_break" : entry.clockStatus ?? "working"}
                      />
                    </TableCell>
                    <TableCell>
                      <div>{location?.name ?? "Unassigned"}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.clockInGeofenceStatus === "verified"
                          ? "Inside geofence"
                          : entry.clockInGeofenceStatus === "outside_geofence"
                            ? "Outside geofence"
                            : "Geofence unavailable"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <GeoLink
                        latitude={entry.clockInLatitude}
                        longitude={entry.clockInLongitude}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
