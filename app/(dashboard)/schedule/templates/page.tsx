import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/auth/session";
import { listTemplates } from "@/lib/db/shifts";
import { getLookups } from "@/lib/db/users";
import { formatTimeRange } from "@/lib/utils";

export default async function TemplatesPage() {
  await requirePermission("schedules.manage");
  const templates = await listTemplates();
  const lookups = await getLookups();

  return (
    <div>
      <PageHeader
        title="Shift templates"
        description="Reuse common class blocks like CNA morning theory or clinical rotation."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardContent className="p-5">
              <div className="mb-3 h-2 w-12 rounded-full" style={{ backgroundColor: template.color }} />
              <h2 className="font-semibold">{template.name}</h2>
              <p className="text-sm text-muted-foreground">{template.title}</p>
              <p className="mt-3 text-sm">
                {formatTimeRange(template.startTime, template.endTime)}
              </p>
              <p className="text-sm text-muted-foreground">
                {lookups.locations.find((item) => item.id === template.locationId)?.name}
              </p>
              <div className="mt-3 flex gap-2">
                <Badge variant="secondary">Instructors: {template.requiredInstructors}</Badge>
                <Badge variant="outline">{template.classCohort}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
