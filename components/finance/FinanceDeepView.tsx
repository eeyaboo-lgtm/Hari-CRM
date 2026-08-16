"use client";

// Simplifi-inspired "Deep view" for Finance — turns the data already entered
// in Standard view into charts/meters instead of new data entry. Toggled via
// the Standard/Deep switch in app/finance/page.tsx; this component only
// reads props, never mutates state.
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import type { MonthlyProjectionPoint, BudgetStatus } from "@/lib/financeUtils";
import { COLORS, STATUS_HEX } from "@/lib/financeUtils";

const tooltipStyle = {
  background: "#20222e",
  border: "1px solid #2a2d3a",
  borderRadius: 12,
  fontSize: 12,
  color: "#e5e7eb",
};

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="glass-card rounded-xl2 p-5">
      <h3 className="relative z-10 font-medium text-white">{title}</h3>
      {subtitle && <p className="relative z-10 mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      <div className="relative z-10 mt-4">{children}</div>
    </section>
  );
}

/** Radial "meter" gauge — hand-rolled SVG, no extra dependency for a single arc. */
function BudgetGauge({ ratioPct, status, label }: { ratioPct: number; status: BudgetStatus; label: string }) {
  const clamped = Math.min(Math.max(ratioPct, 0), 100);
  const r = 70;
  const circumference = Math.PI * r; // half circle
  const offset = circumference * (1 - clamped / 100);
  const color = STATUS_HEX[status];
  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="100" viewBox="0 0 180 100">
        <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#2a2d3a" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <p className="-mt-8 text-2xl font-semibold text-white">{Math.round(clamped)}%</p>
      <p className="mt-1 text-center text-xs text-gray-500">{label}</p>
    </div>
  );
}

export function CashFlowChart({ data }: { data: MonthlyProjectionPoint[] }) {
  const hasData = data.some((d) => d.total > 0);
  return (
    <ChartCard title="Projected cash flow" subtitle="Committed outflow per month, next 12 months — loans drop off automatically when paid off">
      {!hasData ? (
        <p className="py-10 text-center text-xs text-gray-500">No loans, subscriptions, or scheme items yet — add some in Standard view to see this fill in.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="cashflowFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.5} />
                <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
            <XAxis dataKey="month" stroke="#6b7280" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis stroke="#6b7280" tickLine={false} axisLine={false} fontSize={12} width={40} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => Math.round(v).toLocaleString()} />
            <Area type="monotone" dataKey="total" stroke={COLORS.purple} strokeWidth={2} fill="url(#cashflowFill)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function SpendCategoryDonut({
  loans,
  cards,
  subs,
  schemes,
  expenses = 0,
}: {
  loans: number;
  cards: number;
  subs: number;
  schemes: number;
  expenses?: number;
}) {
  const raw = [
    { name: "Loans", value: loans, color: COLORS.blue },
    { name: "Cards", value: cards, color: COLORS.pink },
    { name: "Subscriptions", value: subs, color: COLORS.orange },
    { name: "Payment schemes", value: schemes, color: COLORS.green },
    { name: "Other expenses", value: expenses, color: COLORS.purple },
  ].filter((d) => d.value > 0);
  const total = raw.reduce((s, d) => s + d.value, 0);

  return (
    <ChartCard title="Where money is going" subtitle="This month's committed outflow, by category">
      {total === 0 ? (
        <p className="py-10 text-center text-xs text-gray-500">Nothing committed this month yet.</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative h-[160px] w-[160px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={raw} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} strokeWidth={0}>
                  {raw.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => Math.round(v).toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-semibold text-white">{Math.round(total).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            {raw.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-gray-300">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  {d.name}
                </span>
                <span className="text-gray-400">{Math.round((d.value / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export function BudgetMeterCard({ outflow, budget, status }: { outflow: number; budget: number; status: BudgetStatus }) {
  const ratioPct = budget > 0 ? (outflow / budget) * 100 : 0;
  const label = budget > 0 ? `${Math.round(outflow).toLocaleString()} of ${budget.toLocaleString()} budget` : "No monthly budget set";
  return (
    <ChartCard title="Budget meter">
      <div className="flex items-center justify-center py-2">
        <BudgetGauge ratioPct={ratioPct} status={status} label={label} />
      </div>
    </ChartCard>
  );
}

export function CurrencyBalancesBars({ totals, hideBalances }: { totals: Record<string, number>; hideBalances: boolean }) {
  const data = Object.entries(totals).map(([currency, value]) => ({ currency, value: Math.round(value) }));
  return (
    <ChartCard title="Balances by currency" subtitle="Across all accounts in the current filter">
      {hideBalances ? (
        <p className="py-10 text-center text-xs text-gray-500">Balances hidden — toggle &ldquo;Balances hidden&rdquo; above to reveal this chart.</p>
      ) : data.length === 0 ? (
        <p className="py-10 text-center text-xs text-gray-500">No accounts yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="currency" type="category" stroke="#9ca3af" tickLine={false} axisLine={false} fontSize={13} width={44} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toLocaleString()} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} fill={COLORS.blue} barSize={22} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/**
 * Simplifi-style "Spending Plan" — recurring monthly income minus committed
 * monthly outflow, converted to one currency via lib/financeUtils.ts's
 * convertAmount(). Red when negative takes priority over the usual
 * ratio-based status (see spendingPlanStatus()) since a real household
 * shortfall matters more than which color band it lands in. Shown at the
 * top of both Standard and Deep view — this is the single most-requested
 * piece of Simplifi-style math from the LifeOS strategy session.
 */
export function SpendingPlanBanner({
  safeToSpend,
  monthlyIncome,
  monthlyOutflow,
  status,
  currency,
  hasIncome,
}: {
  safeToSpend: number;
  monthlyIncome: number;
  monthlyOutflow: number;
  status: BudgetStatus;
  currency: string;
  hasIncome: boolean;
}) {
  const color = STATUS_HEX[status];
  return (
    <section className="glass-card rounded-xl2 p-5">
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
          <div>
            <h3 className="font-medium text-white">Spending Plan</h3>
            {hasIncome ? (
              <p className="mt-0.5 text-xs text-gray-500">
                {Math.round(monthlyIncome).toLocaleString()} recurring income − {Math.round(monthlyOutflow).toLocaleString()} committed
                outflow, converted to {currency}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-gray-500">
                No recurring income entered yet — add one in the Income section below to see a real safe-to-spend number.
              </p>
            )}
          </div>
        </div>
        {hasIncome && (
          <p className="text-2xl font-semibold" style={{ color }}>
            {safeToSpend < 0 ? "-" : ""}
            {Math.round(Math.abs(safeToSpend)).toLocaleString()} {currency}
            <span className="ml-1.5 text-xs font-normal text-gray-500">/mo safe to spend</span>
          </p>
        )}
      </div>
    </section>
  );
}
