import { sendNotificationEmail } from "@/lib/notifications/email";

export async function sendTestEmail(to: string) {
  const recipient = to.trim().toLowerCase();
  if (!recipient.includes("@") || recipient.length > 200) {
    return { sent: false as const, reason: "invalid_recipient" as const };
  }
  return sendNotificationEmail({
    to: recipient,
    template: "task_assigned",
    message: "CAL ACE test email. If you received this, SMTP or Resend delivery is working.",
  });
}
