import { requireSession } from "@/lib/auth/session";
import { readWorkforceState } from "@/lib/db/workforce";
import { searchCatalog } from "@/lib/db/phase5";
import { emailDeliveryConfigured, redactSmtpSecrets } from "@/lib/notifications/smtp";
import { isManager } from "@/lib/permissions";
import { fullName, minutesToHoursLabel, toISODate } from "@/lib/utils";
import type { AttendanceRow, AttendanceStatus } from "@/types";
import {
  calculateEntryTotals,
  formatCurrency,
} from "@/lib/time-clock/calculations";

export async function getDashboardData() {
  const user = await requireSession();
  const state = await readWorkforceState();
  const today = toISODate(new Date());
  const instructors = state.profiles.filter((profile) =>
    profile.employeeType === "instructor",
  );
  const staff = state.profiles.filter((profile) => profile.employeeType === "staff");
  const todayShifts = state.shifts.filter(
    (shift) => shift.date === today && shift.status !== "cancelled",
  );
  const manager = isManager(user.roles);

  const attendance: AttendanceRow[] = todayShifts.flatMap((shift) => {
    const assigneeIds = shift.instructorIds.length ? shift.instructorIds : [null];
    return assigneeIds.map((instructorId) => {
      if (!instructorId) {
        return {
          id: `${shift.id}-open`,
          userId: "",
          shiftId: shift.id,
          scheduledStart: shift.startTime,
          scheduledEnd: shift.endTime,
          clockIn: null,
          clockOut: null,
          status: "scheduled" as AttendanceStatus,
          workedMinutes: 0,
        };
      }
      const clock = state.timeEntries.find(
        (entry) => entry.shiftId === shift.id && entry.userId === instructorId,
      );
      let status: AttendanceStatus = "scheduled";
      if (clock?.status === "on_break") status = "on_break";
      else if (clock?.clockOutAt) status = "completed";
      else if (clock?.clockStatus === "late") status = "late";
      else if (clock?.status === "working") status = "clocked_in";
      else if (shift.startTime < `${new Date().getHours().toString().padStart(2, "0")}:00` && !clock) {
        status = "absent";
      }
      const worked = clock
        ? Math.max(
            0,
            Math.round(
              calculateEntryTotals(
                clock,
                state.timeBreaks.filter((item) => item.timeEntryId === clock.id),
                state.settings,
              ).workedSeconds / 60,
            ),
          )
        : 0;
      return {
        id: `${shift.id}-${instructorId}`,
        userId: instructorId,
        shiftId: shift.id,
        scheduledStart: shift.startTime,
        scheduledEnd: shift.endTime,
        clockIn: clock?.clockInAt ?? null,
        clockOut: clock?.clockOutAt ?? null,
        status,
        workedMinutes: worked,
      };
    });
  });

  const activeEntries = state.timeEntries.filter((entry) => !entry.clockOutAt);
  const todayEntries = state.timeEntries.filter((entry) => entry.workDate === today);
  const todayLaborCost = todayEntries.reduce(
    (sum, entry) =>
      sum +
      calculateEntryTotals(
        entry,
        state.timeBreaks.filter((item) => item.timeEntryId === entry.id),
        state.settings,
      ).estimatedPay,
    0,
  );
  const stats = {
    totalEmployees: state.profiles.filter(
      (profile) => profile.employmentStatus === "active",
    ).length,
    totalInstructors: instructors.length,
    totalStaff: staff.length,
    todaysShifts: todayShifts.length,
    currentlyClockedIn: activeEntries.length,
    onBreak: activeEntries.filter((entry) => entry.status === "on_break").length,
    late: activeEntries.filter((entry) => entry.clockStatus === "late").length,
    openShifts: state.shifts.filter((shift) => shift.isOpen && shift.status === "published").length,
    pendingRequests:
      state.timeOff.filter((item) => item.status === "pending").length +
      state.trades.filter((item) => item.status === "pending").length,
    todayLaborCost: formatCurrency(
      todayLaborCost,
      state.settings.currencyCode,
    ),
  };

  const dashboardPreferences = state.dashboardPreferences ?? [];

  return {
    user,
    manager,
    stats,
    attendance,
    instructors,
    profiles: state.profiles,
    staff,
    shifts: state.shifts,
    todayShifts,
    timeOff: state.timeOff,
    trades: state.trades,
    tasks: manager
      ? state.tasks
      : state.tasks.filter((task) => task.assigneeIds.includes(user.id)),
    notifications: state.notifications.filter(
      (item) => item.userId === user.id || (manager && item.userId !== user.id),
    ),
    activity: state.activity,
    locations: state.locations,
    departments: state.departments,
    positions: state.positions,
    timeEntries: state.timeEntries,
    timeBreaks: state.timeBreaks,
    settings: redactSmtpSecrets(state.settings),
    lookups: {
      locations: state.locations,
      departments: state.departments,
      positions: state.positions,
    },
    searchItems: searchCatalog(user, state).items,
    activityEmailInstructorIds:
      dashboardPreferences.find((pref) => pref.userId === user.id)?.activityEmailInstructorIds ?? [],
    emailConfigured: emailDeliveryConfigured(state.settings),
  };
}

export function displayUserName(
  profiles: { id: string; firstName: string; lastName: string }[],
  userId: string,
) {
  const profile = profiles.find((item) => item.id === userId);
  return profile ? fullName(profile.firstName, profile.lastName) : "Unassigned";
}

export { minutesToHoursLabel };
