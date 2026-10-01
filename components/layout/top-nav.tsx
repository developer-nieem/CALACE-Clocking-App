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
    <header className="flex h-16 items-center gap-3 border-b border-border bg-card px-4">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="hidden text-sm font-semibold text-primary sm:block lg:hidden">
        CAL ACE
      </div>
      <div className="flex flex-1 justify-center">
        <GlobalSearch instructors={instructors} shifts={shifts} tasks={tasks} extras={searchItems} />
      </div>
      <div className="flex items-center gap-1">
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
