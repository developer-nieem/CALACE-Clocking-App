import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { envPublicSummary, validateEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  const user = await getSessionUser();
  const allowed =
    (secret && header === `Bearer ${secret}`) ||
    (user && (user.role === "admin" || user.role === "super_admin"));
  if (!allowed) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const env = validateEnv();
  const services = envPublicSummary();
  return NextResponse.json({
    ok: env.ok,
    services,
    issues: env.issues,
    timestamp: new Date().toISOString(),
  });
}
