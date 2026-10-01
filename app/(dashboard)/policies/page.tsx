import { AcknowledgePolicyButton, PolicyForm } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPhase5Context } from "@/lib/db/phase5";

export default async function PoliciesPage() {
  const { user, state } = await getPhase5Context();
  const published = state.policyDocuments.filter((item) => item.status === "published");
  return (
    <div className="space-y-6">
      <PageHeader title="Policies" description="View and acknowledge published policies. Signature evidence is stored for the signed-in user." />
      {user.permissions.includes("knowledge.manage") ? (
        <Card>
          <CardHeader><CardTitle>Publish policy</CardTitle></CardHeader>
          <CardContent><PolicyForm /></CardContent>
        </Card>
      ) : null}
      {published.map((policy) => {
        const ack = state.policyAcknowledgements.find((item) => item.policyId === policy.id && item.userId === user.id);
        return (
          <Card key={policy.id}>
            <CardHeader><CardTitle>{policy.title} · v{policy.version}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-wrap">{policy.content}</p>
              <p className="text-muted-foreground">
                Viewed: {ack?.viewedAt?.slice(0, 16) ?? "—"} · Acknowledged: {ack?.acknowledgedAt?.slice(0, 16) ?? "—"}
              </p>
              {!ack?.acknowledgedAt ? <AcknowledgePolicyButton id={policy.id} /> : <p>Acknowledged.</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
