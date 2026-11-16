// Ledger = one dated record per paid/received occurrence (finance_transactions).
// Pure helpers, no React. Recurring items are expanded into dated
// "occurrences"; the ledger records which occurrences actually happened.
// History (week/month/quarter/year) is built from ledger rows + card spends.

export type SourceKind = "sub" | "loan" | "income" | "expense" | "scheme_item";
export type Direction = "in" | "out";

export type Occurrence = {
  key: string; // `${sourceKind}:${sourceId}:${date}`
  sourceKind: SourceKind;
  sourceId: string;
  label: string;
  ownerId: string; // local owner id ("shared" | member id)
  amount: number;
  currency: string;
  date: string; // ISO yyyy-mm-dd — also the ledger "period"
  direction: Direction;
  category: string;
  auto: boolean; // fixed recurring → auto-logged on its date; false = needs a manual tick
  legacyPaid?: boolean; // one-off expense / scheme item already flagged paid before the ledger existed
};

/** Auto-logging never reaches back before this date (history starts here). */
export const HISTORY_START = "2026-11-01";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id: string) => UUID_RE.test(id);

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function todayIso(): string {
  return iso(new Date());
}
export function parseIso(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
/** Day-of-month clamped to the month's length (31 → 30 Nov, 28/29 Feb). */
function dayIn(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(Math.max(day, 1), last));
}
/** Every monthly date on `day` within [from, to]. */
function monthlyDates(day: number, from: string, to: string): string[] {
  const out: string[] = [];
  const f = parseIso(from);
  const t = parseIso(to);
  let y = f.getFullYear();
  let m = f.getMonth();
  while (y < t.getFullYear() || (y === t.getFullYear() && m <= t.getMonth())) {
    const d = iso(dayIn(y, m, day));
    if (d >= from && d <= to) out.push(d);
    if (m === 11) { y++; m = 0; } else m++;
  }
  return out;
}
/** Every yearly anniversary of `anchor` within [from, to]. */
function yearlyDates(anchor: string, from: string, to: string): string[] {
  if (!anchor) return [];
  const a = parseIso(anchor);
  const out: string[] = [];
  for (let y = parseIso(from).getFullYear(); y <= parseIso(to).getFullYear(); y++) {
    const d = iso(dayIn(y, a.getMonth(), a.getDate()));
    if (d >= from && d <= to) out.push(d);
  }
  return out;
}
export function addDaysIso(s: string, n: number): string {
  const d = parseIso(s);
  return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}
export function addMonthsIso(s: string, n: number): string {
  const d = parseIso(s);
  return iso(dayIn(d.getFullYear(), d.getMonth() + n, d.getDate()));
}

// Minimal input shapes (structurally compatible with app/finance/page.tsx types).
export type SubIn = { id: string; ownerId: string; provider: string; currency: string; amount: number; cadence: "monthly" | "yearly"; billingDay: number; nextDate: string; taxPct: number; elevatedAmount: number | null; effectiveUntil: string; endDate: string };
export type LoanIn = { id: string; ownerId: string; name: string; currency: string; startDate: string; tenureMonths: number; emi: number };
export type IncomeIn = { id: string; ownerId: string; source: string; incomeType: string; amount: number; currency: string; isRecurring: boolean; cadence: "monthly" | "yearly"; receivedDate: string };
export type ExpenseIn = { id: string; ownerId: string; label: string; category: string; currency: string; amount: number; expenseType: "monthly" | "fixed_term" | "one_off"; billingDay: number; startDate: string; endDate: string; dueDate: string; paid: boolean };
export type SchemeIn = { id: string; ownerId: string; name: string; currency: string; items: { id: string; label: string; amount: number; cadence: string; dueDate: string; billingDay: number; paid: boolean }[] };

export type LedgerInputs = { subs: SubIn[]; loans: LoanIn[]; income: IncomeIn[]; expenses: ExpenseIn[]; schemes: SchemeIn[] };

const mk = (o: Omit<Occurrence, "key">): Occurrence => ({ ...o, key: `${o.sourceKind}:${o.sourceId}:${o.date}` });

/** Loan's final EMI date (start + tenure months), "" if unknown. */
export function loanEndDate(l: { startDate: string; tenureMonths: number }): string {
  return l.startDate && l.tenureMonths > 0 ? addMonthsIso(l.startDate, l.tenureMonths) : "";
}

/** Expand every item into dated occurrences within [from, to]. Items without a real DB id are skipped. */
export function occurrencesBetween(inp: LedgerInputs, from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const s of inp.subs) {
    if (!isUuid(s.id)) continue;
    const end = s.endDate && s.endDate < to ? s.endDate : to;
    if (end < from) continue;
    const dates = s.cadence === "monthly" ? monthlyDates(s.billingDay, from, end) : yearlyDates(s.nextDate, from, end);
    for (const date of dates) {
      const base = s.elevatedAmount != null && s.effectiveUntil && date <= s.effectiveUntil ? s.elevatedAmount : s.amount;
      out.push(mk({ sourceKind: "sub", sourceId: s.id, label: s.provider, ownerId: s.ownerId, amount: base * (1 + (s.taxPct || 0) / 100), currency: s.currency, date, direction: "out", category: "Subscriptions", auto: true }));
    }
  }
  for (const l of inp.loans) {
    if (!isUuid(l.id) || !l.startDate || l.tenureMonths <= 0) continue;
    for (let k = 1; k <= l.tenureMonths; k++) {
      const date = addMonthsIso(l.startDate, k);
      if (date > to) break;
      if (date >= from) out.push(mk({ sourceKind: "loan", sourceId: l.id, label: l.name, ownerId: l.ownerId, amount: l.emi, currency: l.currency, date, direction: "out", category: "Loans", auto: true }));
    }
  }
  for (const i of inp.income) {
    if (!isUuid(i.id) || !i.receivedDate) continue;
    const cat = i.incomeType && i.incomeType !== "other" ? i.incomeType : "Income";
    let dates: string[];
    if (!i.isRecurring) dates = i.receivedDate >= from && i.receivedDate <= to ? [i.receivedDate] : [];
    else {
      const first = i.receivedDate > from ? i.receivedDate : from;
      dates = i.cadence === "monthly" ? monthlyDates(parseIso(i.receivedDate).getDate(), first, to) : yearlyDates(i.receivedDate, first, to);
    }
    for (const date of dates) out.push(mk({ sourceKind: "income", sourceId: i.id, label: i.source, ownerId: i.ownerId, amount: i.amount, currency: i.currency, date, direction: "in", category: cat, auto: true }));
  }
  for (const e of inp.expenses) {
    if (!isUuid(e.id)) continue;
    const cat = e.category || "Expenses";
    const base = { sourceKind: "expense" as const, sourceId: e.id, label: e.label, ownerId: e.ownerId, amount: e.amount, currency: e.currency, direction: "out" as const, category: cat };
    if (e.expenseType === "one_off") {
      if (e.dueDate && e.dueDate >= from && e.dueDate <= to) out.push(mk({ ...base, date: e.dueDate, auto: false, legacyPaid: e.paid }));
      continue;
    }
    let f = from, t = to;
    if (e.expenseType === "fixed_term") {
      if (e.startDate && e.startDate > f) f = e.startDate;
      if (e.endDate && e.endDate < t) t = e.endDate;
    }
    if (f > t) continue;
    for (const date of monthlyDates(e.billingDay, f, t)) out.push(mk({ ...base, date, auto: true }));
  }
  for (const sc of inp.schemes) {
    for (const it of sc.items) {
      if (!isUuid(it.id)) continue;
      const base = { sourceKind: "scheme_item" as const, sourceId: it.id, label: `${sc.name} — ${it.label}`, ownerId: sc.ownerId, amount: it.amount, currency: sc.currency, direction: "out" as const, category: "Schemes" };
      if (it.cadence === "monthly") {
        for (const date of monthlyDates(it.billingDay, from, to)) out.push(mk({ ...base, date, auto: true }));
      } else if (it.dueDate && it.dueDate >= from && it.dueDate <= to) {
        out.push(mk({ ...base, date: it.dueDate, auto: false, legacyPaid: it.paid }));
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- periods ----------
export type PeriodKind = "week" | "month" | "quarter" | "year";
export type Period = { kind: PeriodKind; start: string; end: string; label: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Period containing today, shifted by `offset` periods (-1 = last, +1 = next). Weeks start Monday. */
export function periodAt(kind: PeriodKind, offset: number, today = new Date()): Period {
  const y = today.getFullYear(), m = today.getMonth();
  let s: Date, e: Date, label: string;
  if (kind === "week") {
    const dow = (today.getDay() + 6) % 7;
    s = new Date(y, m, today.getDate() - dow + offset * 7);
    e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
    label = `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]}`;
  } else if (kind === "month") {
    s = new Date(y, m + offset, 1);
    e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
    label = `${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  } else if (kind === "quarter") {
    const q = Math.floor(m / 3) + offset;
    s = new Date(y, q * 3, 1);
    e = new Date(s.getFullYear(), s.getMonth() + 3, 0);
    label = `Q${Math.floor(s.getMonth() / 3) + 1} ${s.getFullYear()}`;
  } else {
    s = new Date(y + offset, 0, 1);
    e = new Date(y + offset, 11, 31);
    label = `${s.getFullYear()}`;
  }
  const rel = offset === 0 ? "This" : offset === -1 ? "Last" : offset === 1 ? "Next" : "";
  if (rel) label = `${rel} ${kind} · ${label}`;
  return { kind, start: iso(s), end: iso(e), label };
}

export type HistoryEntry = { key: string; date: string; label: string; category: string; ownerId: string; amount: number; currency: string; direction: Direction; projected: boolean };

export type PeriodSummary = {
  inflow: number; outflow: number; net: number; savingsRate: number | null;
  byCategory: { category: string; amount: number }[];
  entries: HistoryEntry[];
  projectedOut: number; projectedIn: number;
};

/** Totals in `target` currency. Projected entries are reported separately and never mixed into actuals. */
export function summarize(entries: HistoryEntry[], convert: (amt: number, cur: string) => number): PeriodSummary {
  let inflow = 0, outflow = 0, projectedIn = 0, projectedOut = 0;
  const cats = new Map<string, number>();
  for (const e of entries) {
    const v = convert(e.amount, e.currency);
    if (e.projected) {
      if (e.direction === "in") projectedIn += v; else projectedOut += v;
      continue;
    }
    if (e.direction === "in") inflow += v;
    else {
      outflow += v;
      cats.set(e.category, (cats.get(e.category) || 0) + v);
    }
  }
  const byCategory = [...cats.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  const net = inflow - outflow;
  return { inflow, outflow, net, savingsRate: inflow > 0 ? net / inflow : null, byCategory, entries, projectedIn, projectedOut };
}
