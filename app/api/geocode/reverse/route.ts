import { NextResponse } from "next/server";
import { formatClockLocation, type ReverseAddress } from "@/lib/time-clock/place-name";

export const dynamic = "force-dynamic";

const cache = new Map<string, { name: string; expires: number }>();
const CACHE_MS = 10 * 60 * 1000;

async function nominatim(latitude: number, longitude: number, zoom: number) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=${zoom}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "CALACE-Workforce/1.0 (time clock location)",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) return "";
  const data = (await response.json()) as { address?: ReverseAddress };
  return data.address ? formatClockLocation(data.address) : "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ name: "" }, { status: 400 });
  }

  const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ name: cached.name, lat: latitude, lng: longitude });
  }

  try {
    let name = await nominatim(latitude, longitude, 18);
    if (name.split(", ").length < 3) {
      const wider = await nominatim(latitude, longitude, 14);
      if (wider.split(", ").length > name.split(", ").length) name = wider;
    }
    if (name) cache.set(key, { name, expires: Date.now() + CACHE_MS });
    return NextResponse.json({ name, lat: latitude, lng: longitude });
  } catch {
    return NextResponse.json({ name: "", lat: latitude, lng: longitude });
  }
}
