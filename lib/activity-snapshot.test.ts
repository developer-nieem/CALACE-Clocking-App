import { describe, expect, it } from "vitest";
import {
  ACTIVITY_SNAPSHOT_MAX_MINUTES,
  ACTIVITY_SNAPSHOT_MIN_MINUTES,
  activitySnapshotRecipients,
  employeeScreenCaptureEnabled,
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

  it("emails active admins when screen capture is on", () => {
    expect(
      activitySnapshotRecipients({
        profiles: [
          { id: "admin-1", email: "admin@calace.team", roles: ["admin"], employmentStatus: "active" },
          { id: "admin-2", email: "gone@calace.team", roles: ["admin"], employmentStatus: "archived" },
          { id: "ins-1", email: "yan@school.com", roles: ["instructor"], employmentStatus: "active" },
        ],
      }),
    ).toEqual(["admin@calace.team"]);
    expect(
      employeeScreenCaptureEnabled("ins-1", [
        { id: "ins-1", screenCaptureEnabled: true },
        { id: "ins-2", screenCaptureEnabled: false },
      ]),
    ).toBe(true);
  });

  it("rejects non-jpeg payloads and unsafe paths", () => {
    const jpeg = `data:image/jpeg;base64,${"A".repeat(80)}=`;
    expect(parseActivitySnapshotImage("data:image/png;base64,abc")).toBeNull();
    expect(parseActivitySnapshotImage(jpeg)).toBe(`${"A".repeat(80)}=`);
    expect(sanitizeActivityPath("https://evil.example/x")).toBe("/dashboard");
    expect(sanitizeActivityPath("/time-clock")).toBe("/time-clock");
  });
});
