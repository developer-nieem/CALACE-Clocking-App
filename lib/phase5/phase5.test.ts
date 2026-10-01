import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  adminCannotSignAsEmployee,
  allowedSensitiveExport,
  canEditTimeRecord,
  createSignatureEvidence,
  employeeCanClockIn,
  employeeIsSchedulable,
  facilityBillingRateForDate,
  invoiceLineFromHours,
  laborMargin,
  nextInvoiceNumber,
  onboardingProgress,
  payrollExportRows,
  redactExportRecord,
  validateFormValues,
  validateUpload,
  visibleAnnouncements,
  visibleArticles,
} from "@/lib/phase5/domain";
import type {
  Announcement,
  EmployeeOnboardingItem,
  EmployeePayRate,
  EmployeeTimesheet,
  FacilityBillingRate,
  FormField,
  KnowledgeBaseArticle,
  OnboardingTemplateItem,
  PayPeriod,
  Profile,
  TimeBreak,
  TimeEntry,
} from "@/types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "emp-1",
    organizationId: "org-1",
    email: "staff@calace.team",
    firstName: "Sam",
    lastName: "Lee",
    phone: null,
    avatarUrl: null,
    employeeType: "staff",
    positionId: "pos-1",
    departmentId: "dep-1",
    primaryLocationId: "loc-1",
    employmentStatus: "active",
    hireDate: "2026-01-01",
    payType: "hourly",
    hourlyRate: 25,
    weeklyTargetHours: 40,
    maximumWeeklyHours: 40,
    defaultWeeklyHours: 40,
    maxWeeklyHours: 40,
    lastActiveAt: null,
    qualifications: [],
    locationIds: ["loc-1"],
    roles: ["staff"],
    ...overrides,
  };
}

describe("facility billing vs employee pay", () => {
  it("keeps employee pay, client billing, and margin separate", () => {
    const result = laborMargin({
      approvedHours: 8,
      employeeHourlyRate: 25,
      facilityHourlyRate: 40,
    });
    expect(result.laborCost).toBe(200);
    expect(result.revenue).toBe(320);
    expect(result.margin).toBe(120);
  });

  it("uses the historical facility rate for the service date", () => {
    const rates: FacilityBillingRate[] = [
      {
        id: "r1",
        organizationId: "org-1",
        facilityId: "fac-1",
        positionId: null,
        qualificationId: null,
        billingRate: 40,
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-06-30",
        createdBy: "admin",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "r2",
        organizationId: "org-1",
        facilityId: "fac-1",
        positionId: null,
        qualificationId: null,
        billingRate: 45,
        effectiveFrom: "2026-07-01",
        effectiveTo: null,
        createdBy: "admin",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ];
    expect(facilityBillingRateForDate(rates, "fac-1", "2026-06-15")?.billingRate).toBe(40);
    expect(facilityBillingRateForDate(rates, "fac-1", "2026-07-15")?.billingRate).toBe(45);
    const june = invoiceLineFromHours({
      hours: 8,
      rate: facilityBillingRateForDate(rates, "fac-1", "2026-06-15")!.billingRate,
      description: "June labor",
      serviceDate: "2026-06-15",
    });
    expect(june.amount).toBe(320);
  });
});

describe("onboarding and forms", () => {
  it("tracks required onboarding progress without auto-complete", () => {
    const templateItems: OnboardingTemplateItem[] = [
      {
        id: "i1",
        organizationId: "org-1",
        templateId: "t1",
        title: "Upload ID",
        description: null,
        itemType: "document_upload",
        isRequired: true,
        sortOrder: 1,
        dueDaysAfterStart: 3,
      },
      {
        id: "i2",
        organizationId: "org-1",
        templateId: "t1",
        title: "Optional tour",
        description: null,
        itemType: "task",
        isRequired: false,
        sortOrder: 2,
        dueDaysAfterStart: null,
      },
    ];
    const items: EmployeeOnboardingItem[] = [
      {
        id: "e1",
        organizationId: "org-1",
        employeeOnboardingId: "eo1",
        templateItemId: "i1",
        status: "complete",
        completedAt: "2026-01-02T00:00:00.000Z",
        completedBy: "emp-1",
        notes: null,
      },
    ];
    const progress = onboardingProgress(items, templateItems);
    expect(progress.complete).toBe(1);
    expect(progress.total).toBe(2);
    expect(progress.percent).toBe(50);
    expect(progress.completeEnough).toBe(true);
  });

  it("rejects unpublished required form fields", () => {
    const fields: FormField[] = [
      {
        id: "f1",
        organizationId: "org-1",
        formId: "form-1",
        fieldType: "short_text",
        label: "Incident",
        description: null,
        required: true,
        options: null,
        sortOrder: 1,
      },
    ];
    expect(validateFormValues(fields, {})).toEqual(["Incident is required."]);
    expect(validateFormValues(fields, { f1: "Late arrival" })).toEqual([]);
  });

  it("records signature evidence for the authenticated signer only", () => {
    const evidence = createSignatureEvidence({
      signerId: "emp-1",
      method: "typed",
      version: 1,
      consentText: "I acknowledge this policy.",
      userAgent: "TestAgent",
    });
    expect(evidence.signedByUserId).toBe("emp-1");
    expect(evidence.consentText).toContain("acknowledge");
    expect(adminCannotSignAsEmployee("admin-1", "emp-1")).toBe(false);
    expect(adminCannotSignAsEmployee("emp-1", "emp-1")).toBe(true);
  });
});

describe("announcements and knowledge base", () => {
  it("hides instructor-only announcements from staff", () => {
    const announcement: Announcement = {
      id: "a1",
      organizationId: "org-1",
      title: "Instructor huddle",
      message: "Meet at 8.",
      audienceKind: "instructors",
      audienceValue: null,
      publishAt: "2026-01-01T00:00:00.000Z",
      expiresAt: null,
      priority: "normal",
      requireAcknowledgement: true,
      createdBy: "admin",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const staff = visibleAnnouncements([announcement], profile());
    const instructor = visibleAnnouncements(
      [announcement],
      profile({ employeeType: "instructor", roles: ["instructor"] }),
    );
    expect(staff).toHaveLength(0);
    expect(instructor).toHaveLength(1);
  });

  it("filters knowledge articles by audience", () => {
    const article: KnowledgeBaseArticle = {
      id: "k1",
      organizationId: "org-1",
      categoryId: "hr",
      title: "Staff handbook",
      summary: "Staff only",
      content: "Private",
      audienceKind: "staff",
      audienceValue: null,
      status: "published",
      publishedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "admin",
    };
    expect(visibleArticles([article], profile())).toHaveLength(1);
    expect(
      visibleArticles([article], profile({ employeeType: "instructor", roles: ["instructor"] })),
    ).toHaveLength(0);
  });
});

describe("payroll lock and exports", () => {
  const period: PayPeriod = {
    id: "p1",
    organizationId: "org-1",
    startDate: "2026-01-05",
    endDate: "2026-01-11",
    status: "locked",
    lockedAt: "2026-01-12T00:00:00.000Z",
    lockedBy: "admin",
    createdAt: "2026-01-05T00:00:00.000Z",
    updatedAt: "2026-01-12T00:00:00.000Z",
  };

  it("blocks locked period edits unless the actor can unlock", () => {
    expect(canEditTimeRecord({ actorPermissions: ROLE_PERMISSIONS.staff, periods: [period], workDate: "2026-01-06" })).toBe(
      false,
    );
    expect(
      canEditTimeRecord({ actorPermissions: ROLE_PERMISSIONS.admin, periods: [period], workDate: "2026-01-06" }),
    ).toBe(true);
  });

  it("exports approved hours and adjustments", () => {
    const entries: TimeEntry[] = [
      {
        id: "te1",
        organizationId: "org-1",
        userId: "emp-1",
        shiftId: null,
        workDate: "2026-01-06",
        clockInAt: "2026-01-06T16:00:00.000Z",
        clockOutAt: "2026-01-07T00:00:00.000Z",
        clockInLatitude: null,
        clockInLongitude: null,
        clockInAccuracy: null,
        clockOutLatitude: null,
        clockOutLongitude: null,
        clockOutAccuracy: null,
        clockInLocationId: null,
        clockOutLocationId: null,
        clockInDistanceMeters: null,
        clockOutDistanceMeters: null,
        clockInGeofenceStatus: "not_required",
        clockOutGeofenceStatus: "not_required",
        status: "completed",
        clockStatus: "on_time",
        payRateSnapshot: 25,
        notes: null,
        createdAt: "2026-01-06T16:00:00.000Z",
        updatedAt: "2026-01-07T00:00:00.000Z",
      },
    ];
    const breaks: TimeBreak[] = [];
    const rates: EmployeePayRate[] = [
      {
        id: "pr1",
        organizationId: "org-1",
        userId: "emp-1",
        hourlyRate: 25,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        createdBy: "admin",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const timesheets: EmployeeTimesheet[] = [
      {
        id: "ts1",
        organizationId: "org-1",
        userId: "emp-1",
        payPeriodId: "p1",
        status: "approved",
        submittedAt: "2026-01-11T00:00:00.000Z",
        reviewedBy: "admin",
        reviewedAt: "2026-01-12T00:00:00.000Z",
        rejectionReason: null,
        createdAt: "2026-01-05T00:00:00.000Z",
        updatedAt: "2026-01-12T00:00:00.000Z",
      },
    ];
    const rows = payrollExportRows({
      profiles: [profile()],
      entries,
      breaks,
      rates,
      adjustments: [
        {
          id: "adj1",
          organizationId: "org-1",
          userId: "emp-1",
          payPeriodId: "p1",
          adjustmentType: "bonus",
          amount: 20,
          hours: null,
          description: "Coverage bonus",
          createdBy: "admin",
          createdAt: "2026-01-12T00:00:00.000Z",
        },
      ],
      timesheets,
      period: { ...period, status: "approved" },
      overtimeMultiplier: 1.5,
      approvedOnly: true,
    });
    expect(rows[0]["Regular Hours"]).toBe(8);
    expect(rows[0]["Estimated Gross"]).toBe(220);
  });

  it("redacts secrets from data export", () => {
    const redacted = redactExportRecord({
      email: "a@calace.team",
      passwordHash: "secret",
      apiKey: "abc",
      refreshToken: "tok",
      firstName: "Sam",
    });
    expect(redacted).toEqual({ email: "a@calace.team", firstName: "Sam" });
    expect(allowedSensitiveExport(ROLE_PERMISSIONS.staff, "audit")).toBe(false);
    expect(allowedSensitiveExport(ROLE_PERMISSIONS.admin, "audit")).toBe(true);
  });
});

describe("employment status and security", () => {
  it("blocks scheduling and clock-in after archive or termination", () => {
    expect(employeeIsSchedulable(profile({ employmentStatus: "archived" }))).toBe(false);
    expect(employeeCanClockIn(profile({ employmentStatus: "terminated" }))).toBe(false);
    expect(employeeCanClockIn(profile())).toBe(true);
  });

  it("rejects unsafe uploads and keeps scheduler off billing", () => {
    expect(validateUpload({ fileName: "../secret.env", mimeType: "text/plain", sizeBytes: 10 })).toBe(
      "Unsupported file type.",
    );
    expect(validateUpload({ fileName: "id.pdf", mimeType: "application/pdf", sizeBytes: 1000 })).toBeNull();
    expect(ROLE_PERMISSIONS.scheduler.includes("facility_billing.view")).toBe(false);
    expect(ROLE_PERMISSIONS.scheduler.includes("payroll.view")).toBe(false);
    expect(ROLE_PERMISSIONS.staff.includes("pay.manage")).toBe(false);
    expect(nextInvoiceNumber([], 2026)).toBe("INV-2026-0001");
    expect(nextInvoiceNumber([{ invoiceNumber: "INV-2026-0001" } as never], 2026)).toBe("INV-2026-0002");
  });
});
