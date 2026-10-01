import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { mutateWorkforceState } from "@/lib/db/workforce";
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
