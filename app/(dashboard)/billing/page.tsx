import Link from "next/link";
import { InvoiceDraftForm, InvoiceStatusButton } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { getPhase5Context } from "@/lib/db/phase5";

export default async function BillingPage() {
  await requirePermission("billing.manage");
  const { state } = await getPhase5Context();
  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Invoice drafts only. Invoices are never sent automatically." />
      <Card>
        <CardHeader><CardTitle>Generate draft</CardTitle></CardHeader>
        <CardContent>
          <InvoiceDraftForm facilities={state.facilities.map((item) => ({ id: item.id, name: item.name }))} />
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {state.invoices.map((invoice) => {
          const facility = state.facilities.find((item) => item.id === invoice.facilityId);
          return (
            <Card key={invoice.id}>
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">{facility?.name} · {invoice.periodStart} – {invoice.periodEnd} · {invoice.status} · ${invoice.total.toFixed(2)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="text-sm font-medium text-primary" href={`/billing/${invoice.id}`}>Print view</Link>
                  {invoice.status === "draft" ? <InvoiceStatusButton id={invoice.id} status="review" /> : null}
                  {invoice.status === "approved" ? <InvoiceStatusButton id={invoice.id} status="sent" /> : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
