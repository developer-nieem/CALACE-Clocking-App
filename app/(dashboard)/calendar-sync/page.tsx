import { CalendarSync } from "@/components/phase3/calendar-sync";

export default function CalendarSyncPage() {
  return (
    <CalendarSync
      googleConfigured={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
      microsoftConfigured={Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)}
    />
  );
}
