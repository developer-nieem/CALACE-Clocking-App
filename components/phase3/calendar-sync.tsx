"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { issueCalendarFeedAction } from "@/app/actions/phase3";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CalendarSync({
  googleConfigured,
  microsoftConfigured,
}: {
  googleConfigured: boolean;
  microsoftConfigured: boolean;
}) {
  const [pending, start] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <PageHeader title="Calendar sync" description="Published shifts can be downloaded or subscribed. Draft shifts are never included." />
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>ICS export</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <a className="block text-primary" href="/api/calendar/ics?days=30">Download next 30 days</a>
            <a className="block text-primary" href="/api/calendar/ics?days=90">Download next 90 days</a>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await issueCalendarFeedAction();
                  if ("error" in result && result.error) toast.error(result.error);
                  else if ("token" in result && result.token) {
                    setToken(result.token);
                    toast.success("Private feed created. Copy it now. It is not shown again.");
                  }
                })
              }
            >
              Regenerate private feed
            </Button>
            {token ? <p className="break-all text-xs">webcal feed token: {token}</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Google and Outlook</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{googleConfigured ? "Google credentials are present. Connect starts the OAuth flow. A failed calendar sync does not block schedule publishing." : "Google Calendar integration requires configuration."}</p>
            {googleConfigured ? <a className="block text-primary" href="/api/calendar/google/start">Connect Google Calendar</a> : null}
            <p>{microsoftConfigured ? "Microsoft credentials are present. Connect starts the OAuth flow. Tokens stay on the server." : "Outlook integration requires configuration."}</p>
            {microsoftConfigured ? <a className="block text-primary" href="/api/calendar/microsoft/start">Connect Outlook</a> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
