"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { csvCell } from "@/lib/money";
import {
  acknowledgeAnnouncementAction,
  addFacilityLocationAction,
  addFormFieldAction,
  addOnboardingItemAction,
  addPayrollAdjustmentAction,
  assignEmployeeFacilityAction,
  assignOnboardingAction,
  assignTrainingAction,
  completeOnboardingItemAction,
  completeTrainingAction,
  exportDatasetAction,
  exportPayrollCsvAction,
  generateInvoiceDraftAction,
  lockPayPeriodAction,
  reviewTimesheetAction,
  saveAnnouncementAction,
  saveArticleAction,
  saveBillingRateAction,
  saveCustomFieldAction,
  saveDashboardPreferenceAction,
  saveFacilityAction,
  saveFacilityContactAction,
  saveFormAction,
  saveOnboardingTemplateAction,
  saveOrganizationProfileAction,
  savePolicyAction,
  saveSavedViewAction,
  saveTagAction,
  saveTrainingAction,
  setInvoiceStatusAction,
  submitFormAction,
  submitTimesheetAction,
  terminateEmployeeAction,
  unlockPayPeriodAction,
  acknowledgePolicyAction,
} from "@/app/actions/phase5";
import { deleteUserAction } from "@/app/actions/workforce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormField, InvoiceStatus, OrgForm } from "@/types";

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function FacilityForm() {
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          try {
            await saveFacilityAction({
              name: data.get("name"),
              facilityType: data.get("facilityType"),
              status: "active",
              addressLine1: data.get("addressLine1"),
              city: data.get("city"),
              phone: data.get("phone"),
              email: data.get("email") || null,
              billingEnabled: data.get("billingEnabled") === "on",
            });
            toast.success("Facility saved.");
            event.currentTarget.reset();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save facility.");
          }
        });
      }}
    >
      <div><Label htmlFor="facility-name">Name</Label><Input id="facility-name" name="name" required /></div>
      <div>
        <Label htmlFor="facility-type">Type</Label>
        <select id="facility-type" name="facilityType" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="clinical_site">Clinical site</option>
          <option value="training_site">Training site</option>
          <option value="client">Client</option>
          <option value="office">Office</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div><Label htmlFor="facility-address">Address</Label><Input id="facility-address" name="addressLine1" /></div>
      <div><Label htmlFor="facility-city">City</Label><Input id="facility-city" name="city" /></div>
      <div><Label htmlFor="facility-phone">Phone</Label><Input id="facility-phone" name="phone" /></div>
      <div><Label htmlFor="facility-email">Email</Label><Input id="facility-email" name="email" type="email" /></div>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" name="billingEnabled" /> Billing enabled
      </label>
      <Button type="submit" disabled={pending} className="md:col-span-2">Create facility</Button>
    </form>
  );
}

export function FacilityContactForm({ facilityId }: { facilityId: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          await saveFacilityContactAction({
            facilityId,
            firstName: data.get("firstName"),
            lastName: data.get("lastName"),
            title: data.get("title"),
            email: data.get("email") || null,
            phone: data.get("phone"),
            isPrimary: data.get("isPrimary") === "on",
          });
          toast.success("Contact added.");
          event.currentTarget.reset();
        });
      }}
    >
      <Input name="firstName" placeholder="First name" required />
      <Input name="lastName" placeholder="Last name" required />
      <Input name="title" placeholder="Title" />
      <Input name="email" type="email" placeholder="Email" />
      <Input name="phone" placeholder="Phone" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPrimary" /> Primary</label>
      <Button type="submit" disabled={pending} className="sm:col-span-2">Add contact</Button>
    </form>
  );
}

export function FacilityLocationForm({ facilityId }: { facilityId: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          await addFacilityLocationAction({
            facilityId,
            name: data.get("name"),
            address: data.get("address"),
          });
          toast.success("Job site added.");
          event.currentTarget.reset();
        });
      }}
    >
      <Input name="name" placeholder="Location name" required />
      <Input name="address" placeholder="Address" />
      <Button type="submit" disabled={pending}>Add location</Button>
    </form>
  );
}

export function AssignEmployeeForm({
  facilityId,
  employees,
}: {
  facilityId: string;
  employees: Array<{ id: string; label: string }>;
}) {
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          await assignEmployeeFacilityAction({
            facilityId,
            userId: String(data.get("userId")),
            isPrimary: true,
          });
          toast.success("Employee assigned.");
        });
      }}
    >
      <select name="userId" className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm">
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>{employee.label}</option>
        ))}
      </select>
      <Button type="submit" disabled={pending}>Assign</Button>
    </form>
  );
}

export function BillingRateForm({ facilityId }: { facilityId: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2 sm:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          await saveBillingRateAction({
            facilityId,
            billingRate: data.get("billingRate"),
            effectiveFrom: data.get("effectiveFrom"),
          });
          toast.success("Billing rate saved. Earlier periods keep the previous rate.");
          event.currentTarget.reset();
        });
      }}
    >
      <Input name="billingRate" type="number" step="0.01" min="0" placeholder="Rate / hour" required />
      <Input name="effectiveFrom" type="date" required />
      <Button type="submit" disabled={pending}>Save rate</Button>
    </form>
  );
}

export function OnboardingAdminForms({
  templates,
  employees,
}: {
  templates: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; label: string }>;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          start(async () => {
            await saveOnboardingTemplateAction({ name: data.get("name"), employeeType: data.get("employeeType") || null });
            toast.success("Template created.");
          });
        }}
      >
        <Input name="name" placeholder="Template name" required />
        <select name="employeeType" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Any employee type</option>
          <option value="instructor">Instructor</option>
          <option value="staff">Staff</option>
        </select>
        <Button type="submit" disabled={pending}>Create template</Button>
      </form>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          start(async () => {
            await addOnboardingItemAction({
              templateId: data.get("templateId"),
              title: data.get("title"),
              itemType: data.get("itemType"),
              isRequired: true,
            });
            toast.success("Checklist item added.");
          });
        }}
      >
        <select name="templateId" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
        <Input name="title" placeholder="Item title" required />
        <select name="itemType" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="task">Task</option>
          <option value="form">Form</option>
          <option value="document_upload">Document upload</option>
          <option value="acknowledgement">Acknowledgement</option>
          <option value="link">Link</option>
          <option value="profile_field">Profile field</option>
          <option value="training">Training</option>
        </select>
        <Button type="submit" disabled={pending}>Add item</Button>
      </form>
      <form
        className="space-y-2 lg:col-span-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          start(async () => {
            await assignOnboardingAction({
              userId: String(data.get("userId")),
              templateId: String(data.get("templateId")),
            });
            toast.success("Onboarding assigned.");
          });
        }}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <select name="userId" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.label}</option>)}
          </select>
          <select name="templateId" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
          <Button type="submit" disabled={pending}>Assign employee</Button>
        </div>
      </form>
    </div>
  );
}

export function CompleteItemButton({ itemId }: { itemId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await completeOnboardingItemAction({ itemId });
          toast.success("Item completed.");
        })
      }
    >
      Mark complete
    </Button>
  );
}

export function FormBuilder({ forms }: { forms: Array<{ id: string; title: string }> }) {
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          start(async () => {
            await saveFormAction({ title: data.get("title"), description: data.get("description"), status: data.get("status") });
            toast.success("Form saved.");
          });
        }}
      >
        <Input name="title" placeholder="Form title" required />
        <Textarea name="description" placeholder="Description" />
        <select name="status" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <Button type="submit" disabled={pending}>Save form</Button>
      </form>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          start(async () => {
            await addFormFieldAction({
              formId: data.get("formId"),
              fieldType: data.get("fieldType"),
              label: data.get("label"),
              required: data.get("required") === "on",
            });
            toast.success("Field added.");
          });
        }}
      >
        <select name="formId" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          {forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}
        </select>
        <Input name="label" placeholder="Field label" required />
        <select name="fieldType" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="short_text">Short text</option>
          <option value="long_text">Long text</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
          <option value="time">Time</option>
          <option value="dropdown">Dropdown</option>
          <option value="radio">Radio</option>
          <option value="checkbox">Checkbox</option>
          <option value="yes_no">Yes / No</option>
          <option value="signature">Signature</option>
          <option value="file_upload">File upload</option>
          <option value="section_heading">Section heading</option>
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="required" /> Required</label>
        <Button type="submit" disabled={pending}>Add field</Button>
      </form>
    </div>
  );
}

export function FormFill({ form, fields }: { form: OrgForm; fields: FormField[] }) {
  const [pending, start] = useTransition();
  const [signature, setSignature] = useState("");
  const [drawn, setDrawn] = useState("");
  const [method, setMethod] = useState<"typed" | "drawn">("typed");
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const values: Record<string, unknown> = {};
        for (const field of fields) {
          values[field.id] = field.fieldType === "signature" ? (method === "drawn" ? drawn : signature) : data.get(field.id);
        }
        start(async () => {
          try {
            await submitFormAction({
              formId: form.id,
              values,
              signatureMethod: method,
              userAgent: navigator.userAgent,
            });
            toast.success("Form submitted. Signature evidence is stored for the signed-in user only.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not submit.");
          }
        });
      }}
    >
      {fields.map((field) => (
        <div key={field.id}>
          {field.fieldType === "section_heading" ? (
            <h3 className="text-sm font-semibold">{field.label}</h3>
          ) : (
            <>
              <Label htmlFor={field.id}>{field.label}{field.required ? " *" : ""}</Label>
              {field.fieldType === "long_text" ? (
                <Textarea id={field.id} name={field.id} required={field.required} />
              ) : field.fieldType === "signature" ? (
                <div className="space-y-2">
                  <Input
                    id={field.id}
                    value={signature}
                    onChange={(event) => {
                      setMethod("typed");
                      setSignature(event.target.value);
                    }}
                    placeholder="Type your full name as signature"
                    required={field.required && !drawn}
                  />
                  <p className="text-xs text-muted-foreground">Or draw below. This is an evidence foundation, not a claim of full legal compliance.</p>
                  <canvas
                    className="h-24 w-full cursor-crosshair rounded-md border border-input bg-white"
                    onPointerDown={(event) => {
                      const canvas = event.currentTarget;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) return;
                      canvas.setPointerCapture(event.pointerId);
                      ctx.beginPath();
                      ctx.moveTo(event.nativeEvent.offsetX, event.nativeEvent.offsetY);
                    }}
                    onPointerMove={(event) => {
                      if (event.buttons === 0) return;
                      const ctx = event.currentTarget.getContext("2d");
                      if (!ctx) return;
                      ctx.lineTo(event.nativeEvent.offsetX, event.nativeEvent.offsetY);
                      ctx.stroke();
                      setMethod("drawn");
                      setDrawn(event.currentTarget.toDataURL("image/png"));
                    }}
                  />
                </div>
              ) : field.fieldType === "yes_no" ? (
                <select id={field.id} name={field.id} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required={field.required}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <Input id={field.id} name={field.id} required={field.required} type={field.fieldType === "email" ? "email" : field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"} />
              )}
            </>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        This e-signature records who signed, when, and the form version. It is a foundation only and does not claim to meet every legal e-signature standard.
      </p>
      <Button type="submit" disabled={pending}>Submit</Button>
    </form>
  );
}

export function AnnouncementForm() {
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          await saveAnnouncementAction({
            title: data.get("title"),
            message: data.get("message"),
            audienceKind: data.get("audienceKind"),
            publishAt: new Date().toISOString(),
            priority: data.get("priority"),
            requireAcknowledgement: data.get("requireAcknowledgement") === "on",
          });
          toast.success("Announcement published.");
        });
      }}
    >
      <Input name="title" placeholder="Title" required />
      <Textarea name="message" placeholder="Message" required />
      <div className="grid gap-2 sm:grid-cols-2">
        <select name="audienceKind" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="everyone">Everyone</option>
          <option value="instructors">Instructors</option>
          <option value="staff">Staff</option>
        </select>
        <select name="priority" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="normal">Normal</option>
          <option value="important">Important</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requireAcknowledgement" /> Require acknowledgement</label>
      <Button type="submit" disabled={pending}>Publish</Button>
    </form>
  );
}

export function AcknowledgeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" disabled={pending} onClick={() => start(async () => { await acknowledgeAnnouncementAction(id); toast.success("Acknowledged."); })}>
      Acknowledge
    </Button>
  );
}

export function ArticleForm({ categories }: { categories: Array<{ id: string; name: string }> }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          await saveArticleAction({
            title: data.get("title"),
            categoryId: data.get("categoryId"),
            summary: data.get("summary"),
            content: data.get("content"),
            audienceKind: data.get("audienceKind"),
            status: "published",
          });
          toast.success("Article published.");
        });
      }}
    >
      <Input name="title" placeholder="Title" required />
      <select name="categoryId" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
      <Input name="summary" placeholder="Summary" />
      <Textarea name="content" placeholder="Content" required />
      <select name="audienceKind" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        <option value="everyone">Everyone</option>
        <option value="instructors">Instructors</option>
        <option value="staff">Staff</option>
      </select>
      <Button type="submit" disabled={pending}>Publish article</Button>
    </form>
  );
}

export function TrainingForm() {
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          await saveTrainingAction({
            title: data.get("title"),
            resourceType: data.get("resourceType"),
            url: data.get("url"),
            content: data.get("content"),
          });
          toast.success("Training resource saved.");
        });
      }}
    >
      <Input name="title" placeholder="Title" required />
      <select name="resourceType" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        <option value="article">Article</option>
        <option value="video_link">Video link</option>
        <option value="pdf">PDF</option>
        <option value="external_link">External link</option>
        <option value="checklist">Checklist</option>
        <option value="document">Document</option>
      </select>
      <Input name="url" placeholder="URL" />
      <Textarea name="content" placeholder="Notes" />
      <Button type="submit" disabled={pending}>Add resource</Button>
    </form>
  );
}

export function CompleteTrainingButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <Button size="sm" disabled={pending} onClick={() => start(async () => { await completeTrainingAction(id); })}>Complete</Button>;
}

export function PayrollActions({
  periodId,
  timesheetId,
  canApprove,
  canLock,
  canExport,
}: {
  periodId: string;
  timesheetId?: string;
  canApprove?: boolean;
  canLock?: boolean;
  canExport?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={pending} onClick={() => start(async () => { await submitTimesheetAction(periodId); toast.success("Timesheet submitted."); })}>
        Submit timesheet
      </Button>
      {canApprove && timesheetId ? (
        <>
          <Button size="sm" disabled={pending} onClick={() => start(async () => { await reviewTimesheetAction({ timesheetId, decision: "approve" }); toast.success("Approved."); })}>
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt("Rejection reason");
              if (!reason) return;
              start(async () => { await reviewTimesheetAction({ timesheetId, decision: "reject", reason }); });
            }}
          >
            Return
          </Button>
        </>
      ) : null}
      {canLock ? (
        <>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { await lockPayPeriodAction(periodId); toast.success("Period locked."); })}>
            Lock period
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt("Unlock reason (required)");
              if (!reason) return;
              start(async () => { await unlockPayPeriodAction({ payPeriodId: periodId, reason }); toast.success("Unlocked."); });
            }}
          >
            Unlock
          </Button>
        </>
      ) : null}
      {canExport ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const csv = await exportPayrollCsvAction(periodId);
              download("payroll.csv", csv);
            })
          }
        >
          Export CSV
        </Button>
      ) : null}
    </div>
  );
}

export function AdjustmentForm({ periodId, employees }: { periodId: string; employees: Array<{ id: string; label: string }> }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          await addPayrollAdjustmentAction({
            payPeriodId: periodId,
            userId: data.get("userId"),
            adjustmentType: data.get("adjustmentType"),
            amount: data.get("amount"),
            description: data.get("description"),
          });
          toast.success("Adjustment added. Taxes are not calculated.");
        });
      }}
    >
      <select name="userId" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.label}</option>)}
      </select>
      <select name="adjustmentType" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
        <option value="bonus">Bonus</option>
        <option value="reimbursement">Reimbursement</option>
        <option value="manual_pay">Manual pay</option>
        <option value="manual_hours">Manual hours</option>
        <option value="other">Other</option>
      </select>
      <Input name="amount" type="number" step="0.01" placeholder="Amount" required />
      <Input name="description" placeholder="Description" required />
      <Button type="submit" disabled={pending} className="sm:col-span-2">Add adjustment</Button>
    </form>
  );
}

export function InvoiceDraftForm({ facilities }: { facilities: Array<{ id: string; name: string }> }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          await generateInvoiceDraftAction({
            facilityId: data.get("facilityId"),
            periodStart: data.get("periodStart"),
            periodEnd: data.get("periodEnd"),
            notes: data.get("notes"),
          });
          toast.success("Draft invoice generated. It was not sent.");
        });
      }}
    >
      <select name="facilityId" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
        {facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
      </select>
      <Input name="notes" placeholder="Notes" />
      <Input name="periodStart" type="date" required />
      <Input name="periodEnd" type="date" required />
      <Button type="submit" disabled={pending} className="sm:col-span-2">Generate draft</Button>
    </form>
  );
}

export function InvoiceStatusButton({ id, status }: { id: string; status: InvoiceStatus }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { await setInvoiceStatusAction(id, status); })}>
      Mark {status}
    </Button>
  );
}

export function DataExportButtons() {
  const [pending, start] = useTransition();
  const kinds = ["employees", "schedules", "attendance", "timesheets", "tasks", "facilities", "invoices", "audit"];
  return (
    <div className="flex flex-wrap gap-2">
      {kinds.map((kind) => (
        <Button
          key={kind}
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                const csv = await exportDatasetAction(kind);
                download(`${kind}.csv`, csv);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Export failed.");
              }
            })
          }
        >
          {kind}
        </Button>
      ))}
    </div>
  );
}

export function OrgSettingsForm() {
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          await saveOrganizationProfileAction({
            organizationAddress: String(data.get("organizationAddress") ?? ""),
            organizationPhone: String(data.get("organizationPhone") ?? ""),
            organizationEmail: String(data.get("organizationEmail") ?? ""),
            idleSessionMinutes: Number(data.get("idleSessionMinutes") || 30),
            requireReauthSensitive: data.get("requireReauthSensitive") === "on",
            chatRetentionDays: data.get("chatRetentionDays") ? Number(data.get("chatRetentionDays")) : null,
          });
          toast.success("Settings saved.");
        });
      }}
    >
      <Input name="organizationAddress" placeholder="Address" />
      <Input name="organizationPhone" placeholder="Phone" />
      <Input name="organizationEmail" type="email" placeholder="Email" />
      <Input name="idleSessionMinutes" type="number" placeholder="Idle timeout minutes" />
      <Input name="chatRetentionDays" type="number" placeholder="Chat retention days" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requireReauthSensitive" /> Reauth for sensitive actions</label>
      <Button type="submit" disabled={pending} className="md:col-span-2">Save organization settings</Button>
    </form>
  );
}

export function TerminateButtons({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await terminateEmployeeAction({ userId, mode: "archived" });
            if (result.ok) toast.success("Archived. History kept.");
            else toast.error(result.error);
          })
        }
      >
        Archive
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await terminateEmployeeAction({ userId, mode: "terminated" });
            if (result.ok) toast.success("Terminated. Clock-in and future scheduling blocked.");
            else toast.error(result.error);
          })
        }
      >
        Terminate
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        className="text-destructive"
        onClick={() =>
          start(async () => {
            if (!window.confirm("Delete this employee permanently? This cannot be undone.")) return;
            const result = await deleteUserAction(userId);
            if ("error" in result && result.error) toast.error(result.error);
            else {
              toast.success("Employee deleted");
              window.location.href = "/users";
            }
          })
        }
      >
        Delete
      </Button>
    </div>
  );
}

export function PolicyForm() {
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          await savePolicyAction({ title: String(data.get("title")), content: String(data.get("content")) });
          toast.success("Policy published.");
        });
      }}
    >
      <Input name="title" placeholder="Policy title" required />
      <Textarea name="content" placeholder="Policy text" required />
      <Button type="submit" disabled={pending}>Publish policy</Button>
    </form>
  );
}

export function AcknowledgePolicyButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" disabled={pending} onClick={() => start(async () => { await acknowledgePolicyAction(id, navigator.userAgent); toast.success("Acknowledged."); })}>
      Acknowledge
    </Button>
  );
}

export function TrainingAssignForm({
  resources,
  employees,
}: {
  resources: Array<{ id: string; title: string }>;
  employees: Array<{ id: string; label: string }>;
}) {
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2 sm:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          await assignTrainingAction({ resourceId: String(data.get("resourceId")), userId: String(data.get("userId")) });
          toast.success("Training assigned.");
        });
      }}
    >
      <select name="resourceId" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
        {resources.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
      <select name="userId" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
        {employees.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <Button type="submit" disabled={pending}>Assign</Button>
    </form>
  );
}

export function ExtraSettingsForms() {
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); start(async () => { await saveCustomFieldAction({ name: String(data.get("name")), fieldType: String(data.get("fieldType")) as "text" | "number" | "date" | "dropdown" | "checkbox" | "yes_no" }); toast.success("Custom field added."); }); }}>
        <Input name="name" placeholder="Custom field name" required />
        <select name="fieldType" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
          <option value="dropdown">Dropdown</option>
          <option value="checkbox">Checkbox</option>
          <option value="yes_no">Yes / No</option>
        </select>
        <Button type="submit" disabled={pending}>Add field</Button>
      </form>
      <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); start(async () => { await saveTagAction(String(data.get("name"))); toast.success("Tag added."); }); }}>
        <Input name="name" placeholder="Tag name" required />
        <Button type="submit" disabled={pending}>Add tag</Button>
      </form>
      <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); start(async () => { await saveSavedViewAction({ module: data.get("module") as "users", name: String(data.get("name")), filters: { q: String(data.get("filters") ?? "") } }); toast.success("Saved view created."); }); }}>
        <Input name="name" placeholder="Saved view name" required />
        <select name="module" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="users">Users</option>
          <option value="schedule">Schedule</option>
          <option value="attendance">Attendance</option>
          <option value="timesheets">Timesheets</option>
          <option value="tasks">Tasks</option>
          <option value="reports">Reports</option>
        </select>
        <Input name="filters" placeholder="Filter text" />
        <Button type="submit" disabled={pending}>Save view</Button>
      </form>
    </div>
  );
}

export function DashboardCustomize({ hidden }: { hidden: string[] }) {
  const [pending, start] = useTransition();
  const widgets = [
    ["attendance", "Today's Attendance"],
    ["open_shifts", "Open Shifts"],
    ["pending", "Pending Requests"],
    ["tasks", "Overdue Tasks"],
  ];
  return (
    <form
      className="flex flex-wrap gap-3 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const next = widgets.filter(([id]) => !data.get(id)).map(([id]) => id);
        start(async () => {
          await saveDashboardPreferenceAction(next);
          toast.success("Dashboard widgets saved.");
        });
      }}
    >
      {widgets.map(([id, label]) => (
        <label key={id} className="flex items-center gap-2">
          <input type="checkbox" name={id} defaultChecked={!hidden.includes(id)} />
          {label}
        </label>
      ))}
      <Button type="submit" size="sm" disabled={pending}>Save widgets</Button>
    </form>
  );
}

export function CsvDownload({ filename, rows }: { filename: string; rows: Array<Record<string, string | number>> }) {
  return (
    <Button
      size="sm"
      variant="outline"
      type="button"
      onClick={() => {
        if (!rows.length) return;
        const headers = Object.keys(rows[0]);
        const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(","))].join("\n");
        download(filename, csv);
      }}
    >
      Export CSV
    </Button>
  );
}
