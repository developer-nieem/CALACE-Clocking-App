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
    const { ensureDatabase } = await import("@/lib/db/neon");
    await ensureDatabase();
    const database = process.env.DATABASE_URL?.includes("neon.tech") ? "neon" : "postgres";
    return NextResponse.json({
      ok: true,
      status: "ok",
      database,
      version,
      timestamp,
    });
  } catch {
    return NextResponse.json(
      { ok: false, status: "error", database: "unavailable", timestamp },
      { status: 503 },
    );
  }
}
