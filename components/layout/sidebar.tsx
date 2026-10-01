"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { navSections, visibleNav } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";
import type { FeatureFlagMap } from "@/lib/features";
import type { AppRole } from "@/lib/permissions";

export function Sidebar({
  collapsed,
  onToggle,
  roles,
  flags,
  mobile = false,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  roles: AppRole[];
  flags?: FeatureFlagMap | null;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = visibleNav(navSections, roles, flags);
  const width = collapsed && !mobile ? "w-[76px]" : "w-[240px]";

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground transition-all duration-200",
        width,
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <Logo collapsed={collapsed && !mobile} />
        {!mobile ? (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {sections.map((section) => (
          <div key={section.title || "root"} className="mb-4">
            {section.title && !collapsed ? (
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                {section.title}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={item.label}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:bg-white/5 hover:text-white",
                      collapsed && !mobile && "justify-center px-0",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md",
                        active ? "bg-accent text-primary" : "text-white/80",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {(!collapsed || mobile) && (
                      <span className="flex-1 truncate">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
