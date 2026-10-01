import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { displayUserName, minutesToHoursLabel } from "@/lib/db/dashboard";
import { formatTimeRange } from "@/lib/utils";
import type { AttendanceRow, Profile, Shift } from "@/types";

export function AttendanceTable({
  rows,
  profiles,
  shifts,
}: {
  rows: AttendanceRow[];
  profiles: Profile[];
  shifts: Shift[];
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title="No shifts today" description="Published shifts will appear here." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Today&apos;s Attendance</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link href="/attendance">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Instructor</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Scheduled Time</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Worked Hours</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const shift = shifts.find((item) => item.id === row.shiftId);
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.userId ? displayUserName(profiles, row.userId) : "Open shift"}
                  </TableCell>
                  <TableCell>{shift?.title ?? "—"}</TableCell>
                  <TableCell>
                    {formatTimeRange(row.scheduledStart, row.scheduledEnd)}
                  </TableCell>
                  <TableCell>
                    {row.clockIn
                      ? new Date(row.clockIn).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {row.clockOut
                      ? new Date(row.clockOut).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>{minutesToHoursLabel(row.workedMinutes)}</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={row.userId ? `/users/${row.userId}` : "/open-shifts"}>
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
