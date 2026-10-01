import { allowDemoSeed, envPublicSummary, isDatabaseMode, jsonStoreStatus, validateEnv } from "@/lib/env";
import { rateLimitConfigured } from "@/lib/security/rate-limit";
import { buildGoLiveChecklist, featureAwareStatus } from "@/lib/phase7/domain";
import { monitoringStatus } from "@/lib/monitoring";

export function integrationPanel() {
  const services = envPublicSummary();
  const flags = services;
  return [
    { label: "Database", value: isDatabaseMode() ? "Connected" : "Demo / not set" },
    { label: "Relational Workforce Store", value: isDatabaseMode() ? "Active" : "Demo memory" },
    {
      label: "Legacy JSON Store",
      value:
        jsonStoreStatus() === "dual_write"
          ? "Dual-write"
          : jsonStoreStatus() === "read_only"
            ? "Read-only"
            : "Disabled",
    },
    {
      label: "Distributed Rate Limit",
      value: rateLimitConfigured() ? "Configured" : isDatabaseMode() ? "Memory fallback" : "Not required (demo)",
    },
    { label: "Resend", value: featureAwareStatus(true, flags.email) },
    { label: "Google Calendar", value: featureAwareStatus(true, flags.googleCalendar) },
    { label: "Microsoft Calendar", value: featureAwareStatus(true, flags.microsoftCalendar) },
    { label: "Cron", value: flags.cron ? "Configured" : "Not configured" },
    { label: "Sentry", value: monitoringStatus().configured ? "Configured" : "Console only" },
    { label: "Storage", value: flags.storage ? "Connected" : "Not configured" },
    { label: "AI", value: featureAwareStatus(true, flags.ai) },
  ];
}

export function goLiveItems(input?: { lastCronAt?: string | null; profileCount?: number }) {
  const env = validateEnv();
  const services = envPublicSummary();
  return buildGoLiveChecklist({
    database: isDatabaseMode(),
    relationalRuntime: isDatabaseMode(),
    jsonWrites: process.env.CALACE_JSON_WRITES !== "false",
    rlsVerified: process.env.CALACE_RLS_VERIFIED === "true",
    adminAccount: (input?.profileCount ?? 0) > 0 || !isDatabaseMode(),
    distributedLimiter: rateLimitConfigured(),
    cron: services.cron,
    email: services.email,
    backupDocumented: true,
    demoSeedDisabled: !allowDemoSeed() || process.env.NODE_ENV !== "production",
  }).map((item) => {
    if (item.id === "cron" && input?.lastCronAt) {
      return { ...item, detail: `Last success ${input.lastCronAt}` };
    }
    if (item.id === "database" && !env.ok) {
      return { ...item, status: "fail" as const, detail: env.issues.join(", ") };
    }
    return item;
  });
}

export function isStagingEnvironment() {
  return process.env.NEXT_PUBLIC_APP_ENV === "staging" || process.env.APP_ENV === "staging";
}
