import { OrgSettingsForm } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { getPhase5Context } from "@/lib/db/phase5";
import { monitoringStatus } from "@/lib/monitoring";

export default async function SecuritySettingsPage() {
  const user = await requirePermission("security.manage");
  const { state } = await getPhase5Context();
  const monitoring = monitoringStatus();
  return (
    <div className="space-y-6">
      <PageHeader title="Security" description="Session, password, audit, and integration controls." />
      <Card>
        <CardHeader><CardTitle>Session security</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Idle timeout and reauthentication are stored on the organization. Sensitive actions: pay rate, unlock period, payroll export, employee delete, OAuth.</p>
          <OrgSettingsForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Active sessions</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Signed in as {user.email}. Database mode stores hashed session tokens. A full device inventory is not exposed by this auth model; use Sign out to clear the current cookie session.
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Audit log</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {state.activity.slice(0, 20).map((item) => (
            <p key={item.id}>{item.createdAt.slice(0, 16)} · {item.action} · {item.entityType}</p>
          ))}
          <p className="text-muted-foreground">Audit records are append-only in the app. There is no ordinary delete button.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>API / integrations</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Calendar OAuth starts only when credentials exist. Error monitoring: {monitoring.provider}
          {monitoring.configured ? " configured" : " (console only until SENTRY_DSN is set)"}.
        </CardContent>
      </Card>
    </div>
  );
}
