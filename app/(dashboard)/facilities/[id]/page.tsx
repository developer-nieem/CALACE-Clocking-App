import { notFound } from "next/navigation";
import {
  AssignEmployeeForm,
  BillingRateForm,
  FacilityContactForm,
  FacilityLocationForm,
} from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireSession } from "@/lib/auth/session";
import { facilityOverview, getPhase5Context } from "@/lib/db/phase5";
import { fullName } from "@/lib/utils";

export default async function FacilityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  const { state } = await getPhase5Context();
  const canBill = user.permissions.includes("facility_billing.view") || user.permissions.includes("facility_billing.manage");
  const data = facilityOverview(state, id, canBill);
  if (!data) notFound();
  const primary = data.contacts.find((item) => item.isPrimary) ?? data.contacts[0];
  const employees = state.profiles
    .filter((profile) => profile.employmentStatus === "active")
    .map((profile) => ({ id: profile.id, label: fullName(profile.firstName, profile.lastName) }));
  const weekShifts = data.shifts.filter((shift) => shift.status !== "cancelled");
  return (
    <div className="space-y-6">
      <PageHeader title={data.facility.name} description={`${data.facility.facilityType.replaceAll("_", " ")} · ${data.facility.status}`} />
      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Address: {[data.facility.addressLine1, data.facility.city, data.facility.state].filter(Boolean).join(", ") || "—"}</p>
                <p>Phone: {data.facility.phone || "—"}</p>
                <p>Email: {data.facility.email || "—"}</p>
                <p>Primary contact: {primary ? `${primary.firstName} ${primary.lastName}` : "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Coverage</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Shifts: {weekShifts.length}</p>
                <p>Assigned employees: {data.assignments.length}</p>
                <p>Open shifts: {weekShifts.filter((shift) => shift.isOpen).length}</p>
                <p>Job sites: {data.locations.length}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="contacts">
          <Card>
            <CardHeader><CardTitle>Contacts</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {user.permissions.includes("facilities.manage") ? <FacilityContactForm facilityId={id} /> : null}
              {data.contacts.map((contact) => (
                <p key={contact.id} className="text-sm">{contact.firstName} {contact.lastName} · {contact.title || "Contact"} {contact.isPrimary ? "(primary)" : ""}</p>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="schedule">
          <Card>
            <CardHeader><CardTitle>Shifts at this facility</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {weekShifts.map((shift) => (
                <p key={shift.id}>{shift.date} · {shift.title} · {shift.startTime}–{shift.endTime}</p>
              ))}
              {weekShifts.length === 0 ? <p className="text-muted-foreground">No shifts linked yet. Use the existing schedule and set the facility on the shift.</p> : null}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="employees">
          <Card>
            <CardHeader><CardTitle>Assigned employees</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {user.permissions.includes("facilities.manage") ? <AssignEmployeeForm facilityId={id} employees={employees} /> : null}
              {data.assignments.map((assignment) => {
                const person = state.profiles.find((item) => item.id === assignment.userId);
                return <p key={assignment.id} className="text-sm">{person ? fullName(person.firstName, person.lastName) : assignment.userId}</p>;
              })}
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader><CardTitle>Job sites</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {user.permissions.includes("facilities.manage") ? <FacilityLocationForm facilityId={id} /> : null}
              {data.locations.map((location) => <p key={location.id} className="text-sm">{location.name}</p>)}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="billing">
          {canBill ? (
            <Card>
              <CardHeader><CardTitle>Facility billing rates</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Client billing is separate from employee pay. Historical rates stay on older periods.</p>
                {user.permissions.includes("facility_billing.manage") ? <BillingRateForm facilityId={id} /> : null}
                {data.rates.map((rate) => (
                  <p key={rate.id} className="text-sm">${rate.billingRate.toFixed(2)} / hour from {rate.effectiveFrom}{rate.effectiveTo ? ` to ${rate.effectiveTo}` : ""}</p>
                ))}
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">Billing rates are hidden without facility billing permission.</p>
          )}
        </TabsContent>
        <TabsContent value="documents">
          <p className="text-sm text-muted-foreground">Facility documents use the existing employee document library. Upload files from the employee profile or training resources.</p>
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              {state.activity.filter((item) => item.entityId === id).slice(0, 12).map((item) => (
                <p key={item.id}>{item.createdAt.slice(0, 16)} · {item.action}</p>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
