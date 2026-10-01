"use server";

import {
  createRecurringShifts,
  createShiftFromTemplate,
  offerReplacement,
  publishWeek,
  requestOpenShift,
  requestTimeOff,
  requestTrade,
  respondToTrade,
  reviewOpenShift,
  reviewTimeOff,
  reviewTrade,
  saveAvailability,
} from "@/lib/db/phase2";

function fail(error: unknown) {
  return { error: error instanceof Error ? error.message : "Request failed." };
}

export async function saveAvailabilityAction(input: Parameters<typeof saveAvailability>[0]) {
  try {
    await saveAvailability(input);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function requestTimeOffAction(input: Parameters<typeof requestTimeOff>[0]) {
  try {
    await requestTimeOff(input);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function reviewTimeOffAction(id: string, status: "approved" | "rejected" | "cancelled", notes?: string) {
  try {
    await reviewTimeOff(id, status, notes);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function publishWeekAction(start: string, end: string) {
  try {
    const count = await publishWeek(start, end);
    return { ok: true as const, count };
  } catch (error) {
    return fail(error);
  }
}

export async function createRecurringAction(input: Parameters<typeof createRecurringShifts>[0]) {
  try {
    const count = await createRecurringShifts(input);
    return { ok: true as const, count };
  } catch (error) {
    return fail(error);
  }
}

export async function createFromTemplateAction(input: Parameters<typeof createShiftFromTemplate>[0]) {
  try {
    await createShiftFromTemplate(input);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function claimOpenShiftAction(shiftId: string) {
  try {
    await requestOpenShift(shiftId);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function reviewOpenShiftAction(id: string, status: "approved" | "rejected") {
  try {
    await reviewOpenShift(id, status);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function requestTradeAction(input: Parameters<typeof requestTrade>[0]) {
  try {
    await requestTrade(input);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function respondTradeAction(id: string, accept: boolean) {
  try {
    await respondToTrade(id, accept);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function reviewTradeAction(id: string, approve: boolean) {
  try {
    await reviewTrade(id, approve);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function offerReplacementAction(tradeId: string) {
  try {
    await offerReplacement(tradeId);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
