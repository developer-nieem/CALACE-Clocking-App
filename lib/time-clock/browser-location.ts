import type { DeviceLocation } from "@/types";

function sanitize(position: GeolocationPosition): DeviceLocation {
  const accuracy = Number(position.coords.accuracy);
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Number.isFinite(accuracy) ? Math.min(Math.max(accuracy, 0), 100_000) : 0,
    timestamp: Number(position.timestamp) || Date.now(),
  };
}

function readPosition(enableHighAccuracy: boolean, timeout: number) {
  return new Promise<DeviceLocation>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location is required, but this browser cannot read it."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(sanitize(position)),
      (error) => reject(error),
      { enableHighAccuracy, timeout, maximumAge: enableHighAccuracy ? 0 : 60_000 },
    );
  });
}

export async function readDeviceLocation(): Promise<DeviceLocation> {
  try {
    return await readPosition(true, 8_000);
  } catch {
    return readPosition(false, 12_000);
  }
}
