import { describe, expect, it } from "vitest";
import { formatClockLocation } from "@/lib/time-clock/place-name";

describe("clock location name", () => {
  it("matches the postal address line", () => {
    expect(
      formatClockLocation({
        postcode: "8700",
        city: "Barguna",
        county: "Barguna Sadar Subdistrict",
        state: "Barishal Division",
        country: "Bangladesh",
      }),
    ).toBe("8700, Barguna, Barguna, Barisal, Bangladesh");
  });

  it("keeps a full street address when Nominatim provides a road", () => {
    expect(
      formatClockLocation({
        house_number: "12",
        road: "Hospital Road",
        postcode: "8700",
        city: "Barguna",
        county: "Barguna",
        state: "Barishal",
        country: "Bangladesh",
      }),
    ).toBe("12, Hospital Road, 8700, Barguna, Barguna, Barisal, Bangladesh");
  });
});
