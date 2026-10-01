import { createHash } from "node:crypto";
import { payRateForDate } from "@/lib/time-clock/calculations";
import { roundHours, roundMoney } from "@/lib/money";
import type { Permission } from "@/lib/permissions";
import type {
  Announcement,
  AudienceKind,
  EmployeeOnboardingItem,
  EmployeePayRate,
  EmployeeTimesheet,
  FacilityBillingRate,
  FormField,
  Invoice,
  KnowledgeBaseArticle,
  OnboardingTemplateItem,
  PayPeriod,
  PayrollAdjustment,
  Phase5Collections,
  Profile,
  SignatureEvidence,
  TimeBreak,
  TimeEntry,
} from "@/types";

export const PHASE5_KB_CATEGORIES = [
  ["policies", "Policies"],
  ["training", "Training"],
  ["how-to", "How-To"],
  ["scheduling", "Scheduling"],
  ["time-clock", "Time Clock"],
  ["clinical", "Clinical Resources"],
  ["hr", "HR"],
  ["other", "Other"],
] as const;

export function facilityBillingRateForDate(
  rates: FacilityBillingRate[],
  facilityId: string,
  date: string,
  positionId?: string | null,
) {
  const applicable = rates
    .filter(
      (rate) =>
        rate.facilityId === facilityId &&
        rate.effectiveFrom <= date &&
        (!rate.effectiveTo || rate.effectiveTo >= date) &&
        (!rate.positionId || rate.positionId === positionId),
    )
    .sort((left, right) => {
      if (left.positionId && !right.positionId) return -1;
      if (!left.positionId && right.positionId) return 1;
      return right.effectiveFrom.localeCompare(left.effectiveFrom);
    });
  return applicable[0] ?? null;
}

export function laborMargin(input: {
  approvedHours: number;
  employeeHourlyRate: number;
  facilityHourlyRate: number;
}) {
  const laborCost = roundMoney(input.approvedHours * input.employeeHourlyRate);
  const revenue = roundMoney(input.approvedHours * input.facilityHourlyRate);
  return {
    laborCost,
    revenue,
    margin: roundMoney(revenue - laborCost),
    marginPercent: revenue === 0 ? 0 : roundMoney(((revenue - laborCost) / revenue) * 100),
  };
}

export function onboardingProgress(items: EmployeeOnboardingItem[], templateItems: OnboardingTemplateItem[]) {
  const required = templateItems.filter((item) => item.isRequired);
  const requiredIds = new Set(required.map((item) => item.id));
  const completeRequired = items.filter(
    (item) => item.status === "complete" && requiredIds.has(item.templateItemId),
  ).length;
  const complete = items.filter((item) => item.status === "complete").length;
  const total = templateItems.length;
  const percent = total === 0 ? 0 : Math.round((complete / total) * 100);
  const missing = templateItems.filter(
    (item) => !items.some((row) => row.templateItemId === item.id && row.status === "complete"),
  );
  return {
    complete,
    total,
    percent,
    requiredComplete: completeRequired,
    requiredTotal: required.length,
    missing,
    completeEnough: required.every((item) =>
      items.some((row) => row.templateItemId === item.id && row.status === "complete"),
    ),
  };
}

export function canCompleteOnboardingItem(input: {
  itemType: OnboardingTemplateItem["itemType"];
  requirementMet: boolean;
}) {
  return input.requirementMet;
}

export function validateFormValues(fields: FormField[], values: Record<string, unknown>) {
  const errors: string[] = [];
  for (const field of fields) {
    if (field.fieldType === "section_heading") continue;
    const value = values[field.id];
    if (field.required && isEmptyValue(value)) {
      errors.push(`${field.label} is required.`);
    }
  }
  return errors;
}

function isEmptyValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function createSignatureEvidence(input: {
  signerId: string;
  method: "drawn" | "typed";
  userAgent?: string | null;
  ipAddress?: string | null;
  version: number;
  consentText: string;
}): SignatureEvidence {
  return {
    signedByUserId: input.signerId,
    signatureMethod: input.method,
    signedAt: new Date().toISOString(),
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    documentVersion: input.version,
    consentText: input.consentText,
  };
}

export function adminCannotSignAsEmployee(actorId: string, signerId: string) {
  return actorId === signerId;
}

export function audienceMatches(
  audience: { audienceKind: AudienceKind; audienceValue: string | null },
  profile: Profile,
  assignedFacilityIds: string[] = [],
) {
  switch (audience.audienceKind) {
    case "everyone":
      return true;
    case "instructors":
      return profile.employeeType === "instructor";
    case "staff":
      return profile.employeeType === "staff";
    case "role":
      return Boolean(audience.audienceValue && profile.roles.includes(audience.audienceValue as Profile["roles"][number]));
    case "department":
      return profile.departmentId === audience.audienceValue;
    case "location":
      return (
        profile.primaryLocationId === audience.audienceValue ||
        profile.locationIds.includes(audience.audienceValue ?? "")
      );
    case "facility":
      return Boolean(audience.audienceValue && assignedFacilityIds.includes(audience.audienceValue));
    case "employees":
      return Boolean(audience.audienceValue?.split(",").includes(profile.id));
    default:
      return false;
  }
}

export function visibleAnnouncements(
  announcements: Announcement[],
  profile: Profile,
  assignedFacilityIds: string[] = [],
  now = new Date().toISOString(),
) {
  return announcements.filter(
    (item) =>
      item.publishAt <= now &&
      (!item.expiresAt || item.expiresAt >= now) &&
      audienceMatches(item, profile, assignedFacilityIds),
  );
}

export function visibleArticles(articles: KnowledgeBaseArticle[], profile: Profile) {
  return articles.filter(
    (article) => article.status === "published" && audienceMatches(article, profile),
  );
}

export function payPeriodContains(period: PayPeriod, date: string) {
  return period.startDate <= date && period.endDate >= date;
}

export function isPayPeriodLocked(periods: PayPeriod[], date: string) {
  return periods.some((period) => period.status === "locked" && payPeriodContains(period, date));
}

export function canEditTimeRecord(input: {
  actorPermissions: Permission[];
  periods: PayPeriod[];
  workDate: string;
}) {
  if (!isPayPeriodLocked(input.periods, input.workDate)) return true;
  return input.actorPermissions.includes("payroll.lock");
}

export function nextInvoiceNumber(existing: Invoice[], year: number) {
  const prefix = `INV-${year}-`;
  const max = existing
    .filter((invoice) => invoice.invoiceNumber.startsWith(prefix))
    .map((invoice) => Number(invoice.invoiceNumber.slice(prefix.length)))
    .filter((value) => Number.isFinite(value))
    .reduce((highest, value) => Math.max(highest, value), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export function redactExportRecord(record: Record<string, unknown>) {
  const blocked = [
    "password",
    "passwordHash",
    "password_hash",
    "token",
    "accessToken",
    "refreshToken",
    "oauth",
    "apiKey",
    "api_key",
    "secret",
    "clientSecret",
    "client_secret",
    "storageUrl",
    "signedUrl",
  ];
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (blocked.some((name) => key.toLowerCase().includes(name.toLowerCase()))) continue;
    copy[key] = value;
  }
  return copy;
}

export function csvFromRows(rows: Array<Record<string, string | number>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header] ?? "")).join(","))].join(
    "\n",
  );
}

export function hashCsv(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export function payrollExportRows(input: {
  profiles: Profile[];
  entries: TimeEntry[];
  breaks: TimeBreak[];
  rates: EmployeePayRate[];
  adjustments: PayrollAdjustment[];
  timesheets: EmployeeTimesheet[];
  period: PayPeriod;
  overtimeMultiplier: number;
  approvedOnly: boolean;
}) {
  const rows = input.profiles
    .filter((profile) => profile.employmentStatus !== "invited")
    .map((profile) => {
      const timesheet = input.timesheets.find(
        (item) => item.userId === profile.id && item.payPeriodId === input.period.id,
      );
      if (input.approvedOnly && timesheet && !["approved", "locked", "exported"].includes(timesheet.status)) {
        return null;
      }
      const periodEntries = input.entries.filter(
        (entry) =>
          entry.userId === profile.id &&
          entry.workDate >= input.period.startDate &&
          entry.workDate <= input.period.endDate &&
          entry.clockOutAt,
      );
      let regularHours = 0;
      let overtimeHours = 0;
      let regularPay = 0;
      let overtimePay = 0;
      for (const entry of periodEntries) {
        const breakSeconds = input.breaks
          .filter((item) => item.timeEntryId === entry.id && item.breakEndAt)
          .reduce((sum, item) => sum + (new Date(item.breakEndAt!).getTime() - new Date(item.breakStartAt).getTime()) / 1000, 0);
        const workedHours = Math.max(
          0,
          (new Date(entry.clockOutAt!).getTime() - new Date(entry.clockInAt).getTime()) / 3_600_000 - breakSeconds / 3600,
        );
        const rate = payRateForDate(input.rates, profile.id, entry.workDate) ?? profile.hourlyRate ?? 0;
        const ot = Math.max(0, workedHours - 8);
        const regular = workedHours - ot;
        regularHours += regular;
        overtimeHours += ot;
        regularPay += regular * rate;
        overtimePay += ot * rate * input.overtimeMultiplier;
      }
      const adjustments = input.adjustments
        .filter((item) => item.userId === profile.id && item.payPeriodId === input.period.id)
        .reduce((sum, item) => sum + item.amount, 0);
      return {
        Employee: `${profile.firstName} ${profile.lastName}`,
        "Employee ID": profile.id,
        "Pay Period": `${input.period.startDate} – ${input.period.endDate}`,
        "Regular Hours": roundHours(regularHours),
        "Overtime Hours": roundHours(overtimeHours),
        "Hourly Rate": profile.hourlyRate ?? 0,
        "Regular Pay": roundMoney(regularPay),
        "Overtime Pay": roundMoney(overtimePay),
        Adjustments: roundMoney(adjustments),
        "Estimated Gross": roundMoney(regularPay + overtimePay + adjustments),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  return rows;
}

export function invoiceLineFromHours(input: {
  hours: number;
  rate: number;
  description: string;
  serviceDate: string;
  userId?: string | null;
  shiftId?: string | null;
}) {
  return {
    description: input.description,
    serviceDate: input.serviceDate,
    hours: roundHours(input.hours),
    rate: roundMoney(input.rate),
    amount: roundMoney(input.hours * input.rate),
    userId: input.userId ?? null,
    shiftId: input.shiftId ?? null,
  };
}

export function searchIndex(query: string, items: Array<{ id: string; group: string; label: string; href: string; permission?: Permission }>, permissions: Permission[]) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return items
    .filter((item) => item.label.toLowerCase().includes(q))
    .filter((item) => !item.permission || permissions.includes(item.permission) || permissions.includes("users.manage"))
    .slice(0, 16);
}

export function allowedSensitiveExport(permissions: Permission[], kind: string) {
  if (kind === "audit") return permissions.includes("audit.export") || permissions.includes("security.manage");
  if (kind === "payroll" || kind === "invoices") {
    return permissions.includes("payroll.export") || permissions.includes("exports.manage");
  }
  return permissions.includes("exports.manage") || permissions.includes("settings.manage");
}

export function employeeIsSchedulable(profile: Profile) {
  return profile.employmentStatus === "active";
}

export function employeeCanClockIn(profile: Profile) {
  return profile.employmentStatus === "active";
}

export function validateUpload(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  allowedExt?: string[];
  maxBytes?: number;
}) {
  const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  const allowed = input.allowedExt ?? ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx"];
  const maxBytes = input.maxBytes ?? 10 * 1024 * 1024;
  if (!allowed.includes(ext)) return "Unsupported file type.";
  if (input.sizeBytes > maxBytes) return "File is too large.";
  if (input.fileName.includes("..") || input.fileName.includes("/") || input.fileName.includes("\\")) {
    return "Unsafe file name.";
  }
  return null;
}

export function emptyPhase5(): Phase5Collections {
  return {
    facilities: [],
    facilityContacts: [],
    employeeFacilities: [],
    facilityBillingRates: [],
    onboardingTemplates: [],
    onboardingTemplateItems: [],
    employeeOnboarding: [],
    employeeOnboardingItems: [],
    forms: [],
    formFields: [],
    formSubmissions: [],
    formSubmissionValues: [],
    policyDocuments: [],
    policyAcknowledgements: [],
    announcements: [],
    announcementAcknowledgements: [],
    knowledgeBaseCategories: PHASE5_KB_CATEGORIES.map(([slug, name]) => ({
      id: slug,
      organizationId: "00000000-0000-0000-0000-000000000001",
      name,
      slug,
    })),
    knowledgeBaseArticles: [],
    knowledgeBaseAttachments: [],
    trainingResources: [],
    trainingAssignments: [],
    payPeriods: [],
    payrollAdjustments: [],
    employeeTimesheets: [],
    invoices: [],
    invoiceItems: [],
    payrollExports: [],
    savedViews: [],
    customFieldDefinitions: [],
    customFieldValues: [],
    tags: [],
    entityTags: [],
    employeeAdminNotes: [],
    dashboardPreferences: [],
  };
}
