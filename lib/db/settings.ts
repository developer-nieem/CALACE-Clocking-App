import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { mutateWorkforceState, readWorkforceState } from "@/lib/db/workforce";
import { encryptSecret, encryptionConfigured } from "@/lib/security/secrets";
import { smtpSettingsSchema } from "@/lib/validations/smtp";
import { toPublicSmtpSettings } from "@/lib/notifications/smtp";
import type { GeofenceEnforcement } from "@/types";

export async function updateClockSettings(input: {
  requireLocationClockIn: boolean;
  requireLocationClockOut: boolean;
  geofenceEnforcement: GeofenceEnforcement;
  allowUnscheduledClockIn: boolean;
}) {
  await requirePermission("settings.manage");
  await mutateWorkforceState((state) => {
    Object.assign(state.settings, input);
  });
  revalidatePath("/settings");
  revalidatePath("/time-clock");
}

export async function updateWorkLocation(input: {
  id: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
  geolocationRequired: boolean;
}) {
  await requirePermission("settings.manage");
  await mutateWorkforceState((state) => {
    const location = state.locations.find((item) => item.id === input.id);
    if (!location) throw new Error("Location not found.");
    Object.assign(location, input);
  });
  revalidatePath("/settings");
  revalidatePath("/time-clock");
}

export async function getSmtpSettingsPublic() {
  await requirePermission("settings.manage");
  const state = await readWorkforceState();
  return toPublicSmtpSettings(state.settings);
}

export async function saveSmtpSettings(input: unknown) {
  const actor = await requirePermission("settings.manage");
  const parsed = smtpSettingsSchema.parse(input);
  await mutateWorkforceState((state) => {
    const previous = state.settings.smtpPasswordEncrypted ?? null;
    let nextPassword = previous;
    if (parsed.password) {
      if (!encryptionConfigured()) {
        throw new Error("APP_ENCRYPTION_KEY is required before an SMTP password can be saved.");
      }
      nextPassword = encryptSecret(parsed.password);
    }
    if (!parsed.enabled && !parsed.host) {
      nextPassword = null;
    }
    if (parsed.enabled && !nextPassword && parsed.username) {
      throw new Error("Enter the SMTP password.");
    }
    Object.assign(state.settings, {
      smtpEnabled: parsed.enabled,
      smtpHost: parsed.host || null,
      smtpPort: parsed.port,
      smtpSecure: parsed.secure,
      smtpUsername: parsed.username || null,
      smtpPasswordEncrypted: nextPassword,
      smtpFromEmail: parsed.fromEmail || null,
      smtpFromName: parsed.fromName || null,
    });
  }, actor.organizationId);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
