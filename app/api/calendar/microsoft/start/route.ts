import { NextResponse } from "next/server";
import { microsoftConfigured } from "@/lib/calendar/provider";
import { rateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(`oauth:microsoft:${ip}`, 10, 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }
  if (!microsoftConfigured()) {
    return NextResponse.redirect(new URL("/calendar-sync?error=not_configured", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/microsoft/callback`;
  const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  url.searchParams.set("client_id", process.env.MICROSOFT_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "offline_access Calendars.ReadWrite");
  return NextResponse.redirect(url);
}
