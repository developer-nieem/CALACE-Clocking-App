"use server";

import {
  commentOnTask,
  completeChecklistItem,
  createGroupChat,
  createTask,
  editOwnMessage,
  issueCalendarFeed,
  markNotifications,
  registerDocument,
  saveNotificationPreference,
  sendChatMessage,
  startDirectChat,
} from "@/lib/db/phase3";

export async function createTaskAction(input: Parameters<typeof createTask>[0]) {
  try {
    await createTask(input);
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create task." };
  }
}

export async function completeChecklistAction(taskId: string, itemId: string) {
  try {
    await completeChecklistItem(taskId, itemId);
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update checklist." };
  }
}

export async function commentOnTaskAction(taskId: string, comment: string) {
  try {
    await commentOnTask(taskId, comment);
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to comment." };
  }
}

export async function startDirectChatAction(userId: string) {
  try {
    const room = await startDirectChat(userId);
    return { ok: true as const, roomId: room.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to start chat." };
  }
}

export async function createGroupChatAction(name: string, memberIds: string[]) {
  try {
    const room = await createGroupChat({ name, memberIds });
    return { ok: true as const, roomId: room.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create group." };
  }
}

export async function sendChatMessageAction(roomId: string, message: string) {
  try {
    await sendChatMessage({ roomId, message });
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to send message." };
  }
}

export async function editOwnMessageAction(messageId: string, message: string) {
  try {
    await editOwnMessage(messageId, message);
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to edit message." };
  }
}

export async function markNotificationsAction(ids: string[], read: boolean) {
  try {
    await markNotifications(ids, read);
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update notifications." };
  }
}

export async function savePreferenceAction(category: string, inApp: boolean, email: boolean) {
  try {
    await saveNotificationPreference(category, inApp, email);
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save preference." };
  }
}

export async function registerDocumentAction(input: Parameters<typeof registerDocument>[0]) {
  try {
    await registerDocument(input);
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save document." };
  }
}

export async function issueCalendarFeedAction() {
  try {
    const token = await issueCalendarFeed();
    return { ok: true as const, token };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create calendar feed." };
  }
}
