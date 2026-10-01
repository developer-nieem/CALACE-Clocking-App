import { NextResponse } from "next/server";
import { buildIcsCalendar } from "@/lib/calendar/ics";
import { readWorkforceState } from "@/lib/db/workforce";
import { hashFeedToken } from "@/lib/notifications/email";
import { shiftsForCalendar } from "@/lib/phase3/domain";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const state = await readWorkforceState();
  const hash = hashFeedToken(token);
  const feed = state.calendarFeeds.find((item) => item.tokenHash === hash);
  if (!feed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const shifts = shiftsForCalendar(state.shifts.filter((shift) => shift.instructorIds.includes(feed.userId)));
  const ics = buildIcsCalendar(shifts, "CAL ACE Workforce", state.locations);
  return new NextResponse(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
}
