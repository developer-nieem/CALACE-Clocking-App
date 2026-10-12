"use server";

import { requirePermission, withSessionOrganization } from "@/lib/auth/session";
import { sendTestEmail } from "@/lib/notifications/test-email";
import { RATE_LIMIT_MESSAGE, rateLimit } from "@/lib/security/rate-limit";

export async function sendTestEmailAction(to: string) {
  await requirePermission("settings.manage");
  const limited = await rateLimit(`test-email:${to}`, 3, 60_000);
  if (!limited.success) return { error: RATE_LIMIT_MESSAGE };
  const result = await withSessionOrganization(() => sendTestEmail(to));
  if (!result.sent) {
    return { error: result.reason === "not_configured" ? "Email is not configured. Add SMTP in Settings." : "The test email could not be sent." };
  }
  return { ok: true as const };
}
