"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { inviteUserAction, updateUserAction } from "@/app/actions/workforce";
import type {
  Department,
  EmployeeType,
  Location,
  PayType,
  Position,
  Profile,
} from "@/types";
import type { AppRole } from "@/lib/permissions";

export function InviteUserDrawer({
  open,
  onOpenChange,
  positions,
  departments,
  locations,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positions: Position[];
  departments: Department[];
  locations: Location[];
}) {
  return (
    <UserFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      positions={positions}
      departments={departments}
      locations={locations}
      title="Add employee"
      description="Create a login for a new CAL ACE team member."
    />
  );
}

export function UserFormDrawer({
  open,
  onOpenChange,
  positions,
  departments,
  locations,
  user,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positions: Position[];
  departments: Department[];
  locations: Location[];
  user?: Profile;
  title: string;
  description: string;
}) {
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<AppRole>(user?.roles[0] ?? "staff");
  const [employeeType, setEmployeeType] = useState<EmployeeType>(
    user?.employeeType ?? "staff",
  );
  const [payType, setPayType] = useState<PayType>(user?.payType ?? "hourly");
  const [positionId, setPositionId] = useState(user?.positionId ?? "");
  const [departmentId, setDepartmentId] = useState(user?.departmentId ?? "");
  const [primaryLocationId, setPrimaryLocationId] = useState(
    user?.primaryLocationId ?? "",
  );
  const [status, setStatus] = useState(user?.employmentStatus ?? "invited");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-lg" data-testid="invite-user-sheet">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-1 flex-col gap-4 px-6 py-5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            startTransition(async () => {
              const password = String(form.get("password") ?? "");
              const confirmPassword = String(form.get("confirmPassword") ?? "");
              if (!user && password.length < 8) {
                toast.error("Password must be at least 8 characters.");
                return;
              }
              if (password && password !== confirmPassword) {
                toast.error("Passwords do not match.");
                return;
              }
              const payload = {
                id: user?.id,
                firstName: String(form.get("firstName") ?? ""),
                lastName: String(form.get("lastName") ?? ""),
                email: String(form.get("email") ?? ""),
                password,
                phone: String(form.get("phone") ?? ""),
                employeeType,
                role,
                positionId,
                departmentId,
                primaryLocationId,
                payType,
                hourlyRate:
                  payType === "hourly"
                    ? Number(form.get("hourlyRate") ?? 0)
                    : null,
                weeklyTargetHours: Number(form.get("weeklyTargetHours") ?? 40),
                maximumWeeklyHours: Number(
                  form.get("maximumWeeklyHours") ?? 40,
                ),
                hireDate: String(form.get("hireDate") ?? "") || null,
                employmentStatus: status,
              };
              const result = user
                ? await updateUserAction(payload)
                : await inviteUserAction(payload);
              if ("error" in result && result.error) toast.error(result.error);
              else {
                toast.success(user ? "User updated" : "Employee added");
                onOpenChange(false);
              }
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" name="firstName" defaultValue={user?.firstName} />
            <Field label="Last name" name="lastName" defaultValue={user?.lastName} />
          </div>
          <Field label="Email" name="email" type="email" defaultValue={user?.email} />
          <Field
            label={user ? "New password (optional)" : "Password"}
            name="password"
            type="password"
            autoComplete="new-password"
            required={!user}
          />
          <Field
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required={!user}
          />
          <Field label="Phone" name="phone" defaultValue={user?.phone ?? ""} />
          <div className="space-y-2">
            <Label>Employee Type</Label>
            <Select
              value={employeeType}
              onValueChange={(value) => setEmployeeType(value as EmployeeType)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="instructor">Instructor</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instructor">Instructor</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="scheduler">Scheduler</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Position</Label>
            <Select value={positionId} onValueChange={setPositionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Primary Location</Label>
            <Select
              value={primaryLocationId}
              onValueChange={setPrimaryLocationId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select primary location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field
            label="Hire Date"
            name="hireDate"
            type="date"
            defaultValue={user?.hireDate ?? ""}
          />
          <div className="space-y-2">
            <Label>Pay Type</Label>
            <Select
              value={payType}
              onValueChange={(value) => setPayType(value as PayType)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="salary">Salary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {payType === "hourly" ? (
            <Field
              label="Hourly Rate"
              name="hourlyRate"
              type="number"
              step="0.01"
              defaultValue={String(user?.hourlyRate ?? "")}
            />
          ) : null}
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {user ? (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as Profile["employmentStatus"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Weekly Target Hours"
              name="weeklyTargetHours"
              type="number"
              step="0.25"
              defaultValue={String(user?.weeklyTargetHours ?? 40)}
            />
            <Field
              label="Maximum Weekly Hours"
              name="maximumWeeklyHours"
              type="number"
              step="0.25"
              defaultValue={String(user?.maximumWeeklyHours ?? 40)}
            />
          </div>
          <div className="mt-auto flex gap-2 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {user ? "Save changes" : "Add employee"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  step,
  autoComplete,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  step?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        step={step}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={required ?? !["phone", "hireDate"].includes(name)}
      />
    </div>
  );
}
