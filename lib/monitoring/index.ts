type LogLevel = "info" | "warn" | "error";

function safeMeta(meta?: Record<string, unknown>) {
  if (!meta) return undefined;
  const blocked = [
    "password",
    "token",
    "secret",
    "authorization",
    "cookie",
    "dsn",
    "apikey",
    "refresh",
    "service_role",
    "latitude",
    "longitude",
    "geolocation",
    "chat",
    "hourlyrate",
    "payrate",
  ];
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (blocked.some((name) => key.toLowerCase().includes(name))) continue;
    copy[key] = value;
  }
  return copy;
}

export function logEvent(level: LogLevel, event: string, meta?: Record<string, unknown>) {
  const payload = {
    level,
    event,
    at: new Date().toISOString(),
    ...safeMeta(meta),
  };
  if (level === "error") console.error(JSON.stringify(payload));
  else if (level === "warn") console.warn(JSON.stringify(payload));
  else console.info(JSON.stringify(payload));
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : "Unknown error";
  logEvent("error", "exception", { message, ...safeMeta(context) });
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return { configured: false };
  return { configured: true };
}

export function monitoringStatus() {
  return {
    provider: process.env.SENTRY_DSN ? "sentry" : "console",
    configured: Boolean(process.env.SENTRY_DSN),
  };
}
