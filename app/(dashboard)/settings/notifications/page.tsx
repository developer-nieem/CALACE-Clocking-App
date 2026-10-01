import { PageHeader } from "@/components/shared/page-header";
import { PreferenceForm } from "@/components/phase3/boards";
import { requireSession } from "@/lib/auth/session";

export default async function NotificationSettingsPage() {
  await requireSession();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Notification preferences"
        description="In-app alerts always work. Email sends only when Resend is configured, and a failed email does not block the action."
      />
      <PreferenceForm />
    </div>
  );
}
