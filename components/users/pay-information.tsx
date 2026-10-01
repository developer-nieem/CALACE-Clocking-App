"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updatePayRateAction } from "@/app/actions/workforce";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/time-clock/calculations";
import { toISODate } from "@/lib/utils";
import type { EmployeePayRate, Profile } from "@/types";

export function PayInformation({
  profile,
  rates,
  currencyCode,
  canManage,
}: {
  profile: Profile;
  rates: EmployeePayRate[];
  currencyCode: string;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [hourlyRate, setHourlyRate] = useState(String(profile.hourlyRate ?? ""));
  const [effectiveFrom, setEffectiveFrom] = useState(toISODate(new Date()));
  const router = useRouter();

  return (
    <Card>
      <CardHeader><CardTitle>Pay Information</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Pay Type</p>
            <p className="font-medium capitalize">{profile.payType}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Current Hourly Rate</p>
            <p className="font-medium">
              {profile.hourlyRate !== null
                ? formatCurrency(profile.hourlyRate, currencyCode)
                : "Not applicable"}
            </p>
          </div>
        </div>
        {canManage && profile.payType === "hourly" ? (
          <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label>New Hourly Rate</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={hourlyRate}
                onChange={(event) => setHourlyRate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </div>
            <Button
              disabled={pending || !hourlyRate}
              onClick={() =>
                startTransition(async () => {
                  const result = await updatePayRateAction({
                    userId: profile.id,
                    hourlyRate: Number(hourlyRate),
                    effectiveFrom,
                  });
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast.success("New pay rate added; historical rates were preserved");
                    router.refresh();
                  }
                })
              }
            >
              Add Rate
            </Button>
          </div>
        ) : null}
        <div>
          <p className="mb-2 text-sm font-medium">Rate History</p>
          <div className="divide-y divide-border rounded-lg border border-border">
            {rates.map((rate) => (
              <div key={rate.id} className="flex justify-between px-3 py-2 text-sm">
                <span>
                  {rate.effectiveFrom} – {rate.effectiveTo ?? "Present"}
                </span>
                <span className="font-medium">
                  {formatCurrency(rate.hourlyRate, currencyCode)}/hr
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
