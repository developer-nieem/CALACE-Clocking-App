import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { listUsers } from "@/lib/db/users";
import { goLiveItems } from "@/lib/phase7/status";

export default async function GoLivePage() {
  await requirePermission("security.manage");
  const users = await listUsers();
  const items = goLiveItems({ profileCount: users.length });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Go-live"
        description="Readiness only. The app never auto-invites employees. An administrator must choose when to start."
      />
      <Card>
        <CardHeader><CardTitle>Production checklist</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {items.map((item) => (
            <p key={item.id}>
              {item.status === "pass" ? "✓" : item.status === "warn" ? "⚠" : "✕"} {item.label}: {item.detail}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
