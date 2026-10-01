import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/session";
import { readWorkforceState } from "@/lib/db/workforce";
import { scheduleHealth } from "@/lib/phase4/scheduler";
import { expiringQualifications } from "@/lib/phase4/reports";
import { addDays, startOfWeekMonday, toISODate } from "@/lib/utils";

export default async function CommandCenterPage() {
  await requirePermission("command_center.view");
  const state = await readWorkforceState();
  const start = toISODate(startOfWeekMonday(new Date()));
  const end = toISODate(addDays(startOfWeekMonday(new Date()), 6));
  const today = toISODate(new Date());
  const health = scheduleHealth(
    {
      employees: state.profiles,
      shifts: state.shifts,
      rules: state.availability,
      exceptions: state.availabilityExceptions ?? [],
      timeOff: state.timeOff,
      qualifications: state.qualifications,
      positions: state.positions,
      locations: state.locations,
      settings: state.settings,
    },
    start,
    end,
  );
  const working = state.timeEntries.filter((entry) => entry.clockOutAt === null);
  const pendingTimeOff = state.timeOff.filter((item) => item.status === "pending");
  const pendingTrades = state.trades.filter((item) => item.status === "pending");
  const openClaims = state.openShiftRequests.filter((item) => item.status === "pending");
  const overdueTasks = state.tasks.filter((task) => task.status !== "completed" && task.status !== "cancelled" && task.dueAt && task.dueAt.slice(0, 10) < today);
  const expiring = expiringQualifications(state.profiles, today, 30);
  const failedRuns = state.automationRuns.filter((run) => run.status === "failed");
  const callouts = state.shiftCallouts.filter((item) => item.status === "pending");
  const sections = [
    ["Currently working", String(working.length), "/attendance"],
    ["Unfilled positions", String(health.unfilled), "/schedule"],
    ["Pending time off", String(pendingTimeOff.length), "/time-off"],
    ["Pending trades", String(pendingTrades.length), "/shift-trades"],
    ["Open shift claims", String(openClaims.length), "/open-shifts"],
    ["Overdue tasks", String(overdueTasks.length), "/tasks"],
    ["Expiring qualifications", String(expiring.length), "/users"],
    ["Pending call-outs", String(callouts.length), "/schedule"],
    ["Automation failures", String(failedRuns.length), "/automations"],
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Command Center" description="Operational items only. This does not score employee quality." />
      <div className="grid gap-3 md:grid-cols-3">
        {sections.map(([label, value, href]) => (
          <Link key={label} href={href} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </Link>
        ))}
      </div>
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold">Schedule health</h2>
        <p className="mt-2 text-sm">Coverage {health.coverage}% · Unfilled {health.unfilled} · Overtime risks {health.overtimeRisks} · Conflicts {health.conflicts}</p>
        <p className="mt-1 text-xs text-muted-foreground">{health.healthLabel}</p>
        <ul className="mt-3 list-disc pl-5 text-sm">
          {health.insights.length ? health.insights.map((item) => <li key={item}>{item}</li>) : <li>No schedule issues in this week.</li>}
        </ul>
      </section>
    </div>
  );
}
