"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { readDeviceLocation, startLocationWatch } from "@/lib/time-clock/browser-location";

type PermissionState = "checking" | "granted" | "prompt" | "denied" | "unsupported";

export function LocationPermissionPrompt() {
  const [status, setStatus] = useState<PermissionState>("checking");

  function request() {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    void readDeviceLocation()
      .then(() => setStatus("granted"))
      .catch(() => setStatus("denied"));
  }

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      const timer = window.setTimeout(() => setStatus("unsupported"), 0);
      return () => window.clearTimeout(timer);
    }
    if (!navigator.permissions?.query) {
      const timer = window.setTimeout(() => setStatus("prompt"), 0);
      return () => window.clearTimeout(timer);
    }
    let permission: PermissionStatus | null = null;
    const apply = (state: PermissionStatus["state"]) => {
      setStatus(state === "granted" ? "granted" : state === "denied" ? "denied" : "prompt");
    };
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        permission = result;
        apply(result.state);
        result.onchange = () => apply(result.state);
      })
      .catch(() => setStatus("prompt"));
    return () => {
      if (permission) permission.onchange = null;
    };
  }, []);

  useEffect(() => {
    if (status === "granted") return startLocationWatch();
  }, [status]);

  if (status === "checking" || status === "granted") return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {status === "unsupported"
            ? "This browser cannot read location. Clock in, break, and clock out need a device that can share GPS."
            : "Location permission is required. Allow location for this site before you clock in. Admins see the GPS coordinates of each clock action."}
        </span>
      </p>
      {status === "denied" || status === "prompt" ? (
        <button
          type="button"
          onClick={request}
          className="rounded-full bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Allow location
        </button>
      ) : null}
    </div>
  );
}
