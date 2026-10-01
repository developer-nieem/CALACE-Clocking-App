import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { getPhase5Context } from "@/lib/db/phase5";
import { lastJobRun } from "@/lib/db/neon";
import { isDatabaseMode } from "@/lib/env";
import { diagnostics } from "@/lib/phase6/domain";
import { integrationPanel } from "@/lib/phase7/status";
import { sendTestEmailAction } from "@/app/actions/phase7";

export default async function SystemHealthPage() {
  await requirePermission("security.manage");
  const rows = integrationPanel();
  const { state } = await getPhase5Context();
  const diag = diagnostics({
    entries: state.timeEntries,
    breaks: state.timeBreaks,
    invoices: state.invoices,
    facilities: state.facilities,
    profiles: state.profiles,
  });
  const lastCron = isDatabaseMode()
    ? await lastJobRun("cron:automations").catch(() => null)
    : null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="System health"
        description="Operational status only. Secret values are never shown."
      />
      <Card>
        <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          {rows.map((row) => (
            <p key={row.label}><span className="font-medium">{row.label}:</span> {row.value}</p>
          ))}
          <p><span className="font-medium">Automation processor:</span> {state.settings.lastAutomationStatus ?? "—"} {state.settings.lastAutomationRunAt ?? ""}</p>
          <p><span className="font-medium">Cron last run:</span> {lastCron?.finished_at ?? state.settings.lastAutomationRunAt ?? "Never"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Data checks</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>Impossible clock-out timestamps: {diag.impossibleClockOuts}</p>
          <p>Breaks without a time entry: {diag.orphanBreaks}</p>
          <p>Invoices missing facility: {diag.missingInvoiceFacilities}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Send test email</CardTitle></CardHeader>
        <CardContent>
          <form
            action={async (formData) => {
              "use server";
              await sendTestEmailAction(String(formData.get("to") ?? ""));
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              name="to"
              type="email"
              required
              placeholder="test@example.com"
              className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
            />
            <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground">
              Send Test Email
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
