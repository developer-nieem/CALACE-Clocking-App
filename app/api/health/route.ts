import { NextResponse } from "next/server";
import { isDatabaseMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const version = process.env.npm_package_version ?? "0.1.0";
  const timestamp = new Date().toISOString();
  if (!isDatabaseMode()) {
    return NextResponse.json({
      ok: true,
      status: "ok",
      database: "demo",
      version,
      timestamp,
    });
  }

  try {
    const { pingDatabase } = await import("@/lib/db/neon");
    await pingDatabase();
    const database = process.env.DATABASE_URL?.includes("neon.tech") ? "neon" : "postgres";
    return NextResponse.json({
      ok: true,
      status: "ok",
      database,
      version,
      timestamp,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const hint = /password authentication failed|28P01/i.test(message)
      ? "DATABASE_URL password was rejected. Paste the current pooled Neon URL in Vercel and redeploy."
      : /ENOTFOUND|ETIMEDOUT|ECONNREFUSED|timeout/i.test(message)
        ? "Could not reach Neon. Confirm DATABASE_URL and that the database is not paused."
        : "Database connection failed. Confirm DATABASE_URL in Vercel.";
    return NextResponse.json(
      { ok: false, status: "error", database: "unavailable", hint, timestamp },
      { status: 503 },
    );
  }
}
