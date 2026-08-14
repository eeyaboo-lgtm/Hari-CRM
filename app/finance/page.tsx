"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { Plus, X } from "lucide-react";

type Account = { id: string; name: string; type: string; currency: string; balance: number };
type Loan = { id: string; name: string; currency: string; remaining: number; monthly: number; monthsLeft: number };
type Sub = { id: string; name: string; currency: string; amount: number; dueIn: string };

const DEFAULT_ACCOUNTS: Account[] = [
  { id: "a1", name: "Joint savings", type: "bank", currency: "AED", balance: 18420 },
  { id: "a2", name: "Shenaal salary account", type: "bank", currency: "LKR", balance: 340000 },
  { id: "a3", name: "Shalini USD savings", type: "bank", currency: "USD", balance: 5200 },
];
const DEFAULT_LOANS: Loan[] = [
  { id: "l1", name: "Car loan", currency: "AED", remaining: 24500, monthly: 1450, monthsLeft: 17 },
  { id: "l2", name: "Home renovation", currency: "LKR", remaining: 890000, monthly: 42000, monthsLeft: 22 },
];
const DEFAULT_SUBS: Sub[] = [
  { id: "s1", name: "Netflix", currency: "AED", amount: 39, dueIn: "3 days" },
  { id: "s2", name: "iCloud storage", currency: "USD", amount: 3, dueIn: "9 days" },
  { id: "s3", name: "Gym — Shalini", currency: "AED", amount: 220, dueIn: "14 days" },
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function FinancePage() {
  const [accounts, setAccounts] = useLocalStorage<Account[]>("finance.accounts", DEFAULT_ACCOUNTS);
  const [loans, setLoans] = useLocalStorage<Loan[]>("finance.loans", DEFAULT_LOANS);
  const [subs, setSubs] = useLocalStorage<Sub[]>("finance.subs", DEFAULT_SUBS);

  const [newAccount, setNewAccount] = useState({ name: "", currency: "AED", balance: "" });
  const [newSub, setNewSub] = useState({ name: "", amount: "", dueIn: "" });

  const addAccount = () => {
    if (!newAccount.name.trim() || !newAccount.balance) return;
    setAccounts((prev) => [
      ...prev,
      { id: uid(), name: newAccount.name.trim(), type: "bank", currency: newAccount.currency, balance: Number(newAccount.balance) },
    ]);
    setNewAccount({ name: "", currency: "AED", balance: "" });
  };
  const removeAccount = (id: string) => setAccounts((prev) => prev.filter((a) => a.id !== id));
  const removeLoan = (id: string) => setLoans((prev) => prev.filter((l) => l.id !== id));

  const addSub = () => {
    if (!newSub.name.trim() || !newSub.amount) return;
    setSubs((prev) => [
      ...prev,
      { id: uid(), name: newSub.name.trim(), currency: "AED", amount: Number(newSub.amount), dueIn: newSub.dueIn || "—" },
    ]);
    setNewSub({ name: "", amount: "", dueIn: "" });
  };
  const removeSub = (id: string) => setSubs((prev) => prev.filter((s) => s.id !== id));

  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Finance</h1>
          <p className="mt-1 text-sm text-gray-400">
            LKR · AED · USD tracked side by side. Saved on this device for now — will move to Supabase once
            fx_rates and the finance tables are wired up.
          </p>
        </div>

        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-4 font-medium text-white">Accounts</h2>
          <div className="relative z-10 space-y-3">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-gray-200">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.type}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-medium text-white">
                    {a.balance.toLocaleString()} {a.currency}
                  </p>
                  <button type="button" onClick={() => removeAccount(a.id)} className="text-gray-500 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="relative z-10 mt-4 flex flex-wrap gap-2 border-t border-base-border pt-4">
            <input
              placeholder="Account name"
              value={newAccount.name}
              onChange={(e) => setNewAccount((s) => ({ ...s, name: e.target.value }))}
              className="min-w-0 flex-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
            <select
              value={newAccount.currency}
              onChange={(e) => setNewAccount((s) => ({ ...s, currency: e.target.value }))}
              className="rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none"
            >
              <option>AED</option>
              <option>LKR</option>
              <option>USD</option>
            </select>
            <input
              placeholder="Balance"
              type="number"
              value={newAccount.balance}
              onChange={(e) => setNewAccount((s) => ({ ...s, balance: e.target.value }))}
              className="w-28 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
            <button type="button" onClick={addAccount} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="glass-card rounded-xl2 p-5">
            <h2 className="relative z-10 mb-4 font-medium text-white">Loans & installments</h2>
            <div className="relative z-10 space-y-4">
              {loans.map((l) => (
                <div key={l.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-200">{l.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-400">{l.monthsLeft} months left</p>
                      <button type="button" onClick={() => removeLoan(l.id)} className="text-gray-500 hover:text-white">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-base-card">
                    <div
                      className="h-1.5 rounded-full bg-accent-blue"
                      style={{ width: `${Math.max(0, 100 - (l.monthsLeft / 36) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {l.remaining.toLocaleString()} {l.currency} remaining · {l.monthly.toLocaleString()} {l.currency}/mo
                  </p>
                </div>
              ))}
              {loans.length === 0 && <p className="text-xs text-gray-500">No loans logged.</p>}
            </div>
          </section>

          <section className="glass-card rounded-xl2 p-5">
            <h2 className="relative z-10 mb-4 font-medium text-white">Subscriptions due</h2>
            <div className="relative z-10 space-y-3">
              {subs.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <p className="text-gray-200">{s.name}</p>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-gray-200">
                        {s.amount} {s.currency}
                      </p>
                      <p className="text-xs text-gray-500">due in {s.dueIn}</p>
                    </div>
                    <button type="button" onClick={() => removeSub(s.id)} className="text-gray-500 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="relative z-10 mt-4 flex flex-wrap gap-2 border-t border-base-border pt-4">
              <input
                placeholder="Subscription"
                value={newSub.name}
                onChange={(e) => setNewSub((s) => ({ ...s, name: e.target.value }))}
                className="min-w-0 flex-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
              <input
                placeholder="Amount"
                type="number"
                value={newSub.amount}
                onChange={(e) => setNewSub((s) => ({ ...s, amount: e.target.value }))}
                className="w-20 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
              <input
                placeholder="Due in"
                value={newSub.dueIn}
                onChange={(e) => setNewSub((s) => ({ ...s, dueIn: e.target.value }))}
                className="w-24 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
              <button type="button" onClick={addSub} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
                <Plus size={14} /> Add
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
