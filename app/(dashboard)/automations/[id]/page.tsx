import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/session";
import { readWorkforceState } from "@/lib/db/workforce";

export default async function AutomationRunsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("automations.read");
  const { id } = await params;
  const state = await readWorkforceState();
  const automation = state.automations.find((item) => item.id === id);
  if (!automation) notFound();
  const runs = state.automationRuns.filter((run) => run.automationId === id);
  return (
    <div className="space-y-4">
      <PageHeader title={automation.name} description={`${automation.triggerType} · ${automation.isEnabled ? "Enabled" : "Disabled"}`} />
      <Link href="/automations" className="text-sm text-primary">Back to automations</Link>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Run time</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No runs yet.</td></tr>
            ) : runs.map((run) => (
              <tr key={run.id} className="border-b">
                <td className="px-3 py-3">{new Date(run.triggeredAt).toLocaleString()}</td>
                <td className="px-3 py-3">{run.status}</td>
                <td className="px-3 py-3">{run.inputData.shiftId ?? run.executionKey}</td>
                <td className="px-3 py-3">{run.errorMessage ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
