import { CompleteTrainingButton, TrainingAssignForm, TrainingForm } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPhase5Context } from "@/lib/db/phase5";
import { fullName } from "@/lib/utils";

export default async function TrainingPage() {
  const { user, state } = await getPhase5Context();
  const mine = state.trainingAssignments.filter((item) => item.userId === user.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Training" description="Resource library. This is not a full LMS." />
      {user.permissions.includes("knowledge.manage") ? (
        <>
          <Card>
            <CardHeader><CardTitle>Add resource</CardTitle></CardHeader>
            <CardContent><TrainingForm /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Assign training</CardTitle></CardHeader>
            <CardContent>
              <TrainingAssignForm
                resources={state.trainingResources.map((item) => ({ id: item.id, title: item.title }))}
                employees={state.profiles.map((item) => ({ id: item.id, label: fullName(item.firstName, item.lastName) }))}
              />
            </CardContent>
          </Card>
        </>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {state.trainingResources.map((resource) => {
          const assignment = mine.find((item) => item.resourceId === resource.id);
          return (
            <Card key={resource.id}>
              <CardHeader><CardTitle>{resource.title}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{resource.resourceType.replaceAll("_", " ")}</p>
                {resource.url ? <a className="text-primary underline" href={resource.url} target="_blank" rel="noreferrer">Open resource</a> : null}
                {resource.content ? <p>{resource.content}</p> : null}
                {assignment ? (
                  <div className="flex items-center justify-between">
                    <span>{assignment.status}</span>
                    {assignment.status !== "completed" ? <CompleteTrainingButton id={assignment.id} /> : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
