import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { getPhase5Context } from "@/lib/db/phase5";

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("billing.manage");
  const { id } = await params;
  const { state } = await getPhase5Context();
  const invoice = state.invoices.find((item) => item.id === id);
  if (!invoice) notFound();
  const facility = state.facilities.find((item) => item.id === invoice.facilityId);
  const items = state.invoiceItems.filter((item) => item.invoiceId === invoice.id);
  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-6 text-black print:p-0">
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-semibold">CAL ACE Workforce</h1>
          <p className="text-sm">{state.settings.organizationAddress || "Organization address"}</p>
          <p className="text-sm">{state.settings.organizationEmail || ""}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{invoice.invoiceNumber}</p>
          <p className="text-sm">{invoice.status}</p>
        </div>
      </div>
      <div>
        <p className="font-medium">Bill to</p>
        <p>{facility?.name}</p>
        <p className="text-sm">{[facility?.addressLine1, facility?.city, facility?.state].filter(Boolean).join(", ")}</p>
        <p className="text-sm">Period {invoice.periodStart} – {invoice.periodEnd}</p>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Date</th>
            <th>Description</th>
            <th>Hours</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-2">{item.serviceDate}</td>
              <td>{item.description}</td>
              <td>{item.hours}</td>
              <td>${item.rate.toFixed(2)}</td>
              <td>${item.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-right font-semibold">Total ${invoice.total.toFixed(2)}</p>
      <p className="text-xs text-neutral-600">Print this page for a paper copy. A dedicated PDF engine is not required in Phase 5.</p>
    </div>
  );
}
