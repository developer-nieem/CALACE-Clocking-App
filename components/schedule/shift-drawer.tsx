"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deleteShiftAction,
  cancelShiftAction,
  duplicateShiftAction,
  evaluateWarningsAction,
  publishShiftAction,
  saveShiftAction,
} from "@/app/actions/workforce";
import { SHIFT_COLORS } from "@/lib/constants";
import { canOverrideWarnings } from "@/lib/permissions";
import { fullName } from "@/lib/utils";
import type {
  Department,
  Location,
  Position,
  Profile,
  SchedulingWarning,
  SessionUser,
  Shift,
  ShiftTemplate,
} from "@/types";

export function ShiftDrawer({
  open,
  onOpenChange,
  shift,
  instructors,
  locations,
  departments,
  positions,
  templates,
  user,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: Shift | null;
  instructors: Profile[];
  locations: Location[];
  departments: Department[];
  positions: Position[];
  templates: ShiftTemplate[];
  user: SessionUser;
  defaultDate: string;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(shift?.title ?? "CNA Theory - Morning");
  const [date, setDate] = useState(shift?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(shift?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(shift?.endTime ?? "13:00");
  const [instructorIds, setInstructorIds] = useState<string[]>(shift?.instructorIds ?? []);
  const [locationId, setLocationId] = useState(shift?.locationId ?? locations[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState(shift?.departmentId ?? departments[0]?.id ?? "");
  const [positionId, setPositionId] = useState(shift?.positionId ?? positions[0]?.id ?? "");
  const [classCohort, setClassCohort] = useState(shift?.classCohort ?? "CNA Cohort A");
  const [color, setColor] = useState<string>(shift?.color ?? SHIFT_COLORS[0]);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(shift?.breakDurationMinutes ?? 15);
  const [notes, setNotes] = useState(shift?.notes ?? "");
  const [tasks, setTasks] = useState(shift?.tasks.join("\n") ?? "");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [overrideWarnings, setOverrideWarnings] = useState(false);
  const [warnings, setWarnings] = useState<SchedulingWarning[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const payload = useMemo(
    () => ({
      id: shift?.id,
      title,
      date,
      startTime,
      endTime,
      instructorIds,
      locationId,
      departmentId,
      classCohort,
      positionId,
      color,
      breakDurationMinutes,
      notes,
      tasks: tasks
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      saveAsTemplate,
      overrideWarnings,
      isOpen: instructorIds.length === 0,
      requiredInstructors: Math.max(1, instructorIds.length || 1),
      status: shift?.status ?? "draft",
    }),
    [
      breakDurationMinutes,
      classCohort,
      color,
      date,
      departmentId,
      endTime,
      instructorIds,
      locationId,
      notes,
      overrideWarnings,
      positionId,
      saveAsTemplate,
      shift?.id,
      shift?.status,
      startTime,
      tasks,
      title,
    ],
  );

  useEffect(() => {
    if (!open || instructorIds.length === 0) {
      return;
    }
    const handle = setTimeout(() => {
      void evaluateWarningsAction(payload).then(setWarnings);
    }, 250);
    return () => clearTimeout(handle);
  }, [instructorIds.length, open, payload]);

  const visibleWarnings = instructorIds.length === 0 ? [] : warnings;

  function submit(publish: boolean) {
    startTransition(async () => {
      const result = await saveShiftAction(payload, publish);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (result && "ok" in result && result.ok === false) {
        setWarnings(result.warnings);
        toast.error("Resolve or override scheduling warnings before publishing.");
        return;
      }
      toast.success(publish ? "Shift published" : "Draft saved");
      onOpenChange(false);
    });
  }

  const canManage = user.permissions.includes("schedules.manage");
  const allowOverride = canOverrideWarnings(user.roles);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{shift ? "Edit shift" : "Add shift"}</SheetTitle>
            <SheetDescription>
              Assign one or more employees. Blocking conflicts must be resolved or overridden before the shift is saved.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-6 py-5">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                onValueChange={(id) => {
                  const template = templates.find((item) => item.id === id);
                  if (!template) return;
                  setTitle(template.title);
                  setStartTime(template.startTime);
                  setEndTime(template.endTime);
                  setLocationId(template.locationId ?? "");
                  setDepartmentId(template.departmentId ?? "");
                  setClassCohort(template.classCohort ?? "");
                  setColor(template.color);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Start from a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Title" value={title} onChange={setTitle} />
            <Field label="Date" value={date} onChange={setDate} type="date" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start time" value={startTime} onChange={setStartTime} type="time" />
              <Field label="End time" value={endTime} onChange={setEndTime} type="time" />
            </div>
            <div className="space-y-2">
              <Label>Employees</Label>
              <div className="max-h-40 space-y-2 overflow-auto rounded-lg border border-border p-3">
                {instructors.map((instructor) => {
                  const checked = instructorIds.includes(instructor.id);
                  return (
                    <label key={instructor.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setInstructorIds((current) =>
                            value
                              ? [...current, instructor.id]
                              : current.filter((id) => id !== instructor.id),
                          );
                        }}
                      />
                      {fullName(instructor.firstName, instructor.lastName)}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Location"
                value={locationId}
                onChange={setLocationId}
                options={locations.map((item) => ({ id: item.id, name: item.name }))}
              />
              <SelectField
                label="Department"
                value={departmentId}
                onChange={setDepartmentId}
                options={departments.map((item) => ({ id: item.id, name: item.name }))}
              />
            </div>
            <SelectField
              label="Position"
              value={positionId}
              onChange={setPositionId}
              options={positions.map((item) => ({ id: item.id, name: item.name }))}
            />
            <Field label="Class / Cohort" value={classCohort} onChange={setClassCohort} />
            <Field
              label="Break (minutes)"
              value={String(breakDurationMinutes)}
              onChange={(value) => setBreakDurationMinutes(Number(value))}
              type="number"
            />
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {SHIFT_COLORS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setColor(value)}
                    className="h-7 w-7 rounded-full border border-border"
                    style={{
                      backgroundColor: value,
                      outline: color === value ? "2px solid #D8B53C" : undefined,
                    }}
                    aria-label={value}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tasks (one per line)</Label>
              <Textarea value={tasks} onChange={(event) => setTasks(event.target.value)} />
            </div>
            {visibleWarnings.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {visibleWarnings.map((warning) => (
                  <p key={`${warning.code}-${warning.message}`}>⚠ {warning.message}</p>
                ))}
                {allowOverride ? (
                  <label className="flex items-center gap-2 pt-1">
                    <Checkbox
                      checked={overrideWarnings}
                      onCheckedChange={(value) => setOverrideWarnings(Boolean(value))}
                    />
                    Override warnings and continue
                  </label>
                ) : (
                  <p>You do not have permission to override these warnings.</p>
                )}
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={saveAsTemplate}
                onCheckedChange={(value) => setSaveAsTemplate(Boolean(value))}
              />
              Save as template
            </label>
            {canManage ? (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={pending}
                    onClick={() => submit(false)}
                  >
                    Save Draft
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={pending}
                    onClick={() => submit(true)}
                  >
                    Publish Shift
                  </Button>
                </div>
                {shift ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      onClick={() =>
                        startTransition(async () => {
                          await duplicateShiftAction(shift.id);
                          toast.success("Shift duplicated");
                          onOpenChange(false);
                        })
                      }
                    >
                      Duplicate
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      onClick={() =>
                        startTransition(async () => {
                          await publishShiftAction(shift.id, shift.status !== "published");
                          toast.success(
                            shift.status === "published" ? "Shift unpublished" : "Shift published",
                          );
                          onOpenChange(false);
                        })
                      }
                    >
                      {shift.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        if (shift.status === "draft") {
                          setConfirmDelete(true);
                          return;
                        }
                        startTransition(async () => {
                          const result = await cancelShiftAction(shift.id);
                          if ("error" in result && result.error) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success("Shift cancelled");
                          onOpenChange(false);
                        });
                      }}
                    >
                      {shift.status === "draft" ? "Delete Draft" : "Cancel Shift"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
          <AlertDialogTitle>{shift?.status === "draft" ? "Delete this draft?" : "Delete this shift?"}</AlertDialogTitle>
          <AlertDialogDescription>
            Draft shifts can be deleted. Published shifts stay in history and should be cancelled instead.
          </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!shift) return;
                startTransition(async () => {
                  await deleteShiftAction(shift.id);
                  toast.success("Shift deleted");
                  setConfirmDelete(false);
                  onOpenChange(false);
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
