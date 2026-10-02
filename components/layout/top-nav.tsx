"use client";

import Link from "next/link";
import { Bell, HelpCircle, Menu, MessageSquare } from "lucide-react";
import { GlobalSearch } from "@/components/layout/global-search";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import type { Profile, SessionUser, Shift, TaskItem } from "@/types";

export function TopNav({
  user,
  unreadCount,
  onMenuClick,
  instructors,
  shifts,
  tasks,
  searchItems = [],
}: {
  user: SessionUser;
  unreadCount: number;
  onMenuClick: () => void;
  instructors: Profile[];
  shifts: Shift[];
  tasks: TaskItem[];
  searchItems?: Array<{ id: string; group: string; label: string; href: string }>;
}) {
  return (
    <header className="flex h-16 min-w-0 items-center gap-2 border-b border-border bg-card px-3 sm:gap-3 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 lg:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="hidden shrink-0 text-sm font-semibold text-primary sm:block lg:hidden">
        CAL ACE
      </div>
      <div className="min-w-0 flex-1">
        <GlobalSearch instructors={instructors} shifts={shifts} tasks={tasks} extras={searchItems} />
      </div>
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <Link
          href="/notifications"
          className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
          ) : null}
        </Link>
        <Link
          href="/chat"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Messages"
        >
          <MessageSquare className="h-5 w-5" />
        </Link>
        <Link
          href="/help"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Help"
        >
          <HelpCircle className="h-5 w-5" />
        </Link>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
