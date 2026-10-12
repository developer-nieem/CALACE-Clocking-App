"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSmtpSettingsAction } from "@/app/actions/workforce";
import { sendTestEmailAction } from "@/app/actions/phase7";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SmtpSettingsPublic } from "@/types";

export function SmtpSettingsForm({ initial }: { initial: SmtpSettingsPublic }) {
  const [pending, startTransition] = useTransition();
  const [testing, startTest] = useTransition();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [secure, setSecure] = useState(initial.secure);
  const [testTo, setTestTo] = useState("");

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Add your own SMTP server (Gmail, Outlook, workspace mail, or a provider like Resend SMTP).
        The password is encrypted. Leave the password blank to keep the current one.
      </p>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await saveSmtpSettingsAction({
              enabled,
              host: String(data.get("host") ?? ""),
              port: Number(data.get("port") || 587),
              secure,
              username: String(data.get("username") ?? ""),
              password: String(data.get("password") ?? ""),
              fromEmail: String(data.get("fromEmail") ?? ""),
              fromName: String(data.get("fromName") ?? ""),
            });
            if (result.ok) toast.success("SMTP settings saved.");
            else toast.error(result.error);
          });
        }}
      >
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2">
          <span>Use custom SMTP</span>
          <Checkbox checked={enabled} onCheckedChange={(value) => setEnabled(value === true)} />
        </label>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="smtp-host">SMTP host</Label>
          <Input
            id="smtp-host"
            name="host"
            placeholder="smtp.gmail.com"
            defaultValue={initial.host}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp-port">Port</Label>
          <Input
            id="smtp-port"
            name="port"
            type="number"
            min={1}
            max={65535}
            defaultValue={initial.port}
          />
        </div>
        <label className="flex items-center justify-between gap-3 self-end rounded-lg border border-border px-3 py-2 text-sm">
          <span>SSL (port 465)</span>
          <Checkbox checked={secure} onCheckedChange={(value) => setSecure(value === true)} />
        </label>
        <div className="space-y-2">
          <Label htmlFor="smtp-username">Username</Label>
          <Input
            id="smtp-username"
            name="username"
            placeholder="you@example.com"
            defaultValue={initial.username}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp-password">Password</Label>
          <Input
            id="smtp-password"
            name="password"
            type="password"
            placeholder={initial.passwordSet ? "Saved — leave blank to keep" : "SMTP password"}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp-from">From email</Label>
          <Input
            id="smtp-from"
            name="fromEmail"
            type="email"
            placeholder="noreply@yourschool.com"
            defaultValue={initial.fromEmail}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp-from-name">From name</Label>
          <Input
            id="smtp-from-name"
            name="fromName"
            placeholder="CAL ACE"
            defaultValue={initial.fromName}
          />
        </div>
        <Button type="submit" disabled={pending} className="sm:col-span-2">
          {pending ? "Saving…" : "Save SMTP"}
        </Button>
      </form>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          startTest(async () => {
            const result = await sendTestEmailAction(testTo);
            if (result && "ok" in result && result.ok) toast.success("Test email sent.");
            else toast.error(result && "error" in result ? result.error : "Could not send test email.");
          });
        }}
      >
        <Input
          type="email"
          required
          placeholder="Send a test to this address"
          value={testTo}
          onChange={(event) => setTestTo(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={testing}>
          {testing ? "Sending…" : "Send test email"}
        </Button>
      </form>
    </div>
  );
}
