import { FormBuilder, FormFill } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPhase5Context } from "@/lib/db/phase5";
import { fullName } from "@/lib/utils";

export default async function FormsPage() {
  const { user, state } = await getPhase5Context();
  const published = state.forms.filter((form) => form.status === "published");
  const canManage = user.permissions.includes("forms.manage");
  return (
    <div className="space-y-6">
      <PageHeader title="Forms" description="Organization forms with typed signature evidence. Admins cannot silently sign as someone else." />
      {canManage ? (
        <Card>
          <CardHeader><CardTitle>Form builder</CardTitle></CardHeader>
          <CardContent><FormBuilder forms={state.forms.map((form) => ({ id: form.id, title: form.title }))} /></CardContent>
        </Card>
      ) : null}
      {published.map((form) => (
        <Card key={form.id}>
          <CardHeader><CardTitle>{form.title}</CardTitle></CardHeader>
          <CardContent>
            <FormFill form={form} fields={state.formFields.filter((field) => field.formId === form.id)} />
          </CardContent>
        </Card>
      ))}
      {canManage ? (
        <Card>
          <CardHeader><CardTitle>Submissions</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {state.formSubmissions.map((submission) => {
              const person = state.profiles.find((item) => item.id === submission.userId);
              const form = state.forms.find((item) => item.id === submission.formId);
              return (
                <p key={submission.id}>
                  {form?.title} · {person ? fullName(person.firstName, person.lastName) : "Unknown"} · {submission.status}
                  {submission.signature ? ` · signed ${submission.signature.signedAt.slice(0, 16)}` : ""}
                </p>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
