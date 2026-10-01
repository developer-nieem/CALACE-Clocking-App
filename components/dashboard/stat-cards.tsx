import {
  CalendarDays,
  Clock3,
  UserRound,
  AlertTriangle,
  RefreshCcw,
  ArrowLeftRight,
  Coffee,
  Banknote,
} from "lucide-react";
import { Card } from "@/components/ui/card";

const items = [
  { key: "totalEmployees", label: "Total Employees", icon: UserRound },
  { key: "totalInstructors", label: "Total Instructors", icon: UserRound },
  { key: "totalStaff", label: "Total Staff", icon: UserRound },
  { key: "todaysShifts", label: "Today's Shifts", icon: CalendarDays },
  { key: "currentlyClockedIn", label: "Currently Clocked In", icon: Clock3 },
  { key: "onBreak", label: "On Break", icon: Coffee },
  { key: "late", label: "Late", icon: AlertTriangle },
  { key: "openShifts", label: "Open Shifts", icon: RefreshCcw },
  { key: "pendingRequests", label: "Pending Requests", icon: ArrowLeftRight },
  { key: "todayLaborCost", label: "Today's Estimated Labor Cost", icon: Banknote },
] as const;

export function StatCards({
  stats,
}: {
  stats: Record<(typeof items)[number]["key"], number | string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.key} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-primary">{stats[item.key]}</p>
              </div>
              <div className="rounded-lg bg-primary/8 p-2 text-primary">
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
