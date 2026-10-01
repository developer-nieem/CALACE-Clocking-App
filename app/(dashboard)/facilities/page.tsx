import Link from "next/link";
import { FacilityForm } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { getPhase5Context } from "@/lib/db/phase5";

export default async function FacilitiesPage() {
  const user = await requireSession();
  if (!user.permissions.includes("facilities.view") && !user.permissions.includes("facilities.manage")) {
    const { forbidden } = await import("next/navigation");
    forbidden();
  }
  const { state } = await getPhase5Context();
  return (
    <div className="space-y-6">
      <PageHeader title="Facilities" description="Client and partner sites. Locations remain physical job sites under a facility." />
      {user.permissions.includes("facilities.manage") ? (
        <Card>
          <CardHeader><CardTitle>Add facility</CardTitle></CardHeader>
          <CardContent><FacilityForm /></CardContent>
        </Card>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {state.facilities.map((facility) => (
          <Link key={facility.id} href={`/facilities/${facility.id}`} className="rounded-xl border border-border bg-card p-4">
            <p className="font-medium">{facility.name}</p>
            <p className="text-sm text-muted-foreground">{facility.facilityType.replaceAll("_", " ")} · {facility.status}</p>
            <p className="text-sm text-muted-foreground">{[facility.city, facility.state].filter(Boolean).join(", ") || "No city"}</p>
          </Link>
        ))}
        {state.facilities.length === 0 ? <p className="text-sm text-muted-foreground">No facilities yet.</p> : null}
      </div>
    </div>
  );
}
