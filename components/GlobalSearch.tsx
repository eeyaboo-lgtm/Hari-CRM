"use client";

// Global search / Cmd+K — with 8 modules and a growing number of rows
// (bills, appointments, conditions, projects, memberships...) there was no
// way to jump straight to "when is the ENBD loan due" without opening
// Finance and scrolling. This reads the same localStorage caches every
// module's own page already reads (useSupabaseSynced keeps them in sync
// with Supabase) — no new fetches, no new tables, just an index over data
// that's already sitting in the browser.
//
// Mounted once in app/layout.tsx so Cmd+K / Ctrl+K works from any page.
// Deliberately read-only and best-effort: if a module's cache is empty
// (e.g. first load before that page has ever been visited this session)
// it just contributes zero results, it doesn't error.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useLocalStorage } from "@/lib/useLocalStorage";

type Hit = { module: string; title: string; subtitle?: string; href: string; color: string };

function textOf(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // One useLocalStorage call per module cache — same storage keys each
  // module's own page reads, kept in sync by useSupabaseSynced already.
  const [accounts] = useLocalStorage<any[]>("finance.accounts.v4", []);
  const [cards] = useLocalStorage<any[]>("finance.cards.v4", []);
  const [loans] = useLocalStorage<any[]>("finance.loans.v3", []);
  const [subs] = useLocalStorage<any[]>("finance.subs.v3", []);
  const [schemes] = useLocalStorage<any[]>("finance.schemes.v1", []);
  const [income] = useLocalStorage<any[]>("finance.income.v1", []);
  const [expenses] = useLocalStorage<any[]>("finance.expenses.v1", []);
  const [conditions] = useLocalStorage<any[]>("health.conditions", []);
  const [measurements] = useLocalStorage<any[]>("fitness.measurements", []);
  const [allergies] = useLocalStorage<any[]>("health.allergies", []);
  const [appointments] = useLocalStorage<any[]>("health.appointments", []);
  const [insurance] = useLocalStorage<any[]>("health.insurance", []);
  const [ideas] = useLocalStorage<any[]>("business.ideas", []);
  const [stack] = useLocalStorage<any[]>("business.stack", []);
  const [projects] = useLocalStorage<any[]>("business.projects.v1", []);
  const [memberships] = useLocalStorage<any[]>("memberships.items", []);
  const [events] = useLocalStorage<any[]>("calendar.events.v1", []);
  const [goals] = useLocalStorage<any[]>("vision.goals", []);

  const index: Hit[] = useMemo(() => {
    const out: Hit[] = [];
    for (const a of accounts) out.push({ module: "Finance", title: textOf(a.name), subtitle: "Account", href: "/finance", color: "text-accent-blue" });
    for (const c of cards) out.push({ module: "Finance", title: textOf(c.name), subtitle: "Card", href: "/finance", color: "text-accent-blue" });
    for (const l of loans) out.push({ module: "Finance", title: textOf(l.name), subtitle: "Loan", href: "/finance", color: "text-accent-blue" });
    for (const s of subs) out.push({ module: "Finance", title: textOf(s.provider), subtitle: "Subscription", href: "/finance", color: "text-accent-blue" });
    for (const sc of schemes) {
      out.push({ module: "Finance", title: textOf(sc.name), subtitle: "Payment scheme", href: "/finance", color: "text-accent-blue" });
      for (const it of sc.items ?? []) out.push({ module: "Finance", title: textOf(it.label), subtitle: `${sc.name} — scheme item`, href: "/finance", color: "text-accent-blue" });
    }
    for (const i of income) out.push({ module: "Finance", title: textOf(i.source), subtitle: "Income", href: "/finance", color: "text-accent-blue" });
    for (const e of expenses) out.push({ module: "Finance", title: textOf(e.label), subtitle: "Expense", href: "/finance", color: "text-accent-blue" });

    for (const c of conditions) out.push({ module: "Health", title: textOf(c.text), subtitle: "Condition", href: "/health", color: "text-accent-pink" });
    for (const a of allergies) out.push({ module: "Health", title: textOf(a.trigger), subtitle: "Allergy", href: "/health", color: "text-accent-pink" });
    for (const a of appointments) out.push({ module: "Health", title: textOf(a.text), subtitle: a.provider ? `Appointment — ${a.provider}` : "Appointment", href: "/health", color: "text-accent-pink" });
    for (const p of insurance) out.push({ module: "Health", title: textOf(p.provider), subtitle: "Insurance policy", href: "/health", color: "text-accent-pink" });

    for (const m of measurements) out.push({ module: "Fitness", title: m.entryDate ? `Measurement — ${m.entryDate}` : "Measurement", subtitle: textOf(m.notes) || "Body measurement log", href: "/fitness", color: "text-accent-blue" });

    for (const i of ideas) out.push({ module: "Business", title: textOf(i.text), subtitle: "Idea", href: "/business", color: "text-accent-purple" });
    for (const s of stack) out.push({ module: "Business", title: textOf(s.service), subtitle: "Stack tool", href: "/business", color: "text-accent-purple" });
    for (const p of projects) out.push({ module: "Business", title: textOf(p.name), subtitle: "Project", href: "/business", color: "text-accent-purple" });

    for (const m of memberships) out.push({ module: "Memberships", title: textOf(m.name), subtitle: m.provider ? `Membership — ${m.provider}` : "Membership", href: "/memberships", color: "text-accent-orange" });

    for (const e of events) out.push({ module: "Calendar", title: textOf(e.title), subtitle: e.eventDate ? `Event — ${e.eventDate}` : "Event", href: "/calendar", color: "text-accent-orange" });

    for (const g of goals) out.push({ module: "Vision", title: textOf(g.title), subtitle: "Goal / trip", href: "/vision", color: "text-accent-green" });

    return out.filter((h) => h.title.trim().length > 0);
  }, [accounts, cards, loans, subs, schemes, income, expenses, conditions, allergies, appointments, insurance, measurements, ideas, stack, projects, memberships, events, goals]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index.filter((h) => h.title.toLowerCase().includes(q) || h.subtitle?.toLowerCase().includes(q)).slice(0, 30);
  }, [index, query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-xs text-gray-300 backdrop-blur-xl hover:bg-white/20 hover:text-white md:bottom-6 md:right-6"
        title="Search everything (Ctrl/Cmd+K)"
      >
        <Search size={14} />
        Search
        <span className="hidden rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-400 sm:inline">⌘K</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <div className="glass-card w-full max-w-lg rounded-xl2 p-2" onClick={(e) => e.stopPropagation()}>
        <div className="relative z-10 flex items-center gap-2 border-b border-white/5 px-3 py-2.5">
          <Search size={16} className="text-gray-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bills, appointments, projects, events..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
          />
          <button type="button" onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="relative z-10 max-h-[50vh] overflow-y-auto p-2">
          {query.trim().length === 0 && (
            <p className="px-2 py-3 text-xs text-gray-500">Start typing to search across every module.</p>
          )}
          {query.trim().length > 0 && results.length === 0 && (
            <p className="px-2 py-3 text-xs text-gray-500">No matches for "{query}".</p>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.href}-${r.title}-${i}`}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(r.href);
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-gray-200 hover:bg-white/5"
            >
              <span>
                {r.title}
                {r.subtitle && <span className="ml-2 text-xs text-gray-500">{r.subtitle}</span>}
              </span>
              <span className={`text-[10px] uppercase tracking-wide ${r.color}`}>{r.module}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
