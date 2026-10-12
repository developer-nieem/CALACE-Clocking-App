import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "New password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"],
  });

export const inviteUserSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  phone: z.string().optional(),
  employeeType: z.enum(["instructor", "staff"]),
  role: z.enum(["super_admin", "admin", "scheduler", "instructor", "staff"]),
  positionId: z.string().optional(),
  departmentId: z.string().optional(),
  primaryLocationId: z.string().optional(),
  payType: z.enum(["hourly", "salary"]),
  hourlyRate: z.coerce.number().min(0).max(10_000).nullable(),
  weeklyTargetHours: z.coerce.number().min(0).max(80).nullable(),
  maximumWeeklyHours: z.coerce.number().min(0).max(80).nullable(),
  hireDate: z.string().optional().nullable(),
  screenCaptureEnabled: z.boolean().optional().default(false),
});

export const updateUserSchema = inviteUserSchema.omit({ password: true }).extend({
  id: z.string().uuid(),
  employmentStatus: z.enum(["active", "invited", "inactive", "terminated", "archived"]),
  password: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? "")
    .refine((value) => value.length === 0 || value.length >= 8, "Password must be at least 8 characters."),
});

export const shiftSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required."),
  date: z.string().min(1, "Date is required."),
  startTime: z.string().min(1, "Start time is required."),
  endTime: z.string().min(1, "End time is required."),
  instructorIds: z.array(z.string()).default([]),
  locationId: z.string().optional().nullable(),
  facilityId: z.string().uuid().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  classCohort: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  color: z.string().default("#0D2A43"),
  breakDurationMinutes: z.coerce.number().min(0).max(240).default(0),
  notes: z.string().optional().nullable(),
  tasks: z.array(z.string()).default([]),
  status: z.enum(["draft", "published", "completed", "cancelled"]).default("draft"),
  isOpen: z.boolean().default(false),
  requiredInstructors: z.coerce.number().min(1).max(12).default(1),
  saveAsTemplate: z.boolean().optional(),
  overrideWarnings: z.boolean().optional(),
  overrideReason: z.string().optional(),
});

export type ShiftInput = z.infer<typeof shiftSchema>;
