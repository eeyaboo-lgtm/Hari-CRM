"use client";

import InfoTip from "@/components/InfoTip";
import { daysUntil, formatDaysUntil, formatMoney } from "@/lib/financeUtils";
import type { Occurrence } from "@/lib/ledger";

export type UpcomingItem = { occ: Occurrence; paid: boolean };

const badge = (days: number, paid: boolean) =>
  paid ? "bg-accent-green/20 text-accent-green" : days < 0 || days <= 3 ? "bg-red-500/20 text-red-400" : days <= 7 ? "bg-accent-orange/20 text-accent-orange" : "bg-accent-blue/20 text-accent-blue";

export function UpcomingPayments({ items, onToggle, ownerName }: { items: UpcomingItem[]; onToggle: (o: Occurrence, paid: boolean) => void; ownerName: (id: string) => string }) {
  return (
    <section className="glass-card rounded-xl2 p-5">
      <h2 className="relative z-10 mb-4 flex items-center gap-1 font-medium text-white">
        Upcoming payments
        <InfoTip size="sm" text="Due in the next 14 days, plus anything overdue. Tick when paid." />
      </h2>
      <div className="relative z-10 space-y-2">
        {items.length === 0 && <p className="text-xs text-gray-500">Nothing due in the next two weeks.</p>}
        {items.map(({ occ, paid }) => {
          const days = daysUntil(occ.date);
          return (
            <label key={occ.key} className="flex cursor-pointer items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <input type="checkbox" checked={paid} onChange={() => onToggle(occ, !paid)} className="h-4 w-4 shrink-0 accent-accent-purple" aria-label={`Mark ${occ.label} ${occ.direction === "in" ? "received" : "paid"}`} />
                <span className={`min-w-0 truncate ${paid ? "text-gray-500 line-through" : "text-gray-200"}`}>
                  {occ.label}
                  <span className="ml-1 text-xs text-gray-500 no-underline">· {ownerName(occ.ownerId)}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={occ.direction === "in" ? "text-accent-green" : "text-gray-300"}>{occ.direction === "in" ? "+" : ""}{formatMoney(occ.amount, occ.currency)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${badge(days, paid)}`}>{paid ? (occ.direction === "in" ? "received" : "paid") : formatDaysUntil(days)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export type EndingItem = { key: string; label: string; kind: string; date: string; ownerId: string; note?: string };

export function EndingSoon({ items, ownerName }: { items: EndingItem[]; ownerName: (id: string) => string }) {
  return (
    <section className="glass-card rounded-xl2 p-5">
      <h2 className="relative z-10 mb-4 flex items-center gap-1 font-medium text-white">
        Ending soon
        <InfoTip size="sm" text="Subscriptions, loans and fixed-term costs ending within 90 days." />
      </h2>
      <div className="relative z-10 space-y-2">
        {items.length === 0 && <p className="text-xs text-gray-500">Nothing ends in the next 90 days.</p>}
        {items.map((it) => {
          const days = daysUntil(it.date);
          return (
            <div key={it.key} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate text-gray-200">{it.label}</p>
                <p className="text-xs text-gray-500">{it.kind} · {ownerName(it.ownerId)}{it.note ? ` · ${it.note}` : ""}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${days < 0 ? "bg-white/10 text-gray-400" : days <= 14 ? "bg-red-500/20 text-red-400" : days <= 30 ? "bg-accent-orange/20 text-accent-orange" : "bg-accent-blue/20 text-accent-blue"}`}>
                {days < 0 ? `ended ${it.date}` : days === 0 ? "ends today" : `ends in ${days}d`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
