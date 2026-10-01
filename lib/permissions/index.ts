export const APP_ROLES = [
  "super_admin",
  "admin",
  "scheduler",
  "instructor",
  "staff",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const PERMISSIONS = [
  "users.read",
  "users.manage",
  "users.invite",
  "schedules.read",
  "schedules.manage",
  "schedules.publish",
  "schedules.override_warnings",
  "availability.read_all",
  "time_off.approve",
  "shift_trades.approve",
  "open_shifts.manage",
  "open_shifts.approve",
  "tasks.manage",
  "time_clock.view_all",
  "time_clock.use",
  "time_clock.read_own",
  "time_clock.manage",
  "pay.read_own",
  "pay.manage",
  "timesheets.manage",
  "attendance.read",
  "reports.read",
  "payroll.view",
  "payroll.export",
  "documents.manage",
  "settings.manage",
  "chat.use",
  "schedules.auto_fill",
  "automations.manage",
  "automations.read",
  "calendar.manage",
  "reports.advanced",
  "notifications.manage",
  "schedules.settings",
  "command_center.view",
  "facilities.view",
  "facilities.manage",
  "facility_billing.view",
  "facility_billing.manage",
  "forms.manage",
  "forms.submissions.view",
  "forms.submit",
  "knowledge.manage",
  "knowledge.view",
  "onboarding.manage",
  "onboarding.view",
  "payroll.approve",
  "payroll.lock",
  "billing.manage",
  "margin.view",
  "exports.manage",
  "security.manage",
  "audit.export",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  super_admin: [...PERMISSIONS],
  admin: [...PERMISSIONS],
  scheduler: [
    "users.read",
    "schedules.read",
    "schedules.manage",
    "schedules.publish",
    "availability.read_all",
    "time_off.approve",
    "shift_trades.approve",
    "open_shifts.manage",
    "open_shifts.approve",
    "attendance.read",
    "chat.use",
    "schedules.auto_fill",
    "reports.advanced",
    "command_center.view",
    "facilities.view",
    "forms.submit",
    "knowledge.view",
    "onboarding.view",
  ],
  instructor: [
    "schedules.read",
    "time_clock.use",
    "time_clock.read_own",
    "pay.read_own",
    "chat.use",
    "forms.submit",
    "knowledge.view",
    "onboarding.view",
  ],
  staff: [
    "schedules.read",
    "time_clock.use",
    "time_clock.read_own",
    "pay.read_own",
    "chat.use",
    "forms.submit",
    "knowledge.view",
    "onboarding.view",
  ],
};

export function hasPermission(
  roles: AppRole[],
  permissions: Permission[],
  permission: Permission,
) {
  if (roles.includes("super_admin")) return true;
  return permissions.includes(permission);
}

export function isManager(roles: AppRole[]) {
  return roles.some((role) =>
    ["super_admin", "admin", "scheduler"].includes(role),
  );
}

export function canOverrideWarnings(roles: AppRole[]) {
  return roles.includes("super_admin") || roles.includes("admin");
}

export function canAccessEmployeeRecord(
  actor: { id: string; roles: AppRole[] },
  employeeId: string,
) {
  return actor.id === employeeId || isManager(actor.roles);
}

export function primaryRole(roles: AppRole[]): AppRole {
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("scheduler")) return "scheduler";
  if (roles.includes("staff")) return "staff";
  return "instructor";
}

export function roleLabel(role: AppRole) {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "scheduler":
      return "Scheduler";
    case "instructor":
      return "Instructor";
    case "staff":
      return "Staff";
  }
}
