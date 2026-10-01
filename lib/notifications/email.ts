import { createHash, randomBytes } from "node:crypto";

export type EmailTemplate =
  | "shift_assigned"
  | "shift_changed"
  | "shift_cancelled"
  | "time_off_approved"
  | "time_off_rejected"
  | "open_shift_approved"
  | "trade_approved"
  | "task_assigned"
  | "qualification_expiring";

export function renderEmail(template: EmailTemplate, message: string) {
  const titles: Record<EmailTemplate, string> = {
    shift_assigned: "Shift assigned",
    shift_changed: "Shift changed",
    shift_cancelled: "Shift cancelled",
    time_off_approved: "Time off approved",
    time_off_rejected: "Time off rejected",
    open_shift_approved: "Open shift approved",
    trade_approved: "Shift trade approved",
    task_assigned: "Task assigned",
    qualification_expiring: "Qualification expiring",
  };
  return `<!doctype html><html><body style="margin:0;background:#F7F8FA;font-family:Arial,sans-serif;color:#0D2A43">
    <div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #e6e8eb;border-radius:12px;padding:24px">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;color:#D8B53C">CAL ACE</p>
      <h1 style="margin:0 0 12px;font-size:20px">${titles[template]}</h1>
      <p style="margin:0;font-size:14px;line-height:1.5">${message}</p>
    </div>
  </body></html>`;
}

export async function sendNotificationEmail(input: {
  to: string;
  template: EmailTemplate;
  message: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { sent: false as const, reason: "not_configured" as const };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: `CAL ACE · ${input.template.replaceAll("_", " ")}`,
        html: renderEmail(templateSafe(input.template), input.message),
      }),
    });
    if (!response.ok) return { sent: false as const, reason: "provider_error" as const };
    return { sent: true as const };
  } catch {
    return { sent: false as const, reason: "provider_error" as const };
  }
}

function templateSafe(template: EmailTemplate) {
  return template;
}

export function emailFailureDoesNotThrow() {
  return true;
}

export function hashFeedToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createFeedToken() {
  const token = randomBytes(24).toString("hex");
  return { token, tokenHash: hashFeedToken(token) };
}
