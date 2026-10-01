import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { readWorkforceState } from "@/lib/db/workforce";
import { hasPermission } from "@/lib/permissions";
import { toCsv } from "@/lib/phase3/domain";
import { attendanceRows, laborCost, payrollCsv, scheduleVersusActual } from "@/lib/phase3/reports";
import { addDays, startOfWeekMonday, toISODate } from "@/lib/utils";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kind = new URL(request.url).searchParams.get("kind");
  const state = await readWorkforceState();
  const now = new Date();
  const today = toISODate(now);
  const start = toISODate(startOfWeekMonday(now));
  const end = toISODate(addDays(startOfWeekMonday(now), 6));

  if (kind === "payroll" || kind === "labor") {
    if (!hasPermission(user.roles, user.permissions, "payroll.export") && !hasPermission(user.roles, user.permissions, "payroll.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!hasPermission(user.roles, user.permissions, "attendance.read") && !hasPermission(user.roles, user.permissions, "reports.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let csv = "";
  if (kind === "payroll") {
    csv = payrollCsv({
      entries: state.timeEntries,
      breaks: state.timeBreaks,
      settings: state.settings,
      rates: state.payRates,
      profiles: state.profiles,
      date: today,
    }).csv;
  } else if (kind === "attendance") {
    csv = toCsv(attendanceRows({
      today,
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
      shifts: state.shifts,
      entries: state.timeEntries,
      profiles: state.profiles,
      graceMinutes: state.settings.clockInLateGraceMinutes,
    }));
  } else if (kind === "schedule") {
    csv = toCsv(scheduleVersusActual({
      shifts: state.shifts,
      entries: state.timeEntries,
      breaks: state.timeBreaks,
      settings: state.settings,
      profiles: state.profiles,
      from: start,
      to: end,
    }));
  } else if (kind === "labor") {
    const cost = laborCost({
      shifts: state.shifts,
      entries: state.timeEntries,
      breaks: state.timeBreaks,
      settings: state.settings,
      rates: state.payRates,
      profiles: state.profiles,
      from: start,
      to: end,
    });
    csv = toCsv([{ scheduled: cost.scheduled, actual: cost.actual, overtime: cost.overtime, variance: cost.variance }]);
  } else {
    return NextResponse.json({ error: "Unknown export" }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calace-${kind}.csv"`,
    },
  });
}
