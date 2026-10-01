"use client";

import { useEffect, useState } from "react";

const names = new Map<string, string>();

function cacheKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

export function usePlaceName(latitude: number | null, longitude: number | null) {
  const key = latitude !== null && longitude !== null ? cacheKey(latitude, longitude) : "";
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!key || latitude === null || longitude === null) {
      return;
    }
    const cached = names.get(key);
    if (cached) {
      const timer = window.setTimeout(() => setName(cached), 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    fetch(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((data: { name?: string }) => {
        const label = data.name?.trim() || "";
        if (label) names.set(key, label);
        setName(label || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      })
      .catch(() => {
        if (!controller.signal.aborted) setName(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      });
    return () => controller.abort();
  }, [key, latitude, longitude]);

  return name;
}

export function GeoLink({
  latitude,
  longitude,
  className,
  tooltip = false,
}: {
  latitude: number | null;
  longitude: number | null;
  className?: string;
  tooltip?: boolean;
}) {
  const name = usePlaceName(latitude, longitude);
  if (latitude === null || longitude === null) {
    return <span className={className}>Not captured</span>;
  }
  const label = name ?? "Finding location…";
  const link = (
    <a
      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
      target="_blank"
      rel="noreferrer"
      title={name ?? undefined}
      className={className ?? "font-medium underline"}
    >
      {label}
    </a>
  );
  if (!tooltip) return link;
  return (
    <span className="group relative block min-w-0 max-w-full">
      {link}
      {name ? (
        <span
          className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden max-w-[min(90vw,24rem)] whitespace-normal rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block"
        >
          {name}
        </span>
      ) : null}
    </span>
  );
}
