import { DEMO_COOKIE } from "@/lib/constants";
import {
  activityLogs,
  availabilityRules,
  buildCurrentWeekShifts,
  buildNotifications,
  buildTimeOff,
  buildTrades,
  buildTimeClockSeed,
  departments,
  locations,
  openShiftRequests,
  organizationSettings,
  employeePayRates,
  positions,
  profiles,
  qualifications,
  shiftTemplates,
  tasks,
} from "@/lib/demo/data";
import type {
  ActivityLog,
  AvailabilityRule,
  AvailabilityException,
  CalendarConnection,
  CalendarEventMapping,
  CalendarFeed,
  ChatMessage,
  ChatRoom,
  EmployeeDocument,
  EmployeePayRate,
  NotificationItem,
  NotificationPreference,
  NotificationDelivery,
  OpenShiftRequest,
  Profile,
  ScheduleOverride,
  ScheduleRecommendation,
  Shift,
  ShiftCallout,
  ShiftConfirmation,
  ShiftSeries,
  ShiftTemplate,
  ShiftTradeRequest,
  AttendanceException,
  Automation,
  AutomationRun,
  TaskItem,
  TimeBreak,
  TimeEntry,
  TimeEntryEdit,
  TimeOffRequest,
  Phase5Collections,
} from "@/types";
import { emptyPhase5 } from "@/lib/phase5/domain";

type DemoState = {
  profiles: Profile[];
  shifts: Shift[];
  templates: ShiftTemplate[];
  availability: AvailabilityRule[];
  timeOff: TimeOffRequest[];
  timeEntries: TimeEntry[];
  timeBreaks: TimeBreak[];
  timeEntryEdits: TimeEntryEdit[];
  payRates: EmployeePayRate[];
  settings: typeof organizationSettings;
  tasks: TaskItem[];
  openShiftRequests: OpenShiftRequest[];
  trades: ShiftTradeRequest[];
  notifications: NotificationItem[];
  activity: ActivityLog[];
  availabilityExceptions: AvailabilityException[];
  shiftSeries: ShiftSeries[];
  scheduleOverrides: ScheduleOverride[];
  chatRooms: ChatRoom[];
  chatMessages: ChatMessage[];
  documents: EmployeeDocument[];
  calendarConnections: CalendarConnection[];
  calendarFeeds: CalendarFeed[];
  notificationPreferences: NotificationPreference[];
  automations: Automation[];
  automationRuns: AutomationRun[];
  attendanceExceptions: AttendanceException[];
  shiftCallouts: ShiftCallout[];
  notificationDeliveries: NotificationDelivery[];
  scheduleRecommendations: ScheduleRecommendation[];
  calendarEventMappings: CalendarEventMapping[];
  shiftConfirmations: ShiftConfirmation[];
} & Phase5Collections;

function createState(): DemoState {
  const shifts = buildCurrentWeekShifts();
  const clock = buildTimeClockSeed();
  return {
    profiles: profiles.map((account) => {
      const copy: Profile & { password?: string } = { ...account };
      delete copy.password;
      return copy;
    }),
    shifts,
    templates: [...shiftTemplates],
    availability: [...availabilityRules],
    timeOff: buildTimeOff(),
    timeEntries: clock.timeEntries,
    timeBreaks: clock.timeBreaks,
    timeEntryEdits: [],
    payRates: employeePayRates.map((rate) => ({ ...rate })),
    settings: { ...organizationSettings },
    tasks: [...tasks],
    openShiftRequests: [...openShiftRequests],
    trades: buildTrades(shifts),
    notifications: buildNotifications(),
    activity: [...activityLogs],
    availabilityExceptions: [],
    shiftSeries: [],
    scheduleOverrides: [],
    chatRooms: [],
    chatMessages: [],
    documents: [],
    calendarConnections: [],
    calendarFeeds: [],
    notificationPreferences: [],
    automations: [],
    automationRuns: [],
    attendanceExceptions: [],
    shiftCallouts: [],
    notificationDeliveries: [],
    scheduleRecommendations: [],
    calendarEventMappings: [],
    shiftConfirmations: [],
    ...emptyPhase5(),
  };
}

const globalForDemo = globalThis as unknown as { __calaceDemo?: DemoState };

export function buildSeedState(): DemoState {
  return createState();
}

export function getDemoState() {
  if (!globalForDemo.__calaceDemo) {
    globalForDemo.__calaceDemo = createState();
  }
  return globalForDemo.__calaceDemo;
}

export function resetDemoState() {
  globalForDemo.__calaceDemo = createState();
  return globalForDemo.__calaceDemo;
}

export function findDemoAccount(email: string, password: string) {
  return profiles.find(
    (profile) =>
      profile.email.toLowerCase() === email.toLowerCase() &&
      profile.password === password,
  );
}

export function findDemoProfile(id: string) {
  return getDemoState().profiles.find((profile) => profile.id === id) ?? null;
}

export { locations, departments, positions, qualifications, DEMO_COOKIE };
