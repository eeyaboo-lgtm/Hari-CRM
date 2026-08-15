"use client";

// Memberships & loyalty cards — distinct from Finance's Subscriptions:
// this is for things like gym/club/warehouse-club memberships and airline/
// hotel loyalty programs, tracked by renewal/expiry rather than recurring
// billing math. localStorage-backed for now, same as every other module
// pending the Supabase wiring pass (see HANDOVER.md).
import { useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useHousehold } from "@/lib/HouseholdContext";
import { uid, daysUntil, formatDaysUntil, formatMoney } from "@/lib/financeUtils";
import { Award, ExternalLink, Plus, Trash2 } from "lucide-react";

type Currency = "AED" | "LKR" | "USD";
type Category = "membership" | "loyalty";
type RenewalCadence = "monthly" | "yearly" | "onetime" | "none";

type Membership = {
  id: string;
  ownerId: string;
  category: Category;
  name: string;
  provider: string;
  memberNumber: string;
  fee: number;
  currency: Currency;
  renewalCadence: RenewalCadence;
  renewalDate: string;
  expiryDate: string;
  link: string;
  notes: string;
};

const SHARED = { id: "shared", name: "Shared", initial: "H" };

const CATEGORY_META: Record<Category, string> = {
  membership: "Membership",
  loyalty: "Loyalty card",
};

const CADENCE_META: Record<RenewalCadence, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  onetime: "One-time",
  none: "No renewal",
};

function MembershipCard({
  m,
  ownerName,
  owners,
  onUpdate,
  onRemove,
}: {
  m: Membership;
  ownerName: (id: string) => string;
  owners: { id: string; name: string }[];
  onUpdate: (v: Membership) => void;
  onRemove: () => void;
}) {
  const renewalDays = m.renewalDate ? daysUntil(m.renewalDate) : null;
  const expiryDays = m.expiryDate ? daysUntil(m.expiryDate) : null;

  return (
    <div className="rounded-xl2 border border-base-border bg-base-card/40 p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-accent-purple">
          <Award size={16} />
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Name</label>
            <input
              value={m.name}
              onChange={(e) => onUpdate({ ...m, name: e.target.value })}
              placeholder="e.g. Costco, Emirates Skywards, Gold's Gym"
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Provider</label>
            <input
              value={m.provider}
              onChange={(e) => onUpdate({ ...m, provider: e.target.value })}
              placeholder="Company/brand"
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Household member</label>
            <select
              value={m.ownerId}
              onChange={(e) => onUpdate({ ...m, ownerId: e.target.value })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            >
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Type</label>
            <select
              value={m.category}
              onChange={(e) => onUpdate({ ...m, category: e.target.value as Category })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            >
              {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Member / card number</label>
            <input
              value={m.memberNumber}
              onChange={(e) => onUpdate({ ...m, memberNumber: e.target.value })}
              placeholder="Membership or loyalty ID"
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Portal / link</label>
            <div className="flex items-center gap-1.5">
              <input
                value={m.link}
                onChange={(e) => onUpdate({ ...m, link: e.target.value })}
                placeholder="https://..."
                className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
              {m.link && (
                <a href={m.link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-gray-400 hover:text-white" title="Open">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Fee</label>
            <div className="flex gap-1.5">
              <input
                type="number"
                value={m.fee || ""}
                onChange={(e) => onUpdate({ ...m, fee: Number(e.target.value) || 0 })}
                placeholder="0"
                className="w-full min-w-0 rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
              <select
                value={m.currency}
                onChange={(e) => onUpdate({ ...m, currency: e.target.value as Currency })}
                className="rounded-lg border border-base-border bg-base-card px-2 py-1.5 text-sm text-gray-100 outline-none"
              >
                <option>AED</option>
                <option>LKR</option>
                <option>USD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Renewal cadence</label>
            <select
              value={m.renewalCadence}
              onChange={(e) => onUpdate({ ...m, renewalCadence: e.target.value as RenewalCadence })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            >
              {(Object.keys(CADENCE_META) as RenewalCadence[]).map((c) => (
                <option key={c} value={c}>
                  {CADENCE_META[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Next payment / renewal date</label>
            <input
              type="date"
              value={m.renewalDate}
              onChange={(e) => onUpdate({ ...m, renewalDate: e.target.value })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Expiry date</label>
            <input
              type="date"
              value={m.expiryDate}
              onChange={(e) => onUpdate({ ...m, expiryDate: e.target.value })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
        </div>
        <button type="button" onClick={onRemove} className="mt-1 shrink-0 text-gray-500 hover:text-red-400" title="Remove">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-500">Notes</label>
        <textarea
          value={m.notes}
          onChange={(e) => onUpdate({ ...m, notes: e.target.value })}
          placeholder="Perks, tier, referral notes..."
          rows={2}
          className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-gray-300">
          {CATEGORY_META[m.category]} · {ownerName(m.ownerId)}
        </span>
        {m.fee > 0 && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-gray-300">
            {formatMoney(m.fee, m.currency)} / {CADENCE_META[m.renewalCadence].toLowerCase()}
          </span>
        )}
        {renewalDays !== null && (
          <span
            className={`rounded-full px-2.5 py-0.5 ${
              renewalDays <= 14 ? "bg-accent-orange/20 text-accent-orange" : "bg-accent-blue/20 text-accent-blue"
            }`}
          >
            Renews {formatDaysUntil(renewalDays)}
          </span>
        )}
        {expiryDays !== null && (
          <span className={`rounded-full px-2.5 py-0.5 ${expiryDays <= 30 ? "bg-red-500/20 text-red-300" : "bg-white/5 text-gray-400"}`}>
            Expires {formatDaysUntil(expiryDays)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MembershipsPage() {
  const { members } = useHousehold();
  const owners = useMemo(() => [...members, SHARED], [members]);
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.name ?? id;

  const [items, setItems] = useLocalStorage<Membership[]>("memberships.items", []);
  const [filter, setFilter] = useState<string>("all");

  const addItem = () => {
    setItems((prev) => [
      {
        id: uid(),
        ownerId: "shared",
        category: "membership",
        name: "",
        provider: "",
        memberNumber: "",
        fee: 0,
        currency: "AED",
        renewalCadence: "yearly",
        renewalDate: "",
        expiryDate: "",
        link: "",
        notes: "",
      },
      ...prev,
    ]);
  };
  const updateItem = (id: string, v: Membership) => setItems((prev) => prev.map((x) => (x.id === id ? v : x)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

  const filtered = items.filter((i) => filter === "all" || i.ownerId === filter);

  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Memberships</h1>
            <p className="mt-1 text-sm text-gray-400">
              Clubs, warehouse memberships, and loyalty cards — renewal/expiry and fees tracked separately from
              Finance&rsquo;s Subscriptions.
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

        <section className="glass-card rounded-xl2 p-5">
          <div className="relative z-10 mb-4 flex items-center justify-between">
            <h2 className="font-medium text-white">All memberships &amp; loyalty cards</h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="relative z-10 space-y-3">
            {filtered.length === 0 && <p className="text-xs text-gray-500">Nothing added yet.</p>}
            {filtered.map((m) => (
              <MembershipCard key={m.id} m={m} ownerName={ownerName} owners={owners} onUpdate={(v) => updateItem(m.id, v)} onRemove={() => removeItem(m.id)} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
