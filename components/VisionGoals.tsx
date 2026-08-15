"use client";

// Life Goals & Trips — bucket-list/travel tracker, shared by default (same
// spirit as the mood board above it: either of you can add/edit/remove).
// Synced live to vision_goals via useSupabaseSynced.
import Link from "next/link";
import { useSupabaseSynced } from "@/lib/supabase/useSupabaseSynced";
import { Plane, Sparkle, Target, Plus, Trash2, ExternalLink, MapPin } from "lucide-react";

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export type GoalType = "trip" | "experience" | "goal";
export type GoalStatus = "idea" | "planned" | "booked" | "done";

export type LifeGoal = {
  id: string;
  type: GoalType;
  title: string;
  target: string; // freeform timeframe, e.g. "2027", "Dec 2026", "Someday"
  notes: string;
  status: GoalStatus;
  ticketPrice: string; // freeform, e.g. "AED 1,200 return, 2 pax"
  link: string; // reference URL (event page, article, etc.)
  // Optional trip cost breakdown, edited on the trip detail sub-page.
  travelers?: number;
  oneWayPerPerson?: number;
  roundTripPerPerson?: number;
  currency?: "AED" | "LKR" | "USD";
};

export const GOALS_STORAGE_KEY = "vision.goals";

export const TYPE_META: Record<GoalType, { label: string; icon: typeof Plane }> = {
  trip: { label: "Trip", icon: Plane },
  experience: { label: "Experience", icon: Sparkle },
  goal: { label: "Life goal", icon: Target },
};

export const STATUS_META: Record<GoalStatus, { label: string; color: string }> = {
  idea: { label: "Idea", color: "bg-white/10 text-gray-300 border-white/10" },
  planned: { label: "Planned", color: "bg-accent-blue/15 text-accent-blue border-accent-blue/30" },
  booked: { label: "Booked", color: "bg-accent-orange/15 text-accent-orange border-accent-orange/30" },
  done: { label: "Done", color: "bg-accent-green/15 text-accent-green border-accent-green/30" },
};

const STATUS_ORDER: GoalStatus[] = ["booked", "planned", "idea", "done"];

function GoalCard({ goal, onUpdate, onRemove }: { goal: LifeGoal; onUpdate: (g: LifeGoal) => void; onRemove: () => void }) {
  const Icon = TYPE_META[goal.type].icon;
  return (
    <div
      className={`rounded-xl2 border border-base-border bg-base-card/40 p-4 ${
        goal.status === "done" ? "opacity-60" : ""
      }`}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-accent-purple">
          <Icon size={16} />
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Title</label>
            <input
              value={goal.title}
              onChange={(e) => onUpdate({ ...goal, title: e.target.value })}
              placeholder="e.g. Japan in cherry blossom season"
              className={`w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm outline-none focus:border-accent-purple ${
                goal.status === "done" ? "text-gray-400 line-through" : "text-gray-100"
              }`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Target</label>
            <input
              value={goal.target}
              onChange={(e) => onUpdate({ ...goal, target: e.target.value })}
              placeholder="e.g. 2027, Dec 2026, Someday"
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Type</label>
            <select
              value={goal.type}
              onChange={(e) => onUpdate({ ...goal, type: e.target.value as GoalType })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            >
              {(Object.keys(TYPE_META) as GoalType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_META[t].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Status</label>
            <select
              value={goal.status}
              onChange={(e) => onUpdate({ ...goal, status: e.target.value as GoalStatus })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            >
              {(Object.keys(STATUS_META) as GoalStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" onClick={onRemove} className="mt-1 shrink-0 text-gray-500 hover:text-red-400" title="Remove">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Ticket / cost estimate</label>
          <input
            value={goal.ticketPrice}
            onChange={(e) => onUpdate({ ...goal, ticketPrice: e.target.value })}
            placeholder="e.g. AED 1,200 return, 2 pax"
            className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Reference link</label>
          <div className="flex items-center gap-1.5">
            <input
              value={goal.link}
              onChange={(e) => onUpdate({ ...goal, link: e.target.value })}
              placeholder="https://..."
              className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
            {goal.link && (
              <a href={goal.link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-gray-400 hover:text-white" title="Open">
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">Notes</label>
        <textarea
          value={goal.notes}
          onChange={(e) => onUpdate({ ...goal, notes: e.target.value })}
          placeholder="Budget, who's coming, must-see list, requirements..."
          rows={2}
          className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className={`relative z-10 inline-block rounded-full border px-2.5 py-0.5 text-xs ${STATUS_META[goal.status].color}`}>
          {STATUS_META[goal.status].label}
        </span>
        {goal.type !== "goal" && (
          <Link
            href={`/vision/trip/${goal.id}`}
            className="relative z-10 flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs text-accent-blue hover:bg-white/10 hover:text-white"
          >
            <MapPin size={12} /> Plan this {goal.type === "trip" ? "trip" : "experience"}
          </Link>
        )}
      </div>
    </div>
  );
}

// Exported so the /vision/trip/[id] sub-page can read/write the exact same
// Supabase-backed array (single source of truth, no separate store).
export const visionGoalsMapper = {
  ownerLocalId: () => "shared",
  toRow: (g: LifeGoal) => ({
    goal_type: g.type, title: g.title, target: g.target || null, notes: g.notes || null, status: g.status,
    ticket_price: g.ticketPrice || null, link: g.link || null, travelers: g.travelers ?? null,
    one_way_per_person: g.oneWayPerPerson ?? null, round_trip_per_person: g.roundTripPerPerson ?? null,
    currency: g.currency ?? null,
  }),
  fromRow: (row: any): LifeGoal => ({
    id: row.id, type: row.goal_type, title: row.title, target: row.target ?? "", notes: row.notes ?? "",
    status: row.status, ticketPrice: row.ticket_price ?? "", link: row.link ?? "",
    travelers: row.travelers ?? undefined, oneWayPerPerson: row.one_way_per_person != null ? Number(row.one_way_per_person) : undefined,
    roundTripPerPerson: row.round_trip_per_person != null ? Number(row.round_trip_per_person) : undefined,
    currency: row.currency ?? undefined,
  }),
};

export default function VisionGoals() {
  const [goals, setGoals] = useSupabaseSynced<LifeGoal>("vision_goals", GOALS_STORAGE_KEY, [], visionGoalsMapper);

  const addGoal = (type: GoalType) => {
    setGoals((prev) => [
      { id: uid(), type, title: "", target: "", notes: "", status: "idea", ticketPrice: "", link: "" },
      ...prev,
    ]);
  };
  const updateGoal = (id: string, g: LifeGoal) => setGoals((prev) => prev.map((x) => (x.id === id ? g : x)));
  const removeGoal = (id: string) => setGoals((prev) => prev.filter((x) => x.id !== id));

  const sorted = [...goals].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const doneCount = goals.filter((g) => g.status === "done").length;

  return (
    <section className="glass-card rounded-xl2 p-5">
      <div className="relative z-10 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-white">Life goals &amp; trips</h2>
          <p className="mt-1 text-sm text-gray-400">
            Bucket list, travel plans, and shared experiences — shared by default.
            {goals.length > 0 ? ` ${doneCount}/${goals.length} done.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addGoal("trip")}
            className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white"
          >
            <Plus size={14} /> Trip
          </button>
          <button
            type="button"
            onClick={() => addGoal("experience")}
            className="flex items-center gap-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-200 hover:border-accent-purple"
          >
            <Plus size={14} /> Experience
          </button>
          <button
            type="button"
            onClick={() => addGoal("goal")}
            className="flex items-center gap-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-200 hover:border-accent-purple"
          >
            <Plus size={14} /> Life goal
          </button>
        </div>
      </div>
      <div className="relative z-10 space-y-3">
        {sorted.length === 0 && <p className="text-xs text-gray-500">Nothing on the list yet — add a trip, experience, or goal above.</p>}
        {sorted.map((g) => (
          <GoalCard key={g.id} goal={g} onUpdate={(v) => updateGoal(g.id, v)} onRemove={() => removeGoal(g.id)} />
        ))}
      </div>
    </section>
  );
}
