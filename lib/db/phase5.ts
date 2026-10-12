import { revalidatePath } from "next/cache";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { mutateWorkforceState, readWorkforceState } from "@/lib/db/workforce";
import { allocateInvoiceNumber } from "@/lib/db/neon";
import { isDatabaseMode } from "@/lib/env";
import { logEvent } from "@/lib/monitoring";
import {
  audienceMatches,
  canEditTimeRecord,
  createSignatureEvidence,
  csvFromRows,
  emptyPhase5,
  facilityBillingRateForDate,
  hashCsv,
  invoiceLineFromHours,
  isPayPeriodLocked,
  laborMargin,
  nextInvoiceNumber,
  onboardingProgress,
  payrollExportRows,
  redactExportRecord,
  validateFormValues,
  visibleAnnouncements,
  visibleArticles,
} from "@/lib/phase5/domain";
import type { Permission } from "@/lib/permissions";
import { isManager } from "@/lib/permissions";
import {
  announcementSchema,
  articleSchema,
  billingRateSchema,
  facilityContactSchema,
  facilityLocationSchema,
  facilitySchema,
  formFieldSchema,
  formSchema,
  invoiceDraftSchema,
  onboardingItemSchema,
  onboardingTemplateSchema,
  payrollAdjustmentSchema,
  trainingSchema,
  unlockPeriodSchema,
} from "@/lib/validations/phase5";
import type {
  EmployeeTimesheet,
  Facility,
  Invoice,
  PayPeriod,
  SavedView,
  SessionUser,
} from "@/types";

function nowIso() {
  return new Date().toISOString();
}

function audit(
  state: { activity: Array<{ id: string; actorId: string; action: string; entityType: string; entityId: string | null; createdAt: string; metadata?: Record<string, string | number | boolean | null> }> },
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, string | number | boolean | null>,
) {
  state.activity.unshift({
    id: crypto.randomUUID(),
    actorId,
    action,
    entityType,
    entityId,
    createdAt: nowIso(),
    metadata,
  });
}

function notify(
  state: { notifications: Array<{ id: string; userId: string; type: string; title: string; message: string; entityType: string | null; entityId: string | null; readAt: string | null; createdAt: string }> },
  userId: string,
  title: string,
  message: string,
  entityType: string,
  entityId: string,
) {
  state.notifications.unshift({
    id: crypto.randomUUID(),
    userId,
    type: "phase5",
    title,
    message,
    entityType,
    entityId,
    readAt: null,
    createdAt: nowIso(),
  });
}

function ensurePhase5<T extends { facilities?: unknown[] }>(state: T) {
  const defaults = emptyPhase5();
  for (const key of Object.keys(defaults) as Array<keyof typeof defaults>) {
    if (!Array.isArray((state as Record<string, unknown>)[key])) {
      (state as Record<string, unknown>)[key] = defaults[key];
    }
  }
  return state as T & ReturnType<typeof emptyPhase5>;
}

export async function getPhase5Context() {
  const user = await requireSession();
  const state = ensurePhase5(await readWorkforceState());
  return { user, state };
}

export async function saveFacility(input: unknown) {
  const actor = await requirePermission("facilities.manage");
  const parsed = facilitySchema.parse(input);
  const facility = await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const existing = parsed.id ? state.facilities.find((item) => item.id === parsed.id) : null;
    const record: Facility = {
      id: existing?.id ?? crypto.randomUUID(),
      organizationId: actor.organizationId,
      name: parsed.name,
      facilityType: parsed.facilityType,
      status: parsed.status,
      addressLine1: parsed.addressLine1 || null,
      addressLine2: parsed.addressLine2 || null,
      city: parsed.city || null,
      state: parsed.state || null,
      postalCode: parsed.postalCode || null,
      country: parsed.country || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      website: parsed.website || null,
      notes: parsed.notes || null,
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
      geofenceRadiusMeters: parsed.geofenceRadiusMeters ?? null,
      billingEnabled: parsed.billingEnabled,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      archivedAt: parsed.status === "inactive" ? nowIso() : null,
    };
    if (existing) {
      Object.assign(existing, record);
    } else {
      state.facilities.unshift(record);
    }
    audit(state, actor.id, existing ? "facility_updated" : "facility_created", "facility", record.id);
    return record;
  });
  revalidatePath("/facilities");
  return facility;
}

export async function saveFacilityContact(input: unknown) {
  const actor = await requirePermission("facilities.manage");
  const parsed = facilityContactSchema.parse(input);
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const contact = {
      id: parsed.id ?? crypto.randomUUID(),
      organizationId: actor.organizationId,
      facilityId: parsed.facilityId,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      title: parsed.title || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      isPrimary: parsed.isPrimary,
      notes: parsed.notes || null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    if (parsed.isPrimary) {
      for (const item of state.facilityContacts) {
        if (item.facilityId === parsed.facilityId) item.isPrimary = false;
      }
    }
    const index = state.facilityContacts.findIndex((item) => item.id === contact.id);
    if (index >= 0) state.facilityContacts[index] = contact;
    else state.facilityContacts.unshift(contact);
    return contact;
  });
  revalidatePath("/facilities");
}

export async function addFacilityLocation(input: unknown) {
  const actor = await requirePermission("facilities.manage");
  const parsed = facilityLocationSchema.parse(input);
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    state.locations.unshift({
      id: crypto.randomUUID(),
      name: parsed.name,
      address: parsed.address || null,
      latitude: null,
      longitude: null,
      geofenceRadiusMeters: 200,
      geolocationRequired: false,
      status: "active",
      facilityId: parsed.facilityId,
    });
    audit(state, actor.id, "facility_location_added", "facility", parsed.facilityId);
  });
  revalidatePath("/facilities");
}

export async function assignEmployeeFacility(input: {
  userId: string;
  facilityId: string;
  isPrimary?: boolean;
}) {
  const actor = await requirePermission("facilities.manage");
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    state.employeeFacilities.unshift({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      userId: input.userId,
      facilityId: input.facilityId,
      isPrimary: input.isPrimary ?? false,
      startDate: null,
      endDate: null,
      createdAt: nowIso(),
    });
  });
  revalidatePath("/facilities");
}

export async function saveBillingRate(input: unknown) {
  const actor = await requirePermission("facility_billing.manage");
  const parsed = billingRateSchema.parse(input);
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const current = state.facilityBillingRates.find(
      (rate) =>
        rate.facilityId === parsed.facilityId &&
        rate.positionId === (parsed.positionId ?? null) &&
        !rate.effectiveTo,
    );
    if (current && current.effectiveFrom < parsed.effectiveFrom) {
      current.effectiveTo = parsed.effectiveFrom;
    }
    state.facilityBillingRates.unshift({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      facilityId: parsed.facilityId,
      positionId: parsed.positionId ?? null,
      qualificationId: parsed.qualificationId ?? null,
      billingRate: parsed.billingRate,
      effectiveFrom: parsed.effectiveFrom,
      effectiveTo: parsed.effectiveTo ?? null,
      createdBy: actor.id,
      createdAt: nowIso(),
    });
    audit(state, actor.id, "facility_rate_changed", "facility", parsed.facilityId, {
      rate: parsed.billingRate,
      effectiveFrom: parsed.effectiveFrom,
    });
  });
  revalidatePath("/billing");
  revalidatePath("/facilities");
}

export async function saveOnboardingTemplate(input: unknown) {
  const actor = await requirePermission("onboarding.manage");
  const parsed = onboardingTemplateSchema.parse(input);
  const template = await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const existing = parsed.id ? state.onboardingTemplates.find((item) => item.id === parsed.id) : null;
    const record = {
      id: existing?.id ?? crypto.randomUUID(),
      organizationId: actor.organizationId,
      name: parsed.name,
      employeeType: parsed.employeeType ?? null,
      role: parsed.role ?? null,
      isActive: parsed.isActive,
      createdBy: actor.id,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    if (existing) Object.assign(existing, record);
    else state.onboardingTemplates.unshift(record);
    return record;
  });
  revalidatePath("/onboarding");
  return template;
}

export async function addOnboardingItem(input: unknown) {
  const actor = await requirePermission("onboarding.manage");
  const parsed = onboardingItemSchema.parse(input);
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    state.onboardingTemplateItems.push({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      templateId: parsed.templateId,
      title: parsed.title,
      description: parsed.description || null,
      itemType: parsed.itemType,
      isRequired: parsed.isRequired,
      sortOrder: state.onboardingTemplateItems.filter((item) => item.templateId === parsed.templateId).length + 1,
      dueDaysAfterStart: parsed.dueDaysAfterStart ?? null,
    });
  });
  revalidatePath("/onboarding");
}

export async function assignOnboarding(input: { userId: string; templateId: string }) {
  const actor = await requirePermission("onboarding.manage");
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const onboardingId = crypto.randomUUID();
    state.employeeOnboarding.unshift({
      id: onboardingId,
      organizationId: actor.organizationId,
      userId: input.userId,
      templateId: input.templateId,
      status: "in_progress",
      startedAt: nowIso(),
      completedAt: null,
      createdAt: nowIso(),
    });
    for (const item of state.onboardingTemplateItems.filter((row) => row.templateId === input.templateId)) {
      state.employeeOnboardingItems.push({
        id: crypto.randomUUID(),
        organizationId: actor.organizationId,
        employeeOnboardingId: onboardingId,
        templateItemId: item.id,
        status: "pending",
        completedAt: null,
        completedBy: null,
        notes: null,
      });
    }
  });
  revalidatePath("/onboarding");
}

export async function completeOnboardingItem(input: { itemId: string; notes?: string }) {
  const user = await requireSession();
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const item = state.employeeOnboardingItems.find((row) => row.id === input.itemId);
    if (!item) throw new Error("Onboarding item not found.");
    const parent = state.employeeOnboarding.find((row) => row.id === item.employeeOnboardingId);
    if (!parent) throw new Error("Onboarding not found.");
    if (!user.permissions.includes("onboarding.manage") && parent.userId !== user.id) {
      throw new Error("You can only complete your own onboarding items.");
    }
    item.status = "complete";
    item.completedAt = nowIso();
    item.completedBy = user.id;
    item.notes = input.notes ?? null;
    const items = state.employeeOnboardingItems.filter((row) => row.employeeOnboardingId === parent.id);
    const templateItems = state.onboardingTemplateItems.filter((row) => row.templateId === parent.templateId);
    const progress = onboardingProgress(items, templateItems);
    if (progress.completeEnough && progress.complete === progress.total) {
      parent.status = "completed";
      parent.completedAt = nowIso();
    }
  });
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
}

export async function saveForm(input: unknown) {
  const actor = await requirePermission("forms.manage");
  const parsed = formSchema.parse(input);
  const form = await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const existing = parsed.id ? state.forms.find((item) => item.id === parsed.id) : null;
    const record = {
      id: existing?.id ?? crypto.randomUUID(),
      organizationId: actor.organizationId,
      title: parsed.title,
      description: parsed.description || null,
      status: parsed.status,
      createdBy: actor.id,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      version: existing ? existing.version + (parsed.status === "published" ? 1 : 0) : 1,
      archivedAt: parsed.status === "archived" ? nowIso() : null,
    };
    if (existing) Object.assign(existing, record);
    else state.forms.unshift(record);
    return record;
  });
  revalidatePath("/forms");
  return form;
}

export async function addFormField(input: unknown) {
  const actor = await requirePermission("forms.manage");
  const parsed = formFieldSchema.parse(input);
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    state.formFields.push({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      formId: parsed.formId,
      fieldType: parsed.fieldType,
      label: parsed.label,
      description: parsed.description || null,
      required: parsed.required,
      options: parsed.options ?? null,
      sortOrder: state.formFields.filter((item) => item.formId === parsed.formId).length + 1,
    });
  });
  revalidatePath("/forms");
}

export async function submitForm(input: {
  formId: string;
  values: Record<string, unknown>;
  signatureMethod?: "drawn" | "typed";
  userAgent?: string | null;
}) {
  const user = await requirePermission("forms.submit");
  const submission = await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const form = state.forms.find((item) => item.id === input.formId && item.status === "published");
    if (!form) throw new Error("Form is not available.");
    const fields = state.formFields.filter((item) => item.formId === form.id);
    const errors = validateFormValues(fields, input.values);
    if (errors.length) throw new Error(errors[0]);
    const signatureField = fields.find((item) => item.fieldType === "signature");
    const record = {
      id: crypto.randomUUID(),
      organizationId: user.organizationId,
      formId: form.id,
      userId: user.id,
      status: "submitted" as const,
      submittedAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      signature: signatureField
        ? createSignatureEvidence({
            signerId: user.id,
            method: input.signatureMethod ?? "typed",
            userAgent: input.userAgent,
            version: form.version,
            consentText: "I confirm this submission is my own and I am the authenticated signer.",
          })
        : null,
    };
    state.formSubmissions.unshift(record);
    for (const field of fields) {
      state.formSubmissionValues.push({
        id: crypto.randomUUID(),
        organizationId: user.organizationId,
        submissionId: record.id,
        fieldId: field.id,
        valueJson: input.values[field.id] ?? null,
        createdAt: nowIso(),
      });
    }
    if (record.signature) {
      audit(state, user.id, "form_signed", "form", form.id, { version: form.version });
    }
    return record;
  });
  revalidatePath("/forms");
  return submission;
}

export async function saveAnnouncement(input: unknown) {
  const actor = await requirePermission("notifications.manage");
  const parsed = announcementSchema.parse(input);
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const announcement = {
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      ...parsed,
      audienceValue: parsed.audienceValue || null,
      expiresAt: parsed.expiresAt || null,
      createdBy: actor.id,
      createdAt: nowIso(),
    };
    state.announcements.unshift(announcement);
    for (const profile of state.profiles) {
      const assigned = state.employeeFacilities.filter((item) => item.userId === profile.id).map((item) => item.facilityId);
      if (audienceMatches(announcement, profile, assigned)) {
        notify(state, profile.id, announcement.title, announcement.message, "announcement", announcement.id);
      }
    }
  });
  revalidatePath("/updates");
}

export async function acknowledgeAnnouncement(id: string) {
  const user = await requireSession();
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const existing = state.announcementAcknowledgements.find(
      (item) => item.announcementId === id && item.userId === user.id,
    );
    if (existing) {
      existing.acknowledgedAt = nowIso();
      existing.viewedAt = existing.viewedAt ?? nowIso();
      return;
    }
    state.announcementAcknowledgements.unshift({
      id: crypto.randomUUID(),
      organizationId: user.organizationId,
      announcementId: id,
      userId: user.id,
      viewedAt: nowIso(),
      acknowledgedAt: nowIso(),
    });
  });
  revalidatePath("/updates");
}

export async function saveArticle(input: unknown) {
  const actor = await requirePermission("knowledge.manage");
  const parsed = articleSchema.parse(input);
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    state.knowledgeBaseArticles.unshift({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      categoryId: parsed.categoryId,
      title: parsed.title,
      summary: parsed.summary || null,
      content: parsed.content,
      audienceKind: parsed.audienceKind,
      audienceValue: parsed.audienceValue || null,
      status: parsed.status,
      publishedAt: parsed.status === "published" ? nowIso() : null,
      updatedAt: nowIso(),
      createdBy: actor.id,
    });
  });
  revalidatePath("/knowledge-base");
}

export async function saveTraining(input: unknown) {
  const actor = await requirePermission("knowledge.manage");
  const parsed = trainingSchema.parse(input);
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    state.trainingResources.unshift({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      title: parsed.title,
      resourceType: parsed.resourceType,
      url: parsed.url || null,
      content: parsed.content || null,
      createdBy: actor.id,
      createdAt: nowIso(),
    });
  });
  revalidatePath("/training");
}

export async function assignTraining(input: { resourceId: string; userId: string }) {
  const actor = await requirePermission("knowledge.manage");
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    state.trainingAssignments.unshift({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      resourceId: input.resourceId,
      userId: input.userId,
      status: "assigned",
      viewedAt: null,
      completedAt: null,
    });
  });
  revalidatePath("/training");
}

export async function completeTraining(id: string) {
  const user = await requireSession();
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const assignment = state.trainingAssignments.find((item) => item.id === id);
    if (!assignment || assignment.userId !== user.id) throw new Error("Assignment not found.");
    assignment.status = "completed";
    assignment.completedAt = nowIso();
    assignment.viewedAt = assignment.viewedAt ?? nowIso();
  });
  revalidatePath("/training");
}

export async function submitTimesheet(payPeriodId: string) {
  const user = await requireSession();
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const period = state.payPeriods.find((item) => item.id === payPeriodId);
    if (!period || period.status === "locked") throw new Error("This pay period cannot be submitted.");
    let sheet = state.employeeTimesheets.find((item) => item.userId === user.id && item.payPeriodId === payPeriodId);
    if (!sheet) {
      sheet = {
        id: crypto.randomUUID(),
        organizationId: user.organizationId,
        userId: user.id,
        payPeriodId,
        status: "submitted",
        submittedAt: nowIso(),
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.employeeTimesheets.unshift(sheet);
    } else {
      sheet.status = "submitted";
      sheet.submittedAt = nowIso();
      sheet.rejectionReason = null;
      sheet.updatedAt = nowIso();
    }
  });
  revalidatePath("/timesheets");
  revalidatePath("/payroll");
}

export async function reviewTimesheet(input: { timesheetId: string; decision: "approve" | "reject"; reason?: string }) {
  const actor = await requirePermission("payroll.approve");
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const sheet = state.employeeTimesheets.find((item) => item.id === input.timesheetId);
    if (!sheet) throw new Error("Timesheet not found.");
    if (input.decision === "reject") {
      if (!input.reason?.trim()) throw new Error("A rejection reason is required.");
      sheet.status = "rejected";
      sheet.rejectionReason = input.reason;
      notify(state, sheet.userId, "Timesheet returned", input.reason, "timesheet", sheet.id);
    } else {
      sheet.status = "approved";
      sheet.rejectionReason = null;
    }
    sheet.reviewedBy = actor.id;
    sheet.reviewedAt = nowIso();
    sheet.updatedAt = nowIso();
    audit(state, actor.id, input.decision === "approve" ? "timesheet_approved" : "timesheet_rejected", "timesheet", sheet.id);
  });
  revalidatePath("/payroll");
  revalidatePath("/timesheets");
}

export async function ensurePayPeriod(startDate: string, endDate: string) {
  const actor = await requirePermission("payroll.view");
  return mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const existing = state.payPeriods.find((item) => item.startDate === startDate && item.endDate === endDate);
    if (existing) return existing;
    const period: PayPeriod = {
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      startDate,
      endDate,
      status: "open",
      lockedAt: null,
      lockedBy: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.payPeriods.unshift(period);
    return period;
  });
}

export async function lockPayPeriod(payPeriodId: string) {
  const actor = await requirePermission("payroll.lock");
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const period = state.payPeriods.find((item) => item.id === payPeriodId);
    if (!period) throw new Error("Pay period not found.");
    period.status = "locked";
    period.lockedAt = nowIso();
    period.lockedBy = actor.id;
    period.updatedAt = nowIso();
    for (const sheet of state.employeeTimesheets.filter((item) => item.payPeriodId === payPeriodId && item.status === "approved")) {
      sheet.status = "locked";
    }
    audit(state, actor.id, "pay_period_locked", "pay_period", period.id);
  });
  revalidatePath("/payroll");
}

export async function unlockPayPeriod(input: unknown) {
  const actor = await requirePermission("payroll.lock");
  const parsed = unlockPeriodSchema.parse(input);
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const period = state.payPeriods.find((item) => item.id === parsed.payPeriodId);
    if (!period) throw new Error("Pay period not found.");
    period.status = "review";
    period.lockedAt = null;
    period.lockedBy = null;
    period.updatedAt = nowIso();
    audit(state, actor.id, "pay_period_unlocked", "pay_period", period.id, { reason: parsed.reason });
  });
  revalidatePath("/payroll");
}

export async function addPayrollAdjustment(input: unknown) {
  const actor = await requirePermission("payroll.view");
  const parsed = payrollAdjustmentSchema.parse(input);
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    if (isPayPeriodLocked(state.payPeriods, state.payPeriods.find((item) => item.id === parsed.payPeriodId)?.startDate ?? "")) {
      throw new Error("This pay period is locked.");
    }
    state.payrollAdjustments.unshift({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      ...parsed,
      hours: parsed.hours ?? null,
      createdBy: actor.id,
      createdAt: nowIso(),
    });
  });
  revalidatePath("/payroll");
}

export async function generateInvoiceDraft(input: unknown) {
  const actor = await requirePermission("billing.manage");
  const parsed = invoiceDraftSchema.parse(input);
  const year = Number(parsed.periodStart.slice(0, 4));
  const allocated = isDatabaseMode()
    ? await allocateInvoiceNumber(actor.organizationId, year)
    : null;
  const invoice = await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    if (state.settings.featureFlags?.facility_billing === false) {
      throw new Error("Facility billing is disabled for this organization.");
    }
    const facility = state.facilities.find((item) => item.id === parsed.facilityId);
    if (!facility) throw new Error("Facility not found.");
    const number = allocated ?? nextInvoiceNumber(state.invoices, year);
    if (state.invoices.some((item) => item.invoiceNumber === number)) {
      throw new Error("Could not allocate a unique invoice number. Retry.");
    }
    const items = state.timeEntries
      .filter((entry) => entry.clockOutAt && entry.workDate >= parsed.periodStart && entry.workDate <= parsed.periodEnd)
      .flatMap((entry) => {
        const shift = state.shifts.find((item) => item.id === entry.shiftId);
        if (!shift || shift.facilityId !== facility.id) return [];
        const sheet = state.employeeTimesheets.find(
          (item) =>
            item.userId === entry.userId && ["approved", "locked", "exported"].includes(item.status),
        );
        if (!sheet) return [];
        const rate = facilityBillingRateForDate(state.facilityBillingRates, facility.id, entry.workDate, shift.positionId);
        if (!rate) return [];
        const hours =
          (new Date(entry.clockOutAt!).getTime() - new Date(entry.clockInAt).getTime()) / 3_600_000;
        return [
          {
            ...invoiceLineFromHours({
              hours,
              rate: rate.billingRate,
              description: `${shift.title} labor`,
              serviceDate: entry.workDate,
              userId: entry.userId,
              shiftId: shift.id,
            }),
          },
        ];
      });
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const record: Invoice = {
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      facilityId: facility.id,
      invoiceNumber: number,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      status: "draft",
      subtotal,
      adjustments: 0,
      total: subtotal,
      notes: parsed.notes || null,
      createdBy: actor.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.invoices.unshift(record);
    for (const item of items) {
      state.invoiceItems.push({
        id: crypto.randomUUID(),
        organizationId: actor.organizationId,
        invoiceId: record.id,
        ...item,
        createdAt: nowIso(),
      });
    }
    audit(state, actor.id, "invoice_generated", "invoice", record.id, { invoiceNumber: number });
    logEvent("info", "invoice_generated", { invoiceNumber: number, facilityId: facility.id });
    return record;
  });
  revalidatePath("/billing");
  return invoice;
}

export async function setInvoiceStatus(id: string, status: Invoice["status"]) {
  const actor = await requirePermission("billing.manage");
  if (status === "sent") {
    // Explicit admin action only; never auto-send.
  }
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const invoice = state.invoices.find((item) => item.id === id);
    if (!invoice) throw new Error("Invoice not found.");
    invoice.status = status;
    invoice.updatedAt = nowIso();
    audit(state, actor.id, status === "sent" ? "invoice_sent" : "invoice_edited", "invoice", id);
  });
  revalidatePath("/billing");
}

export async function exportPayrollCsv(payPeriodId: string) {
  const actor = await requirePermission("payroll.export");
  return mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const period = state.payPeriods.find((item) => item.id === payPeriodId);
    if (!period) throw new Error("Pay period not found.");
    const rows = payrollExportRows({
      profiles: state.profiles,
      entries: state.timeEntries,
      breaks: state.timeBreaks,
      rates: state.payRates,
      adjustments: state.payrollAdjustments,
      timesheets: state.employeeTimesheets,
      period,
      overtimeMultiplier: state.settings.overtimeMultiplier,
      approvedOnly: true,
    });
    const csv = csvFromRows(rows);
    state.payrollExports.unshift({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      payPeriodId,
      format: "csv",
      recordCount: rows.length,
      fileHash: hashCsv(csv),
      createdBy: actor.id,
      createdAt: nowIso(),
    });
    period.status = period.status === "locked" ? "exported" : period.status;
    audit(state, actor.id, "payroll_exported", "pay_period", payPeriodId, { records: rows.length });
    logEvent("info", "payroll_export", { records: rows.length });
    return csv;
  });
}

export async function exportDataset(kind: string) {
  const actor = await requirePermission("exports.manage");
  return mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const map: Record<string, Array<Record<string, unknown>>> = {
      employees: state.profiles.map((profile) =>
        redactExportRecord({
          id: profile.id,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          role: profile.roles[0],
          employeeType: profile.employeeType,
          status: profile.employmentStatus,
        }),
      ),
      facilities: state.facilities.map((item) => redactExportRecord({ ...item })),
      schedules: state.shifts.map((item) =>
        redactExportRecord({ id: item.id, title: item.title, date: item.date, facilityId: item.facilityId ?? "" }),
      ),
      attendance: state.timeEntries.map((item) =>
        redactExportRecord({
          id: item.id,
          userId: item.userId,
          workDate: item.workDate,
          clockInAt: item.clockInAt,
          clockOutAt: item.clockOutAt,
        }),
      ),
      timesheets: state.employeeTimesheets.map((item) => redactExportRecord({ ...item })),
      tasks: state.tasks.map((item) => redactExportRecord({ id: item.id, title: item.title, status: item.status })),
      invoices: actor.permissions.includes("billing.manage")
        ? state.invoices.map((item) => redactExportRecord({ ...item }))
        : [],
      audit: actor.permissions.includes("audit.export")
        ? state.activity.map((item) => redactExportRecord({ ...item }))
        : [],
    };
    if (kind === "audit" && !actor.permissions.includes("audit.export")) {
      throw new Error("Audit export requires authorization.");
    }
    const rows = map[kind];
    if (!rows) throw new Error("Unknown export.");
    audit(state, actor.id, "data_export", "export", kind, { count: rows.length });
    return csvFromRows(
      rows.map((row) => {
        const next: Record<string, string | number> = {};
        for (const [key, value] of Object.entries(row)) {
          next[key] = value == null ? "" : String(value);
        }
        return next;
      }),
    );
  });
}

export async function saveOrganizationProfile(input: {
  organizationAddress?: string;
  organizationPhone?: string;
  organizationEmail?: string;
  weekStartDay?: number;
  defaultLanguage?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  idleSessionMinutes?: number;
  requireReauthSensitive?: boolean;
  chatRetentionDays?: number | null;
  activityRetentionDays?: number | null;
  notificationRetentionDays?: number | null;
}) {
  const actor = await requirePermission("settings.manage");
  await mutateWorkforceState((raw) => {
    Object.assign(raw.settings, input);
    audit(ensurePhase5(raw), actor.id, "security_setting_changed", "settings", "organization");
  });
  revalidatePath("/settings");
}

export async function terminateEmployee(input: { userId: string; mode: "archived" | "terminated" }) {
  const actor = await requirePermission("users.manage");
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const profile = state.profiles.find((item) => item.id === input.userId);
    if (!profile) throw new Error("Employee not found.");
    profile.employmentStatus = input.mode;
    const today = new Date().toISOString().slice(0, 10);
    for (const shift of state.shifts) {
      if (shift.date >= today && shift.instructorIds.includes(profile.id) && shift.status !== "completed") {
        shift.instructorIds = shift.instructorIds.filter((id) => id !== profile.id);
      }
    }
    audit(state, actor.id, input.mode === "terminated" ? "employee_terminated" : "employee_archived", "user", profile.id);
  }, actor.organizationId);
  revalidatePath("/users");
  revalidatePath(`/users/${input.userId}`);
}

export async function assertTimeEditAllowed(user: SessionUser, workDate: string) {
  const state = ensurePhase5(await readWorkforceState());
  if (!canEditTimeRecord({ actorPermissions: user.permissions, periods: state.payPeriods, workDate })) {
    throw new Error("This pay period is locked.");
  }
}

export function facilityOverview(state: Awaited<ReturnType<typeof readWorkforceState>>, facilityId: string, canSeeBilling: boolean) {
  const ready = ensurePhase5(state);
  const facility = ready.facilities.find((item) => item.id === facilityId);
  if (!facility) return null;
  const contacts = ready.facilityContacts.filter((item) => item.facilityId === facilityId);
  const locations = ready.locations.filter((item) => item.facilityId === facilityId);
  const assignments = ready.employeeFacilities.filter((item) => item.facilityId === facilityId);
  const shifts = ready.shifts.filter((item) => item.facilityId === facilityId);
  const rates = canSeeBilling ? ready.facilityBillingRates.filter((item) => item.facilityId === facilityId) : [];
  return { facility, contacts, locations, assignments, shifts, rates };
}

export function marginRows(state: Awaited<ReturnType<typeof readWorkforceState>>, start: string, end: string) {
  const ready = ensurePhase5(state);
  return ready.facilities.map((facility) => {
    const entries = ready.timeEntries.filter((entry) => {
      const shift = ready.shifts.find((item) => item.id === entry.shiftId);
      return Boolean(shift?.facilityId === facility.id && entry.clockOutAt && entry.workDate >= start && entry.workDate <= end);
    });
    let hours = 0;
    let revenue = 0;
    let labor = 0;
    for (const entry of entries) {
      const worked = (new Date(entry.clockOutAt!).getTime() - new Date(entry.clockInAt).getTime()) / 3_600_000;
      const shift = ready.shifts.find((item) => item.id === entry.shiftId);
      const rate = facilityBillingRateForDate(ready.facilityBillingRates, facility.id, entry.workDate, shift?.positionId);
      const pay = ready.profiles.find((item) => item.id === entry.userId)?.hourlyRate ?? 0;
      hours += worked;
      if (rate) {
        const calc = laborMargin({ approvedHours: worked, employeeHourlyRate: pay, facilityHourlyRate: rate.billingRate });
        revenue += calc.revenue;
        labor += calc.laborCost;
      }
    }
    return {
      facility: facility.name,
      hours: Math.round(hours * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      labor: Math.round(labor * 100) / 100,
      margin: Math.round((revenue - labor) * 100) / 100,
      marginPercent: revenue ? Math.round(((revenue - labor) / revenue) * 10000) / 100 : 0,
    };
  });
}

export function searchCatalog(user: SessionUser, state: Awaited<ReturnType<typeof readWorkforceState>>) {
  const ready = ensurePhase5(state);
  const assigned = ready.employeeFacilities.filter((item) => item.userId === user.id).map((item) => item.facilityId);
  const people = isManager(user.roles) ? ready.profiles : ready.profiles.filter((item) => item.id === user.id);
  const items = [
    ...people.map((item) => ({
      id: item.id,
      group: "Employees",
      label: `${item.firstName} ${item.lastName}`,
      href: `/users/${item.id}`,
    })),
    ...ready.facilities
      .filter(() => user.permissions.includes("facilities.view") || isManager(user.roles))
      .map((item) => ({ id: item.id, group: "Facilities", label: item.name, href: `/facilities/${item.id}` })),
    ...ready.shifts.map((item) => ({
      id: item.id,
      group: "Shifts",
      label: `${item.title} ${item.date}`,
      href: "/schedule",
    })),
    ...ready.tasks.map((item) => ({ id: item.id, group: "Tasks", label: item.title, href: "/tasks" })),
    ...ready.forms
      .filter((item) => item.status === "published" || user.permissions.includes("forms.manage"))
      .map((item) => ({ id: item.id, group: "Forms", label: item.title, href: "/forms" })),
    ...visibleArticles(ready.knowledgeBaseArticles, ready.profiles.find((item) => item.id === user.id) ?? ready.profiles[0]).map(
      (item) => ({ id: item.id, group: "Knowledge", label: item.title, href: "/knowledge-base" }),
    ),
    ...ready.invoices
      .filter(() => user.permissions.includes("billing.manage"))
      .map((item) => ({
        id: item.id,
        group: "Invoices",
        label: item.invoiceNumber,
        href: "/billing",
        permission: "billing.manage" as Permission,
      })),
    ...visibleAnnouncements(
      ready.announcements,
      ready.profiles.find((item) => item.id === user.id) ?? ready.profiles[0],
      assigned,
    ).map((item) => ({ id: item.id, group: "Updates", label: item.title, href: "/updates" })),
  ];
  return { items, assigned };
}

export function currentTimesheet(userId: string, sheets: EmployeeTimesheet[], periodId: string) {
  return sheets.find((item) => item.userId === userId && item.payPeriodId === periodId) ?? null;
}

export async function savePolicy(input: { title: string; content: string }) {
  const actor = await requirePermission("knowledge.manage");
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    state.policyDocuments.unshift({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      title: input.title,
      content: input.content,
      version: 1,
      status: "published",
      publishedAt: nowIso(),
      createdBy: actor.id,
      createdAt: nowIso(),
    });
  });
  revalidatePath("/policies");
}

export async function acknowledgePolicy(policyId: string, userAgent?: string | null) {
  const user = await requireSession();
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const policy = state.policyDocuments.find((item) => item.id === policyId);
    if (!policy) throw new Error("Policy not found.");
    const existing = state.policyAcknowledgements.find(
      (item) => item.policyId === policyId && item.userId === user.id && item.policyVersion === policy.version,
    );
    const evidence = createSignatureEvidence({
      signerId: user.id,
      method: "typed",
      userAgent,
      version: policy.version,
      consentText: `I acknowledge policy "${policy.title}" version ${policy.version}.`,
    });
    if (existing) {
      existing.viewedAt = existing.viewedAt ?? nowIso();
      existing.acknowledgedAt = nowIso();
      existing.signature = evidence;
    } else {
      state.policyAcknowledgements.unshift({
        id: crypto.randomUUID(),
        organizationId: user.organizationId,
        policyId,
        userId: user.id,
        policyVersion: policy.version,
        viewedAt: nowIso(),
        acknowledgedAt: nowIso(),
        signature: evidence,
      });
    }
    audit(state, user.id, "policy_acknowledged", "policy", policyId, { version: policy.version });
  });
  revalidatePath("/policies");
}

export async function saveCustomField(input: {
  name: string;
  fieldType: "text" | "number" | "date" | "dropdown" | "checkbox" | "yes_no";
  entityType?: "user" | "facility";
}) {
  const actor = await requirePermission("settings.manage");
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    state.customFieldDefinitions.unshift({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      entityType: input.entityType ?? "user",
      name: input.name,
      fieldType: input.fieldType,
      options: null,
      required: false,
    });
  });
  revalidatePath("/settings");
}

export async function saveTag(name: string) {
  const actor = await requirePermission("settings.manage");
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    state.tags.unshift({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      name,
      color: "#0D2A43",
    });
  });
  revalidatePath("/settings");
}

export async function saveSavedView(input: { module: SavedView["module"]; name: string; filters: Record<string, string> }) {
  const user = await requireSession();
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    state.savedViews.unshift({
      id: crypto.randomUUID(),
      organizationId: user.organizationId,
      userId: user.id,
      module: input.module,
      name: input.name,
      filters: input.filters,
      sortConfig: null,
      isDefault: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  });
  revalidatePath("/settings");
}

export async function saveDashboardPreference(hiddenWidgets: string[]) {
  const user = await requireSession();
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const existing = state.dashboardPreferences.find((item) => item.userId === user.id);
    if (existing) {
      existing.hiddenWidgets = hiddenWidgets;
    } else {
      state.dashboardPreferences.push({
        id: crypto.randomUUID(),
        userId: user.id,
        hiddenWidgets,
        widgetOrder: [],
        activityEmailInstructorIds: [],
      });
    }
  }, user.organizationId);
  revalidatePath("/dashboard");
}

export async function saveActivityEmailInstructors(instructorIds: string[]) {
  const user = await requirePermission("users.read");
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new Error("Only admins can choose instructor activity emails.");
  }
  const requested = new Set(instructorIds.filter((id) => typeof id === "string" && id.length > 0));
  await mutateWorkforceState((raw) => {
    const state = ensurePhase5(raw);
    const validIds = state.profiles
      .filter(
        (profile) =>
          profile.employeeType === "instructor" &&
          profile.employmentStatus === "active" &&
          requested.has(profile.id),
      )
      .map((profile) => profile.id);
    const selected = new Set(validIds);
    for (const profile of state.profiles) {
      if (profile.employeeType !== "instructor") continue;
      profile.screenCaptureEnabled = selected.has(profile.id);
    }
  }, user.organizationId);
  revalidatePath("/dashboard");
  revalidatePath("/users");
}
