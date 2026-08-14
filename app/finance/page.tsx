import Sidebar from "@/components/Sidebar";

// Placeholder rows shaped exactly like finance_loans / finance_subscriptions /
// finance_accounts in schema.sql — swap for real Supabase queries once the
// project is live. Layout is the real target; data wiring is task #7 follow-up.

const ACCOUNTS = [
  { name: "Joint savings", type: "bank", currency: "AED", balance: 18420 },
  { name: "Shenaal salary account", type: "bank", currency: "LKR", balance: 340000 },
  { name: "Shalini USD savings", type: "bank", currency: "USD", balance: 5200 },
];

const LOANS = [
  { name: "Car loan", currency: "AED", remaining: 24500, monthly: 1450, monthsLeft: 17 },
  { name: "Home renovation", currency: "LKR", remaining: 890000, monthly: 42000, monthsLeft: 22 },
];

const SUBSCRIPTIONS = [
  { name: "Netflix", currency: "AED", amount: 39, dueIn: "3 days" },
  { name: "iCloud storage", currency: "USD", amount: 3, dueIn: "9 days" },
  { name: "Gym — Shalini", currency: "AED", amount: 220, dueIn: "14 days" },
];

export default function FinancePage() {
  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-semibold text-white">Finance</h1>
        <p className="text-sm text-gray-400">
          LKR · AED · USD tracked side by side. Combined net worth needs fx_rates
          filled in (see schema.sql) before it can convert to one number.
        </p>

        <section className="rounded-xl2 bg-base-panel p-5">
          <h2 className="mb-4 font-medium text-white">Accounts</h2>
          <div className="space-y-3">
            {ACCOUNTS.map((a) => (
              <div key={a.name} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-gray-200">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.type}</p>
                </div>
                <p className="font-medium text-white">
                  {a.balance.toLocaleString()} {a.currency}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="rounded-xl2 bg-base-panel p-5">
            <h2 className="mb-4 font-medium text-white">Loans & installments</h2>
            <div className="space-y-4">
              {LOANS.map((l) => (
                <div key={l.name} className="text-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-200">{l.name}</p>
                    <p className="text-gray-400">{l.monthsLeft} months left</p>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-base-card">
                    <div
                      className="h-1.5 rounded-full bg-accent-blue"
                      style={{ width: `${100 - (l.monthsLeft / 36) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {l.remaining.toLocaleString()} {l.currency} remaining ·{" "}
                    {l.monthly.toLocaleString()} {l.currency}/mo
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl2 bg-base-panel p-5">
            <h2 className="mb-4 font-medium text-white">Subscriptions due</h2>
            <div className="space-y-3">
              {SUBSCRIPTIONS.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <p className="text-gray-200">{s.name}</p>
                  <div className="text-right">
                    <p className="text-gray-200">
                      {s.amount} {s.currency}
                    </p>
                    <p className="text-xs text-gray-500">due in {s.dueIn}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
