import { z } from "zod";

const uuid = z.string().uuid();
const text = (max = 2000) => z.string().trim().min(1).max(max);
const optionalText = (max = 4000) => z.string().trim().max(max).optional().nullable();

export const facilitySchema = z.object({
  id: uuid.optional(),
  name: text(160),
  facilityType: z.enum(["clinical_site", "training_site", "client", "office", "other"]),
  status: z.enum(["active", "inactive"]).default("active"),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(80),
  state: optionalText(80),
  postalCode: optionalText(20),
  country: optionalText(80),
  phone: optionalText(40),
  email: z.string().email().optional().nullable().or(z.literal("")),
  website: optionalText(200),
  notes: optionalText(4000),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  geofenceRadiusMeters: z.coerce.number().int().min(0).max(50000).optional().nullable(),
  billingEnabled: z.boolean().default(false),
});

export const facilityContactSchema = z.object({
  id: uuid.optional(),
  facilityId: uuid,
  firstName: text(80),
  lastName: text(80),
  title: optionalText(80),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: optionalText(40),
  isPrimary: z.boolean().default(false),
  notes: optionalText(2000),
});

export const facilityLocationSchema = z.object({
  facilityId: uuid,
  name: text(160),
  address: optionalText(200),
});

export const billingRateSchema = z.object({
  facilityId: uuid,
  positionId: uuid.optional().nullable(),
  qualificationId: uuid.optional().nullable(),
  billingRate: z.coerce.number().min(0).max(10000),
  effectiveFrom: z.string().min(8),
  effectiveTo: z.string().optional().nullable(),
});

export const onboardingTemplateSchema = z.object({
  id: uuid.optional(),
  name: text(160),
  employeeType: z.enum(["instructor", "staff"]).optional().nullable(),
  role: z.enum(["super_admin", "admin", "scheduler", "instructor", "staff"]).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const onboardingItemSchema = z.object({
  templateId: uuid,
  title: text(160),
  description: optionalText(),
  itemType: z.enum(["task", "form", "document_upload", "acknowledgement", "link", "profile_field", "training"]),
  isRequired: z.boolean().default(true),
  dueDaysAfterStart: z.coerce.number().int().min(0).max(365).optional().nullable(),
});

export const formSchema = z.object({
  id: uuid.optional(),
  title: text(160),
  description: optionalText(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

export const formFieldSchema = z.object({
  formId: uuid,
  fieldType: z.enum([
    "short_text",
    "long_text",
    "email",
    "phone",
    "number",
    "date",
    "time",
    "dropdown",
    "radio",
    "checkbox",
    "yes_no",
    "signature",
    "file_upload",
    "section_heading",
  ]),
  label: text(160),
  description: optionalText(),
  required: z.boolean().default(false),
  options: z.array(z.string().max(80)).optional().nullable(),
});

export const announcementSchema = z.object({
  title: text(160),
  message: text(8000),
  audienceKind: z.enum([
    "everyone",
    "instructors",
    "staff",
    "role",
    "department",
    "location",
    "facility",
    "employees",
  ]),
  audienceValue: optionalText(400),
  publishAt: z.string().min(8),
  expiresAt: z.string().optional().nullable(),
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
  requireAcknowledgement: z.boolean().default(false),
});

export const articleSchema = z.object({
  title: text(200),
  categoryId: text(40),
  summary: optionalText(400),
  content: text(20000),
  audienceKind: z.enum([
    "everyone",
    "instructors",
    "staff",
    "role",
    "department",
    "location",
    "facility",
    "employees",
  ]),
  audienceValue: optionalText(400),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

export const trainingSchema = z.object({
  title: text(200),
  resourceType: z.enum(["video_link", "pdf", "document", "external_link", "checklist", "article"]),
  url: optionalText(500),
  content: optionalText(8000),
});

export const invoiceDraftSchema = z.object({
  facilityId: uuid,
  periodStart: z.string().min(8),
  periodEnd: z.string().min(8),
  notes: optionalText(),
});

export const payrollAdjustmentSchema = z.object({
  userId: uuid,
  payPeriodId: uuid,
  adjustmentType: z.enum(["bonus", "reimbursement", "manual_pay", "manual_hours", "other"]),
  amount: z.coerce.number().min(-100000).max(100000),
  hours: z.coerce.number().min(0).max(400).optional().nullable(),
  description: text(400),
});

export const unlockPeriodSchema = z.object({
  payPeriodId: uuid,
  reason: text(400),
});
