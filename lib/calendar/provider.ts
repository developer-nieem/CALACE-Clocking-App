export type CalendarSyncResult =
  | { ok: true; externalEventId: string }
  | { ok: false; status: "not_configured" | "failed"; error: string };

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function microsoftConfigured() {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

export function calendarConnectUrl(provider: "google" | "microsoft") {
  if (provider === "google" && !googleConfigured()) return null;
  if (provider === "microsoft" && !microsoftConfigured()) return null;
  return `/api/calendar/${provider}/start`;
}

export type CalendarRetryAction = "create" | "update" | "skip";

export function calendarRetryAction(input: { failed: boolean; existingExternalId?: string | null }): CalendarRetryAction {
  if (!input.failed) return "skip";
  return input.existingExternalId ? "update" : "create";
}

export async function syncShiftToCalendar(input: {
  shiftId: string;
  title: string;
  hasConnection: boolean;
  existingExternalId?: string | null;
}): Promise<CalendarSyncResult> {
  if (!input.hasConnection || (!googleConfigured() && !microsoftConfigured())) {
    return { ok: false, status: "not_configured", error: "Calendar provider is not configured." };
  }
  try {
    return {
      ok: false,
      status: "failed",
      error: "Calendar sync is connected, but no external event call succeeded.",
    };
  } catch (error) {
    return { ok: false, status: "failed", error: error instanceof Error ? error.message : "Calendar sync failed." };
  }
}
