import { NextResponse } from "next/server";
import { googleConfigured } from "@/lib/calendar/provider";
import { rateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(`oauth:google:${ip}`, 10, 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/calendar-sync?error=not_configured", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return NextResponse.redirect(url);
}
