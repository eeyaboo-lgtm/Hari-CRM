"use client";

// In-depth trip/experience planning sub-page — opened via "Plan this
// trip/experience" on a Vision Goals card. Reads/writes the same
// vision.goals localStorage array (single source of truth, no separate
// store) so edits here and on the Vision page stay in sync.
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { useLocalStorage } from "@/lib/useLocalStorage";
import {
  GOALS_STORAGE_KEY,
  STATUS_META,
  TYPE_META,
  type LifeGoal,
  type GoalStatus,
} from "@/components/VisionGoals";
import { formatMoney } from "@/lib/financeUtils";
import { ArrowLeft, ExternalLink } from "lucide-react";

const TRAVEL_SITES: { name: string; url: string }[] = [
  { name: "MakeMyTrip", url: "https://www.makemytrip.com/" },
  { name: "Expedia", url: "https://www.expedia.com/" },
  { name: "Booking.com", url: "https://www.booking.com/" },
  { name: "Trivago", url: "https://www.trivago.com/" },
  { name: "Agoda", url: "https://www.agoda.com/" },
  { name: "TripAdvisor", url: "https://www.tripadvisor.com/" },
  { name: "Airbnb", url: "https://www.airbnb.com/" },
  { name: "Skyscanner", url: "https://www.skyscanner.com/" },
  { name: "Kayak", url: "https://www.kayak.com/" },
  { name: "Google Flights", url: "https://www.google.com/travel/flights" },
  { name: "Hotels.com", url: "https://www.hotels.com/" },
];

const EXPERIENCE_SITES: { region: string; sites: { name: string; url: string }[] }[] = [
  {
    region: "UAE",
    sites: [
      { name: "Platinumlist", url: "https://platinumlist.net/" },
      { name: "Cobone", url: "https://www.cobone.com/" },
      { name: "Groupon UAE", url: "https://www.groupon.ae/" },
      { name: "Fever", url: "https://feverup.com/" },
    ],
  },
  {
    region: "Sri Lanka",
    sites: [
      { name: "MyTickets.lk", url: "https://mytickets.lk/" },
      { name: "Tickets.lk", url: "https://www.tickets.lk/" },
      { name: "TicketsMinistry", url: "https://www.ticketsministry.com/" },
      { name: "Spotseeker.lk", url: "https://www.spotseeker.lk/" },
    ],
  },
  {
    region: "US",
    sites: [
      { name: "Eventbrite", url: "https://www.eventbrite.com/" },
      { name: "Groupon", url: "https://www.groupon.com/" },
      { name: "Viator", url: "https://www.viator.com/" },
      { name: "GetYourGuide", url: "https://www.getyourguide.com/" },
    ],
  },
];

function SiteGrid({ sites }: { sites: { name: string; url: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {sites.map((s) => (
        <a
          key={s.name}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-1.5 rounded-xl border border-base-border bg-base-card/60 px-3 py-2 text-sm text-gray-200 hover:border-accent-purple hover:text-white"
        >
          <span className="truncate">{s.name}</span>
          <ExternalLink size={12} className="shrink-0 text-gray-500" />
        </a>
      ))}
    </div>
  );
}

export default function TripDetailPage({ params }: { params: { id: string } }) {
  const [goals, setGoals] = useLocalStorage<LifeGoal[]>(GOALS_STORAGE_KEY, []);
  const goal = goals.find((g) => g.id === params.id);

  const update = (patch: Partial<LifeGoal>) => {
    setGoals((prev) => prev.map((g) => (g.id === params.id ? { ...g, ...patch } : g)));
  };

  if (!goal) {
    return (
      <div className="flex min-h-screen bg-base-bg">
        <Sidebar />
        <main className="flex-1 space-y-4 p-6">
          <Link href="/vision" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
            <ArrowLeft size={14} /> Back to Vision
          </Link>
          <p className="text-sm text-gray-500">
            Couldn&rsquo;t find that entry — it may have been removed, or this device&rsquo;s local storage was
            cleared. Head back to Vision to pick another one.
          </p>
        </main>
      </div>
    );
  }

  const currency = goal.currency ?? "AED";
  const travelers = goal.travelers ?? 1;
  const oneWay = goal.oneWayPerPerson ?? 0;
  const roundTrip = goal.roundTripPerPerson ?? 0;
  const oneWayTotal = oneWay * travelers;
  const roundTripTotal = roundTrip * travelers;

  const Icon = TYPE_META[goal.type].icon;

  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <div>
          <Link href="/vision" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
            <ArrowLeft size={14} /> Back to Vision
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-accent-purple">
              <Icon size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">{goal.title || "Untitled"}</h1>
              <p className="text-sm text-gray-400">
                {TYPE_META[goal.type].label} · {goal.target || "No target date set"}
              </p>
            </div>
            <span className={`ml-auto rounded-full border px-3 py-1 text-xs ${STATUS_META[goal.status].color}`}>
              {STATUS_META[goal.status].label}
            </span>
          </div>
        </div>

        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-3 font-medium text-white">Basics</h2>
          <div className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Title</label>
              <input
                value={goal.title}
                onChange={(e) => update({ title: e.target.value })}
                className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Target timeframe</label>
              <input
                value={goal.target}
                onChange={(e) => update({ target: e.target.value })}
                placeholder="e.g. 2027, Dec 2026, Someday"
                className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Status</label>
              <select
                value={goal.status}
                onChange={(e) => update({ status: e.target.value as GoalStatus })}
                className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
              >
                {(Object.keys(STATUS_META) as GoalStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Reference link</label>
              <div className="flex items-center gap-1.5">
                <input
                  value={goal.link}
                  onChange={(e) => update({ link: e.target.value })}
                  placeholder="https://..."
                  className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
                />
                {goal.link && (
                  <a href={goal.link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-gray-400 hover:text-white">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {goal.type === "trip" && (
          <section className="glass-card rounded-xl2 p-5">
            <h2 className="relative z-10 mb-3 font-medium text-white">Cost breakdown</h2>
            <div className="relative z-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Travelers</label>
                <input
                  type="number"
                  min={1}
                  value={travelers}
                  onChange={(e) => update({ travelers: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => update({ currency: e.target.value as LifeGoal["currency"] })}
                  className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none"
                >
                  <option>AED</option>
                  <option>LKR</option>
                  <option>USD</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">One-way / person</label>
                <input
                  type="number"
                  value={oneWay || ""}
                  onChange={(e) => update({ oneWayPerPerson: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Round-trip / person</label>
                <input
                  type="number"
                  value={roundTrip || ""}
                  onChange={(e) => update({ roundTripPerPerson: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
                />
              </div>
            </div>
            <div className="relative z-10 mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-base-border pt-3 text-sm text-gray-300">
              <span>One-way total ({travelers} pax): <span className="font-medium text-white">{formatMoney(oneWayTotal, currency)}</span></span>
              <span>Round-trip total ({travelers} pax): <span className="font-medium text-white">{formatMoney(roundTripTotal, currency)}</span></span>
            </div>
          </section>
        )}

        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-1 font-medium text-white">
            {goal.type === "trip" ? "Start researching" : "Ticket sites"}
          </h2>
          <p className="relative z-10 mb-4 text-xs text-gray-500">
            {goal.type === "trip"
              ? "Opens in a new tab — search flights, stays, and packages."
              : "Grouped by region — pick whichever applies to this experience."}
          </p>
          <div className="relative z-10">
            {goal.type === "trip" ? (
              <SiteGrid sites={TRAVEL_SITES} />
            ) : (
              <div className="space-y-4">
                {EXPERIENCE_SITES.map((g) => (
                  <div key={g.region}>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">{g.region}</p>
                    <SiteGrid sites={g.sites} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-3 font-medium text-white">Notes</h2>
          <textarea
            value={goal.notes}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Research notes, must-see list, accommodation ideas, who's coming..."
            rows={5}
            className="relative z-10 w-full rounded-lg border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
        </section>
      </main>
    </div>
  );
}
