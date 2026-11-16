"use client";

// History & summaries: actual money in/out per week / month / quarter / year,
// built from ledger rows + card spends. Past periods show a closing summary;
// the current period shows actuals so far plus what is still due; future
// periods are projections from recurring items.
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import InfoTip from "@/components/InfoTip";
import { HISTORY_START, periodAt, summarize, todayIso, type HistoryEntry, type PeriodKind } from "@/lib/ledger";
import { formatMoney } from "@/lib/financeUtils";

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
];

function pctChange(now: number, before: number): string | null {
  if (before <= 0) return null;
  const p = Math.round(((now - before) / before) * 100);
  return `${p > 0 ? "↑" : p < 0 ? "↓" : "→"} ${Math.abs(p)}%`;
}

export default function FinanceHistory({
  entries,
  convert,
  currency,
  ownerName,
}: {
  entries: HistoryEntry[];
  convert: (amount: number, currency: string) => number;
  currency: string;
  ownerName: (id: string) => string;
}) {
  const [kind, setKind] = useState<PeriodKind>("month");
  const [offset, setOffset] = useState(0);
  const [showEntries, setShowEntries] = useState(false);
  const today = todayIso();

  const period = periodAt(kind, offset);
  const prev = periodAt(kind, offset - 1);
  const inRange = (p: { start: string; end: string }) => (e: HistoryEntry) => e.date >= p.start && e.date <= p.end;
  const cur = useMemo(() => summarize(entries.filter(inRange(period)), convert), [entries, period.start, period.end, convert]); // eslint-disable-line react-hooks/exhaustive-deps
  const before = useMemo(() => summarize(entries.filter(inRange(prev)), convert), [entries, prev.start, prev.end, convert]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFuture = period.start > today;
  const isClosed = period.end < today;
  const beforeTracking = period.end < HISTORY_START && cur.entries.length === 0;
  const money = (n: number) => formatMoney(n, currency);
  const inflow = isFuture ? cur.projectedIn : cur.inflow;
  const outflow = isFuture ? cur.projectedOut : cur.outflow;
  const net = inflow - outflow;
  const rate = inflow > 0 ? Math.round((net / inflow) * 100) : null;
  const outChange = !isFuture ? pctChange(cur.outflow, before.outflow) : null;
  const maxCat = cur.byCategory[0]?.amount || 1;
  const list = cur.entries.filter((e) => (isFuture ? e.projected : !e.projected)).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="glass-card rounded-xl2 p-5">
      <div className="relative z-10 mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 font-medium text-white">
          <History size={16} className="text-accent-blue" /> History &amp; summaries
          <InfoTip size="sm" text="Real money in and out per period, from paid ticks and card spends." />
        </h2>
        <div className="flex items-center rounded-full bg-base-card p-0.5 text-xs font-medium">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => { setKind(k.id); setOffset(0); }}
              className={`rounded-full px-3 py-1.5 transition-colors ${kind === k.id ? "bg-accent-purple text-white" : "text-gray-400 hover:text-white"}`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 mb-4 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="Previous period" className="rounded-full p-2 text-gray-400 hover:text-white"><ChevronLeft size={18} /></button>
        <div className="text-center">
          <p className="text-sm font-medium text-white">{period.label}</p>
          <p className="text-xs text-gray-500">{isFuture ? "Projected from recurring items" : isClosed ? "Closed period" : "In progress"}</p>
        </div>
        <div className="flex items-center">
          {offset !== 0 && <button type="button" onClick={() => setOffset(0)} className="rounded-full px-2 py-1 text-xs text-accent-blue hover:text-white">Today</button>}
          <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="Next period" className="rounded-full p-2 text-gray-400 hover:text-white"><ChevronRight size={18} /></button>
        </div>
      </div>

      {beforeTracking ? (
        <p className="relative z-10 text-sm text-gray-400">No records yet — history starts in November 2026, when tracking began.</p>
      ) : (
        <div className="relative z-10 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={isFuture ? "Expected in" : "Money in"} value={money(inflow)} tone="text-accent-green" />
            <Tile label={isFuture ? "Expected out" : "Money out"} value={money(outflow)} tone="text-white" sub={outChange ? `${outChange} vs ${prev.label.replace(/^(Last|This|Next) \w+ · /, "")}` : undefined} />
            <Tile label="Net" value={money(net)} tone={net >= 0 ? "text-accent-green" : "text-red-400"} />
            <Tile label="Savings rate" value={rate == null ? "—" : `${rate}%`} tone={rate != null && rate < 0 ? "text-red-400" : "text-white"} />
          </div>

          {!isFuture && !isClosed && (cur.projectedOut > 0 || cur.projectedIn > 0) && (
            <p className="text-xs text-gray-400">
              Still due this {kind}: {money(cur.projectedOut)} out{cur.projectedIn > 0 ? `, ${money(cur.projectedIn)} in` : ""}.
            </p>
          )}

          {isClosed && (
            <p className="rounded-xl bg-base-card px-3 py-2 text-sm text-gray-200">
              <span className="font-medium text-white">Summary: </span>
              {cur.inflow === 0 && cur.outflow === 0
                ? "Nothing was recorded in this period."
                : `You received ${money(cur.inflow)} and spent ${money(cur.outflow)}, ${net >= 0 ? `keeping ${money(net)}` : `overspending by ${money(-net)}`}${rate != null ? ` (${rate}% savings rate)` : ""}.${cur.byCategory[0] ? ` Biggest cost: ${cur.byCategory[0].category} at ${money(cur.byCategory[0].amount)}.` : ""}${outChange ? ` Spending ${outChange} vs the previous ${kind}.` : ""}`}
            </p>
          )}

          {!isFuture && cur.byCategory.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Where it went</p>
              {cur.byCategory.slice(0, 6).map((c) => (
                <div key={c.category} className="flex items-center gap-2 text-sm">
                  <span className="w-28 shrink-0 truncate text-gray-300">{c.category}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-base-card">
                    <div className="h-full rounded-full bg-accent-purple" style={{ width: `${Math.max(3, (c.amount / maxCat) * 100)}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-gray-300">{money(c.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {list.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowEntries((v) => !v)} className="text-xs text-accent-blue hover:text-white">
                {showEntries ? "Hide" : "Show"} {list.length} {isFuture ? "expected" : "recorded"} {list.length === 1 ? "entry" : "entries"}
              </button>
              {showEntries && (
                <div className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
                  {list.map((e) => (
                    <div key={e.key} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-gray-200">{e.label}</p>
                        <p className="text-xs text-gray-500">{e.date} · {e.category} · {ownerName(e.ownerId)}</p>
                      </div>
                      <p className={`shrink-0 ${e.direction === "in" ? "text-accent-green" : "text-gray-300"}`}>
                        {e.direction === "in" ? "+" : "−"}{formatMoney(e.amount, e.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-gray-500">Totals in {currency} at today&rsquo;s exchange rates.</p>
        </div>
      )}
    </section>
  );
}

function Tile({ label, value, tone, sub }: { label: string; value: string; tone: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-base-card px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-base font-semibold ${tone}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}
