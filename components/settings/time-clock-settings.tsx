"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updateClockSettingsAction,
  updateWorkLocationAction,
} from "@/app/actions/workforce";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  GeofenceEnforcement,
  Location,
  OrganizationSettings,
} from "@/types";

export function TimeClockSettings({
  settings,
  locations,
}: {
  settings: OrganizationSettings;
  locations: Location[];
}) {
  const [pending, startTransition] = useTransition();
  const [allowUnscheduled, setAllowUnscheduled] = useState(
    settings.allowUnscheduledClockIn,
  );
  const [enforcement, setEnforcement] = useState<GeofenceEnforcement>(
    settings.geofenceEnforcement,
  );
  const router = useRouter();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Time Clock Policy</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Location permission is required for every clock in, break, and clock out. Admins see the GPS coordinates.
          </p>
          <CheckRow label="Allow unscheduled clock-in" value={allowUnscheduled} onChange={setAllowUnscheduled} />
          <div className="space-y-2">
            <Label>Geofence Enforcement</Label>
            <select
              className="h-10 w-full rounded-lg border bg-card px-3 text-sm"
              value={enforcement}
              onChange={(event) => setEnforcement(event.target.value as GeofenceEnforcement)}
            >
              <option value="warning">Warning Only</option>
              <option value="strict">Strict</option>
              <option value="disabled">Disabled</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Warning Only records outside-geofence actions without blocking. Device location can be spoofed and is not fraud-proof.
            </p>
          </div>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateClockSettingsAction({
                  requireLocationClockIn: true,
                  requireLocationClockOut: true,
                  geofenceEnforcement: enforcement,
                  allowUnscheduledClockIn: allowUnscheduled,
                });
                if (!result.ok) toast.error(result.error);
                else {
                  toast.success("Clock policy updated");
                  router.refresh();
                }
              })
            }
          >
            Save Policy
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {locations.map((location) => (
          <LocationForm key={location.id} location={location} />
        ))}
      </div>
    </div>
  );
}

function LocationForm({ location }: { location: Location }) {
  const [pending, startTransition] = useTransition();
  const [latitude, setLatitude] = useState(
    location.latitude === null ? "" : String(location.latitude),
  );
  const [longitude, setLongitude] = useState(
    location.longitude === null ? "" : String(location.longitude),
  );
  const [radius, setRadius] = useState(String(location.geofenceRadiusMeters));
  const [required, setRequired] = useState(location.geolocationRequired);
  const router = useRouter();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{location.name}</CardTitle>
        <p className="text-sm text-muted-foreground">{location.address}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" value={latitude} onChange={setLatitude} />
          <Field label="Longitude" value={longitude} onChange={setLongitude} />
        </div>
        <Field label="Radius (meters)" value={radius} onChange={setRadius} />
        <CheckRow label="Geolocation required at this location" value={required} onChange={setRequired} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!navigator.geolocation) {
                toast.error("This browser cannot read the current location.");
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  setLatitude(position.coords.latitude.toFixed(6));
                  setLongitude(position.coords.longitude.toFixed(6));
                  toast.success("Latitude and longitude filled from this browser.");
                },
                () => toast.error("Location permission was denied."),
              );
            }}
          >
            Use current location
          </Button>
          <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateWorkLocationAction({
                id: location.id,
                latitude: latitude ? Number(latitude) : null,
                longitude: longitude ? Number(longitude) : null,
                geofenceRadiusMeters: Number(radius),
                geolocationRequired: required,
              });
              if (!result.ok) toast.error(result.error);
              else {
                toast.success("Work location updated");
                router.refresh();
              }
            })
          }
        >
          Save Location
        </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={value} onCheckedChange={(checked) => onChange(Boolean(checked))} />
      {label}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        step="any"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
