"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createAutomationAction,
  duplicateAutomationAction,
  installTemplatesAction,
  setAutomationEnabledAction,
} from "@/app/actions/phase4";
import { Button } from "@/components/ui/button";
import type { Automation, AutomationRun, Profile } from "@/types";

const triggers = [
  "shift_created",
  "shift_published",
  "shift_starting",
  "shift_ended",
  "clock_in",
  "clock_out",
  "missing_clock_in",
  "missing_clock_out",
  "late_clock_in",
  "time_off_requested",
  "time_off_approved",
  "task_due_soon",
  "open_shift_created",
  "qualification_expiring",
  "document_expiring",
  "employee_created",
];

export function AutomationsBoard({
  automations,
  runs,
  profiles,
}: {
  automations: Automation[];
  runs: AutomationRun[];
  profiles: Profile[];
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("Clock-in reminder");
  const [triggerType, setTriggerType] = useState("shift_starting");
  const [actionType, setActionType] = useState<"notify_employee" | "notify_admin" | "notify_scheduler" | "timesheet_exception">("notify_employee");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await installTemplatesAction();
              if (!result.ok) toast.error(result.error);
              else toast.success(`${result.count} templates added. They stay off until you enable one.`);
            })
          }
        >
          Add built-in templates
        </Button>
      </div>
      <form
        className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await createAutomationAction({ name, triggerType, actionType });
            if (!result.ok) toast.error(result.error);
            else toast.success("Automation saved. Enable it when you are ready.");
          });
        }}
      >
        <input className="h-10 rounded-lg border px-3 text-sm" value={name} onChange={(event) => setName(event.target.value)} aria-label="Automation name" />
        <select className="h-10 rounded-lg border px-3 text-sm" value={triggerType} onChange={(event) => setTriggerType(event.target.value)} aria-label="Trigger">
          {triggers.map((trigger) => (
            <option key={trigger} value={trigger}>{trigger}</option>
          ))}
        </select>
        <select className="h-10 rounded-lg border px-3 text-sm" value={actionType} onChange={(event) => setActionType(event.target.value as typeof actionType)} aria-label="Action">
          <option value="notify_employee">Notify employee</option>
          <option value="notify_admin">Notify admin</option>
          <option value="notify_scheduler">Notify scheduler</option>
          <option value="timesheet_exception">Add timesheet exception</option>
        </select>
        <Button type="submit" disabled={pending}>Create Automation</Button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Trigger</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last run</th>
              <th className="px-3 py-2">Created by</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {automations.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No automations yet.</td></tr>
            ) : automations.map((automation) => (
              <tr key={automation.id} className="border-b">
                <td className="px-3 py-3 font-medium">{automation.name}</td>
                <td className="px-3 py-3">{automation.triggerType}</td>
                <td className="px-3 py-3">{automation.isEnabled ? "Enabled" : "Disabled"}</td>
                <td className="px-3 py-3">{automation.lastRunAt ? new Date(automation.lastRunAt).toLocaleString() : "Never"}</td>
                <td className="px-3 py-3">{profiles.find((profile) => profile.id === automation.createdBy)?.firstName ?? "—"}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="text-primary underline" onClick={() => startTransition(async () => { const result = await setAutomationEnabledAction(automation.id, !automation.isEnabled); if (!result.ok) toast.error(result.error); })}>
                      {automation.isEnabled ? "Disable" : "Enable"}
                    </button>
                    <button type="button" className="text-primary underline" onClick={() => startTransition(async () => { const result = await duplicateAutomationAction(automation.id); if (!result.ok) toast.error(result.error); })}>
                      Duplicate
                    </button>
                    <a className="text-primary underline" href={`/automations/${automation.id}`}>History</a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">{runs.length} recorded runs. A disabled automation does not send notifications.</p>
    </div>
  );
}
