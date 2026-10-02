"use client";

import Link from "next/link";
import { useState } from "react";
import { logoutAction } from "@/lib/auth/actions";

const links = [
  { href: "/dashboard", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/time-clock", label: "Time Clock" },
  { href: "/tasks", label: "Tasks" },
];

const more = [
  { href: "/chat", label: "Chat" },
  { href: "/notifications", label: "Notifications" },
  { href: "/time-off", label: "Time Off" },
  { href: "/availability", label: "Availability" },
  { href: "/open-shifts", label: "Open Shifts" },
  { href: "/forms", label: "Forms" },
  { href: "/knowledge-base", label: "Knowledge Base" },
  { href: "/updates", label: "Updates" },
  { href: "/training", label: "Training" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/directory", label: "Documents" },
  { href: "/policies", label: "Policies" },
  { href: "/directory", label: "Profile" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="grid grid-cols-5">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="flex min-h-11 items-center justify-center px-1 py-3 text-center text-[11px] font-medium leading-tight sm:text-xs">
            {link.label}
          </Link>
        ))}
        <button type="button" className="flex min-h-11 items-center justify-center px-1 py-3 text-[11px] font-medium sm:text-xs" onClick={() => setOpen((value) => !value)}>
          More
        </button>
      </div>
      {open ? (
        <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
          {more.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-lg bg-muted px-3 py-2 text-sm" onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <form action={logoutAction} className="col-span-2">
            <button type="submit" className="w-full rounded-lg bg-muted px-3 py-2 text-left text-sm">
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </nav>
  );
}
