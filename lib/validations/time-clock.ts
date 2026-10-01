import { z } from "zod";

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const deviceLocationSchema = z.preprocess((value) => {
  if (value == null) return null;
  if (typeof value !== "object") return value;
  const location = value as Record<string, unknown>;
  return {
    latitude: finiteNumber(location.latitude, Number.NaN),
    longitude: finiteNumber(location.longitude, Number.NaN),
    accuracy: Math.min(Math.max(finiteNumber(location.accuracy), 0), 100_000),
    timestamp: Math.max(finiteNumber(location.timestamp, Date.now()), 1),
  };
}, z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(100_000),
    timestamp: z.number().positive(),
  })
  .nullable());

export const clockInSchema = z.object({
  shiftId: z.string().nullable().optional(),
  location: deviceLocationSchema,
});

export const correctionSchema = z.object({
  timeEntryId: z.string().min(1),
  breakId: z.string().optional(),
  fieldName: z.enum([
    "clockInAt",
    "clockOutAt",
    "breakStartAt",
    "breakEndAt",
  ]),
  newValue: z.string().datetime(),
  reason: z.string().trim().min(3, "A correction reason is required."),
});

export const payRateSchema = z.object({
  userId: z.string().min(1),
  hourlyRate: z.coerce.number().min(0).max(10_000),
  effectiveFrom: z.string().date(),
});
