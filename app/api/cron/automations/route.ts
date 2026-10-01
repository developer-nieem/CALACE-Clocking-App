import { NextResponse } from "next/server";
import { runDueAutomations } from "@/lib/db/phase4";
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
  const started = Date.now();
  try {
    const result = await runDueAutomations(new Date());
    logEvent("info", "cron.automations", { ran: result.ran, durationMs: Date.now() - started });
    return NextResponse.json({ ok: true, durationMs: Date.now() - started, ...result });
  } catch (error) {
    logEvent("error", "cron.automations_failed", {
      message: error instanceof Error ? error.message : "cron_failed",
      durationMs: Date.now() - started,
    });
    return NextResponse.json({ ok: false, status: "failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
