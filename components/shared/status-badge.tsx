import { Badge } from "@/components/ui/badge";
import type { AttendanceStatus, ShiftStatus, UserStatus } from "@/types";

export function StatusBadge({
  status,
}: {
  status: AttendanceStatus | ShiftStatus | UserStatus | string;
}) {
  const map: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
    scheduled: { label: "Scheduled", variant: "secondary" },
    clocked_in: { label: "Clocked In", variant: "success" },
    completed: { label: "Completed", variant: "info" },
    late: { label: "Late", variant: "warning" },
    absent: { label: "Absent", variant: "danger" },
    on_break: { label: "On Break", variant: "accent" },
    draft: { label: "Draft", variant: "secondary" },
    published: { label: "Published", variant: "success" },
    cancelled: { label: "Cancelled", variant: "danger" },
    active: { label: "Active", variant: "success" },
    invited: { label: "Invited", variant: "info" },
    inactive: { label: "Inactive", variant: "secondary" },
    pending: { label: "Pending", variant: "warning" },
    approved: { label: "Approved", variant: "success" },
    rejected: { label: "Rejected", variant: "danger" },
    open: { label: "Open", variant: "info" },
  };
  const item = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
