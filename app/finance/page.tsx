"use client";

import { useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useLocalStorage } from "@/lib/useLocalStorage";
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
} from "@/lib/financeUtils";
import { Plus, X, Eye, EyeOff, CreditCard, ChevronDown } from "lucide-react";

type Currency = "AED" | "LKR" | "USD";
type Account = { id: string; ownerId: string; name: string; type: "bank" | "bnpl"; currency: Currency; balance: number; sensitive: boolean };
type CardAcct = {
  id: string; ownerId: string; name: string; network: "visa" | "mastercard" | "other";
  last4: string; currency: Currency; creditLimit: number; limitUsed: number;
  interestRate: number; tenureMonths: number; outstanding: number;
};
type CardSpend = { id: string; cardId: string; label: string; amount: number; date: string };
type Loan = {
  id: string; ownerId: string; name: string; lenderType: "bank" | "person" | "institution";
  currency: Currency; principal: number; interestRate: number; tenureMonths: number; startDate: string;
};
type Sub = {
  id: string; ownerId: string; provider: string; currency: Currency; amount: number;
  cadence: "monthly" | "yearly"; billingDay: number; nextDate: string; taxPct: number;
};

const SHARED = { id: "shared", name: "Shared", initial: "H" };

const DEFAULT_ACCOUNTS: Account[] = [
  { id: "a1", ownerId: "shared", name: "Joint savings", type: "bank", currency: "AED", balance: 18420, sensitive: false },
  { id: "a2", ownerId: "shenaal", name: "Shenaal salary account", type: "bank", currency: "LKR", balance: 340000, sensitive: true },
  { id: "a3", ownerId: "shalini", name: "Shalini USD savings", type: "bank", currency: "USD", balance: 5200, sensitive: true },
];
const DEFAULT_CARDS: CardAcct[] = [
  { id: "c1", ownerId: "shenaal", name: "Emirates NBD", network: "visa", last4: "4471", currency: "AED", creditLimit: 15000, limitUsed: 4200, interestRate: 3.2, tenureMonths: 0, outstanding: 4200 },
];
const DEFAULT_LOANS: Loan[] = [
  { id: "l1", ownerId: "shared", name: "Car loan", lenderType: "bank", currency: "AED", principal: 42000, interestRate: 4.5, tenureMonths: 36, startDate: "2025-07-01" },
  { id: "l2", ownerId: "shenaal", name: "Home renovation", lenderType: "person", currency: "LKR", principal: 1200000, interestRate: 0, tenureMonths: 24, startDate: "2025-11-01" },
];
const DEFAULT_SUBS: Sub[] = [
  { id: "s1", ownerId: "shared", provider: "Netflix", currency: "AED", amount: 39, cadence: "monthly", billingDay: 18, nextDate: "", taxPct: 5 },
  { id: "s2", ownerId: "shalini", provider: "iCloud storage", currency: "USD", amount: 3, cadence: "monthly", billingDay: 24, nextDate: "", taxPct: 0 },
  { id: "s3", ownerId: "shenaal", provider: "Amazon Prime (annual)", currency: "AED", amount: 179, cadence: "yearly", billingDay: 1, nextDate: nextYearIso(3), taxPct: 5 },
];

function nextYearIso(monthsOut: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsOut);
  return d.toISOString().slice(0, 10);
}

function monthlySubCost(s: Sub): number {
  const withTax = s.amount * (1 + s.taxPct / 100);
  return s.cadence === "monthly" ? withTax : withTax / 12;
}
function subNextDate(s: Sub): Date {
  return s.cadence === "monthly" ? nextMonthlyDate(s.billingDay) : new Date(s.nextDate || Date.now());
}
function loanNextDueDate(l: Loan): Date {
  const day = l.startDate ? new Date(l.startDate).getDate() : 1;
  return nextMonthlyDate(day);
}

export default function FinancePage() {
  const { members } = useHousehold();
  const owners = useMemo(() => [...members, SHARED], [members]);
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.name ?? id;

  // .v2 keys: the pre-rebuild Finance page persisted "finance.accounts" /
  // "finance.loans" / "finance.subs" under these exact names with a
  // different, incompatible shape (e.g. loans had no principal/rate/tenure).
  // Reusing the old keys would hydrate the new EMI math with undefined
  // fields and silently render "NaN" — bumping the key avoids that
  // collision. Old data is simply orphaned, not migrated (it was placeholder
  // data anyway).
  const [accounts, setAccounts] = useLocalStorage<Account[]>("finance.accounts.v2", DEFAULT_ACCOUNTS);
  const [cards, setCards] = useLocalStorage<CardAcct[]>("finance.cards.v2", DEFAULT_CARDS);
  const [cardSpends, setCardSpends] = useLocalStorage<CardSpend[]>("finance.cardSpends.v2", []);
  const [loans, setLoans] = useLocalStorage<Loan[]>("finance.loans.v2", DEFAULT_LOANS);
  const [subs, setSubs] = useLocalStorage<Sub[]>("finance.subs.v2", DEFAULT_SUBS);
  const [budget, setBudget] = useLocalStorage<number>("finance.monthlyBudget", 0);

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

  // Monthly committed outflow = loan EMIs + card EMIs (if on a plan) + subscription monthly-equivalent cost.
  const monthlyOutflow =
    fLoans.reduce((sum, l) => sum + calcEMI(l.principal, l.interestRate, l.tenureMonths), 0) +
    fCards.reduce((sum, c) => sum + (c.tenureMonths > 0 ? calcEMI(c.outstanding, c.interestRate, c.tenureMonths) : 0), 0) +
    fSubs.reduce((sum, s) => sum + monthlySubCost(s), 0);
  const status = budgetStatus(monthlyOutflow, budget);
  const statusCls = BUDGET_STATUS_CLASSES[status];

  // Upcoming payments (subs + loans) within 14 days, soonest first.
  const upcoming = [
    ...fSubs.map((s) => ({ label: s.provider, currency: s.currency, amount: s.amount, date: subNextDate(s) })),
    ...fLoans.map((l) => ({
      label: l.name,
      currency: l.currency,
      amount: calcEMI(l.principal, l.interestRate, l.tenureMonths),
      date: loanNextDueDate(l),
    })),
  ]
    .map((p) => ({ ...p, days: daysUntil(p.date) }))
    .filter((p) => p.days <= 14)
    .sort((a, b) => a.days - b.days);

  // Next major non-monthly (yearly) payment landing 2–4 months out.
  const nextMajor = fSubs
    .filter((s) => s.cadence === "yearly")
    .map((s) => ({ s, days: daysUntil(subNextDate(s)) }))
    .filter((x) => x.days >= 55 && x.days <= 125)
    .sort((a, b) => a.days - b.days)[0];

  // --- add-item form state ---
  const [newAccount, setNewAccount] = useState({ ownerId: "shared", name: "", type: "bank" as "bank" | "bnpl", currency: "AED" as Currency, balance: "", sensitive: false });
  const addAccount = () => {
    if (!newAccount.name.trim() || !newAccount.balance) return;
    setAccounts((prev) => [...prev, { id: uid(), ownerId: newAccount.ownerId, name: newAccount.name.trim(), type: newAccount.type, currency: newAccount.currency, balance: Number(newAccount.balance), sensitive: newAccount.sensitive }]);
    setNewAccount({ ownerId: "shared", name: "", type: "bank", currency: "AED", balance: "", sensitive: false });
  };
  const removeAccount = (id: string) => setAccounts((prev) => prev.filter((a) => a.id !== id));

  const [newCard, setNewCard] = useState({ ownerId: "shared", name: "", network: "visa" as CardAcct["network"], last4: "", currency: "AED" as Currency, creditLimit: "", limitUsed: "", interestRate: "", tenureMonths: "", outstanding: "" });
  const addCard = () => {
    if (!newCard.name.trim() || newCard.last4.length !== 4) return;
    setCards((prev) => [...prev, {
      id: uid(), ownerId: newCard.ownerId, name: newCard.name.trim(), network: newCard.network, last4: newCard.last4,
      currency: newCard.currency, creditLimit: Number(newCard.creditLimit) || 0, limitUsed: Number(newCard.limitUsed) || 0,
      interestRate: Number(newCard.interestRate) || 0, tenureMonths: Number(newCard.tenureMonths) || 0, outstanding: Number(newCard.outstanding) || 0,
    }]);
    setNewCard({ ownerId: "shared", name: "", network: "visa", last4: "", currency: "AED", creditLimit: "", limitUsed: "", interestRate: "", tenureMonths: "", outstanding: "" });
  };
  const removeCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setCardSpends((prev) => prev.filter((s) => s.cardId !== id));
  };
  const [spendDraft, setSpendDraft] = useState<Record<string, { label: string; amount: string }>>({});
  const addSpend = (cardId: string) => {
    const d = spendDraft[cardId];
    if (!d?.label?.trim() || !d?.amount) return;
    setCardSpends((prev) => [...prev, { id: uid(), cardId, label: d.label.trim(), amount: Number(d.amount), date: new Date().toISOString().slice(0, 10) }]);
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, limitUsed: c.limitUsed + Number(d.amount), outstanding: c.outstanding + Number(d.amount) } : c)));
    setSpendDraft((prev) => ({ ...prev, [cardId]: { label: "", amount: "" } }));
  };
  const removeSpend = (spend: CardSpend) => {
    setCardSpends((prev) => prev.filter((s) => s.id !== spend.id));
    setCards((prev) => prev.map((c) => (c.id === spend.cardId ? { ...c, limitUsed: Math.max(0, c.limitUsed - spend.amount), outstanding: Math.max(0, c.outstanding - spend.amount) } : c)));
  };

  const [newLoan, setNewLoan] = useState({ ownerId: "shared", name: "", lenderType: "bank" as Loan["lenderType"], currency: "AED" as Currency, principal: "", interestRate: "", tenureMonths: "", startDate: new Date().toISOString().slice(0, 10) });
  const addLoan = () => {
    if (!newLoan.name.trim() || !newLoan.principal || !newLoan.tenureMonths) return;
    setLoans((prev) => [...prev, { id: uid(), ownerId: newLoan.ownerId, name: newLoan.name.trim(), lenderType: newLoan.lenderType, currency: newLoan.currency, principal: Number(newLoan.principal), interestRate: Number(newLoan.interestRate) || 0, tenureMonths: Number(newLoan.tenureMonths), startDate: newLoan.startDate }]);
    setNewLoan({ ownerId: "shared", name: "", lenderType: "bank", currency: "AED", principal: "", interestRate: "", tenureMonths: "", startDate: new Date().toISOString().slice(0, 10) });
  };
  const removeLoan = (id: string) => setLoans((prev) => prev.filter((l) => l.id !== id));

  const [newSub, setNewSub] = useState({ ownerId: "shared", provider: "", currency: "AED" as Currency, amount: "", cadence: "monthly" as Sub["cadence"], billingDay: "1", nextDate: new Date().toISOString().slice(0, 10), taxPct: "0" });
  const addSub = () => {
    if (!newSub.provider.trim() || !newSub.amount) return;
    setSubs((prev) => [...prev, { id: uid(), ownerId: newSub.ownerId, provider: newSub.provider.trim(), currency: newSub.currency, amount: Number(newSub.amount), cadence: newSub.cadence, billingDay: Number(newSub.billingDay) || 1, nextDate: newSub.nextDate, taxPct: Number(newSub.taxPct) || 0 }]);
    setNewSub({ ownerId: "shared", provider: "", currency: "AED", amount: "", cadence: "monthly", billingDay: "1", nextDate: new Date().toISOString().slice(0, 10), taxPct: "0" });
  };
  const removeSub = (id: string) => setSubs((prev) => prev.filter((s) => s.id !== id));

  const inputCls = "min-w-0 flex-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple";
  const selectCls = "rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none";

  const OwnerSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      {owners.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );

  const BlurAmount = ({ id, text }: { id: string; text: string }) => {
    const shown = revealed.has(id);
    return (
      <button type="button" onClick={() => toggleReveal(id)} className="inline-flex items-center gap-1.5 font-medium text-white">
        <span className={shown ? "" : "select-none blur-sm"}>{text}</span>
        {shown ? <EyeOff size={12} className="text-gray-500" /> : <Eye size={12} className="text-gray-500" />}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Finance</h1>
            <p className="mt-1 text-sm text-gray-400">
              LKR · AED · USD side by side. Saved on this device for now — will move to Supabase once
              the finance tables are wired up.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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

        {/* Budget status */}
        <section className="glass-card rounded-xl2 p-5">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${statusCls.bg}`} />
              <div>
                <p className="text-sm text-gray-200">
                  This month&rsquo;s committed outflow: <span className={`font-semibold ${statusCls.text}`}>{Math.round(monthlyOutflow).toLocaleString()}</span> (loan EMIs + card plans + subscriptions, mixed currencies summed at face value)
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
                  <p className="text-gray-200">{nextMajor.s.provider}</p>
                  <p className="mt-1 text-lg font-semibold text-white">{formatMoney(nextMajor.s.amount * (1 + nextMajor.s.taxPct / 100), nextMajor.s.currency)}</p>
                  <p className="text-xs text-gray-500">{formatDaysUntil(nextMajor.days)} · {ownerName(nextMajor.s.ownerId)}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">No yearly/non-monthly bills landing 2–4 months out.</p>
              )}
            </div>
          </section>
        </div>

        {/* Accounts */}
        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-4 font-medium text-white">Bank &amp; BNPL accounts</h2>
          <div className="relative z-10 space-y-3">
            {fAccounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-gray-200">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.type === "bnpl" ? "BNPL" : "Bank"} · {ownerName(a.ownerId)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {a.sensitive ? (
                    <BlurAmount id={a.id} text={formatMoney(a.balance, a.currency)} />
                  ) : (
                    <p className="font-medium text-white">{formatMoney(a.balance, a.currency)}</p>
                  )}
                  <button type="button" onClick={() => removeAccount(a.id)} className="text-gray-500 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
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
            <input placeholder="Balance" type="number" value={newAccount.balance} onChange={(e) => setNewAccount((s) => ({ ...s, balance: e.target.value }))} className="w-28 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple" />
            <label className="flex items-center gap-1.5 text-xs text-gray-400">
              <input type="checkbox" checked={newAccount.sensitive} onChange={(e) => setNewAccount((s) => ({ ...s, sensitive: e.target.checked }))} />
              Blur (salary)
            </label>
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
              const draft = spendDraft[c.id] ?? { label: "", amount: "" };
              return (
                <details key={c.id} className="glossy-gradient group rounded-xl2 bg-gradient-to-br from-accent-purple to-accent-blue p-4">
                  <summary className="relative z-10 flex cursor-pointer list-none items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} />
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs opacity-80">{c.network.toUpperCase()} •••• {c.last4} · {ownerName(c.ownerId)}</p>
                      </div>
                    </div>
                    <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="relative z-10 mt-3 space-y-2 rounded-xl bg-black/20 p-3 text-xs text-white">
                    <div className="h-1.5 w-full rounded-full bg-white/20">
                      <div className="h-1.5 rounded-full bg-white" style={{ width: `${usedPct}%` }} />
                    </div>
                    <p>{formatMoney(c.limitUsed, c.currency)} used of {formatMoney(c.creditLimit, c.currency)} ({Math.round(usedPct)}%)</p>
                    <p>Outstanding: {formatMoney(c.outstanding, c.currency)} · {c.interestRate}% APR</p>
                    {c.tenureMonths > 0 && <p>EMI plan: {formatMoney(emi, c.currency)}/mo × {c.tenureMonths}mo</p>}
                    <div className="border-t border-white/10 pt-2">
                      <p className="mb-1 font-medium">Logged spend</p>
                      {spends.length === 0 && <p className="opacity-70">None logged yet.</p>}
                      {spends.map((s) => (
                        <div key={s.id} className="flex items-center justify-between py-0.5">
                          <span>{s.label}</span>
                          <span className="flex items-center gap-1.5">
                            {formatMoney(s.amount, c.currency)}
                            <button type="button" onClick={() => removeSpend(s)} className="opacity-60 hover:opacity-100"><X size={10} /></button>
                          </span>
                        </div>
                      ))}
                      <div className="mt-2 flex gap-1.5">
                        <input placeholder="Label" value={draft.label} onChange={(e) => setSpendDraft((p) => ({ ...p, [c.id]: { ...draft, label: e.target.value } }))} className="min-w-0 flex-1 rounded-lg bg-white/10 px-2 py-1 text-white outline-none placeholder:text-white/50" />
                        <input placeholder="Amt" type="number" value={draft.amount} onChange={(e) => setSpendDraft((p) => ({ ...p, [c.id]: { ...draft, amount: e.target.value } }))} className="w-16 rounded-lg bg-white/10 px-2 py-1 text-white outline-none placeholder:text-white/50" />
                        <button type="button" onClick={() => addSpend(c.id)} className="rounded-lg bg-white/20 px-2 py-1">+</button>
                      </div>
                    </div>
                    <button type="button" onClick={() => removeCard(c.id)} className="text-white/70 hover:text-white">Remove card</button>
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
                      <button type="button" onClick={() => removeLoan(l.id)} className="text-gray-500 hover:text-white">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-base-card">
                    <div className="h-1.5 rounded-full bg-accent-blue" style={{ width: `${l.tenureMonths ? Math.min(100, (elapsed / l.tenureMonths) * 100) : 0}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatMoney(remaining, l.currency)} remaining · {formatMoney(emi, l.currency)}/mo EMI
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
            <button type="button" onClick={addLoan} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add
            </button>
          </div>
        </section>

        {/* Subscriptions */}
        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-4 font-medium text-white">Subscriptions</h2>
          <div className="relative z-10 space-y-3">
            {fSubs.map((s) => {
              const days = daysUntil(subNextDate(s));
              return (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-gray-200">{s.provider}</p>
                    <p className="text-xs text-gray-500">{s.cadence} · {ownerName(s.ownerId)} · {formatMoney(monthlySubCost(s), s.currency)}/mo equiv.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-gray-200">{formatMoney(s.amount * (1 + s.taxPct / 100), s.currency)}</p>
                      <p className="text-xs text-gray-500">{formatDaysUntil(days)}</p>
                    </div>
                    <button type="button" onClick={() => removeSub(s.id)} className="text-gray-500 hover:text-white">
                      <X size={14} />
                    </button>
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
            <button type="button" onClick={addSub} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
