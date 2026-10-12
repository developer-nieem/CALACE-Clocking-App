import { NextResponse } from "next/server";
import { getSessionUser, withSessionOrganization } from "@/lib/auth/session";
import {
  activitySnapshotRecipients,
  instructorIsWatched,
  parseActivitySnapshotImage,
  sanitizeActivityPath,
} from "@/lib/activity-snapshot";
import { readWorkforceState } from "@/lib/db/workforce";
import { isDatabaseMode } from "@/lib/env";
import { sendActivitySnapshotEmail } from "@/lib/notifications/email";
import { rateLimit, rateLimitKey, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { fullName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ enabled: false }, { status: 401 });
  if (user.employeeType !== "instructor") {
    return NextResponse.json({ enabled: false });
  }
  try {
    const state = await readWorkforceState(user.organizationId);
    return NextResponse.json({
      enabled: instructorIsWatched(user.id, state.dashboardPreferences ?? []),
    });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.employeeType !== "instructor") {
    return NextResponse.json({ error: "Only instructor sessions send activity snapshots." }, { status: 403 });
  }

  const limited = await rateLimit(rateLimitKey(["activity-snapshot", user.id]), 12, 60 * 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  let body: { image?: unknown; path?: unknown };
  try {
    body = (await request.json()) as { image?: unknown; path?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const jpegBase64 = parseActivitySnapshotImage(body.image);
  if (!jpegBase64) {
    return NextResponse.json({ error: "That snapshot could not be sent." }, { status: 400 });
  }
  const path = sanitizeActivityPath(body.path);

  if (!isDatabaseMode()) {
    return NextResponse.json({
      sent: false,
      reason: "demo",
      detail: "Activity snapshots are emailed when the app is connected to email and the database.",
    });
  }

  try {
    const result = await withSessionOrganization(async () => {
      const state = await readWorkforceState(user.organizationId);
      const preferences = state.dashboardPreferences ?? [];
      if (!instructorIsWatched(user.id, preferences)) {
        return { skipped: true as const };
      }
      const recipients = activitySnapshotRecipients({
        instructorId: user.id,
        profiles: state.profiles,
        preferences,
      });
      if (!recipients.length) return { skipped: true as const };

      const instructorName = fullName(user.firstName, user.lastName);
      const capturedAt = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
      let sent = 0;
      for (const to of recipients) {
        const delivery = await sendActivitySnapshotEmail({
          to,
          instructorName,
          path,
          capturedAt,
          jpegBase64,
        });
        if (delivery.sent) sent += 1;
        else if (delivery.reason === "not_configured") {
          return { sent: false as const, reason: "not_configured" as const };
        }
      }
      return { sent: sent > 0, count: sent };
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send snapshot.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
