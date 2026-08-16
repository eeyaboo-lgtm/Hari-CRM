"use client";

import { useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useSupabaseSynced } from "@/lib/supabase/useSupabaseSynced";
import { useSchemesSynced } from "@/lib/supabase/useSchemesSynced";
import { useHousehold } from "@/lib/HouseholdContext";
import {
  uid,
  calcEMI,
  calcRemainingBalance,
  monthsElapsedSince,
  nextMonthlyDate,
  daysUntil,
  formatDaysUntil,
  formatMoney,
  budgetStatus,
  BUDGET_STATUS_CLASSES,
  projectMonthlyOutflow,
  estimateFromRange,
  convertAmount,
  spendingPlanStatus,
} from "@/lib/financeUtils";
import { useFxRates } from "@/lib/supabase/useFxRates";
import { CashFlowChart, SpendCategoryDonut, BudgetMeterCard, CurrencyBalancesBars, SpendingPlanBanner } from "@/components/finance/FinanceDeepView";
import { Plus, X, Eye, EyeOff, CreditCard, ChevronDown, Pencil, Check, GraduationCap, ExternalLink, AlertTriangle, BarChart3, List, Wallet } from "lucide-react";

type Currency = "AED" | "LKR" | "USD";
type AccountKind = "credit" | "debit" | "current" | "checking" | "savings" | "bnpl";
type Account = { id: string; ownerId: string; name: string; type: "bank" | "bnpl"; currency: Currency; balance: number; bankUrl: string };
type CardAcct = {
  id: string; ownerId: string; name: string; network: "visa" | "mastercard" | "other";
  accountKind: AccountKind;
  last4: string; currency: Currency; creditLimit: number; limitUsed: number;
  interestRate: number; tenureMonths: number; outstanding: number;
};
type CardSpend = { id: string; cardId: string; label: string; amount: number; currency: Currency; date: string };
type Loan = {
  id: string; ownerId: string; name: string; lenderType: "bank" | "person" | "institution";
  currency: Currency; principal: number; interestRate: number; tenureMonths: number; startDate: string;
  accountNumber: string;
};
type Sub = {
  id: string; ownerId: string; provider: string; currency: Currency; amount: number;
  cadence: "monthly" | "yearly"; billingDay: number; nextDate: string; taxPct: number;
  tenureMonths: number; // contract length, 0 = open-ended/no fixed term
  notes: string;
  elevatedAmount: number | null; // temporary override, e.g. Tabby's 4-month spike
  effectiveUntil: string; // "" = no active override; auto-reverts once today > this date
};

type Income = {
  id: string; ownerId: string; source: string; incomeType: string; amount: number; currency: Currency;
  isRecurring: boolean; cadence: "monthly" | "yearly"; receivedDate: string; notes: string;
};

type ExpenseType = "monthly" | "fixed_term" | "one_off";
type Expense = {
  id: string; ownerId: string; label: string; category: string; currency: Currency; amount: number;
  minAmount: number | null; maxAmount: number | null; isEstimated: boolean;
  expenseType: ExpenseType; billingDay: number; startDate: string; endDate: string; dueDate: string;
  notes: string; paid: boolean;
};

const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  credit: "Credit", debit: "Debit", current: "Current", checking: "Checking", savings: "Savings", bnpl: "BNPL",
};
type SchemeCadence = "onetime" | "monthly" | "termly" | "yearly";
type SchemeItem = { id: string; label: string; amount: number; cadence: SchemeCadence; dueDate: string; billingDay: number; paid: boolean };
type Scheme = { id: string; ownerId: string; name: string; institution: string; currency: Currency; items: SchemeItem[] };

const SHARED = { id: "shared", name: "Shared", initial: "H" };

const DEFAULT_ACCOUNTS: Account[] = [
  { id: "a1", ownerId: "shared", name: "Joint savings", type: "bank", currency: "AED", balance: 18420, bankUrl: "" },
  { id: "a2", ownerId: "shenaal", name: "Shenaal salary account", type: "bank", currency: "LKR", balance: 340000, bankUrl: "" },
  { id: "a3", ownerId: "shalini", name: "Shalini USD savings", type: "bank", currency: "USD", balance: 5200, bankUrl: "" },
];
const DEFAULT_CARDS: CardAcct[] = [
  { id: "c1", ownerId: "shenaal", name: "Emirates NBD", network: "visa", accountKind: "credit", last4: "4471", currency: "AED", creditLimit: 15000, limitUsed: 4200, interestRate: 3.2, tenureMonths: 0, outstanding: 4200 },
];
const DEFAULT_LOANS: Loan[] = [
  { id: "l1", ownerId: "shared", name: "Car loan", lenderType: "bank", currency: "AED", principal: 42000, interestRate: 4.5, tenureMonths: 36, startDate: "2025-07-01", accountNumber: "" },
  { id: "l2", ownerId: "shenaal", name: "Home renovation", lenderType: "person", currency: "LKR", principal: 1200000, interestRate: 0, tenureMonths: 24, startDate: "2025-11-01", accountNumber: "" },
];
const DEFAULT_SUBS: Sub[] = [
  { id: "s1", ownerId: "shared", provider: "Netflix", currency: "AED", amount: 39, cadence: "monthly", billingDay: 18, nextDate: "", taxPct: 5, tenureMonths: 0, notes: "", elevatedAmount: null, effectiveUntil: "" },
  { id: "s2", ownerId: "shalini", provider: "iCloud storage", currency: "USD", amount: 3, cadence: "monthly", billingDay: 24, nextDate: "", taxPct: 0, tenureMonths: 0, notes: "", elevatedAmount: null, effectiveUntil: "" },
  { id: "s3", ownerId: "shenaal", provider: "Amazon Prime (annual)", currency: "AED", amount: 179, cadence: "yearly", billingDay: 1, nextDate: monthsFromNowIso(3), taxPct: 5, tenureMonths: 0, notes: "", elevatedAmount: null, effectiveUntil: "" },
];
const DEFAULT_INCOME: Income[] = [];
const DEFAULT_EXPENSES: Expense[] = [];
const DEFAULT_SCHEMES: Scheme[] = [
  {
    id: "sc1", ownerId: "shenaal", name: "MBA — Term 2", institution: "University example", currency: "AED",
    items: [
      { id: "si1", label: "Term fee", amount: 8500, cadence: "termly", dueDate: monthsFromNowIso(2), billingDay: 1, paid: false },
      { id: "si2", label: "Monthly materials", amount: 150, cadence: "monthly", dueDate: "", billingDay: 5, paid: false },
      { id: "si3", label: "Exam fee", amount: 300, cadence: "onetime", dueDate: monthsFromNowIso(1), billingDay: 1, paid: false },
    ],
  },
];

function monthsFromNowIso(monthsOut: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsOut);
  return d.toISOString().slice(0, 10);
}
/** Effective amount honoring a temporary override (Item 4) — auto-reverts once today passes effectiveUntil, no manual cleanup needed. */
function activeSubAmount(s: Sub): number {
  if (s.elevatedAmount != null && s.effectiveUntil && s.effectiveUntil >= todayIso()) return s.elevatedAmount;
  return s.amount;
}
function monthlySubCost(s: Sub): number {
  const withTax = activeSubAmount(s) * (1 + s.taxPct / 100);
  return s.cadence === "monthly" ? withTax : withTax / 12;
}
/** Recurring-income monthly-equivalent (Item 1) — 0 for one-off/point-in-time income rows. */
function monthlyIncomeAmount(i: Income): number {
  if (!i.isRecurring) return 0;
  return i.cadence === "monthly" ? i.amount : i.amount / 12;
}
/**
 * Unified expense (Item 2) monthly-equivalent for "counts toward this
 * month's outflow": monthly always counts, fixed-term counts while within
 * [startDate, endDate], one-off counts within +/-30 days of its due date
 * (same "landing this month" convention as scheme items elsewhere on this
 * page). Paid one-offs stop counting.
 */
function expenseMonthlyAmount(e: Expense): number {
  if (e.paid) return 0;
  const today = todayIso();
  if (e.expenseType === "monthly") return e.amount;
  if (e.expenseType === "fixed_term") {
    if (e.startDate && today < e.startDate) return 0;
    if (e.endDate && today > e.endDate) return 0;
    return e.amount;
  }
  if (!e.dueDate) return 0;
  return Math.abs(daysUntil(e.dueDate)) <= 30 ? e.amount : 0;
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
/** Monthly items always count (they recur); other cadences count until marked paid. */
function schemeItemActive(it: SchemeItem): boolean {
  return it.cadence === "monthly" || !it.paid;
}
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function FinancePage() {
  const { members } = useHousehold();
  const owners = useMemo(() => [...members, SHARED], [members]);
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.name ?? id;

  // Accounts/Cards/CardSpends/Loans/Subs are now wired to real Supabase
  // tables via useSupabaseSynced — same [value, setValue] shape as
  // useLocalStorage (which is why none of the JSX/handlers below needed to
  // change), but every setter call also diffs and pushes to the DB, and the
  // localStorage copy is now just an offline cache, not the source of truth.
  // Schemes (nested two-table shape) + budget/hideBalances (per-device
  // prefs) are deliberately left on localStorage this pass — see
  // HANDOVER.md for the follow-up plan.
  const [accounts, setAccounts] = useSupabaseSynced<Account>("finance_accounts", "finance.accounts.v4", DEFAULT_ACCOUNTS, {
    ownerLocalId: (a) => a.ownerId,
    toRow: (a) => ({ name: a.name, account_type: a.type, currency: a.currency, current_balance: a.balance, bank_url: a.bankUrl || null }),
    fromRow: (row, ownerId) => ({ id: row.id, ownerId, name: row.name, type: row.account_type, currency: row.currency, balance: Number(row.current_balance) || 0, bankUrl: row.bank_url ?? "" }),
  });
  const [cards, setCards] = useSupabaseSynced<CardAcct>("finance_cards", "finance.cards.v4", DEFAULT_CARDS, {
    ownerLocalId: (c) => c.ownerId,
    toRow: (c) => ({ name: c.name, network: c.network, account_kind: c.accountKind, last4: c.last4, currency: c.currency, credit_limit: c.creditLimit, limit_used: c.limitUsed, interest_rate: c.interestRate, tenure_months: c.tenureMonths, outstanding: c.outstanding }),
    fromRow: (row, ownerId) => ({ id: row.id, ownerId, name: row.name, network: row.network, accountKind: row.account_kind, last4: row.last4, currency: row.currency, creditLimit: Number(row.credit_limit) || 0, limitUsed: Number(row.limit_used) || 0, interestRate: Number(row.interest_rate) || 0, tenureMonths: Number(row.tenure_months) || 0, outstanding: Number(row.outstanding) || 0 }),
  });
  // Card spends have no per-member owner in the local shape — booked as a
  // joint ("shared") entry so either household member can edit/delete it.
  const [cardSpends, setCardSpends] = useSupabaseSynced<CardSpend>("finance_card_spends", "finance.cardSpends.v3", [], {
    ownerLocalId: () => "shared",
    toRow: (s) => ({ card_id: s.cardId, label: s.label, amount: s.amount, currency: s.currency, spend_date: s.date }),
    fromRow: (row) => ({ id: row.id, cardId: row.card_id, label: row.label, amount: Number(row.amount) || 0, currency: row.currency, date: row.spend_date }),
  });
  const [loans, setLoans] = useSupabaseSynced<Loan>("finance_loans", "finance.loans.v3", DEFAULT_LOANS, {
    ownerLocalId: (l) => l.ownerId,
    toRow: (l) => ({
      name: l.name, lender: l.lenderType, principal: l.principal, currency: l.currency, interest_rate: l.interestRate,
      tenure_months: l.tenureMonths, start_date: l.startDate, account_number: l.accountNumber || null,
      monthly_installment: calcEMI(l.principal, l.interestRate, l.tenureMonths),
      remaining_balance: calcRemainingBalance(l.principal, l.interestRate, l.tenureMonths, monthsElapsedSince(l.startDate)),
    }),
    fromRow: (row, ownerId) => ({ id: row.id, ownerId, name: row.name, lenderType: (row.lender as Loan["lenderType"]) || "bank", currency: row.currency, principal: Number(row.principal) || 0, interestRate: Number(row.interest_rate) || 0, tenureMonths: Number(row.tenure_months) || 0, startDate: row.start_date, accountNumber: row.account_number ?? "" }),
  });
  const [subs, setSubs] = useSupabaseSynced<Sub>("finance_subscriptions", "finance.subs.v3", DEFAULT_SUBS, {
    ownerLocalId: (s) => s.ownerId,
    toRow: (s) => ({ name: s.provider, amount: s.amount, currency: s.currency, billing_cycle: s.cadence, next_due_date: s.nextDate || todayIso(), billing_day: s.billingDay, tax_pct: s.taxPct, tenure_months: s.tenureMonths, auto_renew: true, notes: s.notes || null, elevated_amount: s.elevatedAmount, effective_until: s.effectiveUntil || null }),
    fromRow: (row, ownerId) => ({ id: row.id, ownerId, provider: row.name, currency: row.currency, amount: Number(row.amount) || 0, cadence: (row.billing_cycle as Sub["cadence"]) || "monthly", billingDay: Number(row.billing_day) || 1, nextDate: row.next_due_date ?? "", taxPct: Number(row.tax_pct) || 0, tenureMonths: Number(row.tenure_months) || 0, notes: row.notes ?? "", elevatedAmount: row.elevated_amount != null ? Number(row.elevated_amount) : null, effectiveUntil: row.effective_until ?? "" }),
  });
  const [schemes, setSchemes] = useSchemesSynced("finance.schemes.v1", DEFAULT_SCHEMES);
  // Item 1: recurring income. Item 2: unified Add Expense flow (monthly/fixed-term/one-off).
  const [income, setIncome] = useSupabaseSynced<Income>("finance_income", "finance.income.v1", DEFAULT_INCOME, {
    ownerLocalId: (i) => i.ownerId,
    toRow: (i) => ({ source: i.source, income_type: i.incomeType || "other", amount: i.amount, currency: i.currency, received_date: i.receivedDate || todayIso(), notes: i.notes || null, is_recurring: i.isRecurring, cadence: i.cadence }),
    fromRow: (row, ownerId) => ({ id: row.id, ownerId, source: row.source, incomeType: row.income_type ?? "other", amount: Number(row.amount) || 0, currency: row.currency, receivedDate: row.received_date ?? "", notes: row.notes ?? "", isRecurring: !!row.is_recurring, cadence: (row.cadence as Income["cadence"]) || "monthly" }),
  });
  const [expenses, setExpenses] = useSupabaseSynced<Expense>("finance_expenses", "finance.expenses.v1", DEFAULT_EXPENSES, {
    ownerLocalId: (e) => e.ownerId,
    toRow: (e) => ({
      expense_type: e.expenseType, label: e.label, category: e.category || null, currency: e.currency, amount: e.amount,
      min_amount: e.minAmount, max_amount: e.maxAmount, is_estimated: e.isEstimated, billing_day: e.billingDay,
      start_date: e.startDate || null, end_date: e.endDate || null, due_date: e.dueDate || null, notes: e.notes || null, paid: e.paid,
    }),
    fromRow: (row, ownerId) => ({
      id: row.id, ownerId, expenseType: (row.expense_type as ExpenseType) || "one_off", label: row.label, category: row.category ?? "",
      currency: row.currency, amount: Number(row.amount) || 0,
      minAmount: row.min_amount != null ? Number(row.min_amount) : null, maxAmount: row.max_amount != null ? Number(row.max_amount) : null,
      isEstimated: !!row.is_estimated, billingDay: Number(row.billing_day) || 1,
      startDate: row.start_date ?? "", endDate: row.end_date ?? "", dueDate: row.due_date ?? "", notes: row.notes ?? "", paid: !!row.paid,
    }),
  });
  const { rates: fxRates } = useFxRates();
  const PRIMARY_CURRENCY: Currency = "AED";
  const [budget, setBudget] = useLocalStorage<number>("finance.monthlyBudget", 0);
  const [hideBalances, setHideBalances] = useLocalStorage<boolean>("finance.hideBalances", true);
  const [viewMode, setViewMode] = useLocalStorage<"standard" | "deep">("finance.viewMode", "standard");

  const [filter, setFilter] = useState<string>("all");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const inFilter = (ownerId: string) => filter === "all" || ownerId === filter;

  const fAccounts = accounts.filter((a) => inFilter(a.ownerId));
  const fCards = cards.filter((c) => inFilter(c.ownerId));
  const fLoans = loans.filter((l) => inFilter(l.ownerId));
  const fSubs = subs.filter((s) => inFilter(s.ownerId));
  const fSchemes = schemes.filter((sc) => inFilter(sc.ownerId));
  const fIncome = income.filter((i) => inFilter(i.ownerId));
  const fExpenses = expenses.filter((e) => inFilter(e.ownerId));

  const totalsByCurrency = fAccounts.reduce<Record<string, number>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] || 0) + a.balance;
    return acc;
  }, {});

  const schemeMonthlyContribution = fSchemes
    .flatMap((sc) => sc.items.map((it) => ({ it, sc })))
    .filter(({ it }) => schemeItemActive(it))
    .filter(({ it }) => it.cadence === "monthly" || daysUntil(schemeItemDate(it)) <= 30)
    .reduce((sum, { it }) => sum + it.amount, 0);

  const expensesMonthlyContribution = fExpenses.reduce((sum, e) => sum + expenseMonthlyAmount(e), 0);

  // Monthly committed outflow = loan EMIs + card EMIs (if on a plan) + subscriptions + scheme items due/recurring this month + unified expenses.
  // Mixed currencies summed at face value — the long-standing, disclosed convention for this figure. Item 5's real-conversion
  // total lives separately below (monthlyOutflowConverted), feeding the Spending Plan specifically.
  const monthlyOutflow =
    fLoans.reduce((sum, l) => sum + calcEMI(l.principal, l.interestRate, l.tenureMonths), 0) +
    fCards.reduce((sum, c) => sum + (c.tenureMonths > 0 ? calcEMI(c.outstanding, c.interestRate, c.tenureMonths) : 0), 0) +
    fSubs.reduce((sum, s) => sum + monthlySubCost(s), 0) +
    schemeMonthlyContribution +
    expensesMonthlyContribution;
  const status = budgetStatus(monthlyOutflow, budget);
  const statusCls = BUDGET_STATUS_CLASSES[status];

  // Deep view inputs — same figures as monthlyOutflow above, just split by
  // category instead of summed, plus a 12-month forward projection. Pure
  // derivations of state already loaded above; no extra fetches.
  const loansOutflow = fLoans.reduce((sum, l) => sum + calcEMI(l.principal, l.interestRate, l.tenureMonths), 0);
  const cardsOutflow = fCards.reduce((sum, c) => sum + (c.tenureMonths > 0 ? calcEMI(c.outstanding, c.interestRate, c.tenureMonths) : 0), 0);
  const subsOutflow = fSubs.reduce((sum, s) => sum + monthlySubCost(s), 0);
  const subsForProjection = useMemo(() => fSubs.map((s) => ({ ...s, amount: activeSubAmount(s) })), [fSubs]);
  const cashFlowData = useMemo(
    () => projectMonthlyOutflow(fLoans, subsForProjection, fSchemes.flatMap((sc) => sc.items)),
    [fLoans, subsForProjection, fSchemes]
  );

  // Item 1: Spending Plan — recurring monthly income minus committed monthly
  // outflow, both converted to one currency (Item 5's real FX conversion)
  // so a mixed-currency household still gets one honest number instead of
  // a face-value sum across currencies. Red when negative, per the ask.
  const monthlyIncomeConverted = fIncome.reduce(
    (sum, i) => sum + convertAmount(monthlyIncomeAmount(i), i.currency, PRIMARY_CURRENCY, fxRates), 0
  );
  const monthlyOutflowConverted =
    fLoans.reduce((sum, l) => sum + convertAmount(calcEMI(l.principal, l.interestRate, l.tenureMonths), l.currency, PRIMARY_CURRENCY, fxRates), 0) +
    fCards.reduce((sum, c) => sum + convertAmount(c.tenureMonths > 0 ? calcEMI(c.outstanding, c.interestRate, c.tenureMonths) : 0, c.currency, PRIMARY_CURRENCY, fxRates), 0) +
    fSubs.reduce((sum, s) => sum + convertAmount(monthlySubCost(s), s.currency, PRIMARY_CURRENCY, fxRates), 0) +
    fSchemes
      .flatMap((sc) => sc.items.map((it) => ({ it, sc })))
      .filter(({ it }) => schemeItemActive(it))
      .filter(({ it }) => it.cadence === "monthly" || daysUntil(schemeItemDate(it)) <= 30)
      .reduce((sum, { it, sc }) => sum + convertAmount(it.amount, sc.currency, PRIMARY_CURRENCY, fxRates), 0) +
    fExpenses.reduce((sum, e) => sum + convertAmount(expenseMonthlyAmount(e), e.currency, PRIMARY_CURRENCY, fxRates), 0);
  const safeToSpend = monthlyIncomeConverted - monthlyOutflowConverted;
  const spStatus = spendingPlanStatus(safeToSpend, monthlyIncomeConverted);

  // Upcoming payments (subs + loans + scheme items) within 14 days, soonest first.
  const upcoming = [
    ...fSubs.map((s) => ({ label: s.provider, currency: s.currency, amount: activeSubAmount(s), date: subNextDate(s) })),
    ...fLoans.map((l) => ({ label: l.name, currency: l.currency, amount: calcEMI(l.principal, l.interestRate, l.tenureMonths), date: loanNextDueDate(l) })),
    ...fSchemes.flatMap((sc) =>
      sc.items.filter(schemeItemActive).map((it) => ({ label: `${sc.name} — ${it.label}`, currency: sc.currency, amount: it.amount, date: schemeItemDate(it) }))
    ),
    ...fExpenses.filter((e) => !e.paid && e.dueDate).map((e) => ({ label: e.label, currency: e.currency, amount: e.amount, date: new Date(e.dueDate) })),
  ]
    .map((p) => ({ ...p, days: daysUntil(p.date) }))
    .filter((p) => p.days <= 14)
    .sort((a, b) => a.days - b.days);

  // Next major non-monthly payment landing 2–4 months out (yearly subs + non-monthly scheme items).
  const majorCandidates = [
    ...fSubs.filter((s) => s.cadence === "yearly").map((s) => ({ label: s.provider, currency: s.currency, amount: activeSubAmount(s) * (1 + s.taxPct / 100), owner: ownerName(s.ownerId), date: subNextDate(s) })),
    ...fSchemes.flatMap((sc) =>
      sc.items.filter((it) => it.cadence !== "monthly" && schemeItemActive(it)).map((it) => ({ label: `${sc.name} — ${it.label}`, currency: sc.currency, amount: it.amount, owner: ownerName(sc.ownerId), date: schemeItemDate(it) }))
    ),
  ]
    .map((x) => ({ ...x, days: daysUntil(x.date) }))
    .filter((x) => x.days >= 55 && x.days <= 125)
    .sort((a, b) => a.days - b.days);
  const nextMajor = majorCandidates[0];

  const inputCls = "min-w-0 flex-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple";
  const selectCls = "rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none";
  const smallInputCls = "w-20 rounded-xl border border-base-border bg-base-card px-2 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple";
  const iconBtnCls = "text-gray-500 hover:text-white";

  const OwnerSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      {owners.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );

  // Edit-mode fields always have a bound value (even 0), so the browser
  // never shows the placeholder to explain what the field is — a blank
  // "0" next to another blank "0" is meaningless. Every editable numeric/
  // select field gets a persistent micro-label instead of relying on
  // placeholder text.
  const Field = ({ label, children, dark }: { label: string; children: React.ReactNode; dark?: boolean }) => (
    <label className="flex flex-col gap-0.5">
      <span className={`text-[9px] font-medium uppercase tracking-wide ${dark ? "text-white/60" : "text-gray-500"}`}>{label}</span>
      {children}
    </label>
  );

  const BlurAmount = ({ id, text }: { id: string; text: string }) => {
    const shown = !hideBalances || revealed.has(id);
    return (
      <button type="button" onClick={() => toggleReveal(id)} className="inline-flex items-center gap-1.5 font-medium text-white">
        <span className={shown ? "" : "select-none blur-sm"}>{text}</span>
        {hideBalances && (shown ? <EyeOff size={12} className="text-gray-500" /> : <Eye size={12} className="text-gray-500" />)}
      </button>
    );
  };

  // ---------------- Accounts ----------------
  const [newAccount, setNewAccount] = useState({ ownerId: "shared", name: "", type: "bank" as "bank" | "bnpl", currency: "AED" as Currency, balance: "", bankUrl: "" });
  const addAccount = () => {
    if (!newAccount.name.trim() || !newAccount.balance) return;
    setAccounts((prev) => [...prev, { id: uid(), ownerId: newAccount.ownerId, name: newAccount.name.trim(), type: newAccount.type, currency: newAccount.currency, balance: Number(newAccount.balance), bankUrl: newAccount.bankUrl.trim() }]);
    setNewAccount({ ownerId: "shared", name: "", type: "bank", currency: "AED", balance: "", bankUrl: "" });
  };
  const removeAccount = (id: string) => setAccounts((prev) => prev.filter((a) => a.id !== id));
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountDraft, setAccountDraft] = useState<Account | null>(null);
  const startEditAccount = (a: Account) => { setEditingAccountId(a.id); setAccountDraft({ ...a }); };
  const saveAccount = () => {
    if (!accountDraft) return;
    setAccounts((prev) => prev.map((a) => (a.id === accountDraft.id ? accountDraft : a)));
    setEditingAccountId(null);
    setAccountDraft(null);
  };

  // ---------------- Cards ----------------
  const [newCard, setNewCard] = useState({ ownerId: "shared", name: "", network: "visa" as CardAcct["network"], accountKind: "credit" as AccountKind, last4: "", currency: "AED" as Currency, creditLimit: "", limitUsed: "", interestRate: "", tenureMonths: "", outstanding: "" });
  const addCard = () => {
    if (!newCard.name.trim() || newCard.last4.length !== 4) return;
    setCards((prev) => [...prev, {
      id: uid(), ownerId: newCard.ownerId, name: newCard.name.trim(), network: newCard.network, accountKind: newCard.accountKind, last4: newCard.last4,
      currency: newCard.currency, creditLimit: Number(newCard.creditLimit) || 0, limitUsed: Number(newCard.limitUsed) || 0,
      interestRate: Number(newCard.interestRate) || 0, tenureMonths: Number(newCard.tenureMonths) || 0, outstanding: Number(newCard.outstanding) || 0,
    }]);
    setNewCard({ ownerId: "shared", name: "", network: "visa", accountKind: "credit", last4: "", currency: "AED", creditLimit: "", limitUsed: "", interestRate: "", tenureMonths: "", outstanding: "" });
  };
  const removeCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setCardSpends((prev) => prev.filter((s) => s.cardId !== id));
  };
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardDraft, setCardDraft] = useState<CardAcct | null>(null);
  const startEditCard = (c: CardAcct) => { setEditingCardId(c.id); setCardDraft({ ...c }); };
  const saveCard = () => {
    if (!cardDraft) return;
    setCards((prev) => prev.map((c) => (c.id === cardDraft.id ? cardDraft : c)));
    setEditingCardId(null);
    setCardDraft(null);
  };
  const [spendDraft, setSpendDraft] = useState<Record<string, { label: string; amount: string; currency: Currency }>>({});
  const addSpend = (card: CardAcct) => {
    const d = spendDraft[card.id];
    if (!d?.label?.trim() || !d?.amount) return;
    const currency = d.currency || card.currency;
    setCardSpends((prev) => [...prev, { id: uid(), cardId: card.id, label: d.label.trim(), amount: Number(d.amount), currency, date: todayIso() }]);
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, limitUsed: c.limitUsed + Number(d.amount), outstanding: c.outstanding + Number(d.amount) } : c)));
    setSpendDraft((prev) => ({ ...prev, [card.id]: { label: "", amount: "", currency: card.currency } }));
  };
  const removeSpend = (spend: CardSpend) => {
    setCardSpends((prev) => prev.filter((s) => s.id !== spend.id));
    setCards((prev) => prev.map((c) => (c.id === spend.cardId ? { ...c, limitUsed: Math.max(0, c.limitUsed - spend.amount), outstanding: Math.max(0, c.outstanding - spend.amount) } : c)));
  };

  // ---------------- Loans ----------------
  const [newLoan, setNewLoan] = useState({ ownerId: "shared", name: "", lenderType: "bank" as Loan["lenderType"], currency: "AED" as Currency, principal: "", interestRate: "", tenureMonths: "", startDate: todayIso(), accountNumber: "" });
  const addLoan = () => {
    if (!newLoan.name.trim() || !newLoan.principal || !newLoan.tenureMonths) return;
    setLoans((prev) => [...prev, { id: uid(), ownerId: newLoan.ownerId, name: newLoan.name.trim(), lenderType: newLoan.lenderType, currency: newLoan.currency, principal: Number(newLoan.principal), interestRate: Number(newLoan.interestRate) || 0, tenureMonths: Number(newLoan.tenureMonths), startDate: newLoan.startDate, accountNumber: newLoan.accountNumber.trim() }]);
    setNewLoan({ ownerId: "shared", name: "", lenderType: "bank", currency: "AED", principal: "", interestRate: "", tenureMonths: "", startDate: todayIso(), accountNumber: "" });
  };
  const removeLoan = (id: string) => setLoans((prev) => prev.filter((l) => l.id !== id));
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [loanDraft, setLoanDraft] = useState<Loan | null>(null);
  const startEditLoan = (l: Loan) => { setEditingLoanId(l.id); setLoanDraft({ ...l }); };
  const saveLoan = () => {
    if (!loanDraft) return;
    setLoans((prev) => prev.map((l) => (l.id === loanDraft.id ? loanDraft : l)));
    setEditingLoanId(null);
    setLoanDraft(null);
  };

  // ---------------- Subscriptions ----------------
  const [newSub, setNewSub] = useState({ ownerId: "shared", provider: "", currency: "AED" as Currency, amount: "", cadence: "monthly" as Sub["cadence"], billingDay: "1", nextDate: todayIso(), taxPct: "0", tenureMonths: "0" });
  const addSub = () => {
    if (!newSub.provider.trim() || !newSub.amount) return;
    setSubs((prev) => [...prev, { id: uid(), ownerId: newSub.ownerId, provider: newSub.provider.trim(), currency: newSub.currency, amount: Number(newSub.amount), cadence: newSub.cadence, billingDay: Number(newSub.billingDay) || 1, nextDate: newSub.nextDate, taxPct: Number(newSub.taxPct) || 0, tenureMonths: Number(newSub.tenureMonths) || 0, notes: "", elevatedAmount: null, effectiveUntil: "" }]);
    setNewSub({ ownerId: "shared", provider: "", currency: "AED", amount: "", cadence: "monthly", billingDay: "1", nextDate: todayIso(), taxPct: "0", tenureMonths: "0" });
  };
  const removeSub = (id: string) => setSubs((prev) => prev.filter((s) => s.id !== id));
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState<Sub | null>(null);
  const startEditSub = (s: Sub) => { setEditingSubId(s.id); setSubDraft({ ...s }); };
  const saveSub = () => {
    if (!subDraft) return;
    setSubs((prev) => prev.map((s) => (s.id === subDraft.id ? subDraft : s)));
    setEditingSubId(null);
    setSubDraft(null);
  };

  // ---------------- Payment schemes (education/term-fee style plans) ----------------
  const [newScheme, setNewScheme] = useState({ ownerId: "shared", name: "", institution: "", currency: "AED" as Currency });
  const addScheme = () => {
    if (!newScheme.name.trim()) return;
    setSchemes((prev) => [...prev, { id: uid(), ownerId: newScheme.ownerId, name: newScheme.name.trim(), institution: newScheme.institution.trim(), currency: newScheme.currency, items: [] }]);
    setNewScheme({ ownerId: "shared", name: "", institution: "", currency: "AED" });
  };
  const removeScheme = (id: string) => setSchemes((prev) => prev.filter((sc) => sc.id !== id));
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [schemeDraft, setSchemeDraft] = useState<Scheme | null>(null);
  const startEditScheme = (sc: Scheme) => { setEditingSchemeId(sc.id); setSchemeDraft({ ...sc }); };
  const saveScheme = () => {
    if (!schemeDraft) return;
    setSchemes((prev) => prev.map((sc) => (sc.id === schemeDraft.id ? { ...schemeDraft, items: sc.items } : sc)));
    setEditingSchemeId(null);
    setSchemeDraft(null);
  };

  const [itemDraft, setItemDraft] = useState<Record<string, { label: string; amount: string; cadence: SchemeCadence; dueDate: string; billingDay: string }>>({});
  const addSchemeItem = (schemeId: string) => {
    const d = itemDraft[schemeId];
    if (!d?.label?.trim() || !d?.amount) return;
    const item: SchemeItem = { id: uid(), label: d.label.trim(), amount: Number(d.amount), cadence: d.cadence, dueDate: d.dueDate || todayIso(), billingDay: Number(d.billingDay) || 1, paid: false };
    setSchemes((prev) => prev.map((sc) => (sc.id === schemeId ? { ...sc, items: [...sc.items, item] } : sc)));
    setItemDraft((prev) => ({ ...prev, [schemeId]: { label: "", amount: "", cadence: "onetime", dueDate: todayIso(), billingDay: "1" } }));
  };
  const removeSchemeItem = (schemeId: string, itemId: string) =>
    setSchemes((prev) => prev.map((sc) => (sc.id === schemeId ? { ...sc, items: sc.items.filter((it) => it.id !== itemId) } : sc)));
  const toggleItemPaid = (schemeId: string, itemId: string) =>
    setSchemes((prev) => prev.map((sc) => (sc.id === schemeId ? { ...sc, items: sc.items.map((it) => (it.id === itemId ? { ...it, paid: !it.paid } : it)) } : sc)));

  // ---------------- Income (Item 1) ----------------
  const [newIncome, setNewIncome] = useState({ ownerId: "shared", source: "", incomeType: "salary", amount: "", currency: "AED" as Currency, isRecurring: true, cadence: "monthly" as Income["cadence"], receivedDate: todayIso(), notes: "" });
  const addIncome = () => {
    if (!newIncome.source.trim() || !newIncome.amount) return;
    setIncome((prev) => [...prev, { id: uid(), ownerId: newIncome.ownerId, source: newIncome.source.trim(), incomeType: newIncome.incomeType, amount: Number(newIncome.amount), currency: newIncome.currency, isRecurring: newIncome.isRecurring, cadence: newIncome.cadence, receivedDate: newIncome.receivedDate, notes: newIncome.notes.trim() }]);
    setNewIncome({ ownerId: "shared", source: "", incomeType: "salary", amount: "", currency: "AED", isRecurring: true, cadence: "monthly", receivedDate: todayIso(), notes: "" });
  };
  const removeIncome = (id: string) => setIncome((prev) => prev.filter((i) => i.id !== id));
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [incomeDraft, setIncomeDraft] = useState<Income | null>(null);
  const startEditIncome = (i: Income) => { setEditingIncomeId(i.id); setIncomeDraft({ ...i }); };
  const saveIncome = () => {
    if (!incomeDraft) return;
    setIncome((prev) => prev.map((i) => (i.id === incomeDraft.id ? incomeDraft : i)));
    setEditingIncomeId(null);
    setIncomeDraft(null);
  };

  // ---------------- Unified Add Expense (Item 2) — monthly recurring / fixed-term / one-off, all editable ----------------
  const [newExpense, setNewExpense] = useState({
    ownerId: "shared", label: "", category: "", currency: "AED" as Currency, expenseType: "one_off" as ExpenseType,
    amount: "", useRange: false, minAmount: "", maxAmount: "",
    billingDay: "1", startDate: todayIso(), endDate: "", dueDate: todayIso(), notes: "",
  });
  const newExpenseEstimate = newExpense.useRange ? estimateFromRange(Number(newExpense.minAmount) || 0, Number(newExpense.maxAmount) || 0, 5) : Number(newExpense.amount) || 0;
  const addExpense = () => {
    if (!newExpense.label.trim() || !newExpenseEstimate) return;
    setExpenses((prev) => [...prev, {
      id: uid(), ownerId: newExpense.ownerId, label: newExpense.label.trim(), category: newExpense.category.trim(), currency: newExpense.currency,
      amount: newExpenseEstimate, minAmount: newExpense.useRange ? Number(newExpense.minAmount) || 0 : null, maxAmount: newExpense.useRange ? Number(newExpense.maxAmount) || 0 : null,
      isEstimated: newExpense.useRange, expenseType: newExpense.expenseType, billingDay: Number(newExpense.billingDay) || 1,
      startDate: newExpense.expenseType === "fixed_term" ? newExpense.startDate : "", endDate: newExpense.expenseType === "fixed_term" ? newExpense.endDate : "",
      dueDate: newExpense.expenseType === "one_off" ? newExpense.dueDate : "", notes: newExpense.notes.trim(), paid: false,
    }]);
    setNewExpense({ ownerId: "shared", label: "", category: "", currency: "AED", expenseType: "one_off", amount: "", useRange: false, minAmount: "", maxAmount: "", billingDay: "1", startDate: todayIso(), endDate: "", dueDate: todayIso(), notes: "" });
  };
  const removeExpense = (id: string) => setExpenses((prev) => prev.filter((e) => e.id !== id));
  const toggleExpensePaid = (id: string) => setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, paid: !e.paid } : e)));
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseDraft, setExpenseDraft] = useState<Expense | null>(null);
  const startEditExpense = (e: Expense) => { setEditingExpenseId(e.id); setExpenseDraft({ ...e }); };
  const saveExpense = () => {
    if (!expenseDraft) return;
    setExpenses((prev) => prev.map((e) => (e.id === expenseDraft.id ? expenseDraft : e)));
    setEditingExpenseId(null);
    setExpenseDraft(null);
  };

  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Finance</h1>
            <p className="mt-1 text-sm text-gray-400">
              LKR · AED · USD side by side. Synced live to your household database.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="glass-card flex items-center rounded-full p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode("standard")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                  viewMode === "standard" ? "bg-accent-purple text-white" : "text-gray-400 hover:text-white"
                }`}
                title="Standard view — data entry and lists"
              >
                <List size={13} /> Standard
              </button>
              <button
                type="button"
                onClick={() => setViewMode("deep")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                  viewMode === "deep" ? "bg-accent-purple text-white" : "text-gray-400 hover:text-white"
                }`}
                title="Deep view — charts, meters, and projections"
              >
                <BarChart3 size={13} /> Deep
              </button>
            </div>
            <button
              type="button"
              onClick={() => setHideBalances((v) => !v)}
              className="glass-card flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white"
              title={hideBalances ? "Balances are hidden by default — click any amount to reveal it" : "All balances are showing"}
            >
              {hideBalances ? <EyeOff size={13} /> : <Eye size={13} />}
              {hideBalances ? "Balances hidden" : "Balances visible"}
            </button>
            {[{ id: "all", name: "Household" }, ...owners].map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setFilter(o.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === o.id ? "bg-accent-purple text-white" : "glass-card text-gray-400 hover:text-white"
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>

        {/* Spending Plan — item 1, always visible (not gated behind Deep view; the underlying Income data lives in Standard view below it) */}
        <SpendingPlanBanner
          safeToSpend={safeToSpend}
          monthlyIncome={monthlyIncomeConverted}
          monthlyOutflow={monthlyOutflowConverted}
          status={spStatus}
          currency={PRIMARY_CURRENCY}
          hasIncome={fIncome.some((i) => i.isRecurring)}
        />

        {/* Deep view — charts/meters built from the same data as Standard view below */}
        {viewMode === "deep" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CashFlowChart data={cashFlowData} />
            </div>
            <BudgetMeterCard outflow={monthlyOutflow} budget={budget} status={status} />
            <SpendCategoryDonut loans={loansOutflow} cards={cardsOutflow} subs={subsOutflow} schemes={schemeMonthlyContribution} expenses={expensesMonthlyContribution} />
            <div className="lg:col-span-2">
              <CurrencyBalancesBars totals={totalsByCurrency} hideBalances={hideBalances} />
            </div>
          </div>
        )}

        {/* Budget status */}
        <section className="glass-card rounded-xl2 p-5">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${statusCls.bg}`} />
              <div>
                <p className="text-sm text-gray-200">
                  This month&rsquo;s committed outflow:{" "}
                  <BlurAmount id="outflow-total" text={Math.round(monthlyOutflow).toLocaleString()} />
                  {" "}(loan EMIs + card plans + subscriptions + due scheme items, mixed currencies summed at face value)
                </p>
                <p className="text-xs text-gray-500">
                  {budget > 0 ? `${Math.round((monthlyOutflow / budget) * 100)}% of your ${budget.toLocaleString()} monthly budget` : "Set a monthly budget to get a red/orange/green status."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Monthly budget</span>
              <input
                type="number"
                value={budget || ""}
                onChange={(e) => setBudget(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-28 rounded-xl border border-base-border bg-base-card px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
            </div>
          </div>
        </section>

        {/* Upcoming + next major payment */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="glass-card rounded-xl2 p-5">
            <h2 className="relative z-10 mb-4 font-medium text-white">Upcoming payments (next 14 days)</h2>
            <div className="relative z-10 space-y-2">
              {upcoming.length === 0 && <p className="text-xs text-gray-500">Nothing due in the next two weeks.</p>}
              {upcoming.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <p className="text-gray-200">{p.label}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-gray-300">{formatMoney(p.amount, p.currency)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${p.days <= 3 ? "bg-red-500/20 text-red-400" : p.days <= 7 ? "bg-accent-orange/20 text-accent-orange" : "bg-accent-blue/20 text-accent-blue"}`}>
                      {formatDaysUntil(p.days)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="glass-card rounded-xl2 p-5">
            <h2 className="relative z-10 mb-4 font-medium text-white">Next major payment (2–4 months out)</h2>
            <div className="relative z-10">
              {nextMajor ? (
                <div className="text-sm">
                  <p className="text-gray-200">{nextMajor.label}</p>
                  <p className="mt-1 text-lg font-semibold text-white">{formatMoney(nextMajor.amount, nextMajor.currency)}</p>
                  <p className="text-xs text-gray-500">{formatDaysUntil(nextMajor.days)} · {nextMajor.owner}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">No yearly/term bills landing 2–4 months out.</p>
              )}
            </div>
          </section>
        </div>

        {/* Accounts */}
        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-2 font-medium text-white">Bank &amp; BNPL accounts</h2>
          <p className="relative z-10 mb-3 flex items-start gap-1.5 text-xs text-accent-orange">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Bank URL is just a quick link to the login page — never save full login credentials, passwords, or
            complete card numbers here.
          </p>
          {Object.keys(totalsByCurrency).length > 0 && (
            <p className="relative z-10 mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
              {Object.entries(totalsByCurrency).map(([cur, total]) => (
                <span key={cur}>
                  Total {cur}: <BlurAmount id={`total-${cur}`} text={total.toLocaleString()} />
                </span>
              ))}
            </p>
          )}
          <div className="relative z-10 space-y-3">
            {fAccounts.map((a) =>
              editingAccountId === a.id && accountDraft ? (
                <div key={a.id} className="flex flex-wrap items-end gap-2 rounded-xl border border-accent-purple/40 p-2">
                  <Field label="Owner"><OwnerSelect value={accountDraft.ownerId} onChange={(v) => setAccountDraft({ ...accountDraft, ownerId: v })} /></Field>
                  <Field label="Name"><input value={accountDraft.name} onChange={(e) => setAccountDraft({ ...accountDraft, name: e.target.value })} className={inputCls} /></Field>
                  <Field label="Type">
                    <select value={accountDraft.type} onChange={(e) => setAccountDraft({ ...accountDraft, type: e.target.value as "bank" | "bnpl" })} className={selectCls}>
                      <option value="bank">Bank</option><option value="bnpl">BNPL</option>
                    </select>
                  </Field>
                  <Field label="Currency">
                    <select value={accountDraft.currency} onChange={(e) => setAccountDraft({ ...accountDraft, currency: e.target.value as Currency })} className={selectCls}>
                      <option>AED</option><option>LKR</option><option>USD</option>
                    </select>
                  </Field>
                  <Field label="Balance"><input type="number" value={accountDraft.balance} onChange={(e) => setAccountDraft({ ...accountDraft, balance: Number(e.target.value) })} className={smallInputCls} /></Field>
                  <Field label="Bank URL"><input value={accountDraft.bankUrl} onChange={(e) => setAccountDraft({ ...accountDraft, bankUrl: e.target.value })} placeholder="https://..." className={inputCls} /></Field>
                  <button type="button" onClick={saveAccount} className="text-accent-green hover:text-white"><Check size={16} /></button>
                  <button type="button" onClick={() => setEditingAccountId(null)} className={iconBtnCls}><X size={16} /></button>
                </div>
              ) : (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="flex items-center gap-1.5 text-gray-200">
                      {a.name}
                      {a.bankUrl && (
                        <a href={a.bankUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white" title="Open bank login page">
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{a.type === "bnpl" ? "BNPL" : "Bank"} · {ownerName(a.ownerId)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <BlurAmount id={a.id} text={formatMoney(a.balance, a.currency)} />
                    <button type="button" onClick={() => startEditAccount(a)} className={iconBtnCls}><Pencil size={13} /></button>
                    <button type="button" onClick={() => removeAccount(a.id)} className={iconBtnCls}><X size={14} /></button>
                  </div>
                </div>
              )
            )}
            {fAccounts.length === 0 && <p className="text-xs text-gray-500">No accounts for this filter.</p>}
          </div>
          <div className="relative z-10 mt-4 flex flex-wrap gap-2 border-t border-base-border pt-4">
            <OwnerSelect value={newAccount.ownerId} onChange={(v) => setNewAccount((s) => ({ ...s, ownerId: v }))} />
            <input placeholder="Account name" value={newAccount.name} onChange={(e) => setNewAccount((s) => ({ ...s, name: e.target.value }))} className={inputCls} />
            <select value={newAccount.type} onChange={(e) => setNewAccount((s) => ({ ...s, type: e.target.value as "bank" | "bnpl" }))} className={selectCls}>
              <option value="bank">Bank</option>
              <option value="bnpl">BNPL</option>
            </select>
            <select value={newAccount.currency} onChange={(e) => setNewAccount((s) => ({ ...s, currency: e.target.value as Currency }))} className={selectCls}>
              <option>AED</option><option>LKR</option><option>USD</option>
            </select>
            <input placeholder="Balance" type="number" value={newAccount.balance} onChange={(e) => setNewAccount((s) => ({ ...s, balance: e.target.value }))} className={smallInputCls} />
            <input placeholder="Bank URL (optional)" value={newAccount.bankUrl} onChange={(e) => setNewAccount((s) => ({ ...s, bankUrl: e.target.value }))} className={inputCls} />
            <button type="button" onClick={addAccount} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add
            </button>
          </div>
        </section>

        {/* Cards */}
        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-4 font-medium text-white">Cards</h2>
          <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fCards.map((c) => {
              const emi = c.tenureMonths > 0 ? calcEMI(c.outstanding, c.interestRate, c.tenureMonths) : 0;
              const usedPct = c.creditLimit > 0 ? Math.min(100, (c.limitUsed / c.creditLimit) * 100) : 0;
              const spends = cardSpends.filter((s) => s.cardId === c.id);
              const draft = spendDraft[c.id] ?? { label: "", amount: "", currency: c.currency };
              const editing = editingCardId === c.id && cardDraft;
              return (
                <details key={c.id} className="glossy-gradient group rounded-xl2 bg-gradient-to-br from-accent-purple to-accent-blue p-4">
                  <summary className="relative z-10 flex cursor-pointer list-none items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} />
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs opacity-80">{c.network.toUpperCase()} •••• {c.last4} · {ACCOUNT_KIND_LABEL[c.accountKind]} · {ownerName(c.ownerId)}</p>
                      </div>
                    </div>
                    <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="relative z-10 mt-3 space-y-2 rounded-xl bg-black/20 p-3 text-xs text-white">
                    {editing && cardDraft ? (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          <Field label="Name" dark><input value={cardDraft.name} onChange={(e) => setCardDraft({ ...cardDraft, name: e.target.value })} className="w-full rounded-lg bg-white/10 px-2 py-1 text-white outline-none" /></Field>
                          <Field label="Last 4" dark><input value={cardDraft.last4} maxLength={4} onChange={(e) => setCardDraft({ ...cardDraft, last4: e.target.value.replace(/\D/g, "") })} className="w-14 rounded-lg bg-white/10 px-2 py-1 text-white outline-none" /></Field>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Field label="Network" dark>
                            <select value={cardDraft.network} onChange={(e) => setCardDraft({ ...cardDraft, network: e.target.value as CardAcct["network"] })} className="rounded-lg bg-white/10 px-2 py-1 text-white outline-none">
                              <option className="text-black" value="visa">Visa</option><option className="text-black" value="mastercard">Mastercard</option><option className="text-black" value="other">Other</option>
                            </select>
                          </Field>
                          <Field label="Account type" dark>
                            <select value={cardDraft.accountKind} onChange={(e) => setCardDraft({ ...cardDraft, accountKind: e.target.value as AccountKind })} className="rounded-lg bg-white/10 px-2 py-1 text-white outline-none">
                              {(Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[]).map((k) => (
                                <option key={k} className="text-black" value={k}>{ACCOUNT_KIND_LABEL[k]}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Currency" dark>
                            <select value={cardDraft.currency} onChange={(e) => setCardDraft({ ...cardDraft, currency: e.target.value as Currency })} className="rounded-lg bg-white/10 px-2 py-1 text-white outline-none">
                              <option className="text-black">AED</option><option className="text-black">LKR</option><option className="text-black">USD</option>
                            </select>
                          </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <Field label="Credit limit" dark><input type="number" value={cardDraft.creditLimit} onChange={(e) => setCardDraft({ ...cardDraft, creditLimit: Number(e.target.value) })} className="w-full rounded-lg bg-white/10 px-2 py-1 text-white outline-none" /></Field>
                          <Field label="Limit used" dark><input type="number" value={cardDraft.limitUsed} onChange={(e) => setCardDraft({ ...cardDraft, limitUsed: Number(e.target.value) })} className="w-full rounded-lg bg-white/10 px-2 py-1 text-white outline-none" /></Field>
                          <Field label="Outstanding" dark><input type="number" value={cardDraft.outstanding} onChange={(e) => setCardDraft({ ...cardDraft, outstanding: Number(e.target.value) })} className="w-full rounded-lg bg-white/10 px-2 py-1 text-white outline-none" /></Field>
                          <Field label="APR %" dark><input type="number" value={cardDraft.interestRate} onChange={(e) => setCardDraft({ ...cardDraft, interestRate: Number(e.target.value) })} className="w-full rounded-lg bg-white/10 px-2 py-1 text-white outline-none" /></Field>
                          <Field label="EMI months (0=none)" dark><input type="number" value={cardDraft.tenureMonths} onChange={(e) => setCardDraft({ ...cardDraft, tenureMonths: Number(e.target.value) })} className="w-full rounded-lg bg-white/10 px-2 py-1 text-white outline-none" /></Field>
                          <Field label="Owner" dark><OwnerSelect value={cardDraft.ownerId} onChange={(v) => setCardDraft({ ...cardDraft, ownerId: v })} /></Field>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button type="button" onClick={saveCard} className="flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1"><Check size={12} /> Save</button>
                          <button type="button" onClick={() => setEditingCardId(null)} className="opacity-70 hover:opacity-100">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="h-1.5 w-full rounded-full bg-white/20">
                          <div className="h-1.5 rounded-full bg-white" style={{ width: `${usedPct}%` }} />
                        </div>
                        <p>
                          <BlurAmount id={`card-used-${c.id}`} text={formatMoney(c.limitUsed, c.currency)} /> used of {formatMoney(c.creditLimit, c.currency)} ({Math.round(usedPct)}%)
                        </p>
                        <p>
                          Outstanding: <BlurAmount id={`card-out-${c.id}`} text={formatMoney(c.outstanding, c.currency)} /> · {c.interestRate}% APR
                        </p>
                        {c.tenureMonths > 0 && <p>EMI plan: {formatMoney(emi, c.currency)}/mo × {c.tenureMonths}mo</p>}
                        <div className="border-t border-white/10 pt-2">
                          <p className="mb-1 font-medium">Logged spend</p>
                          {spends.length === 0 && <p className="opacity-70">None logged yet.</p>}
                          {spends.map((s) => (
                            <div key={s.id} className="flex items-center justify-between py-0.5">
                              <span>{s.label}</span>
                              <span className="flex items-center gap-1.5">
                                {formatMoney(s.amount, s.currency)}
                                <button type="button" onClick={() => removeSpend(s)} className="opacity-60 hover:opacity-100"><X size={10} /></button>
                              </span>
                            </div>
                          ))}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <input placeholder="Label" value={draft.label} onChange={(e) => setSpendDraft((p) => ({ ...p, [c.id]: { ...draft, label: e.target.value } }))} className="min-w-0 flex-1 rounded-lg bg-white/10 px-2 py-1 text-white outline-none placeholder:text-white/50" />
                            <input placeholder="Amt" type="number" value={draft.amount} onChange={(e) => setSpendDraft((p) => ({ ...p, [c.id]: { ...draft, amount: e.target.value } }))} className="w-16 rounded-lg bg-white/10 px-2 py-1 text-white outline-none placeholder:text-white/50" />
                            <select value={draft.currency} onChange={(e) => setSpendDraft((p) => ({ ...p, [c.id]: { ...draft, currency: e.target.value as Currency } }))} className="rounded-lg bg-white/10 px-1.5 py-1 text-white outline-none">
                              <option className="text-black">AED</option><option className="text-black">LKR</option><option className="text-black">USD</option>
                            </select>
                            <button type="button" onClick={() => addSpend(c)} className="rounded-lg bg-white/20 px-2 py-1">+</button>
                          </div>
                        </div>
                        <div className="flex gap-3 pt-1">
                          <button type="button" onClick={() => startEditCard(c)} className="flex items-center gap-1 text-white/70 hover:text-white"><Pencil size={11} /> Edit</button>
                          <button type="button" onClick={() => removeCard(c.id)} className="text-white/70 hover:text-white">Remove card</button>
                        </div>
                      </>
                    )}
                  </div>
                </details>
              );
            })}
            {fCards.length === 0 && <p className="text-xs text-gray-500">No cards for this filter.</p>}
          </div>
          <div className="relative z-10 mt-4 flex flex-wrap gap-2 border-t border-base-border pt-4">
            <OwnerSelect value={newCard.ownerId} onChange={(v) => setNewCard((s) => ({ ...s, ownerId: v }))} />
            <input placeholder="Card name" value={newCard.name} onChange={(e) => setNewCard((s) => ({ ...s, name: e.target.value }))} className={inputCls} />
            <select value={newCard.network} onChange={(e) => setNewCard((s) => ({ ...s, network: e.target.value as CardAcct["network"] }))} className={selectCls}>
              <option value="visa">Visa</option><option value="mastercard">Mastercard</option><option value="other">Other</option>
            </select>
            <select value={newCard.accountKind} onChange={(e) => setNewCard((s) => ({ ...s, accountKind: e.target.value as AccountKind }))} className={selectCls}>
              {(Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[]).map((k) => (
                <option key={k} value={k}>{ACCOUNT_KIND_LABEL[k]}</option>
              ))}
            </select>
            <input placeholder="Last 4" maxLength={4} value={newCard.last4} onChange={(e) => setNewCard((s) => ({ ...s, last4: e.target.value.replace(/\D/g, "") }))} className="w-16 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <select value={newCard.currency} onChange={(e) => setNewCard((s) => ({ ...s, currency: e.target.value as Currency }))} className={selectCls}>
              <option>AED</option><option>LKR</option><option>USD</option>
            </select>
            <input placeholder="Credit limit" type="number" value={newCard.creditLimit} onChange={(e) => setNewCard((s) => ({ ...s, creditLimit: e.target.value }))} className="w-28 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <input placeholder="Limit used" type="number" value={newCard.limitUsed} onChange={(e) => setNewCard((s) => ({ ...s, limitUsed: e.target.value }))} className="w-24 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <input placeholder="Outstanding" type="number" value={newCard.outstanding} onChange={(e) => setNewCard((s) => ({ ...s, outstanding: e.target.value }))} className="w-24 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <input placeholder="APR %" type="number" value={newCard.interestRate} onChange={(e) => setNewCard((s) => ({ ...s, interestRate: e.target.value }))} className="w-20 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <input placeholder="EMI months (0=none)" type="number" value={newCard.tenureMonths} onChange={(e) => setNewCard((s) => ({ ...s, tenureMonths: e.target.value }))} className="w-20 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <button type="button" onClick={addCard} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add
            </button>
          </div>
        </section>

        {/* Loans */}
        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-4 font-medium text-white">Loans &amp; installments</h2>
          <div className="relative z-10 space-y-4">
            {fLoans.map((l) => {
              if (editingLoanId === l.id && loanDraft) {
                return (
                  <div key={l.id} className="flex flex-wrap items-end gap-2 rounded-xl border border-accent-purple/40 p-2">
                    <Field label="Owner"><OwnerSelect value={loanDraft.ownerId} onChange={(v) => setLoanDraft({ ...loanDraft, ownerId: v })} /></Field>
                    <Field label="Name"><input value={loanDraft.name} onChange={(e) => setLoanDraft({ ...loanDraft, name: e.target.value })} className={inputCls} /></Field>
                    <Field label="Lender type">
                      <select value={loanDraft.lenderType} onChange={(e) => setLoanDraft({ ...loanDraft, lenderType: e.target.value as Loan["lenderType"] })} className={selectCls}>
                        <option value="bank">Bank</option><option value="person">Person</option><option value="institution">Institution</option>
                      </select>
                    </Field>
                    <Field label="Currency">
                      <select value={loanDraft.currency} onChange={(e) => setLoanDraft({ ...loanDraft, currency: e.target.value as Currency })} className={selectCls}>
                        <option>AED</option><option>LKR</option><option>USD</option>
                      </select>
                    </Field>
                    <Field label="Principal"><input type="number" value={loanDraft.principal} onChange={(e) => setLoanDraft({ ...loanDraft, principal: Number(e.target.value) })} className={smallInputCls} /></Field>
                    <Field label="APR %"><input type="number" value={loanDraft.interestRate} onChange={(e) => setLoanDraft({ ...loanDraft, interestRate: Number(e.target.value) })} className={smallInputCls} /></Field>
                    <Field label="Tenure (mo)"><input type="number" value={loanDraft.tenureMonths} onChange={(e) => setLoanDraft({ ...loanDraft, tenureMonths: Number(e.target.value) })} className={smallInputCls} /></Field>
                    <Field label="Start date"><input type="date" value={loanDraft.startDate} onChange={(e) => setLoanDraft({ ...loanDraft, startDate: e.target.value })} className={selectCls} /></Field>
                    <Field label="Account #"><input value={loanDraft.accountNumber} onChange={(e) => setLoanDraft({ ...loanDraft, accountNumber: e.target.value })} className={inputCls} /></Field>
                    <button type="button" onClick={saveLoan} className="text-accent-green hover:text-white"><Check size={16} /></button>
                    <button type="button" onClick={() => setEditingLoanId(null)} className={iconBtnCls}><X size={16} /></button>
                  </div>
                );
              }
              const emi = calcEMI(l.principal, l.interestRate, l.tenureMonths);
              const elapsed = monthsElapsedSince(l.startDate);
              const remaining = calcRemainingBalance(l.principal, l.interestRate, l.tenureMonths, elapsed);
              const monthsLeft = Math.max(0, l.tenureMonths - elapsed);
              return (
                <div key={l.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-200">{l.name} <span className="text-xs text-gray-500">({l.lenderType} · {ownerName(l.ownerId)})</span></p>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-400">{monthsLeft} months left</p>
                      <button type="button" onClick={() => startEditLoan(l)} className={iconBtnCls}><Pencil size={13} /></button>
                      <button type="button" onClick={() => removeLoan(l.id)} className={iconBtnCls}><X size={12} /></button>
                    </div>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-base-card">
                    <div className="h-1.5 rounded-full bg-accent-blue" style={{ width: `${l.tenureMonths ? Math.min(100, (elapsed / l.tenureMonths) * 100) : 0}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatMoney(remaining, l.currency)} remaining · {formatMoney(emi, l.currency)}/mo EMI
                    {l.accountNumber ? ` · Acct ${l.accountNumber}` : ""}
                  </p>
                </div>
              );
            })}
            {fLoans.length === 0 && <p className="text-xs text-gray-500">No loans logged.</p>}
          </div>
          <div className="relative z-10 mt-4 flex flex-wrap gap-2 border-t border-base-border pt-4">
            <OwnerSelect value={newLoan.ownerId} onChange={(v) => setNewLoan((s) => ({ ...s, ownerId: v }))} />
            <input placeholder="Loan name" value={newLoan.name} onChange={(e) => setNewLoan((s) => ({ ...s, name: e.target.value }))} className={inputCls} />
            <select value={newLoan.lenderType} onChange={(e) => setNewLoan((s) => ({ ...s, lenderType: e.target.value as Loan["lenderType"] }))} className={selectCls}>
              <option value="bank">Bank</option><option value="person">Person</option><option value="institution">Institution</option>
            </select>
            <select value={newLoan.currency} onChange={(e) => setNewLoan((s) => ({ ...s, currency: e.target.value as Currency }))} className={selectCls}>
              <option>AED</option><option>LKR</option><option>USD</option>
            </select>
            <input placeholder="Principal" type="number" value={newLoan.principal} onChange={(e) => setNewLoan((s) => ({ ...s, principal: e.target.value }))} className="w-28 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <input placeholder="APR %" type="number" value={newLoan.interestRate} onChange={(e) => setNewLoan((s) => ({ ...s, interestRate: e.target.value }))} className="w-20 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <input placeholder="Tenure (mo)" type="number" value={newLoan.tenureMonths} onChange={(e) => setNewLoan((s) => ({ ...s, tenureMonths: e.target.value }))} className="w-24 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <input type="date" value={newLoan.startDate} onChange={(e) => setNewLoan((s) => ({ ...s, startDate: e.target.value }))} className="rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <input placeholder="Account # (optional)" value={newLoan.accountNumber} onChange={(e) => setNewLoan((s) => ({ ...s, accountNumber: e.target.value }))} className={inputCls} />
            <button type="button" onClick={addLoan} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add
            </button>
          </div>
        </section>

        {/* Payment schemes — education / multi-line-item plans */}
        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-1 flex items-center gap-2 font-medium text-white">
            <GraduationCap size={16} /> Payment schemes
          </h2>
          <p className="relative z-10 mb-4 text-xs text-gray-500">
            For plans with several irregular line items — e.g. a university programme with a termly fee, monthly materials cost, and one-off exam fees.
          </p>
          <div className="relative z-10 space-y-5">
            {fSchemes.map((sc) => {
              const d = itemDraft[sc.id] ?? { label: "", amount: "", cadence: "onetime" as SchemeCadence, dueDate: todayIso(), billingDay: "1" };
              const editing = editingSchemeId === sc.id && schemeDraft;
              return (
                <div key={sc.id} className="rounded-xl border border-base-border p-3">
                  {editing && schemeDraft ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <Field label="Owner"><OwnerSelect value={schemeDraft.ownerId} onChange={(v) => setSchemeDraft({ ...schemeDraft, ownerId: v })} /></Field>
                      <Field label="Scheme name"><input value={schemeDraft.name} onChange={(e) => setSchemeDraft({ ...schemeDraft, name: e.target.value })} className={inputCls} /></Field>
                      <Field label="Institution"><input value={schemeDraft.institution} onChange={(e) => setSchemeDraft({ ...schemeDraft, institution: e.target.value })} className={inputCls} /></Field>
                      <Field label="Currency">
                        <select value={schemeDraft.currency} onChange={(e) => setSchemeDraft({ ...schemeDraft, currency: e.target.value as Currency })} className={selectCls}>
                          <option>AED</option><option>LKR</option><option>USD</option>
                        </select>
                      </Field>
                      <button type="button" onClick={saveScheme} className="text-accent-green hover:text-white"><Check size={16} /></button>
                      <button type="button" onClick={() => setEditingSchemeId(null)} className={iconBtnCls}><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-200">{sc.name}</p>
                        <p className="text-xs text-gray-500">{sc.institution || "No institution set"} · {ownerName(sc.ownerId)} · {sc.currency}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => startEditScheme(sc)} className={iconBtnCls}><Pencil size={13} /></button>
                        <button type="button" onClick={() => removeScheme(sc.id)} className={iconBtnCls}><X size={14} /></button>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 space-y-1.5 border-t border-base-border pt-3">
                    {sc.items.map((it) => {
                      const days = daysUntil(schemeItemDate(it));
                      return (
                        <div key={it.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {it.cadence !== "monthly" && (
                              <input type="checkbox" checked={it.paid} onChange={() => toggleItemPaid(sc.id, it.id)} title="Mark paid" />
                            )}
                            <span className={it.paid ? "text-gray-500 line-through" : "text-gray-300"}>{it.label}</span>
                            <span className="rounded-full bg-base-card px-1.5 py-0.5 text-[10px] text-gray-500">{it.cadence}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-300">{formatMoney(it.amount, sc.currency)}</span>
                            {!it.paid && <span className="text-gray-500">{formatDaysUntil(days)}</span>}
                            <button type="button" onClick={() => removeSchemeItem(sc.id, it.id)} className={iconBtnCls}><X size={11} /></button>
                          </div>
                        </div>
                      );
                    })}
                    {sc.items.length === 0 && <p className="text-xs text-gray-500">No line items yet.</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <input placeholder="Line item (e.g. Exam fee)" value={d.label} onChange={(e) => setItemDraft((p) => ({ ...p, [sc.id]: { ...d, label: e.target.value } }))} className={inputCls} />
                      <input placeholder="Amount" type="number" value={d.amount} onChange={(e) => setItemDraft((p) => ({ ...p, [sc.id]: { ...d, amount: e.target.value } }))} className={smallInputCls} />
                      <select value={d.cadence} onChange={(e) => setItemDraft((p) => ({ ...p, [sc.id]: { ...d, cadence: e.target.value as SchemeCadence } }))} className={selectCls}>
                        <option value="onetime">One-time</option>
                        <option value="monthly">Monthly</option>
                        <option value="termly">Termly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                      {d.cadence === "monthly" ? (
                        <input type="number" min={1} max={31} placeholder="Billing day" value={d.billingDay} onChange={(e) => setItemDraft((p) => ({ ...p, [sc.id]: { ...d, billingDay: e.target.value } }))} className={smallInputCls} />
                      ) : (
                        <input type="date" value={d.dueDate} onChange={(e) => setItemDraft((p) => ({ ...p, [sc.id]: { ...d, dueDate: e.target.value } }))} className={selectCls} />
                      )}
                      <button type="button" onClick={() => addSchemeItem(sc.id)} className="flex items-center gap-1 rounded-xl bg-accent-purple/80 px-3 py-2 text-xs text-white">
                        <Plus size={12} /> Add line
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {fSchemes.length === 0 && <p className="text-xs text-gray-500">No payment schemes for this filter.</p>}
          </div>
          <div className="relative z-10 mt-4 flex flex-wrap gap-2 border-t border-base-border pt-4">
            <OwnerSelect value={newScheme.ownerId} onChange={(v) => setNewScheme((s) => ({ ...s, ownerId: v }))} />
            <input placeholder="Scheme name (e.g. MBA — Term 3)" value={newScheme.name} onChange={(e) => setNewScheme((s) => ({ ...s, name: e.target.value }))} className={inputCls} />
            <input placeholder="Institution" value={newScheme.institution} onChange={(e) => setNewScheme((s) => ({ ...s, institution: e.target.value }))} className={inputCls} />
            <select value={newScheme.currency} onChange={(e) => setNewScheme((s) => ({ ...s, currency: e.target.value as Currency }))} className={selectCls}>
              <option>AED</option><option>LKR</option><option>USD</option>
            </select>
            <button type="button" onClick={addScheme} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add scheme
            </button>
          </div>
        </section>

        {/* Subscriptions */}
        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-4 font-medium text-white">Subscriptions</h2>
          <div className="relative z-10 space-y-3">
            {fSubs.map((s) => {
              if (editingSubId === s.id && subDraft) {
                return (
                  <div key={s.id} className="flex flex-wrap items-end gap-2 rounded-xl border border-accent-purple/40 p-2">
                    <Field label="Owner"><OwnerSelect value={subDraft.ownerId} onChange={(v) => setSubDraft({ ...subDraft, ownerId: v })} /></Field>
                    <Field label="Provider"><input value={subDraft.provider} onChange={(e) => setSubDraft({ ...subDraft, provider: e.target.value })} className={inputCls} /></Field>
                    <Field label="Amount"><input type="number" value={subDraft.amount} onChange={(e) => setSubDraft({ ...subDraft, amount: Number(e.target.value) })} className={smallInputCls} /></Field>
                    <Field label="Currency">
                      <select value={subDraft.currency} onChange={(e) => setSubDraft({ ...subDraft, currency: e.target.value as Currency })} className={selectCls}>
                        <option>AED</option><option>LKR</option><option>USD</option>
                      </select>
                    </Field>
                    <Field label="Cadence">
                      <select value={subDraft.cadence} onChange={(e) => setSubDraft({ ...subDraft, cadence: e.target.value as Sub["cadence"] })} className={selectCls}>
                        <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                      </select>
                    </Field>
                    {subDraft.cadence === "monthly" ? (
                      <Field label="Billing day"><input type="number" min={1} max={31} value={subDraft.billingDay} onChange={(e) => setSubDraft({ ...subDraft, billingDay: Number(e.target.value) })} className={smallInputCls} /></Field>
                    ) : (
                      <Field label="Next date"><input type="date" value={subDraft.nextDate} onChange={(e) => setSubDraft({ ...subDraft, nextDate: e.target.value })} className={selectCls} /></Field>
                    )}
                    <Field label="Tax %"><input type="number" value={subDraft.taxPct} onChange={(e) => setSubDraft({ ...subDraft, taxPct: Number(e.target.value) })} className="w-16 rounded-xl border border-base-border bg-base-card px-2 py-1.5 text-sm text-gray-100 outline-none" /></Field>
                    <Field label="Tenure (mo, 0=none)"><input type="number" value={subDraft.tenureMonths} onChange={(e) => setSubDraft({ ...subDraft, tenureMonths: Number(e.target.value) })} className="w-20 rounded-xl border border-base-border bg-base-card px-2 py-1.5 text-sm text-gray-100 outline-none" /></Field>
                    <Field label="Notes"><input placeholder="e.g. extra interest-on-minimum" value={subDraft.notes} onChange={(e) => setSubDraft({ ...subDraft, notes: e.target.value })} className={inputCls} /></Field>
                    <Field label="Temp override amount (blank = none)">
                      <input type="number" placeholder="e.g. Tabby spike" value={subDraft.elevatedAmount ?? ""} onChange={(e) => setSubDraft({ ...subDraft, elevatedAmount: e.target.value === "" ? null : Number(e.target.value) })} className={smallInputCls} />
                    </Field>
                    <Field label="Override effective until">
                      <input type="date" value={subDraft.effectiveUntil} onChange={(e) => setSubDraft({ ...subDraft, effectiveUntil: e.target.value })} className={selectCls} />
                    </Field>
                    <button type="button" onClick={saveSub} className="text-accent-green hover:text-white"><Check size={16} /></button>
                    <button type="button" onClick={() => setEditingSubId(null)} className={iconBtnCls}><X size={16} /></button>
                  </div>
                );
              }
              const days = daysUntil(subNextDate(s));
              const overrideActive = s.elevatedAmount != null && s.effectiveUntil && s.effectiveUntil >= todayIso();
              return (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="flex items-center gap-1.5 text-gray-200">
                      {s.provider}
                      {overrideActive && (
                        <span className="rounded-full bg-accent-orange/20 px-2 py-0.5 text-[10px] text-accent-orange" title={`Temporary override until ${s.effectiveUntil}`}>
                          elevated until {s.effectiveUntil}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.cadence} · {ownerName(s.ownerId)} · {formatMoney(monthlySubCost(s), s.currency)}/mo equiv.
                      {s.tenureMonths > 0 ? ` · ${s.tenureMonths}mo contract` : ""}
                    </p>
                    {s.notes && <p className="mt-0.5 text-xs italic text-gray-500">{s.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-gray-200">{formatMoney(activeSubAmount(s) * (1 + s.taxPct / 100), s.currency)}</p>
                      <p className="text-xs text-gray-500">{formatDaysUntil(days)}</p>
                    </div>
                    <button type="button" onClick={() => startEditSub(s)} className={iconBtnCls}><Pencil size={13} /></button>
                    <button type="button" onClick={() => removeSub(s.id)} className={iconBtnCls}><X size={14} /></button>
                  </div>
                </div>
              );
            })}
            {fSubs.length === 0 && <p className="text-xs text-gray-500">No subscriptions for this filter.</p>}
          </div>
          <div className="relative z-10 mt-4 flex flex-wrap gap-2 border-t border-base-border pt-4">
            <OwnerSelect value={newSub.ownerId} onChange={(v) => setNewSub((s) => ({ ...s, ownerId: v }))} />
            <input placeholder="Provider" value={newSub.provider} onChange={(e) => setNewSub((s) => ({ ...s, provider: e.target.value }))} className={inputCls} />
            <input placeholder="Amount" type="number" value={newSub.amount} onChange={(e) => setNewSub((s) => ({ ...s, amount: e.target.value }))} className="w-20 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <select value={newSub.currency} onChange={(e) => setNewSub((s) => ({ ...s, currency: e.target.value as Currency }))} className={selectCls}>
              <option>AED</option><option>LKR</option><option>USD</option>
            </select>
            <select value={newSub.cadence} onChange={(e) => setNewSub((s) => ({ ...s, cadence: e.target.value as Sub["cadence"] }))} className={selectCls}>
              <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
            </select>
            {newSub.cadence === "monthly" ? (
              <input placeholder="Billing day" type="number" min={1} max={31} value={newSub.billingDay} onChange={(e) => setNewSub((s) => ({ ...s, billingDay: e.target.value }))} className="w-20 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            ) : (
              <input type="date" value={newSub.nextDate} onChange={(e) => setNewSub((s) => ({ ...s, nextDate: e.target.value }))} className="rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            )}
            <input placeholder="Tax %" type="number" value={newSub.taxPct} onChange={(e) => setNewSub((s) => ({ ...s, taxPct: e.target.value }))} className="w-16 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <input placeholder="Tenure mo (0=none)" type="number" value={newSub.tenureMonths} onChange={(e) => setNewSub((s) => ({ ...s, tenureMonths: e.target.value }))} className="w-24 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <button type="button" onClick={addSub} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add
            </button>
          </div>
        </section>

        {/* Income (Item 1) — feeds the Spending Plan banner above */}
        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-1 font-medium text-white">Income</h2>
          <p className="relative z-10 mb-3 text-xs text-gray-500">
            Mark a source &ldquo;recurring&rdquo; to have it count toward the Spending Plan above — one-off income (bonuses, gifts) can stay unmarked.
          </p>
          <div className="relative z-10 space-y-3">
            {fIncome.map((i) => {
              if (editingIncomeId === i.id && incomeDraft) {
                return (
                  <div key={i.id} className="flex flex-wrap items-end gap-2 rounded-xl border border-accent-purple/40 p-2">
                    <Field label="Owner"><OwnerSelect value={incomeDraft.ownerId} onChange={(v) => setIncomeDraft({ ...incomeDraft, ownerId: v })} /></Field>
                    <Field label="Source"><input value={incomeDraft.source} onChange={(e) => setIncomeDraft({ ...incomeDraft, source: e.target.value })} className={inputCls} /></Field>
                    <Field label="Type"><input value={incomeDraft.incomeType} onChange={(e) => setIncomeDraft({ ...incomeDraft, incomeType: e.target.value })} className={smallInputCls} /></Field>
                    <Field label="Amount"><input type="number" value={incomeDraft.amount} onChange={(e) => setIncomeDraft({ ...incomeDraft, amount: Number(e.target.value) })} className={smallInputCls} /></Field>
                    <Field label="Currency">
                      <select value={incomeDraft.currency} onChange={(e) => setIncomeDraft({ ...incomeDraft, currency: e.target.value as Currency })} className={selectCls}>
                        <option>AED</option><option>LKR</option><option>USD</option>
                      </select>
                    </Field>
                    <Field label="Recurring?">
                      <select value={incomeDraft.isRecurring ? "yes" : "no"} onChange={(e) => setIncomeDraft({ ...incomeDraft, isRecurring: e.target.value === "yes" })} className={selectCls}>
                        <option value="yes">Recurring</option><option value="no">One-off</option>
                      </select>
                    </Field>
                    {incomeDraft.isRecurring && (
                      <Field label="Cadence">
                        <select value={incomeDraft.cadence} onChange={(e) => setIncomeDraft({ ...incomeDraft, cadence: e.target.value as Income["cadence"] })} className={selectCls}>
                          <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                        </select>
                      </Field>
                    )}
                    <Field label="Received"><input type="date" value={incomeDraft.receivedDate} onChange={(e) => setIncomeDraft({ ...incomeDraft, receivedDate: e.target.value })} className={selectCls} /></Field>
                    <Field label="Notes"><input value={incomeDraft.notes} onChange={(e) => setIncomeDraft({ ...incomeDraft, notes: e.target.value })} className={inputCls} /></Field>
                    <button type="button" onClick={saveIncome} className="text-accent-green hover:text-white"><Check size={16} /></button>
                    <button type="button" onClick={() => setEditingIncomeId(null)} className={iconBtnCls}><X size={16} /></button>
                  </div>
                );
              }
              return (
                <div key={i.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="flex items-center gap-1.5 text-gray-200">
                      {i.source}
                      {i.isRecurring && <span className="rounded-full bg-accent-green/20 px-2 py-0.5 text-[10px] text-accent-green">recurring · {i.cadence}</span>}
                    </p>
                    <p className="text-xs text-gray-500">{i.incomeType} · {ownerName(i.ownerId)} · received {i.receivedDate}</p>
                    {i.notes && <p className="mt-0.5 text-xs italic text-gray-500">{i.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <BlurAmount id={`income-${i.id}`} text={formatMoney(i.amount, i.currency)} />
                    <button type="button" onClick={() => startEditIncome(i)} className={iconBtnCls}><Pencil size={13} /></button>
                    <button type="button" onClick={() => removeIncome(i.id)} className={iconBtnCls}><X size={14} /></button>
                  </div>
                </div>
              );
            })}
            {fIncome.length === 0 && <p className="text-xs text-gray-500">No income sources for this filter.</p>}
          </div>
          <div className="relative z-10 mt-4 flex flex-wrap gap-2 border-t border-base-border pt-4">
            <OwnerSelect value={newIncome.ownerId} onChange={(v) => setNewIncome((s) => ({ ...s, ownerId: v }))} />
            <input placeholder="Source (e.g. Salary)" value={newIncome.source} onChange={(e) => setNewIncome((s) => ({ ...s, source: e.target.value }))} className={inputCls} />
            <input placeholder="Type" value={newIncome.incomeType} onChange={(e) => setNewIncome((s) => ({ ...s, incomeType: e.target.value }))} className="w-24 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <input placeholder="Amount" type="number" value={newIncome.amount} onChange={(e) => setNewIncome((s) => ({ ...s, amount: e.target.value }))} className="w-24 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <select value={newIncome.currency} onChange={(e) => setNewIncome((s) => ({ ...s, currency: e.target.value as Currency }))} className={selectCls}>
              <option>AED</option><option>LKR</option><option>USD</option>
            </select>
            <select value={newIncome.isRecurring ? "yes" : "no"} onChange={(e) => setNewIncome((s) => ({ ...s, isRecurring: e.target.value === "yes" }))} className={selectCls}>
              <option value="yes">Recurring</option><option value="no">One-off</option>
            </select>
            {newIncome.isRecurring && (
              <select value={newIncome.cadence} onChange={(e) => setNewIncome((s) => ({ ...s, cadence: e.target.value as Income["cadence"] }))} className={selectCls}>
                <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
              </select>
            )}
            <input type="date" value={newIncome.receivedDate} onChange={(e) => setNewIncome((s) => ({ ...s, receivedDate: e.target.value }))} className="rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <button type="button" onClick={addIncome} className="flex items-center gap-1 rounded-xl bg-accent-green px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add income
            </button>
          </div>
        </section>

        {/* Unified Add Expense (Item 2 + Item 3) — monthly recurring / fixed-term / one-off, all in one place, with min-max estimate entry */}
        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-1 flex items-center gap-2 font-medium text-white"><Wallet size={16} className="text-accent-purple" /> Expenses</h2>
          <p className="relative z-10 mb-3 text-xs text-gray-500">
            One place for anything that doesn&rsquo;t fit Loans/Subscriptions/Schemes above — one-off costs (car registration renewal), short fixed-term costs, or any monthly recurring line.
          </p>
          <div className="relative z-10 space-y-3">
            {fExpenses.map((e) => {
              const typeBadgeCls =
                e.expenseType === "monthly"
                  ? "bg-accent-blue/20 text-accent-blue"
                  : e.expenseType === "fixed_term"
                  ? "bg-accent-orange/20 text-accent-orange"
                  : "bg-accent-pink/20 text-accent-pink";
              if (editingExpenseId === e.id && expenseDraft) {
                return (
                  <div key={e.id} className="flex flex-wrap items-end gap-2 rounded-xl border border-accent-purple/40 p-2">
                    <Field label="Owner"><OwnerSelect value={expenseDraft.ownerId} onChange={(v) => setExpenseDraft({ ...expenseDraft, ownerId: v })} /></Field>
                    <Field label="Label"><input value={expenseDraft.label} onChange={(ev) => setExpenseDraft({ ...expenseDraft, label: ev.target.value })} className={inputCls} /></Field>
                    <Field label="Category"><input value={expenseDraft.category} onChange={(ev) => setExpenseDraft({ ...expenseDraft, category: ev.target.value })} className="w-28 rounded-xl border border-base-border bg-base-card px-2 py-1.5 text-sm text-gray-100 outline-none" /></Field>
                    <Field label="Type">
                      <select value={expenseDraft.expenseType} onChange={(ev) => setExpenseDraft({ ...expenseDraft, expenseType: ev.target.value as ExpenseType })} className={selectCls}>
                        <option value="monthly">Monthly recurring</option><option value="fixed_term">Fixed-term</option><option value="one_off">One-off</option>
                      </select>
                    </Field>
                    <Field label="Amount"><input type="number" value={expenseDraft.amount} onChange={(ev) => setExpenseDraft({ ...expenseDraft, amount: Number(ev.target.value) })} className={smallInputCls} /></Field>
                    <Field label="Currency">
                      <select value={expenseDraft.currency} onChange={(ev) => setExpenseDraft({ ...expenseDraft, currency: ev.target.value as Currency })} className={selectCls}>
                        <option>AED</option><option>LKR</option><option>USD</option>
                      </select>
                    </Field>
                    {expenseDraft.expenseType === "monthly" && (
                      <Field label="Billing day"><input type="number" min={1} max={31} value={expenseDraft.billingDay} onChange={(ev) => setExpenseDraft({ ...expenseDraft, billingDay: Number(ev.target.value) })} className={smallInputCls} /></Field>
                    )}
                    {expenseDraft.expenseType === "fixed_term" && (
                      <>
                        <Field label="Start"><input type="date" value={expenseDraft.startDate} onChange={(ev) => setExpenseDraft({ ...expenseDraft, startDate: ev.target.value })} className={selectCls} /></Field>
                        <Field label="End"><input type="date" value={expenseDraft.endDate} onChange={(ev) => setExpenseDraft({ ...expenseDraft, endDate: ev.target.value })} className={selectCls} /></Field>
                      </>
                    )}
                    {expenseDraft.expenseType === "one_off" && (
                      <>
                        <Field label="Due date"><input type="date" value={expenseDraft.dueDate} onChange={(ev) => setExpenseDraft({ ...expenseDraft, dueDate: ev.target.value })} className={selectCls} /></Field>
                        <Field label="Paid?">
                          <select value={expenseDraft.paid ? "yes" : "no"} onChange={(ev) => setExpenseDraft({ ...expenseDraft, paid: ev.target.value === "yes" })} className={selectCls}>
                            <option value="no">Unpaid</option><option value="yes">Paid</option>
                          </select>
                        </Field>
                      </>
                    )}
                    <Field label="Notes"><input value={expenseDraft.notes} onChange={(ev) => setExpenseDraft({ ...expenseDraft, notes: ev.target.value })} className={inputCls} /></Field>
                    <button type="button" onClick={saveExpense} className="text-accent-green hover:text-white"><Check size={16} /></button>
                    <button type="button" onClick={() => setEditingExpenseId(null)} className={iconBtnCls}><X size={16} /></button>
                  </div>
                );
              }
              return (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="flex items-center gap-1.5 text-gray-200">
                      {e.label}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${typeBadgeCls}`}>
                        {e.expenseType === "monthly" ? "monthly" : e.expenseType === "fixed_term" ? "fixed-term" : "one-off"}
                      </span>
                      {e.isEstimated && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-400">estimated</span>}
                      {e.paid && <span className="rounded-full bg-accent-green/20 px-2 py-0.5 text-[10px] text-accent-green">paid</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {e.category || "Uncategorized"} · {ownerName(e.ownerId)}
                      {e.expenseType === "fixed_term" && e.startDate ? ` · ${e.startDate} → ${e.endDate || "?"}` : ""}
                      {e.expenseType === "one_off" && e.dueDate ? ` · due ${e.dueDate}` : ""}
                      {e.isEstimated && e.minAmount != null && e.maxAmount != null ? ` · range ${e.minAmount}-${e.maxAmount}` : ""}
                    </p>
                    {e.notes && <p className="mt-0.5 text-xs italic text-gray-500">{e.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-gray-200">{formatMoney(e.amount, e.currency)}</p>
                    {e.expenseType === "one_off" && (
                      <button type="button" onClick={() => toggleExpensePaid(e.id)} className={iconBtnCls} title={e.paid ? "Mark unpaid" : "Mark paid"}>
                        <Check size={13} className={e.paid ? "text-accent-green" : ""} />
                      </button>
                    )}
                    <button type="button" onClick={() => startEditExpense(e)} className={iconBtnCls}><Pencil size={13} /></button>
                    <button type="button" onClick={() => removeExpense(e.id)} className={iconBtnCls}><X size={14} /></button>
                  </div>
                </div>
              );
            })}
            {fExpenses.length === 0 && <p className="text-xs text-gray-500">No expenses for this filter yet.</p>}
          </div>
          <div className="relative z-10 mt-4 space-y-2 border-t border-base-border pt-4">
            <div className="flex flex-wrap gap-2">
              <OwnerSelect value={newExpense.ownerId} onChange={(v) => setNewExpense((s) => ({ ...s, ownerId: v }))} />
              <input placeholder="Label (e.g. Car registration renewal)" value={newExpense.label} onChange={(e) => setNewExpense((s) => ({ ...s, label: e.target.value }))} className={inputCls} />
              <input placeholder="Category" value={newExpense.category} onChange={(e) => setNewExpense((s) => ({ ...s, category: e.target.value }))} className="w-28 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
              <select value={newExpense.expenseType} onChange={(e) => setNewExpense((s) => ({ ...s, expenseType: e.target.value as ExpenseType }))} className={selectCls}>
                <option value="monthly">Monthly recurring</option><option value="fixed_term">Fixed-term</option><option value="one_off">One-off</option>
              </select>
              <select value={newExpense.currency} onChange={(e) => setNewExpense((s) => ({ ...s, currency: e.target.value as Currency }))} className={selectCls}>
                <option>AED</option><option>LKR</option><option>USD</option>
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-400">
                <input type="checkbox" checked={newExpense.useRange} onChange={(e) => setNewExpense((s) => ({ ...s, useRange: e.target.checked }))} />
                I don&rsquo;t have an exact number
              </label>
              {newExpense.useRange ? (
                <>
                  <Field label="Min"><input type="number" value={newExpense.minAmount} onChange={(e) => setNewExpense((s) => ({ ...s, minAmount: e.target.value }))} className={smallInputCls} /></Field>
                  <Field label="Max"><input type="number" value={newExpense.maxAmount} onChange={(e) => setNewExpense((s) => ({ ...s, maxAmount: e.target.value }))} className={smallInputCls} /></Field>
                  <p className="pb-1.5 text-xs text-gray-500">→ estimated {formatMoney(newExpenseEstimate, newExpense.currency)} (midpoint, rounded to nearest 5)</p>
                </>
              ) : (
                <Field label="Amount"><input type="number" value={newExpense.amount} onChange={(e) => setNewExpense((s) => ({ ...s, amount: e.target.value }))} className={smallInputCls} /></Field>
              )}
              {newExpense.expenseType === "monthly" && (
                <Field label="Billing day"><input type="number" min={1} max={31} value={newExpense.billingDay} onChange={(e) => setNewExpense((s) => ({ ...s, billingDay: e.target.value }))} className={smallInputCls} /></Field>
              )}
              {newExpense.expenseType === "fixed_term" && (
                <>
                  <Field label="Start"><input type="date" value={newExpense.startDate} onChange={(e) => setNewExpense((s) => ({ ...s, startDate: e.target.value }))} className={selectCls} /></Field>
                  <Field label="End"><input type="date" value={newExpense.endDate} onChange={(e) => setNewExpense((s) => ({ ...s, endDate: e.target.value }))} className={selectCls} /></Field>
                </>
              )}
              {newExpense.expenseType === "one_off" && (
                <Field label="Due date"><input type="date" value={newExpense.dueDate} onChange={(e) => setNewExpense((s) => ({ ...s, dueDate: e.target.value }))} className={selectCls} /></Field>
              )}
              <Field label="Notes"><input value={newExpense.notes} onChange={(e) => setNewExpense((s) => ({ ...s, notes: e.target.value }))} className={inputCls} /></Field>
              <button type="button" onClick={addExpense} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
                <Plus size={14} /> Add expense
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
