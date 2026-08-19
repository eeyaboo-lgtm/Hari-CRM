// Smart alerts (2026-08-19) — Finance already computes budget status,
// upcoming payments, and elevated-subscription overrides; none of it used
// to *tell* anyone anything, it only sat there waiting to be looked at.
// This turns those already-computed numbers into a real alert list. Pure
// functions operating on already-shaped inputs (not localStorage/Supabase
// directly) so the exact same logic can run client-side (AlertsBanner.tsx,
// reading localStorage) or server-side (app/api/alerts/notify/route.ts,
// reading Supabase) without duplicating the *rules*, only the data-fetch.

export type AlertSeverity = "red" | "orange" | "blue";

export type Alert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string;
};

export function budgetAlert(monthlyOutflow: number, budget: number): Alert | null {
  if (budget <= 0) return null;
  const pct = monthlyOutflow / budget;
  if (pct >= 1) {
    return {
      id: "budget",
      severity: "red",
      title: "Over your monthly budget",
      detail: `Committed outflow is ${Math.round(pct * 100)}% of your ${budget} budget.`,
      href: "/finance",
    };
  }
  if (pct >= 0.9) {
    return {
      id: "budget",
      severity: "orange",
      title: "Approaching your monthly budget",
      detail: `Committed outflow is already ${Math.round(pct * 100)}% of your budget.`,
      href: "/finance",
    };
  }
  return null;
}

export function upcomingPaymentAlerts(
  payments: { label: string; days: number; amount: number; currency: string }[],
  withinDays = 3
): Alert[] {
  return payments
    .filter((p) => p.days <= withinDays)
    .map((p) => ({
      id: `pay-${p.label}-${p.days}`,
      severity: p.days <= 1 ? "red" : "orange",
      title: `${p.label} due ${p.days <= 0 ? "today" : p.days === 1 ? "tomorrow" : `in ${p.days} days`}`,
      detail: `${p.amount} ${p.currency}`,
      href: "/finance",
    } as Alert));
}

export function elevatedSubscriptionAlerts(
  subs: { provider: string; elevatedAmount: number | null; effectiveUntil: string; currency: string }[]
): Alert[] {
  const today = new Date().toISOString().slice(0, 10);
  return subs
    .filter((s) => s.elevatedAmount != null && s.effectiveUntil && s.effectiveUntil >= today)
    .map((s) => ({
      id: `elevated-${s.provider}`,
      severity: "orange",
      title: `${s.provider} is temporarily elevated`,
      detail: `${s.elevatedAmount} ${s.currency} until ${s.effectiveUntil}`,
      href: "/finance",
    } as Alert));
}

export function renewalAlerts(
  items: { name: string; date?: string; kind: string; href: string }[],
  withinDays = 14
): Alert[] {
  const now = Date.now();
  return items
    .filter((i) => i.date)
    .map((i) => ({ ...i, days: Math.round((new Date(i.date + "T00:00:00").getTime() - now) / 86_400_000) }))
    .filter((i) => i.days >= 0 && i.days <= withinDays)
    .map((i) => ({
      id: `renewal-${i.kind}-${i.name}`,
      severity: i.days <= 3 ? "orange" : "blue",
      title: `${i.name} renews in ${i.days} day${i.days === 1 ? "" : "s"}`,
      detail: i.kind,
      href: i.href,
    } as Alert));
}

export const ALERT_SEVERITY_CLASSES: Record<AlertSeverity, { bg: string; text: string; ring: string }> = {
  red: { bg: "bg-red-500/10", text: "text-red-400", ring: "ring-red-500/30" },
  orange: { bg: "bg-accent-orange/10", text: "text-accent-orange", ring: "ring-accent-orange/30" },
  blue: { bg: "bg-accent-blue/10", text: "text-accent-blue", ring: "ring-accent-blue/30" },
};
