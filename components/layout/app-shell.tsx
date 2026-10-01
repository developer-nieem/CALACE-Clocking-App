"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { PwaInstallBanner } from "@/components/layout/pwa-install";
import { MobileNav } from "@/components/phase4/mobile-nav";
import { LocationPermissionPrompt } from "@/components/time-clock/location-permission";
import type { Profile, SessionUser, Shift, TaskItem } from "@/types";

export function AppShell({
  user,
  unreadCount,
  instructors,
  shifts,
  tasks,
  searchItems = [],
  children,
}: {
  user: SessionUser;
  unreadCount: number;
  instructors: Profile[];
  shifts: Shift[];
  tasks: TaskItem[];
  searchItems?: Array<{ id: string; group: string; label: string; href: string }>;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
            roles={user.roles}
            flags={user.featureFlags}
          />
        </div>
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative h-full w-[240px]">
            <Sidebar
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              roles={user.roles}
              flags={user.featureFlags}
              mobile
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {process.env.NEXT_PUBLIC_APP_ENV === "staging" ? (
          <div className="bg-accent px-3 py-1 text-center text-xs font-semibold text-primary">STAGING</div>
        ) : null}
        <TopNav
          user={user}
          unreadCount={unreadCount}
          onMenuClick={() => setMobileOpen(true)}
          instructors={instructors}
          shifts={shifts}
          tasks={tasks}
          searchItems={searchItems}
        />
        <main className="flex-1 p-4 pb-24 md:p-6 lg:pb-6">
          <PwaInstallBanner />
          <LocationPermissionPrompt />
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
