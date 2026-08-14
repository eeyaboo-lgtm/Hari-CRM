import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import SnapshotChart from "@/components/charts/SnapshotChart";
import CategoryDonut from "@/components/charts/CategoryDonut";
import {
  HeartPulse,
  Wallet,
  Briefcase,
  Sparkles,
  ChevronRight,
} from "lucide-react";

// All numbers/lists below are placeholders until each module's queries are
// wired up (tasks #7/#8) — laid out to match the reference screenshot's grid,
// content reworked from "banking app" to "household life dashboard."

const RECENT_UPDATES = [
  { label: "Loan installment due", who: "Shenaal", when: "18 Aug", pct: 50, color: "bg-accent-blue" },
  { label: "Insurance renewal logged", who: "Shalini", when: "20 Aug", pct: 25, color: "bg-accent-purple" },
  { label: "ShelfPulse health check", who: "Shared", when: "Today", pct: 15, color: "bg-accent-orange" },
  { label: "Vision board item added", who: "Shalini", when: "12 Aug", pct: 10, color: "bg-accent-green" },
];

const QUICK_LAUNCH = [
  { name: "ShelfPulse", url: "https://shelfpulse-j820.onrender.com/", status: "healthy" },
  { name: "RetailSuite", url: "https://retailsuite.onrender.com/", status: "healthy" },
];

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />

      <main className="flex-1 space-y-6 p-6">
        <TopBar />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left + center column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Hero card — replaces "Transfer money to your bank" */}
            <div className="flex items-center justify-between rounded-xl2 bg-gradient-to-br from-base-panel to-base-card p-6">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  This month at a glance
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  3 bills due, 1 appointment upcoming, 2 projects healthy.
                </p>
                <button className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-base-bg">
                  Quick add
                </button>
              </div>
              <div className="hidden h-24 w-24 rounded-full bg-gradient-to-br from-accent-purple/40 to-accent-blue/40 sm:block" />
            </div>

            {/* Recent updates list + quick launch cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-xl2 bg-base-panel p-5">
                <h3 className="mb-4 font-medium text-white">Recent updates</h3>
                <div className="space-y-4">
                  {RECENT_UPDATES.map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-200">{item.label}</p>
                        <p className="text-xs text-gray-500">
                          {item.who} · {item.when}
                        </p>
                      </div>
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium text-white ${item.color}`}
                      >
                        {item.pct}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl2 bg-gradient-to-br from-pink-500/80 to-rose-400/80 p-5">
                  <p className="text-xs uppercase tracking-wide text-white/80">Quick launch</p>
                  <p className="mt-2 text-lg font-semibold text-white">ShelfPulse</p>
                  <p className="text-xs text-white/80">shelfpulse-j820.onrender.com</p>
                </div>
                <div className="rounded-xl2 bg-gradient-to-br from-sky-500/80 to-blue-500/80 p-5">
                  <p className="text-xs uppercase tracking-wide text-white/80">Quick launch</p>
                  <p className="mt-2 text-lg font-semibold text-white">RetailSuite</p>
                  <p className="text-xs text-white/80">retailsuite.onrender.com</p>
                </div>
              </div>
            </div>

            {/* Module shortcuts */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Health", icon: HeartPulse, color: "text-accent-pink" },
                { label: "Finance", icon: Wallet, color: "text-accent-blue" },
                { label: "Business", icon: Briefcase, color: "text-accent-purple" },
                { label: "Vision Board", icon: Sparkles, color: "text-accent-green" },
              ].map(({ label, icon: Icon, color }) => (
                <button
                  key={label}
                  className="flex flex-col items-start gap-3 rounded-xl2 bg-base-panel p-4 text-left hover:bg-base-card"
                >
                  <Icon className={color} size={20} />
                  <span className="flex w-full items-center justify-between text-sm text-gray-200">
                    {label}
                    <ChevronRight size={14} className="text-gray-500" />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right column — reports + category split */}
          <div className="space-y-6">
            <div className="rounded-xl2 bg-base-panel p-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium text-white">Spending trend</h3>
                <span className="rounded-full bg-base-card px-3 py-1 text-xs text-gray-400">
                  6 months
                </span>
              </div>
              <SnapshotChart />
            </div>

            <div className="rounded-xl2 bg-base-panel p-5">
              <h3 className="mb-2 font-medium text-white">Where attention is going</h3>
              <CategoryDonut />
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between text-gray-300">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-accent-blue" /> Finance
                  </span>
                  <span>45%</span>
                </div>
                <div className="flex items-center justify-between text-gray-300">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-accent-pink" /> Health
                  </span>
                  <span>25%</span>
                </div>
                <div className="flex items-center justify-between text-gray-300">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-accent-purple" /> Business
                  </span>
                  <span>20%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
