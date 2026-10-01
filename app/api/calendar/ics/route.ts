import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { listShifts } from "@/lib/db/shifts";
import { buildIcsCalendar } from "@/lib/calendar/ics";
import { addDays, toISODate } from "@/lib/utils";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requested = Number(new URL(request.url).searchParams.get("days") ?? 90);
  const days = requested === 30 ? 30 : 90;
  const start = toISODate(new Date());
  const end = toISODate(addDays(new Date(), days));
  const shifts = await listShifts(start, end);
  const ics = buildIcsCalendar(shifts, `${user.firstName} ${user.lastName} · CAL ACE`);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="calace-schedule.ics"',
    },
  });
}
