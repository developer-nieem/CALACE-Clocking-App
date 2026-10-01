import { NextResponse } from "next/server";
import { captureException } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.CALACE_ALLOW_ERROR_TEST !== "true") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  if (process.env.NEXT_PUBLIC_APP_ENV !== "staging" && process.env.CALACE_ALLOW_ERROR_TEST !== "true") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  captureException(new Error("CAL ACE staging error probe"), { probe: true });
  return NextResponse.json({ ok: true, probed: true });
}
