import { revalidatePath } from "next/cache";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { mutateWorkforceState, readWorkforceState } from "@/lib/db/workforce";
import { isManager } from "@/lib/permissions";
import { createFeedToken } from "@/lib/notifications/email";
import { canReadRoom, findDirectRoom, visibleTasks } from "@/lib/phase3/domain";
import type { TaskItem } from "@/types";

function notify(
  state: Awaited<ReturnType<typeof readWorkforceState>>,
  userId: string,
  title: string,
  message: string,
  entityType: string,
  entityId: string,
) {
  state.notifications.unshift({
    id: crypto.randomUUID(),
    userId,
    type: entityType,
    title,
    message,
    entityType,
    entityId,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
}

export async function getTaskWorkspace() {
  const actor = await requireSession();
  const state = await readWorkforceState();
  const canManage = actor.permissions.includes("tasks.manage");
  return {
    actor,
    canManage,
    tasks: visibleTasks(state.tasks, actor.id, canManage),
    profiles: state.profiles,
    shifts: state.shifts,
    locations: state.locations,
    departments: state.departments,
  };
}

export async function createTask(input: {
  title: string;
  description?: string;
  assigneeIds: string[];
  priority: TaskItem["priority"];
  dueAt?: string | null;
  shiftId?: string | null;
  locationId?: string | null;
  departmentId?: string | null;
  checklist?: string[];
}) {
  const actor = await requirePermission("tasks.manage");
  const task = await mutateWorkforceState((state) => {
    const created: TaskItem = {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description ?? null,
      dueAt: input.dueAt ?? null,
      priority: input.priority,
      status: "open",
      assigneeIds: input.assigneeIds,
      shiftId: input.shiftId ?? null,
      locationId: input.locationId ?? null,
      departmentId: input.departmentId ?? null,
      createdBy: actor.id,
      checklist: (input.checklist ?? []).filter(Boolean).map((title, index) => ({
        id: crypto.randomUUID(),
        title,
        sortOrder: index + 1,
        isRequired: false,
      })),
      completions: [],
      comments: [],
    };
    state.tasks.unshift(created);
    for (const userId of created.assigneeIds) {
      notify(state, userId, "Task assigned", created.title, "task", created.id);
    }
    state.activity.unshift({
      id: crypto.randomUUID(),
      actorId: actor.id,
      action: "task_created",
      entityType: "task",
      entityId: created.id,
      createdAt: new Date().toISOString(),
    });
    return created;
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return task;
}

export async function completeChecklistItem(taskId: string, itemId: string) {
  const actor = await requireSession();
  await mutateWorkforceState((state) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("Task not found.");
    if (!task.assigneeIds.includes(actor.id) && !actor.permissions.includes("tasks.manage")) {
      throw new Error("You cannot update this task.");
    }
    task.completions = task.completions ?? [];
    if (!task.completions.some((item) => item.checklistItemId === itemId && item.userId === actor.id)) {
      task.completions.push({
        id: crypto.randomUUID(),
        checklistItemId: itemId,
        userId: actor.id,
        completedAt: new Date().toISOString(),
      });
    }
    const required = task.checklist ?? [];
    const finished = required.every((item) =>
      task.completions?.some((completion) => completion.checklistItemId === item.id && completion.userId === actor.id),
    );
    if (required.length > 0 && finished) {
      task.status = "completed";
      task.completedAt = new Date().toISOString();
      if (task.createdBy) notify(state, task.createdBy, "Task completed", task.title, "task", task.id);
    }
  });
  revalidatePath("/tasks");
}

export async function commentOnTask(taskId: string, comment: string) {
  const actor = await requireSession();
  await mutateWorkforceState((state) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("Task not found.");
    const allowed = task.assigneeIds.includes(actor.id) || isManager(actor.roles);
    if (!allowed) throw new Error("You cannot comment on this task.");
    task.comments = task.comments ?? [];
    task.comments.push({
      id: crypto.randomUUID(),
      userId: actor.id,
      comment,
      createdAt: new Date().toISOString(),
    });
    for (const userId of task.assigneeIds.filter((id) => id !== actor.id)) {
      notify(state, userId, "Task comment", comment, "task", task.id);
    }
  });
  revalidatePath("/tasks");
}

export async function getChatWorkspace() {
  const actor = await requireSession();
  if (!actor.permissions.includes("chat.use")) throw new Error("Chat is not enabled for this role.");
  const state = await readWorkforceState();
  const rooms = state.chatRooms.filter((room) => canReadRoom(room, actor.id));
  const roomIds = new Set(rooms.map((room) => room.id));
  return {
    actor,
    rooms,
    messages: state.chatMessages.filter((message) => roomIds.has(message.roomId) && !message.deletedAt),
    profiles: state.profiles.filter((profile) => profile.employmentStatus === "active"),
    departments: state.departments,
    canCreateGroup: isManager(actor.roles),
  };
}

export async function startDirectChat(otherUserId: string) {
  const actor = await requireSession();
  const room = await mutateWorkforceState((state) => {
    const existing = findDirectRoom(state.chatRooms, actor.id, otherUserId);
    if (existing) return existing;
    const created = {
      id: crypto.randomUUID(),
      type: "direct" as const,
      name: null,
      memberIds: [actor.id, otherUserId],
      createdBy: actor.id,
      createdAt: new Date().toISOString(),
    };
    state.chatRooms.unshift(created);
    return created;
  });
  revalidatePath("/chat");
  return room;
}

export async function createGroupChat(input: { name: string; memberIds: string[]; departmentId?: string | null }) {
  const actor = await requirePermission("chat.use");
  if (!isManager(actor.roles)) throw new Error("Only a manager can create a group.");
  const room = await mutateWorkforceState((state) => {
    const created = {
      id: crypto.randomUUID(),
      type: input.departmentId ? ("department" as const) : ("group" as const),
      name: input.name,
      memberIds: [...new Set([actor.id, ...input.memberIds])],
      createdBy: actor.id,
      departmentId: input.departmentId ?? null,
      createdAt: new Date().toISOString(),
    };
    state.chatRooms.unshift(created);
    return created;
  });
  revalidatePath("/chat");
  return room;
}

export async function sendChatMessage(input: { roomId: string; message: string; replyToMessageId?: string | null }) {
  const actor = await requireSession();
  await mutateWorkforceState((state) => {
    const room = state.chatRooms.find((item) => item.id === input.roomId);
    if (!room || !canReadRoom(room, actor.id)) throw new Error("You are not a member of this conversation.");
    const message = {
      id: crypto.randomUUID(),
      roomId: room.id,
      senderId: actor.id,
      message: input.message.trim(),
      replyToMessageId: input.replyToMessageId ?? null,
      createdAt: new Date().toISOString(),
    };
    if (!message.message) throw new Error("Message is empty.");
    state.chatMessages.push(message);
    for (const userId of room.memberIds.filter((id) => id !== actor.id)) {
      notify(state, userId, room.name ?? "New message", message.message, "chat", room.id);
    }
  });
  revalidatePath("/chat");
}

export async function editOwnMessage(messageId: string, message: string) {
  const actor = await requireSession();
  await mutateWorkforceState((state) => {
    const current = state.chatMessages.find((item) => item.id === messageId);
    if (!current || current.senderId !== actor.id) throw new Error("You can only edit your own message.");
    const age = Date.now() - new Date(current.createdAt).getTime();
    if (age > 15 * 60 * 1000) throw new Error("This message is too old to edit.");
    current.message = message.trim();
    current.editedAt = new Date().toISOString();
  });
  revalidatePath("/chat");
}

export async function markNotifications(ids: string[], read: boolean) {
  const actor = await requireSession();
  await mutateWorkforceState((state) => {
    for (const item of state.notifications) {
      if (item.userId === actor.id && (ids.length === 0 || ids.includes(item.id))) {
        item.readAt = read ? new Date().toISOString() : null;
      }
    }
  });
  revalidatePath("/notifications");
}

export async function saveNotificationPreference(category: string, inApp: boolean, email: boolean) {
  const actor = await requireSession();
  await mutateWorkforceState((state) => {
    const current = state.notificationPreferences.find(
      (item) => item.userId === actor.id && item.category === category,
    );
    if (current) {
      current.inApp = inApp;
      current.email = email;
    } else {
      state.notificationPreferences.push({
        id: crypto.randomUUID(),
        userId: actor.id,
        category,
        inApp,
        email,
      });
    }
  });
  revalidatePath("/settings/notifications");
}

export async function registerDocument(input: {
  userId: string;
  documentType: string;
  title: string;
  fileName: string;
  expirationDate?: string | null;
  notes?: string | null;
}) {
  const actor = await requirePermission("documents.manage");
  const allowed = ["application/pdf", "image/png", "image/jpeg", "text/plain"];
  const extension = input.fileName.split(".").pop()?.toLowerCase();
  const mime =
    extension === "pdf"
      ? "application/pdf"
      : extension === "png"
        ? "image/png"
        : extension === "jpg" || extension === "jpeg"
          ? "image/jpeg"
          : extension === "txt"
            ? "text/plain"
            : null;
  if (!mime || !allowed.includes(mime)) throw new Error("Upload a PDF, image, or text document.");
  await mutateWorkforceState((state) => {
    state.documents.unshift({
      id: crypto.randomUUID(),
      userId: input.userId,
      documentType: input.documentType,
      title: input.title,
      fileName: input.fileName,
      mimeType: mime,
      fileSize: 0,
      issuedDate: null,
      expirationDate: input.expirationDate ?? null,
      notes: input.notes ?? null,
      uploadedBy: actor.id,
      createdAt: new Date().toISOString(),
    });
    state.activity.unshift({
      id: crypto.randomUUID(),
      actorId: actor.id,
      action: "document_uploaded",
      entityType: "document",
      entityId: input.userId,
      createdAt: new Date().toISOString(),
    });
  });
  revalidatePath(`/users/${input.userId}`);
}

export async function issueCalendarFeed() {
  const actor = await requireSession();
  const issued = createFeedToken();
  await mutateWorkforceState((state) => {
    const existing = state.calendarFeeds.find((item) => item.userId === actor.id);
    if (existing) existing.tokenHash = issued.tokenHash;
    else {
      state.calendarFeeds.push({
        id: crypto.randomUUID(),
        userId: actor.id,
        tokenHash: issued.tokenHash,
        createdAt: new Date().toISOString(),
      });
    }
  });
  revalidatePath("/calendar-sync");
  return issued.token;
}
