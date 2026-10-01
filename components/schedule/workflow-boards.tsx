"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  claimOpenShiftAction,
  createRecurringAction,
  offerReplacementAction,
  requestTimeOffAction,
  requestTradeAction,
  respondTradeAction,
  reviewOpenShiftAction,
  reviewTimeOffAction,
  reviewTradeAction,
  saveAvailabilityAction,
  createFromTemplateAction,
} from "@/app/actions/phase2";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fullName } from "@/lib/utils";
import type { getScheduleWorkspace } from "@/lib/db/phase2";

type Workspace = Awaited<ReturnType<typeof getScheduleWorkspace>>;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AvailabilityBoard({ data }: { data: Workspace }) {
  const [pending, start] = useTransition();
  const [userId, setUserId] = useState(data.actor.id);
  const mine = data.availability.filter((rule) => rule.userId === userId);
  return (
    <div className="space-y-4">
      {data.manager ? (
        <select className="h-10 rounded-md border border-border bg-card px-3 text-sm" value={userId} onChange={(event) => setUserId(event.target.value)}>
          {data.profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {fullName(profile.firstName, profile.lastName)} · {profile.employeeType}
            </option>
          ))}
        </select>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Weekly availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {WEEKDAYS.map((label, weekday) => {
            const rule = mine.find((item) => item.weekday === weekday);
            return (
              <form
                key={label}
                className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-4 md:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const next = mine.filter((item) => item.weekday !== weekday);
                  next.push({
                    id: rule?.id ?? crypto.randomUUID(),
                    userId,
                    weekday,
                    status: String(form.get("status")) as "available" | "unavailable" | "preferred",
                    startTime: String(form.get("start") || "") || null,
                    endTime: String(form.get("end") || "") || null,
                  });
                  start(async () => {
                    const result = await saveAvailabilityAction({
                      userId,
                      rules: next,
                      exceptions: data.exceptions.filter((item) => item.userId === userId),
                    });
                    if ("error" in result && result.error) toast.error(result.error);
                    else toast.success(`${label} saved`);
                  });
                }}
              >
                <p className="text-sm font-medium">{label}</p>
                <select name="status" defaultValue={rule?.status ?? "available"} className="h-10 rounded-md border border-border px-2 text-sm">
                  <option value="available">Available</option>
                  <option value="preferred">Preferred</option>
                  <option value="unavailable">Unavailable</option>
                </select>
                <Input name="start" type="time" defaultValue={rule?.startTime ?? "09:00"} />
                <div className="flex gap-2">
                  <Input name="end" type="time" defaultValue={rule?.endTime ?? "17:00"} />
                  <Button type="submit" disabled={pending} size="sm">Save</Button>
                </div>
              </form>
            );
          })}
        </CardContent>
      </Card>
      <ExceptionForm userId={userId} exceptions={data.exceptions.filter((item) => item.userId === userId)} />
      <Card>
        <CardHeader><CardTitle>Exceptions</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.exceptions.filter((item) => item.userId === userId).length === 0 ? (
            <p className="text-muted-foreground">No one-time exceptions. An exception overrides the weekly rule for that date.</p>
          ) : data.exceptions.filter((item) => item.userId === userId).map((item) => (
            <p key={item.id}>{item.date}: {item.status} {item.reason ? `· ${item.reason}` : ""}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ExceptionForm({
  userId,
  exceptions,
}: {
  userId: string;
  exceptions: Workspace["exceptions"];
}) {
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        start(async () => {
          const result = await saveAvailabilityAction({
            userId,
            exceptions: [...exceptions, {
              id: crypto.randomUUID(),
              userId,
              date: String(form.get("date")),
              status: String(form.get("status")) as "available" | "unavailable" | "preferred",
              startTime: null,
              endTime: null,
              reason: String(form.get("reason") || ""),
            }],
          });
          if ("error" in result && result.error) toast.error(result.error);
          else toast.success("Exception saved. Weekly rules for other days were replaced only if you saved them above.");
        });
      }}
    >
      <Input name="date" type="date" required />
      <select name="status" className="h-10 rounded-md border border-border px-2 text-sm">
        <option value="unavailable">Unavailable</option>
        <option value="available">Available</option>
        <option value="preferred">Preferred</option>
      </select>
      <Input name="reason" placeholder="Reason" />
      <Button type="submit" disabled={pending}>Add exception</Button>
    </form>
  );
}

export function TimeOffBoard({ data }: { data: Workspace }) {
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader><CardTitle>Request time off</CardTitle></CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              start(async () => {
                const result = await requestTimeOffAction({
                  requestType: String(form.get("type")) as "vacation",
                  startDate: String(form.get("start")),
                  endDate: String(form.get("end")),
                  isPartialDay: form.get("partial") === "on",
                  startTime: String(form.get("startTime") || "") || null,
                  endTime: String(form.get("endTime") || "") || null,
                  reason: String(form.get("reason")),
                  notes: String(form.get("notes") || ""),
                });
                if ("error" in result && result.error) toast.error(result.error);
                else toast.success("Request submitted");
              });
            }}
          >
            <Label>Type</Label>
            <select name="type" className="h-10 w-full rounded-md border border-border px-2 text-sm">
              <option value="vacation">Vacation</option>
              <option value="sick">Sick</option>
              <option value="personal">Personal</option>
              <option value="training">Training</option>
              <option value="other">Other</option>
            </select>
            <Input name="start" type="date" required />
            <Input name="end" type="date" required />
            <label className="flex items-center gap-2 text-sm"><input name="partial" type="checkbox" /> Partial day</label>
            <Input name="startTime" type="time" />
            <Input name="endTime" type="time" />
            <Textarea name="reason" placeholder="Reason" required />
            <Textarea name="notes" placeholder="Notes" />
            <Button type="submit" disabled={pending}>Submit</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Requests</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.timeOff.map((item) => {
            const person = data.profiles.find((profile) => profile.id === item.userId);
            return (
              <div key={item.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{person ? fullName(person.firstName, person.lastName) : "You"} · {item.requestType ?? "Time off"}</p>
                <p className="text-muted-foreground">{item.startDate} – {item.endDate} · {item.status}</p>
                <p>{item.reason}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.status === "pending" && item.userId === data.actor.id ? (
                    <Button size="sm" variant="outline" onClick={() => start(async () => { await reviewTimeOffAction(item.id, "cancelled"); })}>Cancel</Button>
                  ) : null}
                  {data.actor.permissions.includes("time_off.approve") && item.status === "pending" ? (
                    <>
                      <Button size="sm" onClick={() => start(async () => { const result = await reviewTimeOffAction(item.id, "approved"); if ("error" in result && result.error) toast.error(result.error); else toast.success("Approved"); })}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        const notes = window.prompt("Rejection reason");
                        if (!notes) return;
                        start(async () => { const result = await reviewTimeOffAction(item.id, "rejected", notes); if ("error" in result && result.error) toast.error(result.error); });
                      }}>Reject</Button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export function OpenShiftBoard({ data }: { data: Workspace }) {
  const [pending, start] = useTransition();
  const open = data.shifts.filter((shift) => shift.isOpen && shift.status === "published");
  const mine = data.openShiftRequests.filter((item) => data.manager || item.userId === data.actor.id);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {open.map((shift) => (
          <Card key={shift.id}>
            <CardContent className="space-y-2 p-4">
              <p className="font-medium">{shift.title}</p>
              <p className="text-sm text-muted-foreground">{shift.date} · {shift.startTime}–{shift.endTime}</p>
              <p className="text-sm">{shift.instructorIds.length} / {shift.requiredInstructors} assigned</p>
              <Button size="sm" disabled={pending} onClick={() => start(async () => {
                const result = await claimOpenShiftAction(shift.id);
                if ("error" in result && result.error) toast.error(result.error);
                else toast.success(shift.approvalRequired ? "Request sent" : "Shift claimed");
              })}>{shift.approvalRequired ? "Request shift" : "Claim shift"}</Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Claims</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {mine.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2">
              <span>{item.status}</span>
              {data.actor.permissions.includes("open_shifts.approve") && item.status === "pending" ? (
                <Button size="sm" onClick={() => start(async () => {
                  const result = await reviewOpenShiftAction(item.id, "approved");
                  if ("error" in result && result.error) toast.error(result.error);
                  else toast.success("Assignment created");
                })}>Approve</Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
      {data.manager ? <TemplateAndSeries data={data} /> : null}
    </div>
  );
}

function TemplateAndSeries({ data }: { data: Workspace }) {
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Create from template</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-2" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            start(async () => {
              const result = await createFromTemplateAction({
                templateId: String(form.get("templateId")),
                date: String(form.get("date")),
                instructorIds: String(form.get("employee") || "").split(",").filter(Boolean),
              });
              if ("error" in result && result.error) toast.error(result.error);
              else toast.success("Draft shift created from template");
            });
          }}>
            <select name="templateId" className="h-10 w-full rounded-md border border-border px-2 text-sm" required>
              {data.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
            <Input name="date" type="date" required />
            <Input name="employee" placeholder="Employee id, optional" />
            <Button type="submit" disabled={pending}>Create draft</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recurring weekdays</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-2" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            start(async () => {
              const result = await createRecurringAction({
                title: String(form.get("title")),
                startTime: String(form.get("start")),
                endTime: String(form.get("end")),
                startDate: String(form.get("from")),
                endDate: String(form.get("until")),
                daysOfWeek: [1, 2, 3, 4, 5],
                locationId: String(form.get("location") || "") || null,
              });
              if ("error" in result && result.error) toast.error(result.error);
              else toast.success(`Created ${"count" in result ? result.count : 0} draft shifts`);
            });
          }}>
            <Input name="title" placeholder="Shift title" required />
            <Input name="start" type="time" defaultValue="09:00" required />
            <Input name="end" type="time" defaultValue="13:00" required />
            <Input name="from" type="date" required />
            <Input name="until" type="date" required />
            <select name="location" className="h-10 w-full rounded-md border border-border px-2 text-sm">
              <option value="">Location</option>
              {data.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <Button type="submit" disabled={pending}>Generate drafts</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function TradeBoard({ data }: { data: Workspace }) {
  const [pending, start] = useTransition();
  const mine = data.shifts.filter((shift) => shift.instructorIds.includes(data.actor.id) && shift.status === "published");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Offer or swap a published shift</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-2 md:grid-cols-2" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            start(async () => {
              const result = await requestTradeAction({
                shiftId: String(form.get("shiftId")),
                tradeType: String(form.get("type")) as "offer" | "swap",
                targetUserId: String(form.get("target") || "") || null,
                targetShiftId: String(form.get("targetShift") || "") || null,
                reason: String(form.get("reason") || ""),
              });
              if ("error" in result && result.error) toast.error(result.error);
              else toast.success("Trade submitted. Assignments do not change until approval.");
            });
          }}>
            <select name="shiftId" className="h-10 rounded-md border border-border px-2 text-sm" required>
              {mine.map((shift) => <option key={shift.id} value={shift.id}>{shift.date} {shift.title}</option>)}
            </select>
            <select name="type" className="h-10 rounded-md border border-border px-2 text-sm">
              <option value="offer">Offer</option>
              <option value="swap">Swap</option>
            </select>
            <Input name="target" placeholder="Coworker user id for swap" />
            <Input name="targetShift" placeholder="Their shift id for swap" />
            <Textarea name="reason" placeholder="Reason" />
            <Button type="submit" disabled={pending}>Submit trade</Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {data.trades.map((trade) => (
          <Card key={trade.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <div>
                <p className="font-medium">{trade.tradeType} · {trade.status}</p>
                <p className="text-muted-foreground">Employee response: {trade.employeeResponseStatus ?? "n/a"}</p>
              </div>
              <div className="flex gap-2">
                {trade.tradeType === "offer" && trade.fromUserId !== data.actor.id ? (
                  <Button size="sm" variant="outline" onClick={() => start(async () => { await offerReplacementAction(trade.id); toast.success("Request sent to admin"); })}>Request offered shift</Button>
                ) : null}
                {trade.toUserId === data.actor.id && trade.employeeResponseStatus === "pending" ? (
                  <Button size="sm" onClick={() => start(async () => { await respondTradeAction(trade.id, true); })}>Accept</Button>
                ) : null}
                {data.actor.permissions.includes("shift_trades.approve") && trade.status === "pending" ? (
                  <Button size="sm" onClick={() => start(async () => {
                    const result = await reviewTradeAction(trade.id, true);
                    if ("error" in result && result.error) toast.error(result.error);
                    else toast.success("Assignment updated");
                  })}>Approve</Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
