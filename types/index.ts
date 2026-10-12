import type { AppRole, Permission } from "@/lib/permissions";

export type { AppRole, Permission };

export type UserStatus = "active" | "invited" | "inactive" | "terminated" | "archived";
export type EmployeeType = "instructor" | "staff";
export type PayType = "hourly" | "salary";
export type GeofenceEnforcement = "strict" | "warning" | "disabled";
export type GeofenceStatus =
  | "verified"
  | "outside_geofence"
  | "unavailable"
  | "not_required";
export type TimeEntryStatus = "working" | "on_break" | "completed" | "edited";
export type ClockStatus =
  | "on_time"
  | "early"
  | "late"
  | "unscheduled"
  | "outside_geofence"
  | "missing_clock_out"
  | "admin_edited";
export type ShiftStatus = "draft" | "published" | "completed" | "cancelled";
export type AttendanceStatus =
  | "scheduled"
  | "clocked_in"
  | "completed"
  | "late"
  | "absent"
  | "on_break";
export type TimeOffStatus = "pending" | "approved" | "rejected" | "cancelled";
export type TradeStatus = "pending" | "approved" | "rejected" | "cancelled";
export type TimesheetStatus =
  | "open"
  | "submitted"
  | "approved"
  | "rejected"
  | "payroll_exported";
export type AvailabilityStatus = "available" | "unavailable" | "preferred";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";

export type Location = {
  id: string;
  name: string;
  address?: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
  geolocationRequired: boolean;
  status: "active" | "inactive";
  facilityId?: string | null;
};

export type Department = {
  id: string;
  name: string;
};

export type Position = {
  id: string;
  name: string;
};

export type Qualification = {
  id: string;
  name: string;
  slug: string;
};

export type QualificationRecord = {
  qualificationId: string;
  issuedDate: string | null;
  expirationDate: string | null;
  credentialNumber: string | null;
  notes: string | null;
};

export type Profile = {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  employeeType: EmployeeType;
  positionId: string | null;
  departmentId: string | null;
  primaryLocationId: string | null;
  employmentStatus: UserStatus;
  hireDate: string | null;
  payType: PayType;
  hourlyRate: number | null;
  weeklyTargetHours: number | null;
  maximumWeeklyHours: number | null;
  /** Compatibility aliases for scheduling code. */
  defaultWeeklyHours: number;
  maxWeeklyHours: number;
  lastActiveAt: string | null;
  qualifications: string[];
  qualificationRecords?: QualificationRecord[];
  locationIds: string[];
  roles: AppRole[];
};

export type Shift = {
  id: string;
  organizationId: string;
  templateId: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  locationId: string | null;
  facilityId?: string | null;
  departmentId: string | null;
  classCohort: string | null;
  positionId: string | null;
  color: string;
  breakDurationMinutes: number;
  notes: string | null;
  status: ShiftStatus;
  isOpen: boolean;
  requiredInstructors: number;
  approvalRequired: boolean;
  instructorIds: string[];
  tasks: string[];
  qualificationIds?: string[];
  seriesId?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  claimDeadline?: string | null;
  eligibleEmployeeTypes?: EmployeeType[];
};

export type ShiftTemplate = {
  id: string;
  name: string;
  title: string;
  startTime: string;
  endTime: string;
  locationId: string | null;
  departmentId: string | null;
  classCohort: string | null;
  color: string;
  requiredInstructors: number;
};

export type AvailabilityRule = {
  id: string;
  userId: string;
  weekday: number;
  status: AvailabilityStatus;
  startTime: string | null;
  endTime: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export type AvailabilityException = {
  id: string;
  userId: string;
  date: string;
  status: AvailabilityStatus;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
};

export type ShiftSeries = {
  id: string;
  title: string;
  recurrenceType: "daily" | "weekly" | "weekdays";
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string | null;
  occurrenceCount: number | null;
  locationId: string | null;
  departmentId: string | null;
  qualificationIds: string[];
  requiredInstructors: number;
  breakDurationMinutes: number;
  createdBy: string | null;
};

export type TimeOffRequest = {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  isPartialDay: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  notes: string | null;
  status: TimeOffStatus;
  requestType?: "vacation" | "sick" | "personal" | "training" | "other";
  reviewedBy?: string | null;
  reviewNotes?: string | null;
};

export type TimeEntry = {
  id: string;
  organizationId: string;
  userId: string;
  shiftId: string | null;
  workDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  clockInLatitude: number | null;
  clockInLongitude: number | null;
  clockInAccuracy: number | null;
  clockOutLatitude: number | null;
  clockOutLongitude: number | null;
  clockOutAccuracy: number | null;
  clockInLocationId: string | null;
  clockOutLocationId: string | null;
  clockInDistanceMeters: number | null;
  clockOutDistanceMeters: number | null;
  clockInGeofenceStatus: GeofenceStatus | null;
  clockOutGeofenceStatus: GeofenceStatus | null;
  status: TimeEntryStatus;
  clockStatus: ClockStatus | null;
  payRateSnapshot: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TimeBreak = {
  id: string;
  organizationId: string;
  timeEntryId: string;
  userId: string;
  breakStartAt: string;
  breakEndAt: string | null;
  breakStartLatitude: number | null;
  breakStartLongitude: number | null;
  breakStartAccuracy: number | null;
  breakEndLatitude: number | null;
  breakEndLongitude: number | null;
  breakEndAccuracy: number | null;
  breakMinutes: number | null;
  createdAt: string;
  updatedAt: string;
};

export type TimeEntryEdit = {
  id: string;
  organizationId: string;
  timeEntryId: string;
  changedBy: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  createdAt: string;
};

export type EmployeePayRate = {
  id: string;
  organizationId: string;
  userId: string;
  hourlyRate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type OrganizationSettings = {
  currencyCode: string;
  timezone: string;
  requireLocationClockIn: boolean;
  requireLocationClockOut: boolean;
  geofenceEnforcement: GeofenceEnforcement;
  allowUnscheduledClockIn: boolean;
  clockInEarlyMinutes: number;
  clockInLateGraceMinutes: number;
  earlyClockInPolicy: "allow" | "warning" | "block";
  missingClockOutHours: number;
  dailyOvertimeEnabled: boolean;
  dailyOvertimeThresholdHours: number;
  weeklyOvertimeEnabled: boolean;
  weeklyOvertimeThresholdHours: number;
  overtimeMultiplier: number;
  employeesCanViewEstimatedEarnings: boolean;
  qualificationEnforcement?: "strict" | "warning" | "disabled";
  maximumDailyHours?: number;
  maximumWeeklyHours?: number;
  requiredRestHours?: number;
  allowShiftTrades?: boolean;
  allowOpenShiftClaims?: boolean;
  requireTradeAdminApproval?: boolean;
  allowScheduleOverrides?: boolean;
  overtimeWarningEnabled?: boolean;
  payPeriodType?: "weekly" | "biweekly" | "semimonthly" | "monthly";
  documentAlertDays?: number;
  schedulingWeights?: SchedulingWeights;
  autoFillEnabled?: boolean;
  fairSchedulingEnabled?: boolean;
  requireShiftConfirmation?: boolean;
  autoCreateOpenShift?: boolean;
  automationEngineEnabled?: boolean;
  shiftReminderMinutes?: number;
  clockInReminderMinutes?: number;
  missingClockOutMinutes?: number;
  organizationAddress?: string | null;
  organizationPhone?: string | null;
  organizationEmail?: string | null;
  weekStartDay?: number;
  defaultLanguage?: string;
  logoUrl?: string | null;
  emailLogoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  idleSessionMinutes?: number;
  requireReauthSensitive?: boolean;
  chatRetentionDays?: number | null;
  activityRetentionDays?: number | null;
  notificationRetentionDays?: number | null;
  draftRetentionDays?: number | null;
  lastAutomationRunAt?: string | null;
  lastAutomationStatus?: string | null;
  lastAutomationDurationMs?: number | null;
  smtpEnabled?: boolean;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUsername?: string | null;
  smtpPasswordEncrypted?: string | null;
  smtpFromEmail?: string | null;
  smtpFromName?: string | null;
  featureFlags?: Partial<Record<"ai_scheduler" | "chat" | "calendar_sync" | "automations" | "facility_billing" | "forms" | "knowledge_base" | "pwa", boolean>>;
};

export type SmtpSettingsPublic = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
  passwordSet: boolean;
};

export type ChecklistItem = {
  id: string;
  title: string;
  sortOrder: number;
  isRequired: boolean;
};

export type ChecklistCompletion = {
  id: string;
  checklistItemId: string;
  userId: string;
  completedAt: string;
};

export type TaskComment = {
  id: string;
  userId: string;
  comment: string;
  createdAt: string;
};

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeIds: string[];
  shiftId: string | null;
  locationId?: string | null;
  departmentId?: string | null;
  createdBy?: string | null;
  completedAt?: string | null;
  checklist?: ChecklistItem[];
  completions?: ChecklistCompletion[];
  comments?: TaskComment[];
};

export type ChatRoom = {
  id: string;
  type: "direct" | "group" | "department";
  name: string | null;
  memberIds: string[];
  createdBy: string;
  departmentId?: string | null;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  message: string;
  replyToMessageId?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
};

export type EmployeeDocument = {
  id: string;
  userId: string;
  documentType: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  issuedDate: string | null;
  expirationDate: string | null;
  notes: string | null;
  uploadedBy: string;
  createdAt: string;
};

export type CalendarConnection = {
  id: string;
  userId: string;
  provider: "google" | "microsoft" | "ics";
  providerAccountEmail: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
};

export type CalendarFeed = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
};

export type SchedulingWeights = {
  availability: number;
  preferredAvailability: number;
  qualification: number;
  position: number;
  location: number;
  weeklyHours: number;
  overtimePenalty: number;
  fairness: number;
  preferredHours: number;
};

export type AutomationCondition = {
  field: string;
  operator: "eq" | "gte" | "lte";
  value: string;
};

export type AutomationAction = {
  type:
    | "notify_employee"
    | "notify_admin"
    | "notify_scheduler"
    | "send_email"
    | "create_task"
    | "timesheet_exception"
    | "open_shift"
    | "activity_log"
    | "mark_for_review";
  message?: string;
};

export type Automation = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  triggerType: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isEnabled: boolean;
  createdBy: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRun = {
  id: string;
  organizationId: string;
  automationId: string;
  executionKey: string;
  triggeredAt: string;
  status: "success" | "failed" | "skipped";
  inputData: Record<string, string>;
  resultData: Record<string, string> | null;
  errorMessage: string | null;
  completedAt: string | null;
};

export type AttendanceException = {
  id: string;
  organizationId: string;
  userId: string;
  shiftId: string | null;
  timeEntryId: string | null;
  exceptionType: string;
  severity: "critical" | "warning" | "info";
  message: string;
  status: "open" | "reviewed" | "resolved" | "dismissed";
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
};

export type ShiftCallout = {
  id: string;
  organizationId: string;
  shiftId: string;
  userId: string;
  reasonType: "sick" | "emergency" | "personal" | "other";
  notes: string | null;
  status: "pending" | "kept" | "removed" | "open_shift" | "replaced";
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export type NotificationDelivery = {
  id: string;
  organizationId: string;
  notificationId: string;
  channel: "in_app" | "email" | "push";
  status: "sent" | "failed" | "not_configured";
  provider: string | null;
  attemptCount: number;
  sentAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type ScheduleRecommendationItem = {
  id: string;
  shiftId: string;
  recommendedUserId: string;
  score: number;
  reasons: string[];
  warnings: string[];
  alternatives: Array<{ userId: string; score: number; name: string }>;
  acceptedAt: string | null;
  rejectedAt: string | null;
};

export type ScheduleRecommendation = {
  id: string;
  organizationId: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  createdBy: string;
  status: "pending" | "applied" | "rejected";
  createdAt: string;
  items: ScheduleRecommendationItem[];
};

export type CalendarEventMapping = {
  id: string;
  organizationId: string;
  shiftId: string;
  connectionId: string;
  externalEventId: string | null;
  syncStatus: "synced" | "failed" | "not_configured" | "removed";
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type ShiftConfirmation = {
  id: string;
  organizationId: string;
  shiftId: string;
  userId: string;
  status: "pending" | "confirmed" | "declined";
  viewedAt: string | null;
  confirmedAt: string | null;
  acknowledgedAt: string | null;
};

export type NotificationPreference = {
  id: string;
  userId: string;
  category: string;
  inApp: boolean;
  email: boolean;
};

export type OpenShiftRequest = {
  id: string;
  shiftId: string;
  userId: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedAt?: string;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
};

export type ShiftTradeRequest = {
  id: string;
  shiftId: string;
  fromUserId: string;
  toUserId: string | null;
  tradeType: "offer" | "swap";
  status: TradeStatus;
  targetShiftId?: string | null;
  replacementUserId?: string | null;
  employeeResponseStatus?: "pending" | "accepted" | "declined" | null;
  reason?: string | null;
};

export type ScheduleOverride = {
  id: string;
  shiftId: string;
  userId: string;
  conflictType: string;
  reason: string;
  overriddenBy: string;
  createdAt: string;
};

export type NotificationItem = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type ActivityLog = {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AttendanceRow = {
  id: string;
  userId: string;
  shiftId: string;
  scheduledStart: string;
  scheduledEnd: string;
  clockIn: string | null;
  clockOut: string | null;
  status: AttendanceStatus;
  workedMinutes: number;
};

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: AppRole;
  roles: AppRole[];
  permissions: Permission[];
  organizationId: string;
  organizationName: string;
  positionName: string | null;
  employeeType: EmployeeType;
  featureFlags?: Partial<Record<"ai_scheduler" | "chat" | "calendar_sync" | "automations" | "facility_billing" | "forms" | "knowledge_base" | "pwa", boolean>>;
};

export type SchedulingWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  level?: "info" | "warning" | "blocking";
};

export type AutoFillProposal = {
  shiftId: string;
  instructorId: string;
  score: number;
  reasons: string[];
  warnings: SchedulingWarning[];
};

export type TimeEntryTotals = {
  grossSeconds: number;
  breakSeconds: number;
  workedSeconds: number;
  regularSeconds: number;
  overtimeSeconds: number;
  regularPay: number;
  overtimePay: number;
  estimatedPay: number;
};

export type FacilityType = "clinical_site" | "training_site" | "client" | "office" | "other";
export type FacilityStatus = "active" | "inactive";
export type OnboardingItemType =
  | "task"
  | "form"
  | "document_upload"
  | "acknowledgement"
  | "link"
  | "profile_field"
  | "training";
export type OnboardingStatus = "not_started" | "in_progress" | "completed" | "overdue";
export type FormStatus = "draft" | "published" | "archived";
export type FormFieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "time"
  | "dropdown"
  | "radio"
  | "checkbox"
  | "yes_no"
  | "signature"
  | "file_upload"
  | "section_heading";
export type AnnouncementPriority = "normal" | "important" | "urgent";
export type AudienceKind =
  | "everyone"
  | "instructors"
  | "staff"
  | "role"
  | "department"
  | "location"
  | "facility"
  | "employees";
export type PayPeriodStatus = "open" | "review" | "approved" | "locked" | "exported";
export type PayrollAdjustmentType = "bonus" | "reimbursement" | "manual_pay" | "manual_hours" | "other";
export type InvoiceStatus = "draft" | "review" | "approved" | "sent" | "paid" | "void";
export type TimesheetWorkflowStatus =
  | "open"
  | "submitted"
  | "review"
  | "approved"
  | "rejected"
  | "locked"
  | "exported";

export type Facility = {
  id: string;
  organizationId: string;
  name: string;
  facilityType: FacilityType;
  status: FacilityStatus;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number | null;
  billingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
};

export type FacilityContact = {
  id: string;
  organizationId: string;
  facilityId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeFacility = {
  id: string;
  organizationId: string;
  userId: string;
  facilityId: string;
  isPrimary: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

export type FacilityBillingRate = {
  id: string;
  organizationId: string;
  facilityId: string;
  positionId: string | null;
  qualificationId: string | null;
  billingRate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string;
  createdAt: string;
};

export type OnboardingTemplate = {
  id: string;
  organizationId: string;
  name: string;
  employeeType: EmployeeType | null;
  role: AppRole | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingTemplateItem = {
  id: string;
  organizationId: string;
  templateId: string;
  title: string;
  description: string | null;
  itemType: OnboardingItemType;
  isRequired: boolean;
  sortOrder: number;
  dueDaysAfterStart: number | null;
};

export type EmployeeOnboarding = {
  id: string;
  organizationId: string;
  userId: string;
  templateId: string;
  status: OnboardingStatus;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
};

export type EmployeeOnboardingItem = {
  id: string;
  organizationId: string;
  employeeOnboardingId: string;
  templateItemId: string;
  status: "pending" | "complete";
  completedAt: string | null;
  completedBy: string | null;
  notes: string | null;
};

export type OrgForm = {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: FormStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  archivedAt?: string | null;
};

export type FormField = {
  id: string;
  organizationId: string;
  formId: string;
  fieldType: FormFieldType;
  label: string;
  description: string | null;
  required: boolean;
  options: string[] | null;
  sortOrder: number;
};

export type SignatureEvidence = {
  signedByUserId: string;
  signatureMethod: "drawn" | "typed";
  signedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  documentVersion: number;
  consentText: string;
};

export type FormSubmission = {
  id: string;
  organizationId: string;
  formId: string;
  userId: string | null;
  status: "draft" | "submitted";
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  signature?: SignatureEvidence | null;
};

export type FormSubmissionValue = {
  id: string;
  organizationId: string;
  submissionId: string;
  fieldId: string;
  valueJson: unknown;
  createdAt: string;
};

export type PolicyDocument = {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  version: number;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
};

export type PolicyAcknowledgement = {
  id: string;
  organizationId: string;
  policyId: string;
  userId: string;
  policyVersion: number;
  viewedAt: string | null;
  acknowledgedAt: string | null;
  signature?: SignatureEvidence | null;
};

export type Announcement = {
  id: string;
  organizationId: string;
  title: string;
  message: string;
  audienceKind: AudienceKind;
  audienceValue: string | null;
  publishAt: string;
  expiresAt: string | null;
  priority: AnnouncementPriority;
  requireAcknowledgement: boolean;
  createdBy: string;
  createdAt: string;
};

export type AnnouncementAcknowledgement = {
  id: string;
  organizationId: string;
  announcementId: string;
  userId: string;
  viewedAt: string | null;
  acknowledgedAt: string | null;
};

export type KnowledgeBaseCategory = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
};

export type KnowledgeBaseArticle = {
  id: string;
  organizationId: string;
  categoryId: string;
  title: string;
  summary: string | null;
  content: string;
  audienceKind: AudienceKind;
  audienceValue: string | null;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  updatedAt: string;
  createdBy: string;
  archivedAt?: string | null;
};

export type KnowledgeBaseAttachment = {
  id: string;
  organizationId: string;
  articleId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type TrainingResource = {
  id: string;
  organizationId: string;
  title: string;
  resourceType: "video_link" | "pdf" | "document" | "external_link" | "checklist" | "article";
  url: string | null;
  content: string | null;
  createdBy: string;
  createdAt: string;
};

export type TrainingAssignment = {
  id: string;
  organizationId: string;
  resourceId: string;
  userId: string;
  status: "assigned" | "viewed" | "completed";
  viewedAt: string | null;
  completedAt: string | null;
};

export type PayPeriod = {
  id: string;
  organizationId: string;
  startDate: string;
  endDate: string;
  status: PayPeriodStatus;
  lockedAt: string | null;
  lockedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PayrollAdjustment = {
  id: string;
  organizationId: string;
  userId: string;
  payPeriodId: string;
  adjustmentType: PayrollAdjustmentType;
  amount: number;
  hours: number | null;
  description: string;
  createdBy: string;
  createdAt: string;
};

export type EmployeeTimesheet = {
  id: string;
  organizationId: string;
  userId: string;
  payPeriodId: string;
  status: TimesheetWorkflowStatus;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Invoice = {
  id: string;
  organizationId: string;
  facilityId: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  status: InvoiceStatus;
  subtotal: number;
  adjustments: number;
  total: number;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceItem = {
  id: string;
  organizationId: string;
  invoiceId: string;
  userId: string | null;
  shiftId: string | null;
  description: string;
  serviceDate: string;
  hours: number;
  rate: number;
  amount: number;
  createdAt: string;
};

export type PayrollExportRecord = {
  id: string;
  organizationId: string;
  payPeriodId: string;
  format: "csv";
  recordCount: number;
  fileHash: string | null;
  createdBy: string;
  createdAt: string;
};

export type SavedView = {
  id: string;
  organizationId: string;
  userId: string;
  module: "users" | "schedule" | "attendance" | "timesheets" | "tasks" | "reports";
  name: string;
  filters: Record<string, string | string[] | boolean | null>;
  sortConfig: { field: string; direction: "asc" | "desc" } | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomFieldDefinition = {
  id: string;
  organizationId: string;
  entityType: "user" | "facility";
  name: string;
  fieldType: "text" | "number" | "date" | "dropdown" | "checkbox" | "yes_no";
  options: string[] | null;
  required: boolean;
};

export type CustomFieldValue = {
  id: string;
  organizationId: string;
  definitionId: string;
  entityId: string;
  valueJson: unknown;
};

export type Tag = {
  id: string;
  organizationId: string;
  name: string;
  color: string;
};

export type EntityTag = {
  id: string;
  organizationId: string;
  tagId: string;
  entityType: "user" | "facility" | "shift" | "task";
  entityId: string;
};

export type EmployeeAdminNote = {
  id: string;
  organizationId: string;
  userId: string;
  note: string;
  createdBy: string;
  createdAt: string;
};

export type DashboardPreference = {
  id: string;
  userId: string;
  hiddenWidgets: string[];
  widgetOrder: string[];
  activityEmailInstructorIds?: string[];
};

export type Phase5Collections = {
  facilities: Facility[];
  facilityContacts: FacilityContact[];
  employeeFacilities: EmployeeFacility[];
  facilityBillingRates: FacilityBillingRate[];
  onboardingTemplates: OnboardingTemplate[];
  onboardingTemplateItems: OnboardingTemplateItem[];
  employeeOnboarding: EmployeeOnboarding[];
  employeeOnboardingItems: EmployeeOnboardingItem[];
  forms: OrgForm[];
  formFields: FormField[];
  formSubmissions: FormSubmission[];
  formSubmissionValues: FormSubmissionValue[];
  policyDocuments: PolicyDocument[];
  policyAcknowledgements: PolicyAcknowledgement[];
  announcements: Announcement[];
  announcementAcknowledgements: AnnouncementAcknowledgement[];
  knowledgeBaseCategories: KnowledgeBaseCategory[];
  knowledgeBaseArticles: KnowledgeBaseArticle[];
  knowledgeBaseAttachments: KnowledgeBaseAttachment[];
  trainingResources: TrainingResource[];
  trainingAssignments: TrainingAssignment[];
  payPeriods: PayPeriod[];
  payrollAdjustments: PayrollAdjustment[];
  employeeTimesheets: EmployeeTimesheet[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  payrollExports: PayrollExportRecord[];
  savedViews: SavedView[];
  customFieldDefinitions: CustomFieldDefinition[];
  customFieldValues: CustomFieldValue[];
  tags: Tag[];
  entityTags: EntityTag[];
  employeeAdminNotes: EmployeeAdminNote[];
  dashboardPreferences: DashboardPreference[];
};
