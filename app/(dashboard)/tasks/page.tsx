import { PageHeader } from "@/components/shared/page-header";
import { TaskBoard } from "@/components/phase3/boards";
import { getTaskWorkspace } from "@/lib/db/phase3";

export default async function TasksPage() {
  const data = await getTaskWorkspace();
  return (
    <div className="space-y-4">
      <PageHeader title="Tasks" description="Shift tasks, checklists, and comments for instructors and staff." />
      <TaskBoard tasks={data.tasks} profiles={data.profiles} canManage={data.canManage} />
    </div>
  );
}
