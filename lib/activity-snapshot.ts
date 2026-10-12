export const ACTIVITY_SNAPSHOT_MIN_MINUTES = 3;
export const ACTIVITY_SNAPSHOT_MAX_MINUTES = 7;
export const ACTIVITY_SNAPSHOT_MAX_DATA_URL_CHARS = 1_800_000;

export function randomActivitySnapshotDelayMs() {
  const span = ACTIVITY_SNAPSHOT_MAX_MINUTES - ACTIVITY_SNAPSHOT_MIN_MINUTES + 1;
  const minutes = ACTIVITY_SNAPSHOT_MIN_MINUTES + Math.floor(Math.random() * span);
  return minutes * 60_000;
}

export function parseActivitySnapshotImage(image: unknown) {
  if (typeof image !== "string") return null;
  const compact = image.replace(/\s/g, "");
  if (compact.length < 80 || compact.length > ACTIVITY_SNAPSHOT_MAX_DATA_URL_CHARS) return null;
  const match = compact.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+=*)$/);
  return match?.[1] ?? null;
}

export function sanitizeActivityPath(path: unknown) {
  if (typeof path !== "string" || path.length > 200) return "/dashboard";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return "/dashboard";
  return path;
}

export function employeeScreenCaptureEnabled(
  employeeId: string,
  profiles: Array<{ id: string; screenCaptureEnabled?: boolean }>,
) {
  return Boolean(profiles.find((profile) => profile.id === employeeId)?.screenCaptureEnabled);
}

export function activitySnapshotRecipients(input: {
  profiles: Array<{
    id: string;
    email: string;
    roles: string[];
    employmentStatus?: string;
  }>;
}) {
  return [
    ...new Set(
      input.profiles
        .filter(
          (profile) =>
            (profile.roles.includes("admin") || profile.roles.includes("super_admin")) &&
            profile.email.includes("@") &&
            profile.employmentStatus !== "inactive" &&
            profile.employmentStatus !== "terminated" &&
            profile.employmentStatus !== "archived",
        )
        .map((profile) => profile.email.trim().toLowerCase()),
    ),
  ];
}
