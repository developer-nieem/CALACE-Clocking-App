import type { Shift } from "@/types";

export function buildIcsCalendar(
  shifts: Shift[],
  calendarName = "CAL ACE Schedule",
  locations: Array<{ id: string; name: string }> = [],
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CAL ACE Team//Workforce//EN",
    `X-WR-CALNAME:${calendarName}`,
  ];

  for (const shift of shifts.filter((item) => item.status === "published" || item.status === "completed")) {
    const start = toIcsStamp(shift.date, shift.startTime);
    const end = toIcsStamp(shift.date, shift.endTime);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${shift.id}@calace.team`,
      `DTSTAMP:${start}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeIcs(shift.title)}`,
      `LOCATION:${escapeIcs(locations.find((item) => item.id === shift.locationId)?.name ?? "CAL ACE Workforce")}`,
      `DESCRIPTION:${escapeIcs(shift.notes ?? "CAL ACE Workforce")}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function toIcsStamp(date: string, time: string) {
  return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
}

function escapeIcs(value: string) {
  return value.replaceAll(",", "\\,").replaceAll(";", "\\;").replaceAll("\n", "\\n");
}

export type CalendarProvider = "google" | "outlook" | "apple_ics";

export async function connectCalendarProvider(provider: CalendarProvider) {
  void provider;
  throw new Error("OAuth calendar integrations are planned for a later phase.");
}
