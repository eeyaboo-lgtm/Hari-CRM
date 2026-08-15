"use client";

// Live Finance data on the Dashboard home page — reads the exact same
// localStorage keys app/finance/page.tsx writes to, so anything added there
// shows up here with no extra step. Was previously hardcoded placeholder
// data (RECENT_UPDATES + static donut percentages); this replaces the
// "Recent updates" card and adds a real budget-status dot next to
// "Spending trend". Kept as small, focused hooks/components rather than
// touching Finance's page directly, to avoid risking regressions there.
import Link from "next/link";
import { useLocalStorage } from "@/lib/useLocalStorage";
import {
  calcEMI,
  daysUntil,
  formatDaysUntil,
  formatMoney,
  budgetStatus,
  BUDGET_STATUS_CLASSES,
  nextMonthlyDate,
} from "@/lib/financeUtils";

type Currency = "AED" | "LKR" | "USD";
type Loan = { id: string; ownerId: string; name: string; currency: Currency; principal: number; interestRate: number; tenureMonths: number; startDate: string };
type Sub = { id: string; ownerId: string; provider: string; currency: Currency; amount: number; cadence: "monthly" | "yearly"; billingDay: number; nextDate: string; taxPct: number };
type SchemeCadence = "onetime" | "monthly" | "termly" | "yearly";
type SchemeItem = { id: string; label: string; amount: number; cadence: SchemeCadence; dueDate: string; billingDay: number; paid: boolean };
type Scheme = { id: string; ownerId: string; name: string; currency: Currency; items: SchemeItem[] };

function subNextDate(s: Sub): Date {
  return s.cadence === "monthly" ? nextMonthlyDate(s.billingDay) : new Date(s.nextDate || Date.now());
}
function loanNextDueDate(l: Loan): Date {
  const day = l.startDate ? new Date(l.startDate).getDate() : 1;
  return nextMonthlyDate(day);
}
function schemeItemDate(it: SchemeItem): Date {
  return it.cadence === "monthly" ? nextMonthlyDate(it.billingDay) : new Date(it.dueDate || Date.now());
}
function schemeItemActive(it: SchemeItem): boolean {
  return it.cadence === "monthly" || !it.paid;
}
function monthlySubCost(s: Sub): number {
  const withTax = s.amount * (1 + s.taxPct / 100);
  return s.cadence === "monthly" ? withTax : withTax / 12;
}

function useFinanceSnapshot() {
  const [loans] = useLocalStorage<Loan[]>("finance.loans.v3", []);
  const [subs] = useLocalStorage<Sub[]>("finance.subs.v3", []);
  const [schemes] = useLocalStorage<Scheme[]>("finance.schemes.v1", []);
  const [budget] = useLocalStorage<number>("finance.monthlyBudget", 0);

  const upcoming = [
    ...subs.map((s) => ({ label: s.provider, currency: s.currency, amount: s.amount, date: subNextDate(s) })),
    ...loans.map((l) => ({ label: l.name, currency: l.currency, amount: calcEMI(l.principal, l.interestRate, l.tenureMonths), date: loanNextDueDate(l) })),
    ...schemes.flatMap((sc) =>
      sc.items.filter(schemeItemActive).map((it) => ({ label: `${sc.name} — ${it.label}`, currency: sc.currency, amount: it.amount, date: schemeItemDate(it) }))
    ),
  ]
    .map((p) => ({ ...p, days: daysUntil(p.date) }))
    .filter((p) => p.days <= 14)
    .sort((a, b) => a.days - b.days);

  const schemeMonthlyContribution = schemes
    .flatMap((sc) => sc.items)
    .filter(schemeItemActive)
    .filter((it) => it.cadence === "monthly" || daysUntil(schemeItemDate(it)) <= 30)
    .reduce((sum, it) => sum + it.amount, 0);

  const monthlyOutflow =
    loans.reduce((sum, l) => sum + calcEMI(l.principal, l.interestRate, l.tenureMonths), 0) +
    subs.reduce((sum, s) => sum + monthlySubCost(s), 0) +
    schemeMonthlyContribution;

  return { upcoming, monthlyOutflow, budget, status: budgetStatus(monthlyOutflow, budget) };
}

export function DashboardHeroSubtitle() {
  const { upcoming } = useFinanceSnapshot();
  return (
    <p className="mt-1 text-sm text-gray-400">
      {upcoming.length > 0
        ? `${upcoming.length} bill${upcoming.length === 1 ? "" : "s"} due in the next 2 weeks.`
        : "No bills due in the next 2 weeks."}
    </p>
  );
}

export function UpcomingPaymentsCard() {
  const { upcoming } = useFinanceSnapshot();
  return (
    <div className="glass-card rounded-xl2 p-5">
      <h3 className="relative z-10 mb-4 font-medium text-white">Upcoming payments (next 14 days)</h3>
      <div className="relative z-10 space-y-4">
        {upcoming.length === 0 && (
          <p className="text-xs text-gray-500">
            Nothing due in the next two weeks —{" "}
            <Link href="/finance" className="text-accent-blue hover:underline">
              add bills in Finance
            </Link>
            .
          </p>
        )}
        {upcoming.slice(0, 5).map((p, i) => (
          <div key={i} className="flex items-center justify-between">
            <p className="text-sm text-gray-200">{p.label}</p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-300">{formatMoney(p.amount, p.currency)}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  p.days <= 3 ? "bg-red-500/20 text-red-400" : p.days <= 7 ? "bg-accent-orange/20 text-accent-orange" : "bg-accent-blue/20 text-accent-blue"
                }`}
              >
                {formatDaysUntil(p.days)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BudgetStatusDot() {
  const { monthlyOutflow, budget, status } = useFinanceSnapshot();
  const cls = BUDGET_STATUS_CLASSES[status];
  const title = budget > 0 ? `${Math.round((monthlyOutflow / budget) * 100)}% of monthly budget` : "No monthly budget set — add one in Finance";
  return <span className={`h-2.5 w-2.5 rounded-full ${cls.bg}`} title={title} />;
}
