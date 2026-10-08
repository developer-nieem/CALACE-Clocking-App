import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { TimeClockSettings } from "@/components/settings/time-clock-settings";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { ExtraSettingsForms, OrgSettingsForm } from "@/components/phase5/forms";
import { getTimeClockData } from "@/lib/db/time-clock";

export default async function SettingsPage() {
  const user = await requireSession();
  const clock = await getTimeClockData();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Organization and account preferences." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{user.organizationName}</p>
            <p className="text-muted-foreground">Clock-in grace: 15 minutes before shift start.</p>
            <p className="text-muted-foreground">Overtime threshold: 40 hours / week.</p>
            <p className="text-muted-foreground">
              Qualification enforcement: {clock.settings.qualificationEnforcement ?? "warning"}. Week starts Monday.
              Maximum daily hours: {clock.settings.maximumDailyHours ?? 12}. Maximum weekly hours: {clock.settings.maximumWeeklyHours ?? 40}.
            </p>
            <p className="text-muted-foreground">
              Auto fill and fair scheduling are on unless turned off. Shift confirmation and automatic open shifts are off by default.
              The automation engine runs from the scheduled job at /api/cron/automations.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Calendar sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Download an .ICS calendar now. Google and Outlook connect when their credentials are configured. A calendar failure does not block publishing.
            </p>
            <Button asChild variant="outline">
              <a href="/api/calendar/ics">Download .ICS</a>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Update password</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Enter your current password, then choose a new one (at least 8 characters).
          </p>
          <ChangePasswordForm />
        </CardContent>
      </Card>
      {user.permissions.includes("settings.manage") ? (
        <>
          <Card>
            <CardHeader><CardTitle>General / branding</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">Organization profile, idle timeout, and retention. CAL ACE default theme remains unless you set colors.</p>
              <OrgSettingsForm />
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium">Custom fields, tags, saved views</p>
                <ExtraSettingsForms />
              </div>
            </CardContent>
          </Card>
          <TimeClockSettings settings={clock.settings} locations={clock.locations} />
          <Card>
            <CardHeader><CardTitle>More settings</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              {[
                ["/settings/security", "Security"],
                ["/settings/system-health", "System health"],
                ["/settings/go-live", "Go-live"],
                ["/settings/data-export", "Data export"],
                ["/settings/notifications", "Notifications"],
                ["/facilities", "Facilities"],
                ["/billing", "Billing"],
                ["/forms", "Forms"],
                ["/onboarding", "Onboarding"],
                ["/policies", "Documents / policies"],
                ["/automations", "Automations"],
                ["/calendar-sync", "Calendar integrations"],
                ["/users", "Users & roles"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="rounded-lg border border-border px-3 py-2">{label}</Link>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
