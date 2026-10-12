import { z } from "zod";

export const smtpSettingsSchema = z
  .object({
    enabled: z.boolean(),
    host: z.string().trim().max(200),
    port: z.coerce.number().int().min(1).max(65535),
    secure: z.boolean(),
    username: z.string().trim().max(200),
    password: z.string().max(500).optional(),
    fromEmail: z.string().trim().max(200),
    fromName: z.string().trim().max(120),
  })
  .superRefine((value, ctx) => {
    if (value.host && /[:/]/.test(value.host)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["host"],
        message: "Enter a host name only, not a URL.",
      });
    }
    if (value.enabled && !value.host) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["host"],
        message: "SMTP host is required.",
      });
    }
    if (value.enabled && value.fromEmail && !value.fromEmail.includes("@")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fromEmail"],
        message: "Enter a valid from email.",
      });
    }
    if (value.enabled && !value.fromEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fromEmail"],
        message: "From email is required.",
      });
    }
  });

export type SmtpSettingsInput = z.infer<typeof smtpSettingsSchema>;
