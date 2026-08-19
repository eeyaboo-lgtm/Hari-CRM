"use client";

import {
  LayoutGrid,
  CalendarDays,
  HeartPulse,
  Activity,
  Wallet,
  Briefcase,
  Sparkles,
  Award,
  Settings,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid, href: "/dashboard" },
  { key: "calendar", label: "Calendar", icon: CalendarDays, href: "/calendar" },
  { key: "health", label: "Health & Insurance", icon: HeartPulse, href: "/health" },
  { key: "fitness", label: "Fitness", icon: Activity, href: "/fitness" },
  { key: "finance", label: "Finance", icon: Wallet, href: "/finance" },
  { key: "business", label: "Business Projects", icon: Briefcase, href: "/business" },
  { key: "vision", label: "Vision & Mood Board", icon: Sparkles, href: "/vision" },
  { key: "memberships", label: "Memberships", icon: Award, href: "/memberships" },
  { key: "settings", label: "Settings", icon: Settings, href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between border-r border-white/5 bg-white/[0.03] p-5 backdrop-blur-xl">
      <div>
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="h-3 w-3 rounded-sm bg-accent-blue shadow-glow-blue" />
          <div className="h-3 w-3 rounded-full bg-accent-pink shadow-glow-pink" />
          <div
            className="h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-accent-orange"
            aria-hidden
          />
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map(({ key, label, icon: Icon, href }) => {
            const isActive = pathname === href || pathname?.startsWith(href + "/");
            return (
              <Link
                key={key}
                href={href}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "glossy-gradient bg-gradient-to-r from-accent-purple to-accent-blue text-white shadow-glow-purple"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <span className="relative z-10 flex items-center gap-3">
                  <Icon size={18} />
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3">
        <div className="glass-card rounded-xl2 p-4">
          <p className="relative z-10 text-sm font-medium text-gray-100">Status check</p>
          <p className="relative z-10 mt-1 text-xs text-gray-400">
            ShelfPulse & RetailSuite health is one card away — see Business Projects.
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            // This browser's household/profile cache is shared across
            // whichever account signs in on it — clear it on the way out
            // so the next person (or the next account you sign into on
            // this device) never sees a stale roster from this session.
            try {
              window.localStorage.removeItem("household.members");
              window.sessionStorage.removeItem("household.activeMemberId");
              window.sessionStorage.removeItem("household.unlocked");
              window.localStorage.removeItem("admin.viewingHouseholdId");
            } catch {}
            await logout();
          }}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-red-300"
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </aside>
  );
}
