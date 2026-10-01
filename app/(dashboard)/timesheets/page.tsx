import { PageHeader } from "@/components/shared/page-header";
import { TimeReport } from "@/components/time-clock/time-report";
import { getTimeClockData } from "@/lib/db/time-clock";

export default async function TimesheetsPage() {
  const data = await getTimeClockData();
  return (
    <div className="space-y-6">
      <PageHeader
        title={data.canManage ? "Clock Report" : "My Clock History"}
        description="Worked time and payroll are estimates based on filtered records and configurable organization policy."
      />
      <TimeReport
        entries={data.canManage ? data.allEntries : data.entries}
        breaks={data.canManage ? data.allBreaks : data.breaks}
        edits={data.edits}
        profiles={data.profiles}
        shifts={data.shifts}
        locations={data.locations}
        departments={data.departments}
        positions={data.positions}
        settings={data.settings}
        canManage={data.canManage}
        initialUserId={data.canManage ? "all" : data.profile.id}
      />
    </div>
  );
}
