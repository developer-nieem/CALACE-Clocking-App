import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";

describe("secret encryption", () => {
  it("round-trips a value with APP_ENCRYPTION_KEY", () => {
    process.env.APP_ENCRYPTION_KEY = "unit-test-encryption-key";
    const stored = encryptSecret("smtp-password");
    expect(stored.startsWith("v1.")).toBe(true);
    expect(stored.includes("smtp-password")).toBe(false);
    expect(decryptSecret(stored)).toBe("smtp-password");
  });
});
