"use server";

import { requirePermission } from "@/lib/auth/session";
import { sendTestEmail } from "@/lib/notifications/test-email";
import { RATE_LIMIT_MESSAGE, rateLimit } from "@/lib/security/rate-limit";

export async function sendTestEmailAction(to: string) {
  await requirePermission("security.manage");
  const limited = await rateLimit(`test-email:${to}`, 3, 60_000);
  if (!limited.success) return { error: RATE_LIMIT_MESSAGE };
  const result = await sendTestEmail(to);
  if (!result.sent) {
    return { error: result.reason === "not_configured" ? "Email is not configured." : "The test email could not be sent." };
  }
  return { ok: true as const };
}
