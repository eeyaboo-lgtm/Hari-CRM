// Single source of truth for the app's main section nav — used by both the
// desktop Sidebar and the mobile hamburger drawer (MobileNav) so the two
// never drift out of sync when a new section is added. Add a new page here
// once and it shows up in both places automatically.

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
  Rocket,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  // Admin-only items (e.g. the internal strategy memo) are filtered out of
  // both Sidebar and MobileNav for non-admin household members.
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid, href: "/dashboard" },
  { key: "calendar", label: "Calendar", icon: CalendarDays, href: "/calendar" },
  { key: "health", label: "Health & Insurance", icon: HeartPulse, href: "/health" },
  { key: "fitness", label: "Fitness", icon: Activity, href: "/fitness" },
  { key: "finance", label: "Finance", icon: Wallet, href: "/finance" },
  { key: "business", label: "Business Projects", icon: Briefcase, href: "/business" },
  { key: "vision", label: "Vision & Mood Board", icon: Sparkles, href: "/vision" },
  { key: "memberships", label: "Memberships", icon: Award, href: "/memberships" },
  { key: "settings", label: "Settings", icon: Settings, href: "/settings" },
  { key: "strategy", label: "Strategy Memo", icon: Rocket, href: "/strategy", adminOnly: true },
];

// True when the current pathname belongs to one of the sections above —
// used to decide whether the mobile nav affordance should render at all
// (not on /login, /legal, auth flows, etc).
export function isNavRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return NAV_ITEMS.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
}
