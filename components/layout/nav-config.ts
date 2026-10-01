import {
  Bell,
  BookOpen,
  Bot,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  RefreshCcw,
  Settings,
  Sparkles,
  Timer,
  UserRound,
  Users,
  ArrowLeftRight,
  CalendarOff,
  BarChart3,
  Building2,
  FileText,
  GraduationCap,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/permissions";
import type { FeatureFlagMap } from "@/lib/features";
import { featureEnabled } from "@/lib/features";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  placeholder?: boolean;
  roles?: AppRole[];
  flag?: "chat" | "calendar_sync" | "automations" | "facility_billing" | "forms" | "knowledge_base";
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    title: "",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Workforce",
    items: [
      { href: "/users", label: "Users / Staff", icon: Users, roles: ["super_admin", "admin", "scheduler"] },
      { href: "/smart-groups", label: "Smart Groups", icon: Sparkles, roles: ["super_admin", "admin", "scheduler"] },
      { href: "/availability", label: "Availability", icon: CalendarClock },
    ],
  },
  {
    title: "Communication",
    items: [
      { href: "/chat", label: "Chat", icon: MessageSquare, flag: "chat" },
      { href: "/updates", label: "Updates", icon: Bell },
      { href: "/directory", label: "Directory", icon: BookOpen },
      { href: "/knowledge-base", label: "Knowledge Base", icon: FolderOpen, flag: "knowledge_base" },
      { href: "/forms", label: "Forms", icon: FileText, flag: "forms" },
      { href: "/training", label: "Training", icon: GraduationCap },
      { href: "/policies", label: "Policies", icon: FileText },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/schedule", label: "Schedule", icon: CalendarDays },
      { href: "/time-clock", label: "Time Clock", icon: Clock },
      { href: "/timesheets", label: "Timesheets", icon: Timer },
      { href: "/time-off", label: "Time Off", icon: CalendarOff },
      { href: "/shift-trades", label: "Shift Trades", icon: ArrowLeftRight },
      { href: "/open-shifts", label: "Open Shifts", icon: RefreshCcw },
      { href: "/tasks", label: "Tasks", icon: ClipboardCheck },
      { href: "/attendance", label: "Attendance", icon: UserRound, roles: ["super_admin", "admin", "scheduler"] },
      { href: "/facilities", label: "Facilities", icon: Building2, roles: ["super_admin", "admin", "scheduler"] },
      { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
      { href: "/payroll", label: "Payroll", icon: Receipt, roles: ["super_admin", "admin"] },
      { href: "/billing", label: "Billing", icon: Receipt, roles: ["super_admin", "admin"], flag: "facility_billing" },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, roles: ["super_admin", "admin", "scheduler"] },
      { href: "/automations", label: "Automations", icon: Bot, roles: ["super_admin", "admin"], flag: "automations" },
      { href: "/command-center", label: "Command Center", icon: LayoutDashboard, roles: ["super_admin", "admin", "scheduler"] },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/calendar-sync", label: "Calendar", icon: CalendarDays, flag: "calendar_sync" },
      { href: "/activity", label: "Activity", icon: ClipboardCheck, roles: ["super_admin", "admin", "scheduler"] },
      { href: "/settings", label: "Settings", icon: Settings, roles: ["super_admin", "admin"] },
      { href: "/help", label: "Help", icon: HelpCircle },
    ],
  },
];

export function visibleNav(sections: NavSection[], roles: AppRole[], flags?: FeatureFlagMap | null) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (!item.roles || item.roles.some((role) => roles.includes(role))) &&
          (!item.flag || featureEnabled(flags, item.flag)),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
