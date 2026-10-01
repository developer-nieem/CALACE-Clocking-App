import { NextResponse } from "next/server";
import { withJobLock } from "@/lib/db/neon";
import { isDatabaseMode } from "@/lib/env";
import { logEvent } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false as const, status: 503 };
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) return { ok: false as const, status: 401 };
  return { ok: true as const };
}

async function handle(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, status: auth.status === 503 ? "not_configured" : "unauthorized" }, { status: auth.status });
  }
  if (!isDatabaseMode()) {
    return NextResponse.json({ ok: true, retried: 0, status: "demo" });
  }
  const locked = await withJobLock("cron:calendar-retry", 120, async () => {
    logEvent("info", "cron.calendar_retry", { retried: 0 });
    return { retried: 0 };
  });
  if (!locked.acquired) {
    return NextResponse.json({ ok: true, status: "locked", retried: 0 });
  }
  return NextResponse.json({ ok: true, ...locked.result });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
