import type { DeviceLocation } from "@/types";

const FRESH_MS = 90_000;
const STALE_OK_MS = 5 * 60_000;

let lastKnown: DeviceLocation | null = null;
let watchId: number | null = null;
let watchers = 0;

function sanitize(position: GeolocationPosition): DeviceLocation {
  const accuracy = Number(position.coords.accuracy);
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Number.isFinite(accuracy) ? Math.min(Math.max(accuracy, 0), 100_000) : 0,
    timestamp: Number(position.timestamp) || Date.now(),
  };
}

function remember(location: DeviceLocation) {
  lastKnown = location;
  return location;
}

function ageMs(location: DeviceLocation) {
  return Date.now() - location.timestamp;
}

export function cachedDeviceLocation(maxAgeMs = STALE_OK_MS): DeviceLocation | null {
  if (!lastKnown) return null;
  return ageMs(lastKnown) <= maxAgeMs ? lastKnown : null;
}

function readPosition(enableHighAccuracy: boolean, timeout: number, maximumAge: number) {
  return new Promise<DeviceLocation>((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("Location is required, but this browser cannot read it."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(remember(sanitize(position))),
      (error) => reject(error),
      { enableHighAccuracy, timeout, maximumAge },
    );
  });
}

function primeCache() {
  void readPosition(false, 2_500, 60_000).catch(() => {
    void readPosition(true, 4_000, 15_000).catch(() => undefined);
  });
}

export function startLocationWatch() {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return () => {};
  }
  watchers += 1;
  if (watchId === null) {
    primeCache();
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        remember(sanitize(position));
      },
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 8_000 },
    );
  }
  return () => {
    watchers = Math.max(0, watchers - 1);
    if (watchers === 0 && watchId !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  };
}

export async function readDeviceLocation(): Promise<DeviceLocation> {
  const fresh = cachedDeviceLocation(FRESH_MS);
  if (fresh) return fresh;

  try {
    return await readPosition(false, 2_500, 60_000);
  } catch {
    const stale = cachedDeviceLocation(STALE_OK_MS);
    if (stale) return stale;
    try {
      return await readPosition(true, 4_000, 15_000);
    } catch {
      const last = cachedDeviceLocation(STALE_OK_MS);
      if (last) return last;
      throw new Error("Location permission is required. Allow location for this site, then try again.");
    }
  }
}
