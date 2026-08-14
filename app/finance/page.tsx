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
import { Plus, X, Eye, EyeOff, CreditCard, ChevronDown, Pencil, Check, GraduationCap } from "lucide-react";

type Currency = "AED" | "LKR" | "USD";
type Account = { id: string; ownerId: string; name: string; type: "bank" | "bnpl"; currency: Currency; balance: number };
type CardAcct = {
  id: string; ownerId: string; name: string; network: "visa" | "mastercard" | "other";
  last4: string; currency: Currency; creditLimit: number; limitUsed: number;
  interestRate: number; tenureMonths: number; outstanding: number;
};
type CardSpend = { id: string; cardId: string; label: string; amount: number; currency: Currency; date: string };
type Loan = {
  id: string; ownerId: string; name: string; lenderType: "bank" | "person" | "institution";
  currency: Currency; principal: number; interestRate: number; tenureMonths: number; startDate: string;
};
type Sub = {
  id: string; ownerId: string; provider: string; currency: Currency; amount: number;
  cadence: "monthly" | "yearly"; billingDay: number; nextDate: string; taxPct: number;
};
type SchemeCadence = "onetime" | "monthly" | "termly" | "yearly";
type SchemeItem = { id: string; label: string; amount: number; cadence: SchemeCadence; dueDate: string; billingDay: number; paid: boolean };
type Scheme = { id: string; ownerId: string; name: string; institution: string; currency: Currency; items: SchemeItem[] };

const SHARED = { id: "shared", name: "Shared", initial: "H" };

const DEFAULT_ACCOUNTS: Account[] = [
  { id: "a1", ownerId: "shared", name: "Joint savings", type: "bank", currency: "AED", balance: 18420 },
  { id: "a2", ownerId: "shenaal", name: "Shenaal salary account", type: "bank", currency: "LKR", balance: 340000 },
  { id: "a3", ownerId: "shalini", name: "Shalini USD savings", type: "bank", currency: "USD", balance: 5200 },
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
  { id: "s3", ownerId: "shenaal", provider: "Amazon Prime (annual)", currency: "AED", amount: 179, cadence: "yearly", billingDay: 1, nextDate: monthsFromNowIso(3), taxPct: 5 },
];
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

  // .v3: bumped again — Account dropped `sensitive` (blur is now a global
  // toggle, not per-account), CardSpend gained `currency`. Old .v2 data is
  // orphaned rather than migrated (still placeholder data).
  const [accounts, setAccounts] = useLocalStorage<Account[]>("finance.accounts.v3", DEFAULT_ACCOUNTS);
  const [cards, setCards] = useLocalStorage<CardAcct[]>("finance.cards.v3", DEFAULT_CARDS);
  const [cardSpends, setCardSpends] = useLocalStorage<CardSpend[]>("finance.cardSpends.v3", []);
  const [loans, setLoans] = useLocalStorage<Loan[]>("finance.loans.v2", DEFAULT_LOANS);
  const [subs, setSubs] = useLocalStorage<Sub[]>("finance.subs.v2", DEFAULT_SUBS);
  const [schemes, setSchemes] = useLocalStorage<Scheme[]>("finance.schemes.v1", DEFAULT_SCHEMES);
  const [budget, setBudget] = useLocalStorage<number>("finance.monthlyBudget", 0);
  const [hideBalances, setHideBalances] = useLocalStorage<boolean>("finance.hideBalances", true);

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

  const totalsByCurrency = fAccounts.reduce<Record<string, number>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] || 0) + a.balance;
    return acc;
  }, {});

  const schemeMonthlyContribution = fSchemes
    .flatMap((sc) => sc.items.map((it) => ({ it, sc })))
    .filter(({ it }) => schemeItemActive(it))
    .filter(({ it }) => it.cadence === "monthly" || daysUntil(schemeItemDate(it)) <= 30)
    .reduce((sum, { it }) => sum + it.amount, 0);

  // Monthly committed outflow = loan EMIs + card EMIs (if on a plan) + subscriptions + scheme items due/recurring this month.
  const monthlyOutflow =
    fLoans.reduce((sum, l) => sum + calcEMI(l.principal, l.interestRate, l.tenureMonths), 0) +
    fCards.reduce((sum, c) => sum + (c.tenureMonths > 0 ? calcEMI(c.outstanding, c.interestRate, c.tenureMonths) : 0), 0) +
    fSubs.reduce((sum, s) => sum + monthlySubCost(s), 0) +
    schemeMonthlyContribution;
  const status = budgetStatus(monthlyOutflow, budget);
  const statusCls = BUDGET_STATUS_CLASSES[status];

  // Upcoming payments (subs + loans + scheme items) within 14 days, soonest first.
  const upcoming = [
    ...fSubs.map((s) => ({ label: s.provider, currency: s.currency, amount: s.amount, date: subNextDate(s) })),
    ...fLoans.map((l) => ({ label: l.name, currency: l.currency, amount: calcEMI(l.principal, l.interestRate, l.tenureMonths), date: loanNextDueDate(l) })),
    ...fSchemes.flatMap((sc) =>
      sc.items.filter(schemeItemActive).map((it) => ({ label: `${sc.name} — ${it.label}`, currency: sc.currency, amount: it.amount, date: schemeItemDate(it) }))
    ),
  ]
    .map((p) => ({ ...p, days: daysUntil(p.date) }))
    .filter((p) => p.days <= 14)
    .sort((a, b) => a.days - b.days);

  // Next major non-monthly payment landing 2–4 months out (yearly subs + non-monthly scheme items).
  const majorCandidates = [
    ...fSubs.filter((s) => s.cadence === "yearly").map((s) => ({ label: s.provider, currency: s.currency, amount: s.amount * (1 + s.taxPct / 100), owner: ownerName(s.ownerId), date: subNextDate(s) })),
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
  const [newAccount, setNewAccount] = useState({ ownerId: "shared", name: "", type: "bank" as "bank" | "bnpl", currency: "AED" as Currency, balance: "" });
  const addAccount = () => {
    if (!newAccount.name.trim() || !newAccount.balance) return;
    setAccounts((prev) => [...prev, { id: uid(), ownerId: newAccount.ownerId, name: newAccount.name.trim(), type: newAccount.type, currency: newAccount.currency, balance: Number(newAccount.balance) }]);
    setNewAccount({ ownerId: "shared", name: "", type: "bank", currency: "AED", balance: "" });
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
  const [newLoan, setNewLoan] = useState({ ownerId: "shared", name: "", lenderType: "bank" as Loan["lenderType"], currency: "AED" as Currency, principal: "", interestRate: "", tenureMonths: "", startDate: todayIso() });
  const addLoan = () => {
    if (!newLoan.name.trim() || !newLoan.principal || !newLoan.tenureMonths) return;
    setLoans((prev) => [...prev, { id: uid(), ownerId: newLoan.ownerId, name: newLoan.name.trim(), lenderType: newLoan.lenderType, currency: newLoan.currency, principal: Number(newLoan.principal), interestRate: Number(newLoan.interestRate) || 0, tenureMonths: Number(newLoan.tenureMonths), startDate: newLoan.startDate }]);
    setNewLoan({ ownerId: "shared", name: "", lenderType: "bank", currency: "AED", principal: "", interestRate: "", tenureMonths: "", startDate: todayIso() });
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
  const [newSub, setNewSub] = useState({ ownerId: "shared", provider: "", currency: "AED" as Currency, amount: "", cadence: "monthly" as Sub["cadence"], billingDay: "1", nextDate: todayIso(), taxPct: "0" });
  const addSub = () => {
    if (!newSub.provider.trim() || !newSub.amount) return;
    setSubs((prev) => [...prev, { id: uid(), ownerId: newSub.ownerId, provider: newSub.provider.trim(), currency: newSub.currency, amount: Number(newSub.amount), cadence: newSub.cadence, billingDay: Number(newSub.billingDay) || 1, nextDate: newSub.nextDate, taxPct: Number(newSub.taxPct) || 0 }]);
    setNewSub({ ownerId: "shared", provider: "", currency: "AED", amount: "", cadence: "monthly", billingDay: "1", nextDate: todayIso(), taxPct: "0" });
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
                  <button type="button" onClick={saveAccount} className="text-accent-green hover:text-white"><Check size={16} /></button>
                  <button type="button" onClick={() => setEditingAccountId(null)} className={iconBtnCls}><X size={16} /></button>
                </div>
              ) : (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-gray-200">{a.name}</p>
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
                        <p className="text-xs opacity-80">{c.network.toUpperCase()} •••• {c.last4} · {ownerName(c.ownerId)}</p>
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
                    <button type="button" onClick={saveSub} className="text-accent-green hover:text-white"><Check size={16} /></button>
                    <button type="button" onClick={() => setEditingSubId(null)} className={iconBtnCls}><X size={16} /></button>
                  </div>
                );
              }
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
            <button type="button" onClick={addSub} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
