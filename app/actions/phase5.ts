"use server";

import { rateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { withSessionOrganization } from "@/lib/auth/session";
import {
  acknowledgeAnnouncement,
  addFacilityLocation,
  addFormField,
  addOnboardingItem,
  addPayrollAdjustment,
  assignEmployeeFacility,
  assignOnboarding,
  assignTraining,
  completeOnboardingItem,
  completeTraining,
  exportDataset,
  exportPayrollCsv,
  generateInvoiceDraft,
  lockPayPeriod,
  reviewTimesheet,
  saveAnnouncement,
  saveArticle,
  saveBillingRate,
  saveFacility,
  saveFacilityContact,
  saveForm,
  saveOnboardingTemplate,
  saveOrganizationProfile,
  saveTraining,
  setInvoiceStatus,
  submitForm,
  submitTimesheet,
  terminateEmployee,
  unlockPayPeriod,
  savePolicy,
  acknowledgePolicy,
  saveCustomField,
  saveTag,
  saveSavedView,
  saveDashboardPreference,
} from "@/lib/db/phase5";

async function limited(key: string, limit = 30) {
  const result = await rateLimit(key, limit);
  if (!result.success) throw new Error(RATE_LIMIT_MESSAGE);
}

export async function saveFacilityAction(input: unknown) {
  await limited("facility");
  return saveFacility(input);
}

export async function saveFacilityContactAction(input: unknown) {
  return saveFacilityContact(input);
}

export async function addFacilityLocationAction(input: unknown) {
  return addFacilityLocation(input);
}

export async function assignEmployeeFacilityAction(input: { userId: string; facilityId: string; isPrimary?: boolean }) {
  return assignEmployeeFacility(input);
}

export async function saveBillingRateAction(input: unknown) {
  return saveBillingRate(input);
}

export async function saveOnboardingTemplateAction(input: unknown) {
  return saveOnboardingTemplate(input);
}

export async function addOnboardingItemAction(input: unknown) {
  return addOnboardingItem(input);
}

export async function assignOnboardingAction(input: { userId: string; templateId: string }) {
  return assignOnboarding(input);
}

export async function completeOnboardingItemAction(input: { itemId: string; notes?: string }) {
  return completeOnboardingItem(input);
}

export async function saveFormAction(input: unknown) {
  return saveForm(input);
}

export async function addFormFieldAction(input: unknown) {
  return addFormField(input);
}

export async function submitFormAction(input: {
  formId: string;
  values: Record<string, unknown>;
  signatureMethod?: "drawn" | "typed";
  userAgent?: string | null;
}) {
  await limited("form-submit", 20);
  return submitForm(input);
}

export async function saveAnnouncementAction(input: unknown) {
  return saveAnnouncement(input);
}

export async function acknowledgeAnnouncementAction(id: string) {
  return acknowledgeAnnouncement(id);
}

export async function saveArticleAction(input: unknown) {
  return saveArticle(input);
}

export async function saveTrainingAction(input: unknown) {
  return saveTraining(input);
}

export async function assignTrainingAction(input: { resourceId: string; userId: string }) {
  return assignTraining(input);
}

export async function completeTrainingAction(id: string) {
  return completeTraining(id);
}

export async function submitTimesheetAction(payPeriodId: string) {
  return submitTimesheet(payPeriodId);
}

export async function reviewTimesheetAction(input: { timesheetId: string; decision: "approve" | "reject"; reason?: string }) {
  return reviewTimesheet(input);
}

export async function lockPayPeriodAction(payPeriodId: string) {
  return lockPayPeriod(payPeriodId);
}

export async function unlockPayPeriodAction(input: unknown) {
  return unlockPayPeriod(input);
}

export async function addPayrollAdjustmentAction(input: unknown) {
  return addPayrollAdjustment(input);
}

export async function generateInvoiceDraftAction(input: unknown) {
  await limited("invoice");
  return generateInvoiceDraft(input);
}

export async function setInvoiceStatusAction(id: string, status: "draft" | "review" | "approved" | "sent" | "paid" | "void") {
  return setInvoiceStatus(id, status);
}

export async function exportPayrollCsvAction(payPeriodId: string) {
  await limited("export", 10);
  return exportPayrollCsv(payPeriodId);
}

export async function exportDatasetAction(kind: string) {
  await limited("export", 10);
  return exportDataset(kind);
}

export async function saveOrganizationProfileAction(input: Parameters<typeof saveOrganizationProfile>[0]) {
  return saveOrganizationProfile(input);
}

export async function terminateEmployeeAction(input: { userId: string; mode: "archived" | "terminated" }) {
  try {
    await withSessionOrganization(() => terminateEmployee(input));
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Unable to update employee." };
  }
}

export async function savePolicyAction(input: { title: string; content: string }) {
  return savePolicy(input);
}

export async function acknowledgePolicyAction(policyId: string, userAgent?: string | null) {
  return acknowledgePolicy(policyId, userAgent);
}

export async function saveCustomFieldAction(input: {
  name: string;
  fieldType: "text" | "number" | "date" | "dropdown" | "checkbox" | "yes_no";
}) {
  return saveCustomField(input);
}

export async function saveTagAction(name: string) {
  return saveTag(name);
}

export async function saveSavedViewAction(input: { module: "users" | "schedule" | "attendance" | "timesheets" | "tasks" | "reports"; name: string; filters: Record<string, string> }) {
  return saveSavedView(input);
}

export async function saveDashboardPreferenceAction(hiddenWidgets: string[]) {
  return saveDashboardPreference(hiddenWidgets);
}
