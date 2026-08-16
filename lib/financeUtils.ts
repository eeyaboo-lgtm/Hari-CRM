// Shared finance math + formatting helpers. Pure functions, no React —
// used by app/finance/page.tsx (and, later, any dashboard widget that
// summarizes finance data).

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Standard reducing-balance EMI formula. tenureMonths=0 returns 0. */
export function calcEMI(principal: number, annualRatePct: number, tenureMonths: number): number {
  if (!principal || !tenureMonths) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / tenureMonths;
  const factor = Math.pow(1 + r, tenureMonths);
  return (principal * r * factor) / (factor - 1);
}

/** Outstanding principal after `paymentsMade` monthly EMIs. */
export function calcRemainingBalance(
  principal: number,
  annualRatePct: number,
  tenureMonths: number,
  paymentsMade: number
): number {
  if (!principal || !tenureMonths) return 0;
  const k = Math.min(Math.max(paymentsMade, 0), tenureMonths);
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal * ((tenureMonths - k) / tenureMonths);
  const factorN = Math.pow(1 + r, tenureMonths);
  const factorK = Math.pow(1 + r, k);
  return (principal * (factorN - factorK)) / (factorN - 1);
}

/** Whole months elapsed between an ISO date and today (floor, min 0). */
export function monthsElapsedSince(isoDate: string): number {
  if (!isoDate) return 0;
  const start = new Date(isoDate);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

/** Next occurrence on/after today of a monthly billing day-of-month. */
export function nextMonthlyDate(dayOfMonth: number): Date {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (candidate < now) candidate.setMonth(candidate.getMonth() + 1);
  return candidate;
}

export function daysUntil(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = d.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export function formatDaysUntil(n: number): string {
  if (n < 0) return `${Math.abs(n)}d overdue`;
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  return `in ${n}d`;
}

export function formatMoney(amount: number, currency: string): string {
  return `${Math.round(amount).toLocaleString()} ${currency}`;
}

/**
 * Budget-status color algorithm (red/orange/green/blue), applied per member
 * and household-wide: ratio = this month's committed outflow (loan EMIs +
 * subscription monthly-equivalent cost) / monthly budget.
 *   no budget set  -> blue  (informational only, nothing to compare against)
 *   ratio <= 0.7   -> green (comfortably under budget)
 *   0.7 < r <= 1.0 -> orange (close to/at budget)
 *   ratio > 1.0    -> red   (over budget)
 */
export type BudgetStatus = "blue" | "green" | "orange" | "red";

export function budgetStatus(outflow: number, budget: number): BudgetStatus {
  if (!budget || budget <= 0) return "blue";
  const ratio = outflow / budget;
  if (ratio > 1) return "red";
  if (ratio > 0.7) return "orange";
  return "green";
}

export const BUDGET_STATUS_CLASSES: Record<BudgetStatus, { text: string; bg: string; ring: string }> = {
  blue: { text: "text-accent-blue", bg: "bg-accent-blue", ring: "ring-accent-blue/40" },
  green: { text: "text-accent-green", bg: "bg-accent-green", ring: "ring-accent-green/40" },
  orange: { text: "text-accent-orange", bg: "bg-accent-orange", ring: "ring-accent-orange/40" },
  red: { text: "text-red-400", bg: "bg-red-500", ring: "ring-red-500/40" },
};

/**
 * Simplifi-style "Projected Cash Flow": rolling forward view of committed
 * monthly outflow, built entirely from data already in Finance (no bank-sync
 * needed). Real math, not placeholder — loans drop off the month their
 * tenure ends, yearly subs/scheme items only land in the month they're
 * actually due (and repeat yearly for subs), monthly items recur every
 * month. Mixed currencies are summed at face value, matching the existing
 * "This month's committed outflow" convention elsewhere on the page.
 * Card EMIs are deliberately excluded here (cards have no start date to
 * project from, only a tenure length) — they're still included in the
 * current-month category breakdown via the caller.
 */
export type MonthlyProjectionPoint = { month: string; loans: number; subs: number; schemes: number; total: number };

export function projectMonthlyOutflow(
  loans: { principal: number; interestRate: number; tenureMonths: number; startDate: string }[],
  subs: { amount: number; taxPct: number; cadence: "monthly" | "yearly"; nextDate: string; tenureMonths: number }[],
  schemeItems: { amount: number; cadence: SchemeCadenceLike; dueDate: string; paid: boolean }[],
  monthsAhead = 12
): MonthlyProjectionPoint[] {
  const now = new Date();
  const points: MonthlyProjectionPoint[] = [];

  for (let i = 0; i < monthsAhead; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);

    const loansTotal = loans.reduce((sum, l) => {
      if (!l.startDate || !l.tenureMonths) return sum;
      const start = new Date(l.startDate);
      const monthsSinceStart = (monthDate.getFullYear() - start.getFullYear()) * 12 + (monthDate.getMonth() - start.getMonth());
      if (monthsSinceStart < 0 || monthsSinceStart >= l.tenureMonths) return sum;
      return sum + calcEMI(l.principal, l.interestRate, l.tenureMonths);
    }, 0);

    const subsTotal = subs.reduce((sum, s) => {
      const withTax = s.amount * (1 + s.taxPct / 100);
      if (s.cadence === "monthly") return sum + withTax;
      if (!s.nextDate) return sum;
      const due = new Date(s.nextDate);
      const sameMonth = due.getFullYear() === monthDate.getFullYear() && due.getMonth() === monthDate.getMonth();
      const sameMonthNextYear = due.getFullYear() + 1 === monthDate.getFullYear() && due.getMonth() === monthDate.getMonth();
      return sameMonth || sameMonthNextYear ? sum + withTax : sum;
    }, 0);

    const schemesTotal = schemeItems.reduce((sum, it) => {
      if (it.paid) return sum;
      if (it.cadence === "monthly") return sum + it.amount;
      if (!it.dueDate) return sum;
      const due = new Date(it.dueDate);
      return due.getFullYear() === monthDate.getFullYear() && due.getMonth() === monthDate.getMonth() ? sum + it.amount : sum;
    }, 0);

    points.push({
      month: monthDate.toLocaleDateString("en-US", { month: "short" }),
      loans: Math.round(loansTotal),
      subs: Math.round(subsTotal),
      schemes: Math.round(schemesTotal),
      total: Math.round(loansTotal + subsTotal + schemesTotal),
    });
  }
  return points;
}

// Loosened shape so this file doesn't need to import the page's SchemeCadence type.
type SchemeCadenceLike = "onetime" | "monthly" | "termly" | "yearly";

/**
 * Estimated-figure entry: user gives a min–max range instead of a single
 * number (e.g. "DEWA is AED 350-500, varies seasonally") and this returns
 * the midpoint rounded to a sensible step instead of a raw decimal. Pure —
 * reused anywhere an amount field accepts a range (the unified Add Expense
 * flow today).
 */
export function estimateFromRange(min: number, max: number, roundTo = 5): number {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const mid = (lo + hi) / 2;
  const step = roundTo > 0 ? roundTo : 1;
  return Math.round(mid / step) * step;
}

/**
 * Shared color source of truth for all Finance UI (Standard + Deep view) —
 * hoisted out of FinanceDeepView.tsx (which now imports these) so every new
 * component (Spending Plan, expense-type badges, etc.) reuses the same
 * values instead of inventing new hex per component. Mirrors
 * tailwind.config.ts's accent.* palette; there is no accent.red, so the red
 * case intentionally matches the red-400/500 Tailwind reds
 * BUDGET_STATUS_CLASSES already used — one exception, not a new one.
 */
export const COLORS = {
  purple: "#8b7cf9",
  pink: "#fb7fc4",
  blue: "#4fc3f7",
  orange: "#ffa552",
  green: "#3ddc97",
  red: "#f87171",
};

export const STATUS_HEX: Record<BudgetStatus, string> = {
  blue: COLORS.blue,
  green: COLORS.green,
  orange: COLORS.orange,
  red: COLORS.red,
};

/**
 * Simplifi-style "Spending Plan" status: safe-to-spend = recurring monthly
 * income − committed monthly outflow. Going negative always wins (red)
 * regardless of ratio; otherwise a thin cushion (<10% of income left) is
 * orange, no income entered yet is blue (informational, matches
 * budgetStatus's "no budget set" convention), else green. Reuses the same
 * BudgetStatus/BUDGET_STATUS_CLASSES four-color system, no new palette.
 */
export function spendingPlanStatus(safeToSpend: number, monthlyIncome: number): BudgetStatus {
  if (monthlyIncome <= 0) return "blue";
  if (safeToSpend < 0) return "red";
  if (safeToSpend / monthlyIncome < 0.1) return "orange";
  return "green";
}

/**
 * Real currency conversion using rates loaded from the `fx_rates` table
 * (see lib/supabase/useFxRates.ts). `rates` is keyed "FROM_TO" e.g.
 * "USD_AED". Falls back to face value (1:1) if a rate is missing or not
 * loaded yet — never throws, never blocks rendering; UI should disclose
 * when a fallback happened rather than presenting it as a real conversion.
 */
export type FxRateMap = Record<string, number>;

export function convertAmount(amount: number, from: string, to: string, rates: FxRateMap): number {
  if (from === to) return amount;
  const direct = rates[`${from}_${to}`];
  if (direct) return amount * direct;
  const inverse = rates[`${to}_${from}`];
  if (inverse) return amount / inverse;
  return amount;
}

/** Convert a per-currency totals map (e.g. totalsByCurrency) into one grand total in `target`. */
export function convertTotalsToCurrency(totals: Record<string, number>, target: string, rates: FxRateMap): number {
  return Object.entries(totals).reduce((sum, [cur, amt]) => sum + convertAmount(amt, cur, target, rates), 0);
}
