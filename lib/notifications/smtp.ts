import nodemailer from "nodemailer";
import { decryptSecret } from "@/lib/security/secrets";
import type { OrganizationSettings, SmtpSettingsPublic } from "@/types";

export function smtpConfigured(settings?: OrganizationSettings | null) {
  return Boolean(settings?.smtpEnabled && settings.smtpHost && settings.smtpFromEmail);
}

export function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function emailDeliveryConfigured(settings?: OrganizationSettings | null) {
  return smtpConfigured(settings) || resendConfigured();
}

export function redactSmtpSecrets(settings: OrganizationSettings): OrganizationSettings {
  return { ...settings, smtpPasswordEncrypted: null };
}

export function toPublicSmtpSettings(settings?: OrganizationSettings | null): SmtpSettingsPublic {
  return {
    enabled: Boolean(settings?.smtpEnabled),
    host: settings?.smtpHost ?? "",
    port: settings?.smtpPort ?? 587,
    secure: Boolean(settings?.smtpSecure),
    username: settings?.smtpUsername ?? "",
    fromEmail: settings?.smtpFromEmail ?? "",
    fromName: settings?.smtpFromName ?? "",
    passwordSet: Boolean(settings?.smtpPasswordEncrypted),
  };
}

function fromAddress(settings: OrganizationSettings) {
  const email = settings.smtpFromEmail ?? "";
  const name = settings.smtpFromName?.trim();
  return name ? `${name} <${email}>` : email;
}

export async function sendViaSmtp(input: {
  settings: OrganizationSettings;
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string; encoding?: "base64" }>;
}) {
  const password = input.settings.smtpPasswordEncrypted
    ? decryptSecret(input.settings.smtpPasswordEncrypted)
    : "";
  const transporter = nodemailer.createTransport({
    host: input.settings.smtpHost ?? "",
    port: input.settings.smtpPort ?? 587,
    secure: Boolean(input.settings.smtpSecure),
    auth: input.settings.smtpUsername
      ? { user: input.settings.smtpUsername, pass: password }
      : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  await transporter.sendMail({
    from: fromAddress(input.settings),
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments?.map((item) => ({
      filename: item.filename,
      content: item.content,
      encoding: item.encoding ?? "base64",
    })),
  });
}
