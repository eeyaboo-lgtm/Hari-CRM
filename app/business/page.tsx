"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useSupabaseSynced } from "@/lib/supabase/useSupabaseSynced";
import { Check, ExternalLink, Eye, EyeOff, Pencil, Plus, X } from "lucide-react";

const PROJECTS = [
  { name: "ShelfPulse", url: "https://shelfpulse-j820.onrender.com/", type: "SaaS product" },
  { name: "RetailSuite", url: "https://retailsuite.onrender.com/", type: "SaaS product" },
  { name: "UnwindCircle", url: "https://unwindcircle.com/", type: "Content site" },
  { name: "Dino History", url: "https://dinohistory.com/", type: "Content site" },
];

type Idea = { id: string; text: string; status: "new" | "exploring" | "shipped" };

const STATUS_ORDER: Idea["status"][] = ["new", "exploring", "shipped"];
const STATUS_STYLE: Record<Idea["status"], string> = {
  new: "bg-accent-blue/20 text-accent-blue",
  exploring: "bg-accent-orange/20 text-accent-orange",
  shipped: "bg-accent-green/20 text-accent-green",
};

type StackItem = {
  id: string;
  service: string;
  url: string;
  email: string;
  username: string;
};

const STACK_PRESETS: { service: string; url: string }[] = [
  { service: "Render", url: "https://dashboard.render.com/" },
  { service: "GitHub", url: "https://github.com/" },
  { service: "Supabase", url: "https://supabase.com/dashboard" },
  { service: "Cloudflare", url: "https://dash.cloudflare.com/" },
  { service: "Spaceship.com", url: "https://www.spaceship.com/application/" },
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Masks the tail of a sensitive-ish string (email/username) so it's
// recognizable at a glance but not fully exposed on screen.
function maskTail(value: string) {
  if (!value) return "";
  if (value.length <= 3) return value[0] + "***";
  const visible = Math.max(value.length - 4, 3);
  return value.slice(0, visible) + "***";
}

function StackRow({ item, onUpdate, onRemove }: { item: StackItem; onUpdate: (v: StackItem) => void; onRemove: () => void }) {
  const [reveal, setReveal] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-xl bg-base-card/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <a
          href={item.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-2 text-sm font-medium text-white hover:text-accent-blue"
        >
          <span className="truncate">{item.service}</span>
          <ExternalLink size={12} className="shrink-0 text-gray-500" />
        </a>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setReveal((r) => !r)} className="text-gray-500 hover:text-white" title="Toggle reveal">
            {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button type="button" onClick={() => setEditing((e) => !e)} className="text-xs text-gray-400 hover:text-white">
            {editing ? "Done" : "Edit"}
          </button>
          <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400">
            <X size={14} />
          </button>
        </div>
      </div>

      {!editing ? (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
          {item.email && <span>Email: {reveal ? item.email : maskTail(item.email)}</span>}
          {item.username && <span>User: {reveal ? item.username : maskTail(item.username)}</span>}
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            value={item.url}
            onChange={(e) => onUpdate({ ...item, url: e.target.value })}
            placeholder="Custom URL (e.g. specific repo)"
            className="rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-xs text-gray-100 outline-none focus:border-accent-purple"
          />
          <input
            value={item.email}
            onChange={(e) => onUpdate({ ...item, email: e.target.value })}
            placeholder="Email used"
            className="rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-xs text-gray-100 outline-none focus:border-accent-purple"
          />
          <input
            value={item.username}
            onChange={(e) => onUpdate({ ...item, username: e.target.value })}
            placeholder="Username"
            className="rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-xs text-gray-100 outline-none focus:border-accent-purple"
          />
        </div>
      )}
    </div>
  );
}

function IdeaRow({
  idea,
  onUpdate,
  onCycleStatus,
  onRemove,
}: {
  idea: Idea;
  onUpdate: (v: Idea) => void;
  onCycleStatus: () => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-accent-purple/40 bg-base-card/60 px-3 py-2 text-sm">
        <input
          value={idea.text}
          onChange={(e) => onUpdate({ ...idea, text: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
          autoFocus
          className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <button type="button" onClick={() => setEditing(false)} className="text-accent-green hover:text-white" title="Done">
          <Check size={16} />
        </button>
        <button type="button" onClick={onRemove} className="text-gray-500 hover:text-white" title="Remove">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl bg-base-card/60 px-3 py-2 text-sm">
      <p className="min-w-0 flex-1 truncate text-gray-200">{idea.text}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCycleStatus}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[idea.status]}`}
        >
          {idea.status}
        </button>
        <button type="button" onClick={() => setEditing(true)} className="text-gray-500 hover:text-white" title="Edit">
          <Pencil size={13} />
        </button>
        <button type="button" onClick={onRemove} className="text-gray-500 hover:text-white" title="Remove">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default function BusinessPage() {
  // Business has no per-member split — both household members jointly own
  // every idea/stack entry, so ownerLocalId is always "shared" (-> current
  // user as owner_id, mirrored_edit visibility, either of you can edit).
  const [ideas, setIdeas] = useSupabaseSynced<Idea>("business_ideas", "business.ideas", [], {
    ownerLocalId: () => "shared",
    toRow: (i) => ({ title: i.text, status: i.status }),
    fromRow: (row) => ({ id: row.id, text: row.title, status: (row.status as Idea["status"]) || "new" }),
  });
  // Draft persists to localStorage on every keystroke so nothing typed is
  // ever lost, even if the tab closes before "Add" is clicked.
  const [text, setText] = useLocalStorage<string>("business.ideaDraft", "");
  const [stack, setStack] = useSupabaseSynced<StackItem>("business_stack", "business.stack", [], {
    ownerLocalId: () => "shared",
    toRow: (s) => ({ service: s.service, url: s.url || null, email: s.email || null, username: s.username || null }),
    fromRow: (row) => ({ id: row.id, service: row.service, url: row.url ?? "", email: row.email ?? "", username: row.username ?? "" }),
  });
  const [presetPick, setPresetPick] = useState(STACK_PRESETS[0].service);

  const addIdea = () => {
    if (!text.trim()) return;
    setIdeas((prev) => [...prev, { id: uid(), text: text.trim(), status: "new" }]);
    setText("");
  };
  const cycleStatus = (id: string) => {
    setIdeas((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: STATUS_ORDER[(STATUS_ORDER.indexOf(i.status) + 1) % STATUS_ORDER.length] } : i
      )
    );
  };
  const removeIdea = (id: string) => setIdeas((prev) => prev.filter((i) => i.id !== id));

  const addStackItem = () => {
    const preset = STACK_PRESETS.find((p) => p.service === presetPick);
    setStack((prev) => [
      ...prev,
      { id: uid(), service: preset?.service ?? presetPick, url: preset?.url ?? "", email: "", username: "" },
    ]);
  };
  const updateStackItem = (id: string, v: StackItem) => setStack((prev) => prev.map((s) => (s.id === id ? v : s)));
  const removeStackItem = (id: string) => setStack((prev) => prev.filter((s) => s.id !== id));

  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Business Projects</h1>
          <p className="mt-1 text-sm text-gray-400">
            Sites, stores, socials, program stack, and the idea journal — idea journal and program stack sync
            live to your household database.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {PROJECTS.map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card block rounded-xl2 p-5 transition-colors hover:bg-white/[0.06]"
            >
              <p className="relative z-10 text-xs uppercase tracking-wide text-gray-500">{p.type}</p>
              <h2 className="relative z-10 mt-1 font-medium text-white">{p.name}</h2>
              <p className="relative z-10 mt-1 truncate text-xs text-accent-blue">{p.url}</p>
            </a>
          ))}
        </div>

        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-3 font-medium text-white">Idea journal</h2>
          <div className="relative z-10 mb-4 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addIdea()}
              placeholder="Capture a new idea... (saves as you type)"
              className="min-w-0 flex-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
            <button type="button" onClick={addIdea} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="relative z-10 space-y-2">
            {ideas.length === 0 && (
              <p className="text-xs text-gray-500">No ideas logged yet — click a status pill to cycle new → exploring → shipped.</p>
            )}
            {ideas.map((i) => (
              <IdeaRow
                key={i.id}
                idea={i}
                onUpdate={(v) => setIdeas((prev) => prev.map((x) => (x.id === i.id ? v : x)))}
                onCycleStatus={() => cycleStatus(i.id)}
                onRemove={() => removeIdea(i.id)}
              />
            ))}
          </div>
        </section>

        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-1 font-medium text-white">Program stack</h2>
          <p className="relative z-10 mb-4 text-sm text-gray-400">
            Every tool/service used to build and run these projects, with a clickable shortcut, an optional custom
            URL (e.g. a specific repo), and the account used — email/username shown masked until revealed.
          </p>
          <div className="relative z-10 mb-4 space-y-2">
            {stack.length === 0 && <p className="text-xs text-gray-500">No stack entries yet — add one below.</p>}
            {stack.map((s) => (
              <StackRow key={s.id} item={s} onUpdate={(v) => updateStackItem(s.id, v)} onRemove={() => removeStackItem(s.id)} />
            ))}
          </div>
          <div className="relative z-10 flex gap-2">
            <select
              value={presetPick}
              onChange={(e) => setPresetPick(e.target.value)}
              className="rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
            >
              {STACK_PRESETS.map((p) => (
                <option key={p.service} value={p.service}>
                  {p.service}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>
            <button type="button" onClick={addStackItem} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add to stack
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
