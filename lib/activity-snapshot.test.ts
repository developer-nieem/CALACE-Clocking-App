import { describe, expect, it } from "vitest";
import {
  ACTIVITY_SNAPSHOT_MAX_MINUTES,
  ACTIVITY_SNAPSHOT_MIN_MINUTES,
  activitySnapshotRecipients,
  instructorIsWatched,
  parseActivitySnapshotImage,
  randomActivitySnapshotDelayMs,
  sanitizeActivityPath,
} from "@/lib/activity-snapshot";

describe("activity snapshot", () => {
  it("picks a random 3–7 minute delay", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 80; i += 1) {
      const ms = randomActivitySnapshotDelayMs();
      expect(ms % 60_000).toBe(0);
      const minutes = ms / 60_000;
      expect(minutes).toBeGreaterThanOrEqual(ACTIVITY_SNAPSHOT_MIN_MINUTES);
      expect(minutes).toBeLessThanOrEqual(ACTIVITY_SNAPSHOT_MAX_MINUTES);
      seen.add(minutes);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("emails only admins who selected that instructor", () => {
    expect(
      activitySnapshotRecipients({
        instructorId: "ins-1",
        profiles: [
          { id: "admin-1", email: "admin@calace.team" },
          { id: "admin-2", email: "other@calace.team" },
          { id: "ins-1", email: "yan@school.com" },
        ],
        preferences: [
          { userId: "admin-1", activityEmailInstructorIds: ["ins-1"] },
          { userId: "admin-2", activityEmailInstructorIds: ["ins-2"] },
        ],
      }),
    ).toEqual(["admin@calace.team"]);
  });

  it("rejects non-jpeg payloads and unsafe paths", () => {
    const jpeg = `data:image/jpeg;base64,${"A".repeat(80)}=`;
    expect(parseActivitySnapshotImage("data:image/png;base64,abc")).toBeNull();
    expect(parseActivitySnapshotImage(jpeg)).toBe(`${"A".repeat(80)}=`);
    expect(sanitizeActivityPath("https://evil.example/x")).toBe("/dashboard");
    expect(sanitizeActivityPath("/time-clock")).toBe("/time-clock");
    expect(instructorIsWatched("ins-1", [{ activityEmailInstructorIds: ["ins-1"] }])).toBe(true);
  });
});
