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
