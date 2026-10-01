"use server";

import { revalidatePath } from "next/cache";
import {
  answerSchedule,
  applyAutoFill,
  confirmShift,
  createAutomation,
  currentScheduleHealth,
  duplicateAutomation,
  generateAutoFill,
  installAutomationTemplates,
  rejectAutoFill,
  reviewCallout,
  setAutomationEnabled,
  submitCallout,
} from "@/lib/db/phase4";
import { addDays, startOfWeekMonday, toISODate } from "@/lib/utils";
import type { AutomationAction, ShiftCallout } from "@/types";

function weekRange() {
  const start = toISODate(startOfWeekMonday(new Date()));
  return { start, end: toISODate(addDays(startOfWeekMonday(new Date()), 6)) };
}

export async function answerScheduleAction(question: string) {
  try {
    const result = await answerSchedule(question);
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not answer that question." };
  }
}

export async function generateAutoFillAction() {
  try {
    const range = weekRange();
    const recommendation = await generateAutoFill(range.start, range.end);
    revalidatePath("/schedule");
    return { ok: true as const, recommendation };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Auto fill failed." };
  }
}

export async function applyAutoFillAction(recommendationId: string, itemIds: string[]) {
  try {
    await applyAutoFill(recommendationId, itemIds);
    revalidatePath("/schedule");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not apply recommendations." };
  }
}

export async function rejectAutoFillAction(recommendationId: string, itemIds: string[]) {
  try {
    await rejectAutoFill(recommendationId, itemIds);
    revalidatePath("/schedule");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not reject recommendations." };
  }
}

export async function scheduleHealthAction() {
  try {
    return { ok: true as const, health: await currentScheduleHealth() };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not read schedule health." };
  }
}

export async function installTemplatesAction() {
  try {
    const count = await installAutomationTemplates();
    revalidatePath("/automations");
    return { ok: true as const, count };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not add templates." };
  }
}

export async function setAutomationEnabledAction(id: string, enabled: boolean) {
  try {
    await setAutomationEnabled(id, enabled);
    revalidatePath("/automations");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not update automation." };
  }
}

export async function duplicateAutomationAction(id: string) {
  try {
    await duplicateAutomation(id);
    revalidatePath("/automations");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not duplicate automation." };
  }
}

export async function createAutomationAction(input: {
  name: string;
  triggerType: string;
  actionType: AutomationAction["type"];
}) {
  try {
    const automation = await createAutomation({
      name: input.name,
      triggerType: input.triggerType,
      conditions: [],
      actions: [{ type: input.actionType }],
    });
    revalidatePath("/automations");
    return { ok: true as const, id: automation.id };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not create automation." };
  }
}

export async function submitCalloutAction(input: { shiftId: string; reasonType: ShiftCallout["reasonType"]; notes: string }) {
  try {
    await submitCallout({ ...input, notes: input.notes || null });
    revalidatePath("/schedule");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not submit call-out." };
  }
}

export async function reviewCalloutAction(id: string, status: ShiftCallout["status"]) {
  try {
    await reviewCallout(id, status);
    revalidatePath("/command-center");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not review call-out." };
  }
}

export async function confirmShiftAction(shiftId: string) {
  try {
    await confirmShift(shiftId);
    revalidatePath("/schedule");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not confirm shift." };
  }
}
