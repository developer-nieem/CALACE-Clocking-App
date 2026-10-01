"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  commentOnTaskAction,
  completeChecklistAction,
  createGroupChatAction,
  createTaskAction,
  markNotificationsAction,
  registerDocumentAction,
  savePreferenceAction,
  sendChatMessageAction,
  startDirectChatAction,
} from "@/app/actions/phase3";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fullName } from "@/lib/utils";
import { notificationHref } from "@/lib/phase3/domain";
import type { ChatMessage, ChatRoom, NotificationItem, Profile, TaskItem } from "@/types";

export function TaskBoard({
  tasks,
  profiles,
  canManage,
}: {
  tasks: TaskItem[];
  profiles: Profile[];
  canManage: boolean;
}) {
  const [pending, start] = useTransition();
  const [view, setView] = useState<"mine" | "team" | "overdue" | "completed">("mine");
  const today = new Date().toISOString().slice(0, 10);
  const visible = tasks.filter((task) => {
    if (view === "completed") return task.status === "completed";
    if (view === "overdue") return task.status !== "completed" && task.dueAt && task.dueAt.slice(0, 10) < today;
    if (view === "team") return canManage;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["mine", "team", "overdue", "completed"] as const).map((item) => (
          <Button key={item} variant={view === item ? "default" : "outline"} onClick={() => setView(item)}>
            {item === "mine" ? "My Tasks" : item === "team" ? "Team Tasks" : item === "overdue" ? "Overdue" : "Completed"}
          </Button>
        ))}
      </div>
      {canManage ? (
        <Card>
          <CardHeader><CardTitle>Create task</CardTitle></CardHeader>
          <CardContent>
            <form
              className="grid gap-2 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                start(async () => {
                  const result = await createTaskAction({
                    title: String(form.get("title")),
                    description: String(form.get("description") || ""),
                    assigneeIds: String(form.get("assignee") || "").split(",").filter(Boolean),
                    priority: String(form.get("priority") || "normal") as TaskItem["priority"],
                    dueAt: String(form.get("due") || "") || null,
                    shiftId: String(form.get("shift") || "") || null,
                    checklist: String(form.get("checklist") || "").split("\n"),
                  });
                  if ("error" in result && result.error) toast.error(result.error);
                  else toast.success("Task assigned");
                });
              }}
            >
              <Input name="title" placeholder="Title" required />
              <Input name="assignee" placeholder="Employee id" required />
              <Input name="due" type="date" />
              <Input name="shift" placeholder="Related shift id" />
              <select name="priority" className="h-10 rounded-md border border-border bg-card px-2 text-sm">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <Input name="description" placeholder="Description" />
              <textarea name="checklist" placeholder="Checklist, one item per line" className="min-h-20 rounded-md border border-border p-2 text-sm md:col-span-2" />
              <Button type="submit" disabled={pending}>Create task</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-3">
        {visible.map((task) => (
          <Card key={task.id}>
            <CardContent className="space-y-2 p-4 text-sm">
              <p className="font-medium">{task.title}</p>
              <p className="text-muted-foreground">{task.priority} · {task.status}{task.shiftId ? " · linked to shift" : ""}</p>
              {(task.checklist ?? []).map((item) => {
                const done = (task.completions ?? []).some((completion) => completion.checklistItemId === item.id);
                return (
                  <label key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() =>
                        start(async () => {
                          const result = await completeChecklistAction(task.id, item.id);
                          if ("error" in result && result.error) toast.error(result.error);
                        })
                      }
                    />
                    {item.title}
                  </label>
                );
              })}
              {(task.comments ?? []).map((comment) => (
                <p key={comment.id} className="text-muted-foreground">
                  {profiles.find((person) => person.id === comment.userId)?.firstName ?? "Employee"}: {comment.comment}
                </p>
              ))}
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  start(async () => {
                    const result = await commentOnTaskAction(task.id, String(form.get("comment")));
                    if ("error" in result && result.error) toast.error(result.error);
                    else event.currentTarget.reset();
                  });
                }}
              >
                <Input name="comment" placeholder="Comment" required />
                <Button type="submit" variant="outline" disabled={pending}>Send</Button>
              </form>
            </CardContent>
          </Card>
        ))}
        {visible.length === 0 ? <p className="text-sm text-muted-foreground">No tasks in this view.</p> : null}
      </div>
    </div>
  );
}

export function ChatBoard({
  rooms,
  messages,
  profiles,
  currentUserId,
  canCreateGroup,
  initialRoomId,
}: {
  rooms: ChatRoom[];
  messages: ChatMessage[];
  profiles: Profile[];
  currentUserId: string;
  canCreateGroup: boolean;
  initialRoomId?: string;
}) {
  const router = useRouter();
  const [roomId, setRoomId] = useState(initialRoomId ?? rooms[0]?.id ?? "");
  const [pending, start] = useTransition();
  const room = rooms.find((item) => item.id === roomId) ?? null;
  const thread = messages.filter((message) => message.roomId === roomId);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 8000);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Card>
        <CardHeader><CardTitle>Conversations</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rooms.map((item) => (
            <button key={item.id} type="button" className="block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => setRoomId(item.id)}>
              {item.name ?? (profiles.filter((person) => item.memberIds.includes(person.id) && person.id !== currentUserId).map((person) => fullName(person.firstName, person.lastName)).join(", ") || "Direct message")}
            </button>
          ))}
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              start(async () => {
                const result = await startDirectChatAction(String(form.get("userId")));
                if ("error" in result && result.error) toast.error(result.error);
                else if ("roomId" in result && result.roomId) setRoomId(result.roomId);
              });
            }}
          >
            <Input name="userId" placeholder="Employee id" required />
            <Button type="submit" variant="outline" disabled={pending}>Direct message</Button>
          </form>
          {canCreateGroup ? (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                start(async () => {
                  const result = await createGroupChatAction(String(form.get("name")), String(form.get("members")).split(",").filter(Boolean));
                  if ("error" in result && result.error) toast.error(result.error);
                  else toast.success("Group created");
                });
              }}
            >
              <Input name="name" placeholder="Group name" required />
              <Input name="members" placeholder="Member ids, comma separated" />
              <Button type="submit" variant="outline" disabled={pending}>Create group</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{room?.name ?? "Messages"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {thread.map((message) => (
            <div key={message.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <p>{message.message}</p>
              <p className="text-xs text-muted-foreground">{new Date(message.createdAt).toLocaleString()}</p>
            </div>
          ))}
          {room ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                start(async () => {
                  const result = await sendChatMessageAction(room.id, String(form.get("message")));
                  if ("error" in result && result.error) toast.error(result.error);
                  else event.currentTarget.reset();
                });
              }}
            >
              <Input name="message" placeholder="Message" required />
              <Button type="submit" disabled={pending}>Send</Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Start a direct message to open a conversation.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function NotificationCenter({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [filter, setFilter] = useState("all");
  const visible = items.filter((item) => {
    if (tab === "unread" && item.readAt) return false;
    if (filter === "all") return true;
    return item.type.includes(filter) || item.entityType === filter;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant={tab === "all" ? "default" : "outline"} onClick={() => setTab("all")}>All</Button>
        <Button variant={tab === "unread" ? "default" : "outline"} onClick={() => setTab("unread")}>Unread</Button>
        <select className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All categories</option>
          <option value="shift">Schedule</option>
          <option value="task">Tasks</option>
          <option value="time_off">Time Off</option>
          <option value="chat">Chat</option>
        </select>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await markNotificationsAction(items.map((item) => item.id), true);
              toast.success("All marked read");
            })
          }
        >
          Mark all read
        </Button>
      </div>
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {visible.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <button
                type="button"
                className="text-left"
                onClick={() => {
                  start(async () => {
                    await markNotificationsAction([item.id], true);
                    router.push(notificationHref(item.entityType, item.entityId));
                  });
                }}
              >
                <p className="font-medium">{item.readAt ? item.title : `Unread · ${item.title}`}</p>
                <p className="text-sm text-muted-foreground">{item.message}</p>
              </button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => start(async () => { await markNotificationsAction([item.id], !item.readAt); })}
              >
                {item.readAt ? "Mark unread" : "Mark read"}
              </Button>
            </div>
          ))}
          {visible.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No notifications.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function PreferenceForm() {
  const [pending, start] = useTransition();
  const categories = ["Schedule Updates", "Time Clock", "Tasks", "Time Off", "Open Shifts", "Shift Trades", "Qualification Alerts", "System"];
  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <form
          key={category}
          className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            start(async () => {
              const result = await savePreferenceAction(category, form.get("inApp") === "on", form.get("email") === "on");
              if ("error" in result && result.error) toast.error(result.error);
              else toast.success(`${category} saved`);
            });
          }}
        >
          <span className="min-w-40 font-medium">{category}</span>
          <label className="flex items-center gap-1"><input type="checkbox" name="inApp" defaultChecked /> In-app</label>
          <label className="flex items-center gap-1"><input type="checkbox" name="email" /> Email</label>
          <Button type="submit" variant="outline" disabled={pending}>Save</Button>
        </form>
      ))}
    </div>
  );
}

export function DocumentForm({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        start(async () => {
          const result = await registerDocumentAction({
            userId,
            documentType: String(form.get("type")),
            title: String(form.get("title")),
            fileName: String(form.get("file")),
            expirationDate: String(form.get("expires") || "") || null,
            notes: String(form.get("notes") || "") || null,
          });
          if ("error" in result && result.error) toast.error(result.error);
          else toast.success("Document recorded");
        });
      }}
    >
      <Input name="title" placeholder="Title" required />
      <select name="type" className="h-10 rounded-md border border-border bg-card px-2 text-sm">
        {["Certificate", "License", "CPR", "BLS", "CNA Certificate", "RN License", "LVN License", "Employment Document", "Training Certificate", "Other"].map((type) => (
          <option key={type}>{type}</option>
        ))}
      </select>
      <Input name="file" placeholder="certificate.pdf" required />
      <Input name="expires" type="date" />
      <Input name="notes" placeholder="Notes" />
      <Button type="submit" disabled={pending}>Save document</Button>
    </form>
  );
}
