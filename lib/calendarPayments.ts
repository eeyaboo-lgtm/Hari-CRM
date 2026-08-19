// Pulls "payments due" onto the Calendar page from the same finance data
// Finance/Dashboard already show — no new table, no duplicate data entry.
// Reads the localStorage cache that useSupabaseSynced (see
// lib/supabase/useSupabaseSynced.ts) keeps in sync with the real
// finance_loans / finance_subscriptions / finance_payment_schemes tables,
// exactly the same source components/DashboardLiveWidgets.tsx uses.
//
// Known scope limit: this shows each bill's single *next* occurrence
// (matching nextMonthlyDate's existing app-wide behavior), not a fully
// recurring projection painted across every month you scroll to. Good
// enough for "what's due around now" at a glance; a fuller recurring
// projection is a follow-up, not required for this pass.

import { nextMonthlyDate, calcEMI, formatMoney } from "@/lib/financeUtils";

type Currency = "AED" | "LKR" | "USD";
type Loan = { id: string; name: string; currency: Currency; principal: number; interestRate: number; tenureMonths: number; startDate: string };
type Sub = { id: string; provider: string; currency: Currency; amount: number; cadence: "monthly" | "yearly"; billingDay: number; nextDate: string; taxPct: number };
type SchemeCadence = "onetime" | "monthly" | "termly" | "yearly";
type SchemeItem = { id: string; label: string; amount: number; cadence: SchemeCadence; dueDate: string; billingDay: number; paid: boolean };
type Scheme = { id: string; name: string; currency: Currency; items: SchemeItem[] };

export type PaymentEvent = {
  id: string;
  title: string;
  amountLabel: string;
  dateKey: string; // YYYY-MM-DD, local
};

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function keyOf(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function readCache<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

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

/** All upcoming-payment "next occurrence" events, grouped by date key (YYYY-MM-DD). */
export function getPaymentEventsByDate(): Record<string, PaymentEvent[]> {
  const loans = readCache<Loan[]>("finance.loans.v3", []);
  const subs = readCache<Sub[]>("finance.subs.v3", []);
  const schemes = readCache<Scheme[]>("finance.schemes.v1", []);

  const events: PaymentEvent[] = [
    ...subs.map((s) => ({
      id: `sub-${s.id}`,
      title: s.provider,
      amountLabel: formatMoney(s.amount * (1 + s.taxPct / 100), s.currency),
      dateKey: keyOf(subNextDate(s)),
    })),
    ...loans.map((l) => ({
      id: `loan-${l.id}`,
      title: l.name,
      amountLabel: formatMoney(calcEMI(l.principal, l.interestRate, l.tenureMonths), l.currency),
      dateKey: keyOf(loanNextDueDate(l)),
    })),
    ...schemes.flatMap((sc) =>
      sc.items
        .filter(schemeItemActive)
        .map((it) => ({
          id: `scheme-${it.id}`,
          title: `${sc.name} — ${it.label}`,
          amountLabel: formatMoney(it.amount, sc.currency),
          dateKey: keyOf(schemeItemDate(it)),
        }))
    ),
  ];

  const byDate: Record<string, PaymentEvent[]> = {};
  for (const ev of events) {
    (byDate[ev.dateKey] ??= []).push(ev);
  }
  return byDate;
}
