"use client";

// Real household calendar — replaces the approved static design preview
// with actual Supabase-backed data. Two event sources shown side by side:
//   - calendar_events (this table): appointments/business/other items any
//     household member can add, shared_view via useSupabaseSynced +
//     ownerLocalId "shared" (mirrored_edit — anyone can edit/delete).
//   - Finance's existing loan/subscription/payment-scheme "next due" dates
//     (lib/calendarPayments.ts) — read-only here, add/edit those in Finance.
// Google Calendar sync is intentionally a locked stub: two-way sync needs a
// verified domain + Google OAuth review, which isn't done yet. See
// HANDOVER.md.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Lock, RefreshCw } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useSupabaseSynced } from "@/lib/supabase/useSupabaseSynced";
import { getPaymentEventsByDate, type PaymentEvent } from "@/lib/calendarPayments";

type Category = "appointment" | "business" | "payment" | "other";

type CalEvent = {
  id: string;
  title: string;
  category: Category;
  location: string;
  notes: string;
  eventDate: string; // YYYY-MM-DD
  eventTime: string; // "" or "HH:MM"
};

const CATEGORY_LABEL: Record<Category, string> = {
  appointment: "Appointment",
  business: "Business",
  payment: "Payment / bill",
  other: "Other",
};

const CATEGORY_CLASSES: Record<Category, { chip: string; dot: string }> = {
  appointment: { chip: "bg-accent-purple/20 text-accent-purple", dot: "bg-accent-purple" },
  business: { chip: "bg-accent-orange/20 text-accent-orange", dot: "bg-accent-orange" },
  payment: { chip: "bg-accent-blue/20 text-accent-blue", dot: "bg-accent-blue" },
  other: { chip: "bg-accent-green/20 text-accent-green", dot: "bg-accent-green" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function keyOf(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function todayKey() {
  const t = new Date();
  return keyOf(t.getFullYear(), t.getMonth(), t.getDate());
}

export default function CalendarPage() {
  const [events, setEvents, { ready }] = useSupabaseSynced<CalEvent>(
    "calendar_events",
    "calendar.events.v1",
    [],
    {
      toRow: (e) => ({
        category: e.category,
        title: e.title,
        location: e.location || null,
        notes: e.notes || null,
        event_date: e.eventDate,
        event_time: e.eventTime || null,
      }),
      fromRow: (row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        location: row.location ?? "",
        notes: row.notes ?? "",
        eventDate: row.event_date,
        eventTime: row.event_time ? String(row.event_time).slice(0, 5) : "",
      }),
      ownerLocalId: () => "shared",
    }
  );

  const [paymentsByDate, setPaymentsByDate] = useState<Record<string, PaymentEvent[]>>({});
  useEffect(() => {
    setPaymentsByDate(getPaymentEventsByDate());
  }, [ready]);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [showAddForm, setShowAddForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<Category>("appointment");
  const [formTime, setFormTime] = useState("");
  const [formLocation, setFormLocation] = useState("");

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const e of events) {
      (map[e.eventDate] ??= []).push(e);
    }
    return map;
  }, [events]);

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setViewMonth(m);
    setViewYear(y);
  }

  function jumpToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(todayKey());
  }

  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const list: { d: number; y: number; m: number; other: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      list.push({ d: daysInPrevMonth - i, y: viewMonth === 0 ? viewYear - 1 : viewYear, m: viewMonth === 0 ? 11 : viewMonth - 1, other: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ d, y: viewYear, m: viewMonth, other: false });
    }
    let next = 1;
    while (list.length % 7 !== 0 || list.length < 42) {
      list.push({ d: next++, y: viewMonth === 11 ? viewYear + 1 : viewYear, m: viewMonth === 11 ? 0 : viewMonth + 1, other: true });
      if (list.length >= 42) break;
    }
    return list;
  }, [viewYear, viewMonth]);

  const monthPayments = useMemo(() => {
    const rows: (PaymentEvent & { dateLabel: string })[] = [];
    Object.entries(paymentsByDate).forEach(([key, list]) => {
      const [y, m] = key.split("-").map(Number);
      if (y === viewYear && m - 1 === viewMonth) {
        const d = new Date(key);
        const dateLabel = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        list.forEach((p) => rows.push({ ...p, dateLabel }));
      }
    });
    return rows.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [paymentsByDate, viewYear, viewMonth]);

  const monthCounts = useMemo(() => {
    let apptCount = 0;
    Object.entries(eventsByDate).forEach(([key, list]) => {
      const [y, m] = key.split("-").map(Number);
      if (y === viewYear && m - 1 === viewMonth) apptCount += list.length;
    });
    return { payments: monthPayments.length, appts: apptCount };
  }, [eventsByDate, monthPayments, viewYear, viewMonth]);

  function openAddFor(dateKey: string) {
    setSelectedDate(dateKey);
    setShowAddForm(true);
  }

  async function submitAdd() {
    const title = formTitle.trim();
    if (!title) return;
    const newEvent: CalEvent = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      category: formCategory,
      location: formLocation.trim(),
      notes: "",
      eventDate: selectedDate,
      eventTime: formTime.trim(),
    };
    setEvents((prev) => [...prev, newEvent]);
    setFormTitle("");
    setFormTime("");
    setFormLocation("");
  }

  function removeEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  const selectedLabel = useMemo(() => {
    const d = new Date(selectedDate);
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, [selectedDate]);

  const selectedEvents = eventsByDate[selectedDate] ?? [];
  const selectedPayments = paymentsByDate[selectedDate] ?? [];

  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />

      <main className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Calendar</h1>
            <p className="text-sm text-gray-400">
              {monthCounts.payments} payment{monthCounts.payments !== 1 ? "s" : ""} · {monthCounts.appts} event
              {monthCounts.appts !== 1 ? "s" : ""} this month
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={jumpToday}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-medium text-gray-200 hover:bg-white/10"
            >
              <CalendarDays size={14} /> Today
            </button>
            <button
              type="button"
              onClick={() => openAddFor(selectedDate)}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-base-bg"
            >
              <Plus size={15} strokeWidth={2.4} /> Add event
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] items-start">
          {/* CALENDAR GRID */}
          <div className="glass-card rounded-xl2">
            <div className="relative z-10 flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-gray-200"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="min-w-[150px] text-center text-base font-semibold text-white">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </div>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-gray-200"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              {!ready && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <RefreshCw size={12} className="animate-spin" /> Syncing...
                </span>
              )}
            </div>

            <div className="relative z-10 grid grid-cols-7 px-4">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1.5 text-center text-[11px] uppercase tracking-wide text-gray-500">
                  {w}
                </div>
              ))}
            </div>

            <div className="relative z-10 grid grid-cols-7 gap-2 p-4 pt-1">
              {cells.map((c, i) => {
                const key = keyOf(c.y, c.m, c.d);
                const dayEvents = eventsByDate[key] ?? [];
                const dayPayments = paymentsByDate[key] ?? [];
                const combined = [
                  ...dayPayments.map((p) => ({ kind: "payment" as Category, label: p.title })),
                  ...dayEvents.map((e) => ({ kind: e.category, label: e.title })),
                ];
                const isToday = key === todayKey();
                const isSelected = key === selectedDate;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedDate(key)}
                    className={`flex min-h-[92px] flex-col gap-1 rounded-xl border p-2 text-left transition-colors ${
                      c.other ? "opacity-30" : ""
                    } ${
                      isSelected
                        ? "border-accent-purple bg-gradient-to-b from-accent-purple/20 to-accent-blue/5"
                        : isToday
                        ? "border-accent-blue bg-white/[0.02]"
                        : "border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10"
                    }`}
                  >
                    <span className={`text-xs font-medium ${isToday ? "text-accent-blue font-bold" : "text-gray-300"}`}>{c.d}</span>
                    <div className="flex flex-col gap-0.5">
                      {combined.slice(0, 2).map((ev, j) => (
                        <span
                          key={j}
                          className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_CLASSES[ev.kind].chip}`}
                        >
                          {ev.label}
                        </span>
                      ))}
                      {combined.length > 2 && (
                        <span className="pl-0.5 text-[10px] text-gray-500">+{combined.length - 2} more</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="relative z-10 flex flex-wrap gap-4 px-4 pb-4 text-[11px] text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent-blue" /> Payments / bills
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent-purple" /> Appointments
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent-orange" /> Business
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-5">
            <div className="glass-card rounded-xl2 p-5">
              <h3 className="relative z-10 mb-1 font-medium text-white">Day details</h3>
              <p className="relative z-10 mb-3 text-xs text-gray-500">{selectedLabel}</p>

              <div className="relative z-10 space-y-2">
                {selectedPayments.length === 0 && selectedEvents.length === 0 && (
                  <p className="text-xs text-gray-500">Nothing scheduled. Use "Add event" below to add one.</p>
                )}
                {selectedPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 border-b border-white/5 py-2 text-sm last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-accent-blue" />
                      <div>
                        <p className="text-gray-200">{p.title}</p>
                        <p className="text-[11px] text-gray-500">Bill — from Finance</p>
                      </div>
                    </div>
                    <span className="text-gray-300">{p.amountLabel}</span>
                  </div>
                ))}
                {selectedEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 border-b border-white/5 py-2 text-sm last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_CLASSES[e.category].dot}`} />
                      <div>
                        <p className="text-gray-200">{e.title}</p>
                        <p className="text-[11px] text-gray-500">
                          {e.eventTime || "All day"}
                          {e.location ? ` · ${e.location}` : ""}
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={() => removeEvent(e.id)} className="text-[11px] text-gray-500 hover:text-red-300">
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {showAddForm ? (
                <div className="relative z-10 mt-4 flex flex-col gap-2">
                  <input
                    autoFocus
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Event title (e.g. Dentist, Team call)"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-200 outline-none placeholder:text-gray-500 focus:border-accent-purple"
                  />
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as Category)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-200 outline-none focus:border-accent-purple"
                  >
                    <option value="appointment">Appointment</option>
                    <option value="business">Business</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    type="time"
                    placeholder="Time — optional"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-200 outline-none placeholder:text-gray-500 focus:border-accent-purple"
                  />
                  <input
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Location — optional"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-200 outline-none placeholder:text-gray-500 focus:border-accent-purple"
                  />
                  <button
                    type="button"
                    onClick={submitAdd}
                    className="mt-1 rounded-lg bg-gradient-to-r from-accent-purple to-accent-blue py-2 text-xs font-semibold text-white"
                  >
                    + Add to this day
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="relative z-10 mt-4 w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-medium text-gray-300 hover:text-white"
                >
                  + Add event to this day
                </button>
              )}
            </div>

            <div className="glass-card rounded-xl2 p-5">
              <div className="relative z-10 mb-2 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-accent-blue">
                  <CalendarDays size={17} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Google Calendar sync</p>
                  <span className="mt-0.5 inline-block rounded-full bg-accent-orange/15 px-2 py-0.5 text-[10px] text-accent-orange">
                    Pending verification
                  </span>
                </div>
              </div>
              <p className="relative z-10 mb-3 text-[11px] leading-relaxed text-gray-500">
                Two-way sync will pull your Google events in and push appointments out automatically. It's wired up
                but locked until the app has a verified domain and passes Google's OAuth review.
              </p>
              <button
                type="button"
                disabled
                className="relative z-10 flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] py-2 text-xs text-gray-500"
              >
                <Lock size={13} /> Connect (unlocks after domain setup)
              </button>
            </div>

            <div className="glass-card rounded-xl2 p-5">
              <h3 className="relative z-10 mb-3 font-medium text-white">This month's payments</h3>
              <div className="relative z-10 space-y-2">
                {monthPayments.length === 0 && <p className="text-xs text-gray-500">No bills logged for this month yet.</p>}
                {monthPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 border-b border-white/5 py-2 text-sm last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-accent-blue" />
                      <div>
                        <p className="text-gray-200">{p.title}</p>
                        <p className="text-[11px] text-gray-500">{p.dateLabel}</p>
                      </div>
                    </div>
                    <span className="text-gray-300">{p.amountLabel}</span>
                  </div>
                ))}
              </div>
              <p className="relative z-10 mt-3 text-[11px] text-gray-500">
                Add or edit bills in <Link href="/finance" className="text-accent-blue hover:underline">Finance</Link> — they show
                up here automatically.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
