"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveActivityEmailInstructorsAction } from "@/app/actions/phase5";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { fullName } from "@/lib/utils";
import type { Profile } from "@/types";

export function InstructorActivityEmailCard({
  instructors,
  selectedIds,
  emailConfigured,
}: {
  instructors: Profile[];
  selectedIds: string[];
  emailConfigured: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(selectedIds);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Instructor activity emails</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This matches the Screen capture check mark on Add / Edit employee. Checked people
          email admins a screenshot at a random 3–7 minute interval. Pictures are not saved in the database.
        </p>
        {!emailConfigured ? (
          <p className="text-sm text-amber-700">
            Email is not configured. Add SMTP in Settings, or set RESEND_API_KEY and EMAIL_FROM.
          </p>
        ) : null}
        {instructors.length ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                try {
                  await saveActivityEmailInstructorsAction(selected);
                  toast.success("Activity email instructors saved.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not save instructors.");
                }
              });
            }}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {instructors.map((instructor) => {
                const id = instructor.id;
                const checked = selected.includes(id);
                return (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => {
                        setSelected((current) =>
                          value === true ? [...current, id] : current.filter((item) => item !== id),
                        );
                      }}
                    />
                    <span>
                      {fullName(instructor.firstName, instructor.lastName)}
                      <span className="block text-xs text-muted-foreground">{instructor.email}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save instructor emails"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">No active instructors yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
