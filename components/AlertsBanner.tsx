"use client";

// Real "smart alerts" on the Dashboard — reuses the exact same localStorage
// caches DashboardLiveWidgets/GlobalSearch already read (useSupabaseSynced
// keeps them in sync with Supabase), no new fetches. See lib/alertsUtils.ts
// for the actual rules; this component is just data-gathering + rendering.
// A server-side email version of the same rules lives in
// app/api/alerts/notify/route.ts for households that opt into email alerts
// in Settings — this in-app banner works regardless of that setup.

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { calcEMI, daysUntil, nextMonthlyDate } from "@/lib/financeUtils";
import { budgetAlert, upcomingPaymentAlerts, elevatedSubscriptionAlerts, renewalAlerts, ALERT_SEVERITY_CLASSES, type Alert } from "@/lib/alertsUtils";

function subNextDate(s: any): Date {
  return s.cadence === "monthly" ? nextMonthlyDate(s.billingDay) : new Date(s.nextDate || Date.now());
}
function loanNextDueDate(l: any): Date {
  const day = l.startDate ? new Date(l.startDate).getDate() : 1;
  return nextMonthlyDate(day);
}
function schemeItemDate(it: any): Date {
  return it.cadence === "monthly" ? nextMonthlyDate(it.billingDay) : new Date(it.dueDate || Date.now());
}
function schemeItemActive(it: any): boolean {
  return it.cadence === "monthly" || !it.paid;
}
function monthlySubCost(s: any): number {
  const withTax = s.amount * (1 + s.taxPct / 100);
  return s.cadence === "monthly" ? withTax : withTax / 12;
}

export default function AlertsBanner() {
  const [loans] = useLocalStorage<any[]>("finance.loans.v3", []);
  const [subs] = useLocalStorage<any[]>("finance.subs.v3", []);
  const [schemes] = useLocalStorage<any[]>("finance.schemes.v1", []);
  const [budget] = useLocalStorage<number>("finance.monthlyBudget", 0);
  const [memberships] = useLocalStorage<any[]>("memberships.items", []);
  const [insurance] = useLocalStorage<any[]>("health.insurance", []);

  const alerts: Alert[] = useMemo(() => {
    const upcoming = [
      ...subs.map((s) => ({ label: s.provider, currency: s.currency, amount: s.amount, days: daysUntil(subNextDate(s)) })),
      ...loans.map((l) => ({ label: l.name, currency: l.currency, amount: calcEMI(l.principal, l.interestRate, l.tenureMonths), days: daysUntil(loanNextDueDate(l)) })),
      ...schemes.flatMap((sc: any) =>
        sc.items.filter(schemeItemActive).map((it: any) => ({ label: `${sc.name} — ${it.label}`, currency: sc.currency, amount: it.amount, days: daysUntil(schemeItemDate(it)) }))
      ),
    ];

    const monthlyOutflow =
      loans.reduce((sum: number, l: any) => sum + calcEMI(l.principal, l.interestRate, l.tenureMonths), 0) +
      subs.reduce((sum: number, s: any) => sum + monthlySubCost(s), 0) +
      schemes.flatMap((sc: any) => sc.items).filter(schemeItemActive).reduce((sum: number, it: any) => sum + it.amount, 0);

    const renewItems = [
      ...memberships.filter((m: any) => m.renewalDate).map((m: any) => ({ name: m.name, date: m.renewalDate, kind: "Membership", href: "/memberships" })),
      ...insurance.filter((p: any) => p.renewalDate).map((p: any) => ({ name: p.provider, date: p.renewalDate, kind: "Insurance policy", href: "/health" })),
    ];

    const out: Alert[] = [];
    const budgetA = budgetAlert(monthlyOutflow, budget);
    if (budgetA) out.push(budgetA);
    out.push(...upcomingPaymentAlerts(upcoming));
    out.push(...elevatedSubscriptionAlerts(subs));
    out.push(...renewalAlerts(renewItems));
    return out;
  }, [loans, subs, schemes, budget, memberships, insurance]);

  if (alerts.length === 0) return null;

  return (
    <div className="glass-card rounded-xl2 p-4">
      <div className="relative z-10 mb-2 flex items-center gap-2">
        <AlertTriangle size={15} className="text-accent-orange" />
        <h3 className="text-sm font-medium text-white">{alerts.length} thing{alerts.length === 1 ? "" : "s"} need attention</h3>
      </div>
      <div className="relative z-10 space-y-1.5">
        {alerts.slice(0, 6).map((a) => {
          const cls = ALERT_SEVERITY_CLASSES[a.severity];
          return (
            <Link
              key={a.id}
              href={a.href}
              className={`flex items-center justify-between rounded-lg ${cls.bg} px-3 py-2 text-xs ring-1 ${cls.ring} transition-opacity hover:opacity-80`}
            >
              <span className={cls.text}>{a.title}</span>
              <span className="text-gray-400">{a.detail}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
