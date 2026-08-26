"use client";

// Mobile menu — phones had NO way to move between sections at all. Sidebar
// is desktop-only (`hidden md:flex`) and MobileBackButton only goes back one
// step in history, so on a phone you were stuck on whatever page you landed
// on unless you knew the URL. This is a hamburger button that opens a
// slide-out drawer with the same section list as the desktop Sidebar,
// sourced from the same lib/navItems.ts so the two can't drift apart as
// pages are added.
//
// Positioned fixed bottom-left, mobile only. Every other corner is already
// spoken for on phones: MobileBackButton owns top-left, Dashboard's TopBar
// renders a bell + avatar switcher that reaches the top-right on mobile,
// and GlobalSearch's trigger + SaveStatusIndicator both live bottom-right —
// bottom-left is the one spot nothing else uses.
//
// Mounted once in app/layout.tsx, inside ProfileGate (so it only appears
// once a household/profile is actually unlocked — same treatment as
// GlobalSearch).

import { useEffect, useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import { NAV_ITEMS, isNavRoute } from "@/lib/navItems";
import { useHousehold } from "@/lib/HouseholdContext";
import { clearSyncedLocalCaches } from "@/lib/supabase/ownerMap";

export default function MobileNav() {
  const pathname = usePathname();
  const { isAdmin } = useHousehold();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const [open, setOpen] = useState(false);

  // Close automatically on any route change (covers back/forward nav, not
  // just taps on a Link inside the drawer).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock page scroll behind the drawer while it's open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!isNavRoute(pathname)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="glass-card fixed bottom-4 left-3 z-50 flex h-11 w-11 items-center justify-center rounded-full text-gray-200 shadow-lg md:hidden"
      >
        <Menu size={20} className="relative z-10" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col justify-between border-r border-white/5 bg-base-bg/95 p-5 shadow-2xl backdrop-blur-xl">
            <div>
              <div className="mb-6 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-accent-blue shadow-glow-blue" />
                  <div className="h-3 w-3 rounded-full bg-accent-pink shadow-glow-pink" />
                  <div
                    className="h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-accent-orange"
                    aria-hidden
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="space-y-1">
                {items.map(({ key, label, icon: Icon, href }) => {
                  const isActive = pathname === href || pathname?.startsWith(href + "/");
                  return (
                    <Link
                      key={key}
                      href={href}
                      onClick={() => setOpen(false)}
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

            <button
              type="button"
              onClick={async () => {
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
          </aside>
        </div>
      )}
    </>
  );
}
