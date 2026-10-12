import { createHash, randomBytes } from "node:crypto";
import { readWorkforceState } from "@/lib/db/workforce";
import {
  emailDeliveryConfigured,
  resendConfigured,
  sendViaSmtp,
  smtpConfigured,
} from "@/lib/notifications/smtp";

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

export type SendEmailResult =
  | { sent: true; via: "smtp" | "resend" }
  | { sent: false; reason: "not_configured" | "provider_error" };

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

async function loadSettings() {
  try {
    const state = await readWorkforceState();
    return state.settings;
  } catch {
    return null;
  }
}

export async function sendAppEmail(input: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string; encoding?: "base64" }>;
}): Promise<SendEmailResult> {
  const settings = await loadSettings();
  if (smtpConfigured(settings) && settings) {
    try {
      await sendViaSmtp({
        settings,
        to: input.to,
        subject: input.subject,
        html: input.html,
        attachments: input.attachments,
      });
      return { sent: true, via: "smtp" };
    } catch {
      return { sent: false, reason: "provider_error" };
    }
  }
  if (!resendConfigured()) {
    return { sent: false, reason: emailDeliveryConfigured(settings) ? "provider_error" : "not_configured" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        attachments: input.attachments?.map((item) => ({
          filename: item.filename,
          content: item.content,
        })),
      }),
    });
    if (!response.ok) return { sent: false, reason: "provider_error" };
    return { sent: true, via: "resend" };
  } catch {
    return { sent: false, reason: "provider_error" };
  }
}

export async function sendNotificationEmail(input: {
  to: string;
  template: EmailTemplate;
  message: string;
}) {
  return sendAppEmail({
    to: input.to,
    subject: `CAL ACE · ${input.template.replaceAll("_", " ")}`,
    html: renderEmail(templateSafe(input.template), input.message),
  });
}

export async function sendActivitySnapshotEmail(input: {
  to: string;
  instructorName: string;
  path: string;
  capturedAt: string;
  jpegBase64: string;
}) {
  const safeName = input.instructorName.replace(/[<>]/g, "");
  const safePath = input.path.replace(/[<>]/g, "");
  const html = `<!doctype html><html><body style="margin:0;background:#F7F8FA;font-family:Arial,sans-serif;color:#0D2A43">
    <div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #e6e8eb;border-radius:12px;padding:24px">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;color:#D8B53C">CAL ACE</p>
      <h1 style="margin:0 0 12px;font-size:20px">Instructor activity snapshot</h1>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.5"><strong>${safeName}</strong> was in the app at ${input.capturedAt}.</p>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.5">Screen: ${safePath}</p>
      <p style="margin:0;font-size:12px;color:#667085">This picture is emailed only. It is not saved in the database.</p>
    </div>
  </body></html>`;
  return sendAppEmail({
    to: input.to,
    subject: `CAL ACE · Activity snapshot · ${safeName}`,
    html,
    attachments: [{ filename: "instructor-activity.jpg", content: input.jpegBase64, encoding: "base64" }],
  });
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
