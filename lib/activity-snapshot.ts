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

export function activitySnapshotRecipients(input: {
  instructorId: string;
  profiles: Array<{ id: string; email: string }>;
  preferences: Array<{ userId: string; activityEmailInstructorIds?: string[] }>;
}) {
  const adminIds = new Set(
    input.preferences
      .filter((pref) => pref.activityEmailInstructorIds?.includes(input.instructorId))
      .map((pref) => pref.userId),
  );
  return [
    ...new Set(
      input.profiles
        .filter((profile) => adminIds.has(profile.id) && profile.email.includes("@"))
        .map((profile) => profile.email.trim().toLowerCase()),
    ),
  ];
}

export function instructorIsWatched(
  instructorId: string,
  preferences: Array<{ activityEmailInstructorIds?: string[] }>,
) {
  return preferences.some((pref) => pref.activityEmailInstructorIds?.includes(instructorId));
}
