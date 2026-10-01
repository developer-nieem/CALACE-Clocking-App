import { ClockWorkspace } from "@/components/time-clock/clock-workspace";
import { LiveAttendance } from "@/components/time-clock/live-attendance";
import { getTimeClockData } from "@/lib/db/time-clock";

export default async function TimeClockPage() {
  const data = await getTimeClockData();
  return (
    <div className="space-y-6">
      <ClockWorkspace
        profile={data.profile}
        entries={data.entries}
        breaks={data.breaks}
        shifts={data.shifts}
        locations={data.locations}
        settings={data.settings}
      />
      {data.canManage ? (
        <LiveAttendance
          profiles={data.profiles}
          entries={data.allEntries}
          breaks={data.allBreaks}
          shifts={data.shifts}
          positions={data.positions}
          locations={data.locations}
          settings={data.settings}
        />
      ) : null}
    </div>
  );
}
