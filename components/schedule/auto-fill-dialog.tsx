"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { applyAutoFillAction, proposeAutoFillAction } from "@/app/actions/workforce";
import { fullName } from "@/lib/utils";
import type { Profile } from "@/types";

export function AutoFillDialog({
  rangeStart,
  rangeEnd,
  instructors,
}: {
  rangeStart: string;
  rangeEnd: string;
  instructors: Profile[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof proposeAutoFillAction>>
  >([]);
  const [selected, setSelected] = useState<Record<string, string>>({});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="accent"
          onClick={() => {
            startTransition(async () => {
              const proposals = await proposeAutoFillAction(rangeStart, rangeEnd);
              setRows(proposals);
              setSelected(
                Object.fromEntries(
                  proposals
                    .filter((row) => row.proposals[0])
                    .map((row) => [row.shift.id, row.proposals[0].instructorId]),
                ),
              );
            });
          }}
        >
          Auto Fill Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review proposed assignments</DialogTitle>
          <DialogDescription>
            Deterministic ranking is used now. An AI ranking service can replace this later.
            Nothing is published until you review and save drafts.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[420px] space-y-3 overflow-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {pending ? "Ranking instructors…" : "No unassigned shifts in this week."}
            </p>
          ) : (
            rows.map((row) => (
              <div key={row.shift.id} className="rounded-lg border border-border p-3">
                <p className="font-medium">{row.shift.title}</p>
                <p className="text-xs text-muted-foreground">
                  {row.shift.date} · {row.shift.startTime}–{row.shift.endTime}
                </p>
                <div className="mt-2 space-y-2">
                  {row.proposals.map((proposal) => {
                    const person = instructors.find((item) => item.id === proposal.instructorId);
                    return (
                      <label key={proposal.instructorId} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={selected[row.shift.id] === proposal.instructorId}
                          onCheckedChange={() =>
                            setSelected((current) => ({
                              ...current,
                              [row.shift.id]: proposal.instructorId,
                            }))
                          }
                        />
                        <span>
                          {person ? fullName(person.firstName, person.lastName) : "Instructor"} · score{" "}
                          {Math.round(proposal.score)}
                          <span className="block text-xs text-muted-foreground">
                            {proposal.reasons.join(" · ")}
                            {proposal.warnings.length
                              ? ` · ${proposal.warnings.length} warning(s)`
                              : ""}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
        <Button
          disabled={pending || rows.length === 0}
          onClick={() =>
            startTransition(async () => {
              const assignments = Object.entries(selected).map(([shiftId, instructorId]) => ({
                shiftId,
                instructorId,
              }));
              const result = await applyAutoFillAction(assignments);
              if ("error" in result && result.error) toast.error(result.error);
              else {
                toast.success("Draft assignments saved. Review and publish when ready.");
                setOpen(false);
              }
            })
          }
        >
          Save draft assignments
        </Button>
      </DialogContent>
    </Dialog>
  );
}
