import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/auth/session";
import { readWorkforceState } from "@/lib/db/workforce";

export default async function SmartGroupsPage() {
  await requirePermission("users.read");
  const groups = [
    {
      name: "All Instructors",
      rules: "Role = Instructor AND Status = Active",
    },
    {
      name: "Clinical Instructors",
      rules: "Qualification = Clinical Instructor AND Status = Active",
    },
    {
      name: "Theory Instructors",
      rules: "Qualification = Theory Instructor AND Status = Active",
    },
    {
      name: "Main Campus",
      rules: "Location = CAL ACE Main Campus",
    },
  ];
  const state = await readWorkforceState();
  const instructorCount = state.profiles.filter((profile) =>
    profile.roles.includes("instructor"),
  ).length;

  return (
    <div>
      <PageHeader
        title="Smart Groups"
        description="Rule-based groups for targeting schedules, tasks, and messages."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.name}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{group.name}</h2>
                <Badge variant="secondary">{instructorCount} people</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{group.rules}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
