import { payRateForDate } from "@/lib/time-clock/calculations";
import { csvCell } from "@/lib/money";
import type {
  ChatRoom,
  EmployeeDocument,
  EmployeePayRate,
  Profile,
  Shift,
  TaskItem,
} from "@/types";

export type PayPeriodType = "weekly" | "biweekly" | "semimonthly" | "monthly";

export function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPayPeriod(date: string, type: PayPeriodType = "weekly") {
  const current = new Date(`${date}T00:00:00`);
  if (type === "monthly") {
    const start = new Date(current.getFullYear(), current.getMonth(), 1);
    const end = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    return { start: isoDate(start), end: isoDate(end) };
  }
  if (type === "semimonthly") {
    if (current.getDate() <= 15) {
      return {
        start: isoDate(new Date(current.getFullYear(), current.getMonth(), 1)),
        end: isoDate(new Date(current.getFullYear(), current.getMonth(), 15)),
      };
    }
    return {
      start: isoDate(new Date(current.getFullYear(), current.getMonth(), 16)),
      end: isoDate(new Date(current.getFullYear(), current.getMonth() + 1, 0)),
    };
  }
  const day = current.getDay();
  const mondayOffset = (day + 6) % 7;
  const start = new Date(current);
  start.setDate(current.getDate() - mondayOffset);
  if (type === "biweekly") {
    const anchor = new Date("2026-01-05T00:00:00");
    const days = Math.floor((start.getTime() - anchor.getTime()) / 86400000);
    const period = Math.floor(days / 14);
    const periodStart = new Date(anchor);
    periodStart.setDate(anchor.getDate() + period * 14);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + 13);
    return { start: isoDate(periodStart), end: isoDate(periodEnd) };
  }
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: isoDate(start), end: isoDate(end) };
}

export function visibleTasks(tasks: TaskItem[], userId: string, canManage: boolean) {
  if (canManage) return tasks;
  return tasks.filter((task) => task.assigneeIds.includes(userId));
}

export function checklistForUser(task: TaskItem, userId: string) {
  const items = task.checklist ?? [];
  const done = items.filter((item) =>
    (task.completions ?? []).some(
      (completion) => completion.checklistItemId === item.id && completion.userId === userId,
    ),
  );
  return { total: items.length, done: done.length, complete: items.length > 0 && done.length === items.length };
}

export function canReadRoom(room: ChatRoom, userId: string) {
  return room.memberIds.includes(userId);
}

export function findDirectRoom(rooms: ChatRoom[], leftId: string, rightId: string) {
  const members = [leftId, rightId].sort();
  return (
    rooms.find((room) => {
      if (room.type !== "direct" || room.memberIds.length !== 2) return false;
      const current = [...room.memberIds].sort();
      return current[0] === members[0] && current[1] === members[1];
    }) ?? null
  );
}

export function shiftsForCalendar(shifts: Shift[]) {
  return shifts.filter((shift) => shift.status === "published" || shift.status === "completed");
}

export type AttendanceLabel =
  | "Not Started"
  | "Not Clocked In"
  | "Late"
  | "Working"
  | "On Break"
  | "Completed"
  | "Potential Absence"
  | "Unscheduled"
  | "Outside Geofence"
  | "Missing Clock Out"
  | "Admin Edited";

export function classifyAttendance(input: {
  nowMinutes: number;
  shiftStart: string;
  shiftEnd: string;
  clockedIn: boolean;
  clockedOut: boolean;
  onBreak: boolean;
  late: boolean;
  outsideGeofence: boolean;
  unscheduled: boolean;
  adminEdited: boolean;
  graceMinutes: number;
}) {
  if (input.adminEdited && input.clockedOut) return "Admin Edited" as const;
  if (input.unscheduled && input.clockedIn && !input.clockedOut) return "Unscheduled" as const;
  if (input.outsideGeofence && input.clockedIn) return "Outside Geofence" as const;
  if (input.clockedIn && !input.clockedOut && input.nowMinutes > minutes(input.shiftEnd)) {
    return "Missing Clock Out" as const;
  }
  if (input.clockedOut) return "Completed" as const;
  if (input.onBreak) return "On Break" as const;
  if (input.clockedIn) return input.late ? ("Late" as const) : ("Working" as const);
  const start = minutes(input.shiftStart);
  if (input.nowMinutes < start) return "Not Started" as const;
  if (input.nowMinutes <= start + input.graceMinutes) return "Not Clocked In" as const;
  if (input.nowMinutes <= start + Math.max(input.graceMinutes, 60)) return "Late" as const;
  return "Potential Absence" as const;
}

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function documentStatus(
  expirationDate: string | null,
  today: string,
  alertDays = 30,
) {
  if (!expirationDate) return "Valid" as const;
  if (expirationDate < today) return "Expired" as const;
  const limit = new Date(`${today}T00:00:00`);
  limit.setDate(limit.getDate() + alertDays);
  if (expirationDate <= isoDate(limit)) return "Expiring Soon" as const;
  return "Valid" as const;
}

export function canViewDocument(
  document: Pick<EmployeeDocument, "userId">,
  actor: { id: string; canManage: boolean },
) {
  return actor.canManage || document.userId === actor.id;
}

export type PayrollDay = {
  userId: string;
  workDate: string;
  regularHours: number;
  overtimeHours: number;
  breakHours: number;
};

export function estimatePayroll(
  days: PayrollDay[],
  rates: EmployeePayRate[],
  multiplier: number,
) {
  const byUser = new Map<string, { regularHours: number; overtimeHours: number; breakHours: number; regularPay: number; overtimePay: number }>();
  for (const day of days) {
    const rate = payRateForDate(rates, day.userId, day.workDate) ?? 0;
    const current = byUser.get(day.userId) ?? {
      regularHours: 0,
      overtimeHours: 0,
      breakHours: 0,
      regularPay: 0,
      overtimePay: 0,
    };
    current.regularHours += day.regularHours;
    current.overtimeHours += day.overtimeHours;
    current.breakHours += day.breakHours;
    current.regularPay += day.regularHours * rate;
    current.overtimePay += day.overtimeHours * rate * multiplier;
    byUser.set(day.userId, current);
  }
  return [...byUser.entries()].map(([userId, row]) => ({
    userId,
    ...row,
    estimatedGross: roundMoney(row.regularPay + row.overtimePay),
    regularPay: roundMoney(row.regularPay),
    overtimePay: roundMoney(row.overtimePay),
  }));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function toCsv(rows: Array<Record<string, string | number>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")),
  ].join("\n");
}

export function groupSearch(query: string, data: {
  people: Profile[];
  shifts: Shift[];
  tasks: TaskItem[];
  locations?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
  qualifications?: Array<{ id: string; name: string }>;
}) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const groups: Array<{ group: string; id: string; label: string; href: string }> = [];
  for (const person of data.people) {
    const label = `${person.firstName} ${person.lastName}`;
    if (`${label} ${person.email}`.toLowerCase().includes(q)) {
      groups.push({ group: "People", id: person.id, label, href: `/users/${person.id}` });
    }
  }
  for (const shift of data.shifts) {
    if (shift.title.toLowerCase().includes(q)) {
      groups.push({ group: "Shifts", id: shift.id, label: `${shift.title} · ${shift.date}`, href: `/schedule?shift=${shift.id}` });
    }
  }
  for (const task of data.tasks) {
    if (task.title.toLowerCase().includes(q)) {
      groups.push({ group: "Tasks", id: task.id, label: task.title, href: "/tasks" });
    }
  }
  for (const location of data.locations ?? []) {
    if (location.name.toLowerCase().includes(q)) {
      groups.push({ group: "Locations", id: location.id, label: location.name, href: "/settings" });
    }
  }
  for (const department of data.departments ?? []) {
    if (department.name.toLowerCase().includes(q)) {
      groups.push({ group: "Departments", id: department.id, label: department.name, href: "/users" });
    }
  }
  for (const qualification of data.qualifications ?? []) {
    if (qualification.name.toLowerCase().includes(q)) {
      groups.push({ group: "Qualifications", id: qualification.id, label: qualification.name, href: "/users" });
    }
  }
  return groups.slice(0, 12);
}

export function notificationHref(entityType: string | null, entityId: string | null) {
  if (!entityId) return "/notifications";
  if (entityType === "task") return "/tasks";
  if (entityType === "shift") return `/schedule?shift=${entityId}`;
  if (entityType === "time_off") return "/time-off";
  if (entityType === "chat") return `/chat?room=${entityId}`;
  if (entityType === "document") return "/users";
  return "/notifications";
}
