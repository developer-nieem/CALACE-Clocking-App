"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  answerScheduleAction,
  applyAutoFillAction,
  generateAutoFillAction,
  rejectAutoFillAction,
  scheduleHealthAction,
} from "@/app/actions/phase4";
import { Button } from "@/components/ui/button";
import type { ScheduleRecommendation } from "@/types";

export function AutoFillPanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [recommendation, setRecommendation] = useState<ScheduleRecommendation | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [health, setHealth] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  function run() {
    startTransition(async () => {
      const result = await generateAutoFillAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRecommendation(result.recommendation);
      setSelected(result.recommendation.items.map((item) => item.id));
      toast.success("Recommendations are ready to review. Nothing was published.");
    });
  }

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Schedule assistant</h2>
          <p className="text-sm text-muted-foreground">
            Auto fill proposes draft assignments. You review them before anything is published.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={run}>
            Auto Fill Schedule
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await scheduleHealthAction();
                if (!result.ok) toast.error(result.error);
                else {
                  setHealth(
                    `Coverage ${result.health.coverage}%. Unfilled ${result.health.unfilled}. Overtime risks ${result.health.overtimeRisks}. Conflicts ${result.health.conflicts}.`,
                  );
                }
              })
            }
          >
            Optimize Schedule
          </Button>
        </div>
      </div>
      {health ? <p className="mt-3 text-sm">{health}</p> : null}
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await answerScheduleAction(question);
            if (!result.ok) toast.error(result.error);
            else setAnswer([result.answer, ...result.rows].join(" "));
          });
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Who is available, which shifts are unfilled, or who is near overtime?"
          className="h-10 min-w-0 flex-1 rounded-lg border bg-card px-3 text-sm"
        />
        <Button type="submit" variant="outline">
          Ask
        </Button>
      </form>
      {answer ? <p className="mt-2 text-sm text-muted-foreground">{answer}</p> : null}
      {recommendation ? (
        <div className="mt-4 space-y-3">
          {recommendation.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unassigned draft shifts need a recommendation.</p>
          ) : (
            recommendation.items.map((item) => (
              <label key={item.id} className="block rounded-lg border border-border p-3 text-sm">
                <span className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <span>
                    <span className="font-medium">Score {item.score}</span>
                    <span className="mt-1 block">{item.reasons.join(" · ")}</span>
                    {item.warnings.length ? (
                      <span className="mt-1 block text-amber-700">{item.warnings.join(" · ")}</span>
                    ) : null}
                    {item.alternatives.length ? (
                      <span className="mt-1 block text-muted-foreground">
                        Alternatives: {item.alternatives.map((alternative) => `${alternative.name} ${alternative.score}`).join(", ")}
                      </span>
                    ) : null}
                  </span>
                </span>
              </label>
            ))
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending || selected.length === 0}
              onClick={() =>
                startTransition(async () => {
                  const result = await applyAutoFillAction(recommendation.id, selected);
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast.success("Assignments saved as drafts.");
                    router.refresh();
                  }
                })
              }
            >
              Apply Recommendations
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await rejectAutoFillAction(
                    recommendation.id,
                    recommendation.items.map((item) => item.id),
                  );
                  if (!result.ok) toast.error(result.error);
                  else {
                    setRecommendation(null);
                    toast.success("Recommendations rejected. No assignments were made.");
                  }
                })
              }
            >
              Reject Recommendation
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
