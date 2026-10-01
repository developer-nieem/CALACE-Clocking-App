import { notFound } from "next/navigation";
import { getLookups, getUserById } from "@/lib/db/users";
import { readWorkforceState } from "@/lib/db/workforce";
import { requireSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserProfileEditor } from "@/components/users/user-profile-editor";
import { PayInformation } from "@/components/users/pay-information";
import { TimeReport } from "@/components/time-clock/time-report";
import { DocumentForm } from "@/components/phase3/boards";
import { getTimeClockData } from "@/lib/db/time-clock";
import { fullName, formatTimeRange } from "@/lib/utils";
import { roleLabel } from "@/lib/permissions";
import { TerminateButtons } from "@/components/phase5/forms";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireSession();
  const profile = await getUserById(id);
  if (!profile) notFound();
  const lookups = await getLookups();
  const state = await readWorkforceState();
  const canSeeDrafts = actor.permissions.includes("schedules.manage");
  const shifts = state.shifts.filter(
    (shift) =>
      shift.instructorIds.includes(profile.id) && (canSeeDrafts || shift.status !== "draft"),
  );
  const availability = state.availability.filter((item) => item.userId === profile.id);
  const timeOff = state.timeOff.filter((item) => item.userId === profile.id);
  const tasks = state.tasks.filter((item) => item.assigneeIds.includes(profile.id));
  const canManage = actor.permissions.includes("users.manage");
  const clockData = await getTimeClockData(id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName(profile.firstName, profile.lastName)}
        description={profile.email}
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <UserProfileEditor
                user={profile}
                positions={lookups.positions}
                departments={lookups.departments}
                locations={lookups.locations}
              />
              <TerminateButtons userId={profile.id} />
            </div>
          ) : null
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge>{roleLabel(profile.roles[0])}</Badge>
        <StatusBadge status={profile.employmentStatus} />
        <Badge variant="secondary">
          {lookups.positions.find((item) => item.id === profile.positionId)?.name}
        </Badge>
      </div>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
          <TabsTrigger value="timeclock">Time Clock</TabsTrigger>
          <TabsTrigger value="timeoff">Time Off</TabsTrigger>
          <TabsTrigger value="qualifications">Qualifications</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Phone: {profile.phone ?? "—"}</p>
                <p>Department: {lookups.departments.find((item) => item.id === profile.departmentId)?.name}</p>
                <p>Default hours: {profile.defaultWeeklyHours}</p>
                <p>Maximum hours: {profile.maxWeeklyHours}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Qualifications</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {profile.qualifications.map((id) => (
                  <Badge key={id} variant="accent">
                    {lookups.qualifications.find((item) => item.id === id)?.name}
                  </Badge>
                ))}
              </CardContent>
            </Card>
            {clockData.canManagePay ||
            (actor.id === profile.id && actor.permissions.includes("pay.read_own")) ? (
              <PayInformation
                profile={profile}
                rates={clockData.payRates}
                currencyCode={clockData.settings.currencyCode}
                canManage={clockData.canManagePay}
              />
            ) : null}
          </div>
        </TabsContent>
        <TabsContent value="schedule">
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {shifts.map((shift) => (
                <div key={shift.id} className="px-5 py-3 text-sm">
                  <p className="font-medium">{shift.title}</p>
                  <p className="text-muted-foreground">
                    {shift.date} · {formatTimeRange(shift.startTime, shift.endTime)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="availability">
          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              {availability.map((rule) => (
                <p key={rule.id}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][rule.weekday]}: {rule.status}
                  {rule.startTime ? ` ${rule.startTime}–${rule.endTime}` : ""}
                </p>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="timesheets">
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              Timesheet history will appear here after clock entries are approved.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="timeclock">
          <TimeReport
            entries={clockData.entries}
            breaks={clockData.breaks}
            edits={clockData.edits}
            profiles={[profile]}
            shifts={clockData.shifts}
            locations={clockData.locations}
            departments={clockData.departments}
            positions={clockData.positions}
            settings={clockData.settings}
            canManage={clockData.canManage}
            initialUserId={profile.id}
          />
        </TabsContent>
        <TabsContent value="timeoff">
          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              {timeOff.map((item) => (
                <p key={item.id}>
                  {item.startDate} → {item.endDate} · {item.status}
                </p>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="qualifications">
          <Card>
            <CardHeader>
              <CardTitle>Qualifications</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {profile.qualifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No qualifications assigned.</p>
              ) : (
                profile.qualifications.map((id) => (
                  <Badge key={id} variant="accent">
                    {lookups.qualifications.find((item) => item.id === id)?.name ?? id}
                  </Badge>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tasks">
          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              {tasks.map((task) => (
                <p key={task.id}>{task.title}</p>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="documents">
          <Card>
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(actor.id === profile.id || canManage
                ? state.documents.filter((item) => item.userId === profile.id)
                : []
              ).map((item) => (
                <p key={item.id} className="text-sm">
                  {item.title} · {item.documentType}
                  {item.expirationDate ? ` · expires ${item.expirationDate}` : ""}
                </p>
              ))}
              {canManage ? <DocumentForm userId={profile.id} /> : <p className="text-sm text-muted-foreground">Private documents are visible to this employee and administrators.</p>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              {state.activity
                .filter((item) => item.entityId === profile.id || item.actorId === profile.id)
                .map((item) => (
                  <p key={item.id}>
                    {item.action.replaceAll("_", " ")} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
