"use client";

import BrandMark from "@/components/BrandMark";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import { NAV_ITEMS } from "@/lib/navItems";
import { useHousehold } from "@/lib/HouseholdContext";
import { clearSyncedLocalCaches } from "@/lib/supabase/ownerMap";

export default function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useHousehold();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between border-r border-white/5 bg-white/[0.03] p-5 backdrop-blur-xl">
      <div>
        <div className="mb-8 flex items-center gap-2 px-2">
          <BrandMark size={44} />
        </div>

        <nav className="space-y-1">
          {items.map(({ key, label, icon: Icon, href }) => {
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
            Your pinned shortcuts&rsquo; health is one card away — see Business Projects.
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
              clearSyncedLocalCaches();
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
