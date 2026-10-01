"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { groupSearch } from "@/lib/phase3/domain";
import type { Profile, Shift, TaskItem } from "@/types";

export function GlobalSearch({
  instructors,
  shifts,
  tasks,
  extras = [],
}: {
  instructors: Profile[];
  shifts: Shift[];
  tasks: TaskItem[];
  extras?: Array<{ id: string; group: string; label: string; href: string }>;
}) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const results = useMemo(() => {
    const base = groupSearch(query, { people: instructors, shifts, tasks });
    const q = query.trim().toLowerCase();
    if (q.length < 2) return base;
    const extra = extras
      .filter((item) => item.label.toLowerCase().includes(q))
      .map((item) => ({ group: item.group, id: `${item.group}-${item.id}`, label: item.label, href: item.href }));
    const seen = new Set(base.map((item) => `${item.group}-${item.label}`));
    return [...base, ...extra.filter((item) => !seen.has(`${item.group}-${item.label}`))].slice(0, 16);
  }, [extras, instructors, query, shifts, tasks]);

  return (
    <div className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search anything"
        className="h-10 rounded-full border-border bg-muted/60 pl-9"
        aria-label="Search"
      />
      {results.length > 0 ? (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                setQuery("");
                router.push(result.href);
              }}
            >
              <span className="text-xs uppercase text-muted-foreground">{result.group}</span>
              <span>{result.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
