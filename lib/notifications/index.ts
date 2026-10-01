export const NOTIFICATION_TYPES = [
  "shift.assigned",
  "shift.changed",
  "shift.cancelled",
  "open_shift.available",
  "open_shift.claimed",
  "time_off.approved",
  "time_off.rejected",
  "shift_trade.requested",
  "shift_trade.approved",
  "task.assigned",
  "task.overdue",
  "clock.reminder",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
