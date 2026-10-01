import { z } from "zod";

export type JsonStoreStatus = "dual_write" | "read_only" | "disabled";

export function isDemoMode() {
  if (process.env.DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return true;
  }
  return !process.env.DATABASE_URL;
}

export function isDatabaseMode() {
  return Boolean(process.env.DATABASE_URL) && !isDemoMode();
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function allowDemoSeed() {
  if (process.env.CALACE_SEED_DEMO === "false") return false;
  if (process.env.NODE_ENV === "production" && process.env.CALACE_SEED_DEMO !== "true") return false;
  return true;
}

export function jsonWritesEnabled() {
  return process.env.CALACE_JSON_WRITES !== "false";
}

export function jsonStoreStatus(): JsonStoreStatus {
  if (process.env.CALACE_JSON_STORE === "disabled") return "disabled";
  if (!jsonWritesEnabled()) return "read_only";
  return "dual_write";
}

const optional = z.string().optional();

export const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  DEMO_MODE: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_APP_ENV: optional,
  APP_ENV: optional,
  DATABASE_URL: optional,
  NEXT_PUBLIC_APP_URL: optional,
  CALACE_SEED_DEMO: z.enum(["true", "false"]).optional(),
  CALACE_JSON_WRITES: z.enum(["true", "false"]).optional(),
  CALACE_JSON_STORE: optional,
  CALACE_ALLOW_MEMORY_RATE_LIMIT: z.enum(["true", "false"]).optional(),
  CALACE_RLS_VERIFIED: z.enum(["true", "false"]).optional(),
  CRON_SECRET: optional,
  APP_ENCRYPTION_KEY: optional,
  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GOOGLE_REDIRECT_URI: optional,
  MICROSOFT_CLIENT_ID: optional,
  MICROSOFT_CLIENT_SECRET: optional,
  MICROSOFT_REDIRECT_URI: optional,
  OPENAI_API_KEY: optional,
  AI_PROVIDER: optional,
  SENTRY_DSN: optional,
  NEXT_PUBLIC_SENTRY_DSN: optional,
  NEXT_PUBLIC_SUPABASE_URL: optional,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,
});

export type EnvStatus = {
  group: string;
  configured: boolean;
  classification: "CORE REQUIRED" | "PRODUCTION REQUIRED" | "FEATURE OPTIONAL";
};

export function describeEnv(): EnvStatus[] {
  return [
    {
      group: "core",
      configured: Boolean(process.env.DATABASE_URL) || process.env.DEMO_MODE === "true",
      classification: "CORE REQUIRED",
    },
    {
      group: "email",
      configured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
      classification: "FEATURE OPTIONAL",
    },
    {
      group: "ai",
      configured: Boolean(process.env.OPENAI_API_KEY || process.env.AI_PROVIDER),
      classification: "FEATURE OPTIONAL",
    },
    {
      group: "google_calendar",
      configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      classification: "FEATURE OPTIONAL",
    },
    {
      group: "microsoft_calendar",
      configured: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
      classification: "FEATURE OPTIONAL",
    },
    {
      group: "monitoring",
      configured: Boolean(process.env.SENTRY_DSN),
      classification: "FEATURE OPTIONAL",
    },
    {
      group: "cron",
      configured: Boolean(process.env.CRON_SECRET),
      classification: "PRODUCTION REQUIRED",
    },
    {
      group: "storage",
      configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      classification: "FEATURE OPTIONAL",
    },
    {
      group: "rate_limit",
      configured: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
      classification: "PRODUCTION REQUIRED",
    },
    {
      group: "encryption",
      configured: Boolean(process.env.APP_ENCRYPTION_KEY),
      classification: "PRODUCTION REQUIRED",
    },
  ];
}

export function validateEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    return { ok: false as const, issues: parsed.error.issues.map((issue) => issue.path.join(".")) };
  }
  const production = process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true";
  const issues: string[] = [];
  if (production && !process.env.DATABASE_URL) issues.push("DATABASE_URL");
  if (production && process.env.NEXT_PUBLIC_APP_URL?.includes("localhost")) issues.push("NEXT_PUBLIC_APP_URL");
  if (production && !process.env.CRON_SECRET) issues.push("CRON_SECRET");
  if (production && !process.env.APP_ENCRYPTION_KEY) issues.push("APP_ENCRYPTION_KEY");
  if (
    production &&
    process.env.CALACE_ALLOW_MEMORY_RATE_LIMIT !== "true" &&
    !(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ) {
    issues.push("UPSTASH_REDIS_REST_URL");
  }
  if (issues.length) return { ok: false as const, issues };
  return { ok: true as const, issues: [] as string[] };
}

export function envPublicSummary() {
  const groups = describeEnv();
  return {
    core: groups.find((item) => item.group === "core")?.configured ?? false,
    email: groups.find((item) => item.group === "email")?.configured ?? false,
    ai: groups.find((item) => item.group === "ai")?.configured ?? false,
    googleCalendar: groups.find((item) => item.group === "google_calendar")?.configured ?? false,
    microsoftCalendar: groups.find((item) => item.group === "microsoft_calendar")?.configured ?? false,
    monitoring: groups.find((item) => item.group === "monitoring")?.configured ?? false,
    cron: groups.find((item) => item.group === "cron")?.configured ?? false,
    storage: groups.find((item) => item.group === "storage")?.configured ?? false,
    rateLimit: groups.find((item) => item.group === "rate_limit")?.configured ?? false,
    encryption: groups.find((item) => item.group === "encryption")?.configured ?? false,
  };
}
