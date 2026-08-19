"use client";

import { useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import SnapshotChart from "@/components/charts/SnapshotChart";
import CategoryDonut from "@/components/charts/CategoryDonut";
import QuickAddModal from "@/components/QuickAddModal";
import AlertsBanner from "@/components/AlertsBanner";
import {
  DashboardHeroSubtitle,
  UpcomingPaymentsCard,
  BudgetStatusDot,
  useSpendingTrend,
  useSpendingCategorySplit,
} from "@/components/DashboardLiveWidgets";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { QUICK_LAUNCH_STORAGE_KEY, DEFAULT_QUICK_LAUNCH, QUICK_LAUNCH_GRADIENT, type QuickLaunchItem } from "@/lib/quickLaunch";
import {
  HeartPulse,
  Activity,
  Wallet,
  Briefcase,
  Sparkles,
  Award,
  ChevronRight,
} from "lucide-react";

// Finance widgets below are live (components/DashboardLiveWidgets.tsx, reads
// the same localStorage keys as app/finance/page.tsx). The trend chart and
// category donut are real too, as of 2026-08-19 — see useSpendingTrend/
// useSpendingCategorySplit in DashboardLiveWidgets.tsx for what they
// compute and why they're framed as a projection, not history.

export default function DashboardPage() {
  // Quick Launch is user-customizable from Settings (Phase 0 backlog) — see
  // lib/quickLaunch.ts for the shared type/storage key/color lookup (used
  // by both this page and Settings, so they never drift).
  const [quickLaunch] = useLocalStorage<QuickLaunchItem[]>(QUICK_LAUNCH_STORAGE_KEY, DEFAULT_QUICK_LAUNCH);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const trendData = useSpendingTrend(6);
  const categoryData = useSpendingCategorySplit();

  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />

      <main className="flex-1 space-y-6 p-6">
        <TopBar />
        <AlertsBanner />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left + center column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Hero card — replaces "Transfer money to your bank" */}
            <div className="glass-card flex items-center justify-between rounded-xl2 p-6">
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-white">
                  This month at a glance
                </h2>
                <DashboardHeroSubtitle />
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(true)}
                  className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-base-bg shadow-lg transition-transform hover:scale-[1.03]"
                >
                  Quick add
                </button>
                <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
              </div>
              <div className="relative z-10 hidden h-24 w-24 rounded-full bg-gradient-to-br from-accent-purple to-accent-blue opacity-60 blur-[2px] shadow-glow-purple sm:block" />
            </div>

            {/* Upcoming payments (live) + quick launch cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <UpcomingPaymentsCard />

              <div className="space-y-4">
                {quickLaunch.length === 0 && (
                  <Link href="/settings" className="glass-card block rounded-xl2 p-5 text-center text-xs text-gray-500 hover:text-white">
                    No quick launch shortcuts yet — add some in Settings.
                  </Link>
                )}
                {quickLaunch.map((app) => (
                  <a
                    key={app.id}
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`glossy-gradient block rounded-xl2 bg-gradient-to-br p-5 transition-transform hover:scale-[1.02] ${QUICK_LAUNCH_GRADIENT[app.color]}`}
                  >
                    <p className="relative z-10 text-xs uppercase tracking-wide text-white/80">Quick launch</p>
                    <p className="relative z-10 mt-2 text-lg font-semibold text-white">{app.label}</p>
                    <p className="relative z-10 text-xs text-white/80">{app.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</p>
                  </a>
                ))}
              </div>
            </div>

            {/* Module shortcuts */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
              {[
                { label: "Health", href: "/health", icon: HeartPulse, color: "text-accent-pink" },
                { label: "Fitness", href: "/fitness", icon: Activity, color: "text-accent-blue" },
                { label: "Finance", href: "/finance", icon: Wallet, color: "text-accent-blue" },
                { label: "Business", href: "/business", icon: Briefcase, color: "text-accent-purple" },
                { label: "Vision Board", href: "/vision", icon: Sparkles, color: "text-accent-green" },
                { label: "Memberships", href: "/memberships", icon: Award, color: "text-accent-orange" },
              ].map(({ label, href, icon: Icon, color }) => (
                <Link
                  key={label}
                  href={href}
                  className="glass-card flex flex-col items-start gap-3 rounded-xl2 p-4 text-left transition-colors hover:bg-white/[0.06]"
                >
                  <Icon className={`relative z-10 ${color}`} size={20} />
                  <span className="relative z-10 flex w-full items-center justify-between text-sm text-gray-200">
                    {label}
                    <ChevronRight size={14} className="text-gray-500" />
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Right column — reports + category split */}
          <div className="space-y-6">
            <div className="glass-card rounded-xl2 p-5">
              <div className="relative z-10 mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-medium text-white">
                  <BudgetStatusDot /> Committed outflow (projected)
                </h3>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-400">
                  Next 6 months
                </span>
              </div>
              <div className="relative z-10">
                <SnapshotChart data={trendData} />
              </div>
            </div>

            <div className="glass-card rounded-xl2 p-5">
              <h3 className="relative z-10 mb-2 font-medium text-white">Where money is going</h3>
              <div className="relative z-10">
                <CategoryDonut data={categoryData} />
              </div>
              <div className="relative z-10 mt-4 space-y-2 text-sm">
                {categoryData.map((slice) => (
                  <div key={slice.name} className="flex items-center justify-between text-gray-300">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} /> {slice.name}
                    </span>
                    <span>{slice.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
