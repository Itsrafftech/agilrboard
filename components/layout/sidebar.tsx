"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutGrid,
  KanbanSquare,
  ListTodo,
  Rocket,
  BarChart3,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

function useProjectId() {
  const pathname = usePathname();
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

function navItems(projectId: string | null) {
  return [
    { label: "Projects", href: "/projects", icon: LayoutGrid, enabled: true },
    { label: "Board", href: projectId ? `/projects/${projectId}/board` : "", icon: KanbanSquare, enabled: !!projectId },
    { label: "Backlog", href: projectId ? `/projects/${projectId}/backlog` : "", icon: ListTodo, enabled: !!projectId },
    { label: "Sprint", href: projectId ? `/projects/${projectId}/sprint` : "", icon: Rocket, enabled: !!projectId },
    { label: "Reports", href: projectId ? `/projects/${projectId}/reports` : "", icon: BarChart3, enabled: !!projectId },
    { label: "Team", href: projectId ? `/projects/${projectId}/team` : "", icon: Users, enabled: !!projectId },
  ];
}

function NavList({ pathname, projectId, onNavigate }: { pathname: string; projectId: string | null; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 px-3">
      {navItems(projectId).map((item) => {
        const active = item.enabled && pathname.startsWith(item.href) && item.href !== "";
        const Icon = item.icon;
        if (!item.enabled) {
          return (
            <div
              key={item.label}
              className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300"
              title="Select a project first"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </div>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserFooter() {
  const { data: session } = useSession();
  const user = session?.user;
  return (
    <div className="border-t border-slate-100 p-3">
      <div className="flex items-center gap-2 rounded-lg px-2 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
          {initials(user?.name, user?.email)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{user?.name ?? "User"}</p>
          <p className="truncate text-xs text-slate-400">{user?.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const projectId = useProjectId();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-semibold text-white">
            A
          </div>
          <span className="text-sm font-semibold text-slate-900">AgileBoard</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-64 flex flex-col bg-white border-r border-slate-100">
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-sm font-semibold text-slate-900">AgileBoard</span>
              <button onClick={() => setMobileOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavList pathname={pathname} projectId={projectId} onNavigate={() => setMobileOpen(false)} />
            <UserFooter />
          </div>
          <div className="flex-1 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:border-slate-100 md:bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-semibold text-white">
            A
          </div>
          <span className="text-sm font-semibold text-slate-900">AgileBoard</span>
        </div>
        <NavList pathname={pathname} projectId={projectId} />
        <UserFooter />
      </aside>
    </>
  );
}
